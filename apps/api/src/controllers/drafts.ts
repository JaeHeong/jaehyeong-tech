import type { Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'
import slugifyLib from 'slugify'
import { updateFeaturedPost } from './posts.js'

type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string
const slugify: SlugifyFn = (slugifyLib as unknown as { default?: SlugifyFn }).default || (slugifyLib as unknown as SlugifyFn)

// Admin: Get all drafts
export async function getDrafts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    const drafts = await prisma.draft.findMany({
      where: { authorId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    })

    res.json({ data: drafts })
  } catch (error) {
    next(error)
  }
}

// Admin: Get draft by ID
export async function getDraftById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    const { id } = req.params

    const draft = await prisma.draft.findUnique({
      where: { id },
    })

    if (!draft) {
      throw new AppError('초안을 찾을 수 없습니다.', 404)
    }

    if (draft.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    res.json({ data: draft })
  } catch (error) {
    next(error)
  }
}

// Admin: Create draft
export async function createDraft(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    const { title, content, excerpt, coverImage, categoryId, tagIds } = req.body

    const draft = await prisma.draft.create({
      data: {
        title: title || null,
        content: content || '',
        excerpt: excerpt || null,
        coverImage: coverImage || null,
        categoryId: categoryId || null,
        tagIds: tagIds || [],
        authorId: req.user.id,
      },
    })

    res.status(201).json({ data: draft })
  } catch (error) {
    next(error)
  }
}

// Admin: Update draft
export async function updateDraft(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    const { id } = req.params
    const { title, content, excerpt, coverImage, categoryId, tagIds } = req.body

    const existing = await prisma.draft.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError('초안을 찾을 수 없습니다.', 404)
    }

    if (existing.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    const draft = await prisma.draft.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        content: content !== undefined ? content : existing.content,
        excerpt: excerpt !== undefined ? excerpt : existing.excerpt,
        coverImage: coverImage !== undefined ? coverImage : existing.coverImage,
        categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        tagIds: tagIds !== undefined ? tagIds : existing.tagIds,
      },
    })

    res.json({ data: draft })
  } catch (error) {
    next(error)
  }
}

// Admin: Delete draft
export async function deleteDraft(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    const { id } = req.params

    const existing = await prisma.draft.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError('초안을 찾을 수 없습니다.', 404)
    }

    if (existing.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    await prisma.draft.delete({ where: { id } })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

// Admin: Publish draft as post
export async function publishDraft(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    const { id } = req.params
    const { status, categoryId, tagIds, publishedAt } = req.body

    const draft = await prisma.draft.findUnique({ where: { id } })
    if (!draft) {
      throw new AppError('초안을 찾을 수 없습니다.', 404)
    }

    // Validation for publishing
    if (!draft.title?.trim()) {
      throw new AppError('제목을 입력해주세요.', 400)
    }
    if (!draft.content?.trim() || draft.content === '<p></p>') {
      throw new AppError('내용을 입력해주세요.', 400)
    }

    const finalCategoryId = categoryId || draft.categoryId
    if (!finalCategoryId) {
      throw new AppError('카테고리를 선택해주세요.', 400)
    }

    // Generate slug from title
    let slug = slugify(draft.title, { lower: true, strict: true })

    // If slug is empty (e.g., Korean-only title), use timestamp
    if (!slug) {
      slug = `post-${Date.now()}`
    }

    // Check for duplicate slug and make unique if needed
    const existingPost = await prisma.post.findUnique({ where: { slug } })
    if (existingPost) {
      slug = `${slug}-${Date.now()}`
    }

    // Calculate reading time
    const wordCount = draft.content.split(/\s+/).length
    const readingTime = Math.ceil(wordCount / 200)

    // Extract text for excerpt if not provided
    let excerpt = draft.excerpt
    if (!excerpt) {
      const tempDiv = draft.content.replace(/<[^>]*>/g, ' ')
      excerpt = tempDiv.slice(0, 200)
    }

    const finalTagIds = tagIds || draft.tagIds || []

    // Create post from draft
    const post = await prisma.post.create({
      data: {
        slug,
        title: draft.title,
        excerpt,
        content: draft.content,
        coverImage: draft.coverImage,
        readingTime,
        status: status || 'PUBLIC',
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        author: { connect: { id: req.user.id } },
        category: { connect: { id: finalCategoryId } },
        tags: finalTagIds.length > 0 ? { connect: finalTagIds.map((tagId: string) => ({ id: tagId })) } : undefined,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: true,
        tags: true,
      },
    })

    // Link images to the post
    const imageUrls = extractImageUrls(draft.content, draft.coverImage)
    if (imageUrls.length > 0) {
      for (const url of imageUrls) {
        await prisma.image.updateMany({
          where: { url },
          data: { postId: post.id },
        })
      }
    }

    // Delete the draft after successful publish
    await prisma.draft.delete({ where: { id } })

    // Update featured post
    await updateFeaturedPost()

    res.status(201).json({ data: post })
  } catch (error) {
    next(error)
  }
}

// Helper function to extract image URLs from content
function extractImageUrls(content: string, coverImage?: string | null): string[] {
  const urls: string[] = []

  // Extract from HTML img tags
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi
  let match
  while ((match = imgRegex.exec(content)) !== null) {
    if (match[1]) urls.push(match[1])
  }

  // Also check for markdown-style images
  const mdRegex = /!\[[^\]]*\]\(([^)]+)\)/gi
  while ((match = mdRegex.exec(content)) !== null) {
    if (match[1]) urls.push(match[1])
  }

  // Add cover image if exists
  if (coverImage) urls.push(coverImage)

  return [...new Set(urls)]
}
