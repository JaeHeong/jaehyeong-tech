import type { Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'

// Toggle bookmark on a post (logged-in users only)
export async function toggleBookmark(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = req.params.id
    const userId = req.user?.id

    if (!userId) {
      throw new AppError('로그인이 필요합니다.', 401)
    }

    if (!postId) {
      throw new AppError('게시글 ID가 필요합니다.', 400)
    }

    // Find the post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    })

    if (!post) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    if (post.status !== 'PUBLIC') {
      throw new AppError('비공개 게시글입니다.', 403)
    }

    // Check existing bookmark
    const existingBookmark = await prisma.bookmark.findFirst({
      where: {
        postId,
        userId,
      },
    })

    let bookmarked: boolean

    if (existingBookmark) {
      // Remove bookmark
      await prisma.bookmark.delete({
        where: { id: existingBookmark.id },
      })
      bookmarked = false
    } else {
      // Add bookmark
      await prisma.bookmark.create({
        data: {
          post: { connect: { id: postId } },
          user: { connect: { id: userId } },
        },
      })
      bookmarked = true
    }

    res.json({
      data: {
        bookmarked,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Check if current user has bookmarked a post
export async function checkBookmarkStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = req.params.id
    const userId = req.user?.id

    if (!postId) {
      throw new AppError('게시글 ID가 필요합니다.', 400)
    }

    // If not logged in, return false
    if (!userId) {
      return res.json({
        data: {
          bookmarked: false,
        },
      })
    }

    const existingBookmark = await prisma.bookmark.findFirst({
      where: {
        postId,
        userId,
      },
    })

    res.json({
      data: {
        bookmarked: !!existingBookmark,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get user's bookmarks
export async function getMyBookmarks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new AppError('로그인이 필요합니다.', 401)
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 10), 100)
    const skip = (page - 1) * limit

    // Get total count
    const total = await prisma.bookmark.count({
      where: {
        userId,
        post: {
          status: 'PUBLIC',
        },
      },
    })

    // Get bookmarks with post details
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId,
        post: {
          status: 'PUBLIC',
        },
      },
      include: {
        post: {
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            coverImage: true,
            viewCount: true,
            likeCount: true,
            readingTime: true,
            createdAt: true,
            publishedAt: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            tags: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            _count: {
              select: {
                comments: {
                  where: {
                    isDeleted: false,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    // Transform data
    const posts = bookmarks.map((bookmark) => ({
      id: bookmark.post.id,
      slug: bookmark.post.slug,
      title: bookmark.post.title,
      excerpt: bookmark.post.excerpt,
      coverImage: bookmark.post.coverImage,
      viewCount: bookmark.post.viewCount,
      likeCount: bookmark.post.likeCount,
      readingTime: bookmark.post.readingTime,
      createdAt: bookmark.post.createdAt,
      publishedAt: bookmark.post.publishedAt,
      category: bookmark.post.category,
      tags: bookmark.post.tags,
      commentCount: bookmark.post._count.comments,
      bookmarkedAt: bookmark.createdAt,
    }))

    res.json({
      data: {
        posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// Remove bookmark by post ID (for bulk operations)
export async function removeBookmark(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = req.params.id
    const userId = req.user?.id

    if (!userId) {
      throw new AppError('로그인이 필요합니다.', 401)
    }

    if (!postId) {
      throw new AppError('게시글 ID가 필요합니다.', 400)
    }

    const bookmark = await prisma.bookmark.findFirst({
      where: {
        postId,
        userId,
      },
    })

    if (!bookmark) {
      throw new AppError('북마크를 찾을 수 없습니다.', 404)
    }

    await prisma.bookmark.delete({
      where: { id: bookmark.id },
    })

    res.json({
      message: '북마크가 삭제되었습니다.',
    })
  } catch (error) {
    next(error)
  }
}
