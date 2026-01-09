import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import type { Image } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { prisma } from '../services/prisma.js'
import { deleteFromOCI, isOCIConfigured } from '../services/oci.js'

// Extract image URLs from draft content and coverImage
async function getImageUrlsUsedInDrafts(): Promise<Set<string>> {
  const drafts = await prisma.draft.findMany({
    select: { content: true, coverImage: true },
  })

  const urls = new Set<string>()

  for (const draft of drafts) {
    // Extract coverImage
    if (draft.coverImage) {
      urls.add(draft.coverImage)
    }

    // Extract image URLs from content (markdown and HTML)
    if (draft.content) {
      // Markdown: ![alt](url)
      const mdMatches = draft.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)
      for (const match of mdMatches) {
        if (match[1]) urls.add(match[1])
      }

      // HTML: <img src="url">
      const htmlMatches = draft.content.matchAll(/<img[^>]+src=["']([^"']+)["']/g)
      for (const match of htmlMatches) {
        if (match[1]) urls.add(match[1])
      }
    }
  }

  return urls
}

// Get orphan images (images not linked to any post/draft and older than 24 hours)
export async function getOrphanImages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get images not linked to any post and older than 24 hours
    const candidates = await prisma.image.findMany({
      where: {
        postId: null,
        createdAt: {
          lt: twentyFourHoursAgo,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter out images used in drafts
    const draftImageUrls = await getImageUrlsUsedInDrafts()
    const orphans = candidates.filter((img) => !draftImageUrls.has(img.url))

    // Get all unlinked images (for usedInDrafts calculation)
    const allUnlinkedImages = await prisma.image.findMany({
      where: { postId: null },
      select: { url: true },
    })

    // Count images used in drafts (among all unlinked images, not just old ones)
    const usedInDrafts = allUnlinkedImages.filter((img) => draftImageUrls.has(img.url)).length

    // Get stats
    const [total, linked, totalSizeResult] = await Promise.all([
      prisma.image.count(),
      prisma.image.count({ where: { postId: { not: null } } }),
      prisma.image.aggregate({ _sum: { size: true } }),
    ])

    const orphanSize = orphans.reduce((sum: number, img: Image) => sum + img.size, 0)

    res.json({
      data: {
        orphans: orphans.map((img: Image) => ({
          id: img.id,
          url: img.url,
          objectName: img.objectName,
          filename: img.filename,
          size: img.size,
          createdAt: img.createdAt.toISOString(),
        })),
        stats: {
          total,
          linked,
          usedInDrafts,
          orphaned: orphans.length,
          totalSize: totalSizeResult._sum.size || 0,
          orphanSize,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// Delete orphan images
export async function deleteOrphanImages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get images not linked to any post and older than 24 hours
    const candidates = await prisma.image.findMany({
      where: {
        postId: null,
        createdAt: {
          lt: twentyFourHoursAgo,
        },
      },
    })

    // Filter out images used in drafts
    const draftImageUrls = await getImageUrlsUsedInDrafts()
    const orphans = candidates.filter((img) => !draftImageUrls.has(img.url))

    if (orphans.length === 0) {
      return res.json({
        data: {
          deleted: 0,
          freedSpace: 0,
        },
      })
    }

    let freedSpace = 0
    const deleteErrors: string[] = []

    // Delete from OCI if configured
    if (isOCIConfigured()) {
      for (const image of orphans) {
        try {
          await deleteFromOCI(image.objectName)
          freedSpace += image.size
        } catch (error) {
          console.error(`Failed to delete from OCI: ${image.objectName}`, error)
          deleteErrors.push(image.objectName)
        }
      }
    }

    // Delete from database (only successfully deleted from OCI or if OCI not configured)
    const idsToDelete = orphans
      .filter((img: Image) => !deleteErrors.includes(img.objectName))
      .map((img: Image) => img.id)

    if (idsToDelete.length > 0) {
      await prisma.image.deleteMany({
        where: { id: { in: idsToDelete } },
      })
    }

    res.json({
      data: {
        deleted: idsToDelete.length,
        freedSpace,
        errors: deleteErrors.length > 0 ? deleteErrors : undefined,
      },
    })
  } catch (error) {
    next(error)
  }
}
