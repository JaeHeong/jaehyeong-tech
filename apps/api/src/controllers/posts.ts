import type { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'
import slugifyLib from 'slugify'
import { deleteFromOCI, isOCIConfigured } from '../services/oci.js'

// Hash IP address for unique view tracking
function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-production'
  return crypto.createHash('sha256').update(ip + salt).digest('hex')
}

// Get client IP (considering reverse proxy)
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
  }
  return req.ip || 'unknown'
}

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

// Public: Get posts
// status filter:
//   없음 or 'PUBLIC' → PUBLIC만 (공개 페이지용)
//   'DRAFT' → admin만, DRAFT만 (임시저장)
//   'PUBLISHED' → admin만, PUBLIC + PRIVATE (발행된 것)
//   'PRIVATE' → admin만, PRIVATE만
//   'ALL' → admin만, 모든 상태
export async function getPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const category = req.query.category as string
    const tag = req.query.tag as string
    const search = req.query.search as string
    const statusFilter = req.query.status as string
    const sortBy = req.query.sortBy as string

    const authReq = req as AuthRequest
    const isAdmin = authReq.user?.role === 'ADMIN'

    const where: Record<string, unknown> = {}
    let orderByField: 'publishedAt' | 'updatedAt' | 'viewCount' = 'publishedAt'

    // Support sorting by viewCount for popular posts
    if (sortBy === 'viewCount') {
      orderByField = 'viewCount'
    }

    if (statusFilter === 'DRAFT') {
      if (!isAdmin) throw new AppError('권한이 없습니다.', 403)
      where.status = 'DRAFT'
      if (!sortBy) orderByField = 'updatedAt'
    } else if (statusFilter === 'PUBLISHED') {
      // 발행된 것: PUBLIC + PRIVATE
      if (!isAdmin) throw new AppError('권한이 없습니다.', 403)
      where.status = { in: ['PUBLIC', 'PRIVATE'] }
    } else if (statusFilter === 'PRIVATE') {
      if (!isAdmin) throw new AppError('권한이 없습니다.', 403)
      where.status = 'PRIVATE'
    } else if (statusFilter === 'ALL') {
      if (!isAdmin) throw new AppError('권한이 없습니다.', 403)
      // No filter
      if (!sortBy) orderByField = 'updatedAt'
    } else {
      // Default: PUBLIC only (공개 페이지)
      where.status = 'PUBLIC'
    }

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
        orderBy: { [orderByField]: 'desc' },
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

// Public: Get featured posts (PUBLIC only)
export async function getFeaturedPosts(_req: Request, res: Response, next: NextFunction) {
  try {
    const posts = await prisma.post.findMany({
      where: { status: 'PUBLIC', featured: true },
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

// Public: Get top post by view count for a category (or overall if no category)
export async function getTopViewedPost(req: Request, res: Response, next: NextFunction) {
  try {
    const categorySlug = req.query.category as string

    const where: Record<string, unknown> = { status: 'PUBLIC' }
    if (categorySlug) {
      where.category = { slug: categorySlug }
    }

    const post = await prisma.post.findFirst({
      where,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: true,
        tags: true,
      },
      orderBy: { viewCount: 'desc' },
    })

    res.json({ data: post })
  } catch (error) {
    next(error)
  }
}

// Public: Get post by slug
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

    // Only PUBLIC posts are visible to non-admin
    // PRIVATE posts are visible only to admin
    // DRAFT posts are visible only to admin (but normally accessed via getPostById)
    if (post.status !== 'PUBLIC') {
      const authReq = req as AuthRequest
      if (!authReq.user || authReq.user.role !== 'ADMIN') {
        throw new AppError('게시글을 찾을 수 없습니다.', 404)
      }
    }

    // Track unique view by IP hash (24-hour based)
    const ipHash = hashIP(getClientIP(req))
    let viewIncremented = false
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Check if this IP has viewed this post within the last 24 hours
    const existingView = await prisma.postView.findUnique({
      where: {
        postId_ipHash: {
          postId: post.id,
          ipHash,
        },
      },
    })

    if (!existingView) {
      // New unique view - create view record and increment count
      await prisma.$transaction([
        prisma.postView.create({
          data: {
            postId: post.id,
            ipHash,
          },
        }),
        prisma.post.update({
          where: { id: post.id },
          data: { viewCount: { increment: 1 } },
        }),
      ])
      viewIncremented = true
    } else if (existingView.createdAt < twentyFourHoursAgo) {
      // View record exists but is older than 24 hours - update timestamp and increment count
      await prisma.$transaction([
        prisma.postView.update({
          where: { id: existingView.id },
          data: { createdAt: new Date() },
        }),
        prisma.post.update({
          where: { id: post.id },
          data: { viewCount: { increment: 1 } },
        }),
      ])
      viewIncremented = true
    }

    res.json({ data: { ...post, viewCount: post.viewCount + (viewIncremented ? 1 : 0) } })
  } catch (error) {
    next(error)
  }
}

// Admin: Get post by ID (for editing)
export async function getPostById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403)
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true, bio: true } },
        category: true,
        tags: true,
      },
    })

    if (!post) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    res.json({ data: post })
  } catch (error) {
    next(error)
  }
}

// Admin: Create post
export async function createPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { title, excerpt, content, coverImage, categoryId, tagIds, status, featured } = req.body

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

    // Set publishedAt only when publishing (PUBLIC or PRIVATE)
    let postPublishedAt: Date | null = null
    const postStatus = status || 'DRAFT'
    if (postStatus !== 'DRAFT') {
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
        status: postStatus,
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

// Admin: Update post
export async function updatePost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { title, excerpt, content, coverImage, categoryId, tagIds, status, featured } = req.body

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
    if (status !== undefined) {
      updateData.status = status
      // Set publishedAt when publishing for first time
      if (status !== 'DRAFT' && !existing.publishedAt) {
        updateData.publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : new Date()
      } else if (req.body.publishedAt !== undefined) {
        updateData.publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : null
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

// Admin: Delete post
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
