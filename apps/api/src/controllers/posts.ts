import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'
import slugifyLib from 'slugify'
import { deleteFromOCI, isOCIConfigured } from '../services/oci.js'

type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string
const slugify: SlugifyFn = (slugifyLib as unknown as { default?: SlugifyFn }).default || (slugifyLib as unknown as SlugifyFn)

// Helper function to extract image URLs from post content
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

  return [...new Set(urls)] // Remove duplicates
}

// Link images to a post
async function linkImagesToPost(postId: string, content: string, coverImage?: string | null) {
  const imageUrls = extractImageUrls(content, coverImage)

  if (imageUrls.length === 0) return

  // First, unlink all images from this post (for update scenarios)
  await prisma.image.updateMany({
    where: { postId },
    data: { postId: null },
  })

  // Link images that match the URLs in the content
  for (const url of imageUrls) {
    await prisma.image.updateMany({
      where: { url },
      data: { postId },
    })
  }
}

export async function getPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const category = req.query.category as string
    const tag = req.query.tag as string
    const search = req.query.search as string

    const where: Record<string, unknown> = { published: true }

    if (category) {
      where.category = { slug: category }
    }

    if (tag) {
      where.tags = { some: { slug: tag } }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: true,
          tags: true,
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    res.json({
      data: posts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getFeaturedPosts(_req: Request, res: Response, next: NextFunction) {
  try {
    const posts = await prisma.post.findMany({
      where: { published: true, featured: true },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    })

    res.json({ data: posts })
  } catch (error) {
    next(error)
  }
}

export async function getPostBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params

    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, avatar: true, bio: true } },
        category: true,
        tags: true,
      },
    })

    if (!post) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    if (!post.published) {
      const authReq = req as AuthRequest
      if (!authReq.user || (authReq.user.role !== 'ADMIN' && authReq.user.id !== post.authorId)) {
        throw new AppError('게시글을 찾을 수 없습니다.', 404)
      }
    }

    // Increment view count
    await prisma.post.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    })

    res.json({ data: { ...post, viewCount: post.viewCount + 1 } })
  } catch (error) {
    next(error)
  }
}

export async function createPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { title, excerpt, content, coverImage, categoryId, tagIds, published, featured } = req.body

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const slug = slugify(title, { lower: true, strict: true })

    // Check for duplicate slug
    const existing = await prisma.post.findUnique({ where: { slug } })
    if (existing) {
      throw new AppError('이미 같은 제목의 게시글이 있습니다.', 400)
    }

    // Calculate reading time (average 200 words per minute)
    const wordCount = content.split(/\s+/).length
    const readingTime = Math.ceil(wordCount / 200)

    // Handle custom publishedAt or use current time
    let postPublishedAt: Date | null = null
    if (published) {
      postPublishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : new Date()
    }

    const post = await prisma.post.create({
      data: {
        slug,
        title,
        excerpt,
        content,
        coverImage,
        readingTime,
        published: published || false,
        featured: featured || false,
        publishedAt: postPublishedAt,
        author: { connect: { id: req.user.id } },
        category: { connect: { id: categoryId } },
        tags: tagIds ? { connect: tagIds.map((id: string) => ({ id })) } : undefined,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: true,
        tags: true,
      },
    })

    // Link images to the post
    await linkImagesToPost(post.id, content, coverImage)

    res.status(201).json({ data: post })
  } catch (error) {
    next(error)
  }
}

export async function updatePost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { title, excerpt, content, coverImage, categoryId, tagIds, published, featured } = req.body

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    if (req.user.role !== 'ADMIN' && req.user.id !== existing.authorId) {
      throw new AppError('수정 권한이 없습니다.', 403)
    }

    const updateData: Record<string, unknown> = {}

    if (title && title !== existing.title) {
      updateData.title = title
      updateData.slug = slugify(title, { lower: true, strict: true })
    }
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (content !== undefined) {
      updateData.content = content
      const wordCount = content.split(/\s+/).length
      updateData.readingTime = Math.ceil(wordCount / 200)
    }
    if (coverImage !== undefined) updateData.coverImage = coverImage
    if (categoryId) updateData.category = { connect: { id: categoryId } }
    if (published !== undefined) {
      updateData.published = published
      // Allow custom publishedAt or set to now if publishing for first time
      if (req.body.publishedAt !== undefined) {
        updateData.publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : null
      } else if (published && !existing.publishedAt) {
        updateData.publishedAt = new Date()
      }
    }
    if (featured !== undefined) updateData.featured = featured

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...updateData,
        tags: tagIds ? { set: tagIds.map((tagId: string) => ({ id: tagId })) } : undefined,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: true,
        tags: true,
      },
    })

    // Re-link images to the post based on current content
    const finalContent = content !== undefined ? content : existing.content
    const finalCoverImage = coverImage !== undefined ? coverImage : existing.coverImage
    await linkImagesToPost(post.id, finalContent, finalCoverImage)

    res.json({ data: post })
  } catch (error) {
    next(error)
  }
}

export async function deletePost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    if (req.user.role !== 'ADMIN' && req.user.id !== existing.authorId) {
      throw new AppError('삭제 권한이 없습니다.', 403)
    }

    // Get all images linked to this post
    const images = await prisma.image.findMany({
      where: { postId: id },
    })

    // Delete images from OCI
    if (isOCIConfigured() && images.length > 0) {
      for (const image of images) {
        try {
          await deleteFromOCI(image.objectName)
        } catch (error) {
          console.error(`Failed to delete image from OCI: ${image.objectName}`, error)
        }
      }
    }

    // Delete image records from database
    await prisma.image.deleteMany({ where: { postId: id } })

    // Delete the post
    await prisma.post.delete({ where: { id } })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

