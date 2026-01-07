import type { Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import type { AuthRequest } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { listObjects, isOCIConfigured } from '../services/oci.js'

const BACKUP_FOLDER = 'backups'

export async function getDashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get stats in parallel
    const [
      totalPosts,
      publishedPosts,
      draftCount,
      totalComments,
      recentComments,
      newComments,
      totalViews,
      totalLikes,
      categoryStats,
      tagStats,
      staticPages,
      noticePages,
      imageStats,
      orphanImages,
      recentPosts,
      recentDrafts,
      latestComments,
    ] = await Promise.all([
      // Total posts (all are published now - PUBLIC + PRIVATE)
      prisma.post.count(),
      // Published posts (PUBLIC + PRIVATE) - same as total now
      prisma.post.count({ where: { status: { in: ['PUBLIC', 'PRIVATE'] } } }),
      // Draft count (from Draft table)
      prisma.draft.count(),
      // Total comments
      prisma.comment.count({ where: { isDeleted: false } }),
      // Comments from last 7 days
      prisma.comment.count({
        where: { createdAt: { gte: weekAgo }, isDeleted: false },
      }),
      // Comments from last 24 hours (for "New" badge)
      prisma.comment.count({
        where: { createdAt: { gte: twentyFourHoursAgo }, isDeleted: false },
      }),
      // Total views
      prisma.post.aggregate({
        _sum: { viewCount: true },
      }),
      // Total likes
      prisma.like.count(),
      // Category stats (count only PUBLIC posts for display)
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          _count: { select: { posts: { where: { status: 'PUBLIC' } } } },
        },
        orderBy: { name: 'asc' },
      }),
      // Tag stats with post count (all tags, sorted by usage)
      prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { posts: { where: { status: 'PUBLIC' } } } },
        },
        orderBy: { posts: { _count: 'desc' } },
      }),
      // Static pages count
      prisma.page.count({ where: { type: 'STATIC', status: 'PUBLISHED' } }),
      // Notice pages count
      prisma.page.count({ where: { type: 'NOTICE', status: 'PUBLISHED' } }),
      // Image stats
      prisma.image.aggregate({
        _count: true,
        _sum: { size: true },
      }),
      // Orphan images (no postId and older than 24 hours)
      prisma.image.findMany({
        where: {
          postId: null,
          createdAt: { lt: twentyFourHoursAgo },
        },
        select: { id: true, size: true },
      }),
      // Recent posts (last 5, PUBLIC + PRIVATE)
      prisma.post.findMany({
        where: { status: { in: ['PUBLIC', 'PRIVATE'] } },
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
      // Recent drafts (last 5 from Draft table)
      prisma.draft.findMany({
        select: {
          id: true,
          title: true,
          excerpt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
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

    // Get backup list from OCI
    let backups: { name: string; createdAt: string | null }[] = []
    if (isOCIConfigured()) {
      try {
        const objects = await listObjects(BACKUP_FOLDER)
        backups = objects
          .filter((name) => name.endsWith('.json'))
          .map((name) => {
            const match = name.match(/backup_(.+)\.json$/)
            let createdAt: string | null = null
            if (match && match[1]) {
              try {
                const ts = match[1]
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
            return { name: name.split('/').pop() || name, createdAt }
          })
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
          .slice(0, 5)
      } catch {
        // OCI error - continue without backups
      }
    }

    // Calculate linked images count
    const linkedImages = await prisma.image.count({ where: { postId: { not: null } } })

    res.json({
      data: {
        stats: {
          totalPosts,
          publishedPosts,
          draftPosts: draftCount,
          totalComments,
          recentComments,
          newComments,
          totalViews: totalViews._sum.viewCount || 0,
          totalLikes,
        },
        categories: categoryStats.map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          color: cat.color,
          postCount: cat._count.posts,
        })),
        tags: tagStats.map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          postCount: tag._count.posts,
        })),
        pages: {
          static: staticPages,
          notice: noticePages,
        },
        images: {
          total: imageStats._count,
          totalSize: imageStats._sum.size || 0,
          linked: linkedImages,
          orphaned: orphanImages.length,
          orphanSize: orphanImages.reduce((sum, img) => sum + img.size, 0),
        },
        backups,
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
