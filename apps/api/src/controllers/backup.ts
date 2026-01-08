import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { prisma } from '../services/prisma.js'
import {
  uploadToBackupBucket,
  downloadFromBackupBucket,
  listBackupObjects,
  deleteFromBackupBucket,
  isOCIConfigured,
} from '../services/oci.js'

const BACKUP_FOLDER = 'backups'

interface PostWithTags {
  id: string
  tags: { id: string }[]
  [key: string]: unknown
}

interface BackupData {
  version: string
  createdAt: string
  data: {
    users: unknown[]
    categories: unknown[]
    tags: unknown[]
    posts: unknown[]
    pages: unknown[]
    comments: unknown[]
  }
}

// Create backup
export async function createBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    // Fetch all data
    const [users, categories, tags, posts, pages, comments] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          bio: true,
          title: true,
          github: true,
          twitter: true,
          linkedin: true,
          website: true,
          createdAt: true,
        },
      }),
      prisma.category.findMany(),
      prisma.tag.findMany(),
      prisma.post.findMany({
        include: {
          tags: { select: { id: true } },
        },
      }),
      prisma.page.findMany(),
      prisma.comment.findMany({
        select: {
          id: true,
          content: true,
          guestName: true,
          // guestPassword excluded for security
          isPrivate: true,
          isDeleted: true,
          postId: true,
          authorId: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ])

    const backupData: BackupData = {
      version: '1.1',
      createdAt: new Date().toISOString(),
      data: {
        users,
        categories,
        tags,
        posts: posts.map((post: PostWithTags) => ({
          ...post,
          tagIds: post.tags.map((t: { id: string }) => t.id),
          tags: undefined,
        })),
        pages,
        comments,
      },
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup_${timestamp}.json`

    // Upload to backup bucket
    const buffer = Buffer.from(JSON.stringify(backupData, null, 2), 'utf-8')
    const objectPath = await uploadToBackupBucket(fileName, buffer, 'application/json', BACKUP_FOLDER)

    res.json({
      data: {
        success: true,
        fileName,
        objectPath,
        createdAt: backupData.createdAt,
        stats: {
          users: users.length,
          categories: categories.length,
          tags: tags.length,
          posts: posts.length,
          pages: pages.length,
          comments: comments.length,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// List backups
export async function listBackups(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    const objects = await listBackupObjects(BACKUP_FOLDER)
    const backups = objects
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        // Extract timestamp from filename: backup_2024-01-15T10-30-00-000Z.json
        // Original format was: 2024-01-15T10:30:00.000Z (colons and dots replaced with hyphens)
        const match = name.match(/backup_(.+)\.json$/)
        let createdAt: string | null = null

        if (match && match[1]) {
          try {
            // Convert: 2024-01-15T10-30-00-000Z → 2024-01-15T10:30:00.000Z
            const ts = match[1]
            // Format: YYYY-MM-DDTHH-MM-SS-mmmZ
            const parsed = ts.replace(
              /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
              '$1T$2:$3:$4.$5Z'
            )
            const date = new Date(parsed)
            if (!isNaN(date.getTime())) {
              createdAt = date.toISOString()
            }
          } catch {
            // Ignore parsing errors
          }
        }

        return {
          name: name.split('/').pop(),
          fullPath: name,
          createdAt,
        }
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

    res.json({ data: backups })
  } catch (error) {
    next(error)
  }
}

// Download backup
export async function downloadBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    const { fileName } = req.params
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400)
    }

    const objectName = `${BACKUP_FOLDER}/${fileName}`
    const buffer = await downloadFromBackupBucket(objectName)

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

// Restore from backup
export async function restoreBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    const { fileName } = req.params
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400)
    }

    const objectName = `${BACKUP_FOLDER}/${fileName}`
    const buffer = await downloadFromBackupBucket(objectName)
    const backupData: BackupData = JSON.parse(buffer.toString('utf-8'))

    if (!backupData.version || !backupData.data) {
      throw new AppError('유효하지 않은 백업 파일입니다.', 400)
    }

    // Restore data in transaction
    await prisma.$transaction(async (tx) => {
      // Clear existing data (except current admin user)
      // Delete in order respecting foreign key constraints
      await tx.comment.deleteMany({})
      await tx.post.deleteMany({})
      await tx.page.deleteMany({})
      await tx.tag.deleteMany({})
      await tx.category.deleteMany({})

      // Restore categories
      if (backupData.data.categories?.length) {
        for (const category of backupData.data.categories) {
          await tx.category.create({ data: category as never })
        }
      }

      // Restore tags
      if (backupData.data.tags?.length) {
        for (const tag of backupData.data.tags) {
          await tx.tag.create({ data: tag as never })
        }
      }

      // Restore pages
      if (backupData.data.pages?.length) {
        for (const page of backupData.data.pages) {
          await tx.page.create({ data: page as never })
        }
      }

      // Restore posts with tag connections
      if (backupData.data.posts?.length) {
        for (const post of backupData.data.posts) {
          const { tagIds, ...postData } = post as { tagIds?: string[] } & Record<string, unknown>
          await tx.post.create({
            data: {
              ...postData,
              tags: tagIds?.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
            } as never,
          })
        }
      }

      // Restore comments (parent comments first, then replies)
      if (backupData.data.comments?.length) {
        const comments = backupData.data.comments as Array<{ parentId?: string | null } & Record<string, unknown>>
        // First, create parent comments (no parentId)
        const parentComments = comments.filter(c => !c.parentId)
        const replyComments = comments.filter(c => c.parentId)

        for (const comment of parentComments) {
          await tx.comment.create({ data: comment as never })
        }
        // Then, create reply comments
        for (const comment of replyComments) {
          await tx.comment.create({ data: comment as never })
        }
      }
    })

    res.json({
      data: {
        success: true,
        message: '백업이 복원되었습니다.',
        restoredAt: new Date().toISOString(),
        stats: {
          categories: backupData.data.categories?.length || 0,
          tags: backupData.data.tags?.length || 0,
          posts: backupData.data.posts?.length || 0,
          pages: backupData.data.pages?.length || 0,
          comments: backupData.data.comments?.length || 0,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// Delete backup
export async function deleteBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    const { fileName } = req.params
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400)
    }

    const objectName = `${BACKUP_FOLDER}/${fileName}`
    await deleteFromBackupBucket(objectName)

    res.json({
      data: {
        success: true,
        message: '백업이 삭제되었습니다.',
      },
    })
  } catch (error) {
    next(error)
  }
}
