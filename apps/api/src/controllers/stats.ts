import type { Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import type { AuthRequest } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'

export async function getDashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Get stats in parallel
    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      totalComments,
      recentComments,
      totalViews,
      categoryStats,
      recentPosts,
      recentDrafts,
      latestComments,
    ] = await Promise.all([
      // Total posts
      prisma.post.count(),
      // Published posts
      prisma.post.count({ where: { published: true } }),
      // Draft posts
      prisma.post.count({ where: { published: false } }),
      // Total comments
      prisma.comment.count({ where: { isDeleted: false } }),
      // Comments from last 7 days
      prisma.comment.count({
        where: { createdAt: { gte: weekAgo }, isDeleted: false },
      }),
      // Total views
      prisma.post.aggregate({
        _sum: { viewCount: true },
      }),
      // Category stats
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          _count: { select: { posts: { where: { published: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      // Recent posts (last 5)
      prisma.post.findMany({
        where: { published: true },
        select: {
          id: true,
          title: true,
          slug: true,
          viewCount: true,
          createdAt: true,
          category: { select: { name: true, color: true } },
          _count: { select: { comments: { where: { isDeleted: false } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Recent drafts (last 3)
      prisma.post.findMany({
        where: { published: false },
        select: {
          id: true,
          title: true,
          excerpt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
      }),
      // Latest comments (last 5)
      prisma.comment.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: { name: true, avatar: true } },
          guestName: true,
          post: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    res.json({
      data: {
        stats: {
          totalPosts,
          publishedPosts,
          draftPosts,
          totalComments,
          recentComments,
          totalViews: totalViews._sum.viewCount || 0,
        },
        categories: categoryStats.map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          color: cat.color,
          postCount: cat._count.posts,
        })),
        recentPosts: recentPosts.map((post) => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          viewCount: post.viewCount,
          commentCount: post._count.comments,
          createdAt: post.createdAt.toISOString(),
          category: post.category,
        })),
        recentDrafts: recentDrafts.map((draft) => ({
          id: draft.id,
          title: draft.title || '제목 없음',
          excerpt: draft.excerpt || '',
          createdAt: draft.createdAt.toISOString(),
          updatedAt: draft.updatedAt.toISOString(),
        })),
        recentComments: latestComments.map((comment) => ({
          id: comment.id,
          content: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
          authorName: comment.author?.name || comment.guestName || '익명',
          authorAvatar: comment.author?.avatar || null,
          createdAt: comment.createdAt.toISOString(),
          post: comment.post,
        })),
      },
    })
  } catch (error) {
    next(error)
  }
}
