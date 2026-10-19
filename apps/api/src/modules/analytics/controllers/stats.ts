import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../db';
import { AppError } from '../../../middleware/errorHandler';
import { imageStatistics } from '../../storage/controllers/storage';
import { listBackups } from '../../../services/backups';

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role !== 'ADMIN') throw new AppError('관리자 권한이 필요합니다.', 403);
    const tenantId = req.tenant!.id;
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const dayAgo = new Date(Date.now() - 86400000);
    const visibleComments = { tenantId, isDeleted: false };
    const [
      postGroups, views, totalLikes, draftPosts, totalComments, recentCommentCount,
      newComments, totalUsers, totalVisitors, recentVisitors, openBugReports,
      categoryRows, tagRows, pageGroups, postRows, recentDrafts, commentRows, images, backups,
    ] = await Promise.all([
      prisma.post.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      prisma.post.aggregate({ where: { tenantId }, _sum: { viewCount: true } }),
      prisma.like.count({ where: { tenantId } }),
      prisma.draft.count({ where: { tenantId } }),
      prisma.comment.count({ where: visibleComments }),
      prisma.comment.count({ where: { ...visibleComments, createdAt: { gte: weekAgo } } }),
      prisma.comment.count({ where: { ...visibleComments, createdAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { tenantId } }),
      prisma.siteVisitor.count({ where: { tenantId } }),
      prisma.siteVisitor.count({ where: { tenantId, createdAt: { gte: weekAgo } } }),
      prisma.bugReport.count({ where: { tenantId, status: 'OPEN' } }),
      prisma.category.findMany({ where: { tenantId }, include: { _count: { select: { posts: true } } }, orderBy: { name: 'asc' } }),
      prisma.tag.findMany({ where: { tenantId }, include: { _count: { select: { posts: true } } }, orderBy: { name: 'asc' } }),
      prisma.page.groupBy({ by: ['type'], where: { tenantId }, _count: true }),
      prisma.post.findMany({ where: { tenantId, status: 'PUBLIC' }, include: { category: true }, orderBy: { publishedAt: 'desc' }, take: 5 }),
      prisma.draft.findMany({ where: { tenantId }, select: { id: true, title: true, excerpt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      prisma.comment.findMany({ where: { ...visibleComments, status: 'APPROVED' }, orderBy: { createdAt: 'desc' }, take: 5 }),
      imageStatistics(tenantId, req.tenant!.name),
      listBackups(req.tenant!.name).catch(error => { console.warn('Could not list backups:', error); return []; }),
    ]);
    const [commentCounts, authors, commentPosts] = await Promise.all([
      prisma.comment.groupBy({ by: ['resourceId'], where: { ...visibleComments, status: 'APPROVED', resourceType: { in: ['POST', 'post'] }, resourceId: { in: postRows.map(post => post.id) } }, _count: true }),
      prisma.user.findMany({ where: { tenantId, id: { in: commentRows.flatMap(comment => comment.authorId ? [comment.authorId] : []) } }, select: { id: true, name: true, avatar: true } }),
      prisma.post.findMany({ where: { tenantId, id: { in: commentRows.filter(comment => comment.resourceType.toUpperCase() === 'POST').map(comment => comment.resourceId) } }, select: { id: true, slug: true, title: true } }),
    ]);
    const postCount = (status: string) => postGroups.find(group => group.status === status)?._count || 0;
    res.json({ data: {
      stats: {
        totalPosts: postGroups.reduce((sum, group) => sum + group._count, 0),
        publishedPosts: postCount('PUBLIC'), privatePosts: postCount('PRIVATE'), draftPosts,
        totalComments, recentComments: recentCommentCount, newComments,
        totalViews: views._sum.viewCount || 0, totalLikes, totalUsers,
        totalVisitors, recentVisitors, openBugReports,
      },
      categories: categoryRows.map(category => ({ ...category, postCount: category._count.posts })),
      tags: tagRows.map(tag => ({ ...tag, postCount: tag._count.posts })),
      pages: { static: pageGroups.find(group => group.type === 'STATIC')?._count || 0, notice: pageGroups.find(group => group.type === 'NOTICE')?._count || 0 },
      images, backups, recentDrafts,
      recentPosts: postRows.map(post => ({
        id: post.id, title: post.title, slug: post.slug, status: post.status, viewCount: post.viewCount,
        createdAt: post.createdAt, category: { name: post.category.name, color: post.category.color || 'blue' },
        commentCount: commentCounts.find(group => group.resourceId === post.id)?._count || 0,
      })),
      recentComments: commentRows.map(comment => {
        const author = authors.find(user => user.id === comment.authorId);
        const post = commentPosts.find(post => post.id === comment.resourceId);
        return {
          id: comment.id, content: comment.content, createdAt: comment.createdAt,
          authorName: author?.name || comment.guestName || '익명', authorAvatar: author?.avatar || null,
          post: post ? { slug: post.slug, title: post.title } : { slug: '', title: '페이지' },
        };
      }),
    } });
  } catch (error) { next(error); }
}
