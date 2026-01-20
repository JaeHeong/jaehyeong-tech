import { Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import '@shared/types/express';

// Service URLs using Kubernetes service DNS names
const BLOG_SERVICE_URL = process.env.BLOG_SERVICE_URL || 'http://blog-service:3002';
const COMMENT_SERVICE_URL = process.env.COMMENT_SERVICE_URL || 'http://comment-service:3003';
const PAGE_SERVICE_URL = process.env.PAGE_SERVICE_URL || 'http://page-service:3004';
const STORAGE_SERVICE_URL = process.env.STORAGE_SERVICE_URL || 'http://storage-service:3006';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

interface ServiceResponse<T> {
  data?: T;
  error?: string;
}

async function fetchFromService<T>(
  url: string,
  tenantId: string,
  token: string
): Promise<ServiceResponse<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        'x-tenant-id': tenantId,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { error: `${response.status}` };
    }

    const json = await response.json() as { data: T };
    return { data: json.data };
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    return { error: 'Failed to fetch' };
  }
}

/**
 * GET /api/stats/dashboard
 * Dashboard statistics aggregated from all services
 */
export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const token = req.headers.authorization?.replace('Bearer ', '') || '';

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch data from this service (visitors, bug reports)
    const [totalVisitors, recentVisitors, bugReports] = await Promise.all([
      prisma.siteVisitor.count({ where: { tenantId: tenant.id } }),
      prisma.siteVisitor.count({
        where: { tenantId: tenant.id, createdAt: { gte: weekAgo } },
      }),
      prisma.bugReport.count({
        where: { tenantId: tenant.id, status: 'OPEN' },
      }),
    ]);

    // Define types for service responses
    interface PostStats {
      total: number;
      published: number;
      totalViews: number;
      totalLikes: number;
    }

    interface RawPost {
      id: string;
      title: string;
      slug: string;
      status: string;
      viewCount: number;
      createdAt: string;
      category?: {
        id: string;
        name: string;
        slug: string;
        color?: string | null;
      } | null;
    }

    interface RecentDraft {
      id: string;
      title: string;
      excerpt?: string;
      createdAt: string;
      updatedAt: string;
    }

    interface RawComment {
      id: string;
      content: string;
      guestName?: string | null;
      authorId?: string | null;
      resourceId: string;
      resourceType: string;
      createdAt: string;
    }

    interface Backup {
      name: string;
      fullPath: string;
      createdAt: string | null;
      description: string | null;
    }

    interface CategoryData {
      id: string;
      name: string;
      slug: string;
      color?: string | null;
      postCount?: number;
      _count?: { posts: number };
    }

    interface TagData {
      id: string;
      name: string;
      slug: string;
      postCount?: number;
      _count?: { posts: number };
    }

    interface UserPublicInfo {
      id: string;
      name: string;
      avatar: string | null;
    }

    interface PostInfo {
      id: string;
      title: string;
      slug: string;
    }

    // Fetch data from other services in parallel
    const [
      postsData,
      draftsData,
      commentsData,
      pagesData,
      usersData,
      imagesData,
      categoriesData,
      tagsData,
      recentPostsData,
      recentDraftsData,
      recentCommentsData,
      backupsData,
    ] = await Promise.all([
      // Blog service - posts stats (includes totalViews and totalLikes)
      fetchFromService<PostStats>(
        `${BLOG_SERVICE_URL}/api/posts/stats`,
        tenant.id,
        token
      ),
      // Blog service - drafts stats
      fetchFromService<{ total: number }>(
        `${BLOG_SERVICE_URL}/api/drafts/stats`,
        tenant.id,
        token
      ),
      // Comment service - comments stats
      fetchFromService<{ total: number; recent: number; new: number }>(
        `${COMMENT_SERVICE_URL}/api/comments/stats`,
        tenant.id,
        token
      ),
      // Page service - pages stats
      fetchFromService<{ static: number; notice: number }>(
        `${PAGE_SERVICE_URL}/api/pages/admin/stats`,
        tenant.id,
        token
      ),
      // Auth service - users stats
      fetchFromService<{ total: number }>(
        `${AUTH_SERVICE_URL}/api/users/stats`,
        tenant.id,
        token
      ),
      // Storage service - images stats
      fetchFromService<{ total: number; totalSize: number; linked: number; usedInDrafts: number; orphaned: number; orphanSize: number }>(
        `${STORAGE_SERVICE_URL}/api/images/stats`,
        tenant.id,
        token
      ),
      // Blog service - categories
      fetchFromService<CategoryData[]>(
        `${BLOG_SERVICE_URL}/api/categories`,
        tenant.id,
        token
      ),
      // Blog service - tags
      fetchFromService<TagData[]>(
        `${BLOG_SERVICE_URL}/api/tags`,
        tenant.id,
        token
      ),
      // Blog service - recent posts (status=ALL to include all posts for admin)
      fetchFromService<RawPost[]>(
        `${BLOG_SERVICE_URL}/api/posts?limit=5&sortBy=publishedAt&status=PUBLISHED`,
        tenant.id,
        token
      ),
      // Blog service - recent drafts
      fetchFromService<RecentDraft[]>(
        `${BLOG_SERVICE_URL}/api/drafts?limit=5`,
        tenant.id,
        token
      ),
      // Comment service - recent comments (all statuses for admin)
      fetchFromService<RawComment[]>(
        `${COMMENT_SERVICE_URL}/api/comments?limit=5&status=APPROVED`,
        tenant.id,
        token
      ),
      // Storage service - backups list
      fetchFromService<Backup[]>(
        `${STORAGE_SERVICE_URL}/api/backup`,
        tenant.id,
        token
      ),
    ]);

    // Process recent posts - fetch comment counts
    const rawPosts = recentPostsData.data ?? [];
    const postIds = rawPosts.map((p) => p.id);

    // Fetch comment counts for posts in parallel
    const commentCountsPromises = postIds.map((postId) =>
      fetchFromService<{ count: number }>(
        `${COMMENT_SERVICE_URL}/api/comments/count?resourceType=POST&resourceId=${postId}`,
        tenant.id,
        token
      )
    );
    const commentCountsResults = await Promise.all(commentCountsPromises);
    const commentCountsMap = new Map<string, number>();
    postIds.forEach((id, index) => {
      commentCountsMap.set(id, commentCountsResults[index].data?.count ?? 0);
    });

    // Format recent posts with comment counts
    const recentPosts = rawPosts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      viewCount: post.viewCount,
      commentCount: commentCountsMap.get(post.id) ?? 0,
      createdAt: post.createdAt,
      category: post.category
        ? {
            name: post.category.name,
            color: post.category.color ?? 'blue',
          }
        : null,
    }));

    // Process recent comments - fetch author info and post info
    const rawComments = recentCommentsData.data ?? [];

    // Collect unique author IDs and post IDs
    const authorIds = [...new Set(rawComments.filter((c) => c.authorId).map((c) => c.authorId!))];
    const postResourceIds = [...new Set(rawComments.filter((c) => c.resourceType === 'POST').map((c) => c.resourceId))];

    // Fetch author info from auth-service in parallel
    const authorInfoPromises = authorIds.map((authorId) =>
      fetchFromService<UserPublicInfo>(
        `${AUTH_SERVICE_URL}/api/users/${authorId}/public`,
        tenant.id,
        token
      )
    );
    const authorInfoResults = await Promise.all(authorInfoPromises);
    const authorInfoMap = new Map<string, UserPublicInfo>();
    authorIds.forEach((id, index) => {
      if (authorInfoResults[index].data) {
        authorInfoMap.set(id, authorInfoResults[index].data!);
      }
    });

    // Fetch post info from blog-service in parallel
    const postInfoPromises = postResourceIds.map((postId) =>
      fetchFromService<PostInfo>(
        `${BLOG_SERVICE_URL}/api/posts/admin/${postId}`,
        tenant.id,
        token
      )
    );
    const postInfoResults = await Promise.all(postInfoPromises);
    const postInfoMap = new Map<string, PostInfo>();
    postResourceIds.forEach((id, index) => {
      if (postInfoResults[index].data) {
        postInfoMap.set(id, postInfoResults[index].data!);
      }
    });

    // Format recent comments with author and post info
    const recentComments = rawComments.map((comment) => {
      const authorInfo = comment.authorId ? authorInfoMap.get(comment.authorId) : null;
      const postInfo = comment.resourceType === 'POST' ? postInfoMap.get(comment.resourceId) : null;

      return {
        id: comment.id,
        content: comment.content,
        authorName: authorInfo?.name ?? comment.guestName ?? '익명',
        authorAvatar: authorInfo?.avatar ?? null,
        createdAt: comment.createdAt,
        post: postInfo
          ? {
              slug: postInfo.slug,
              title: postInfo.title,
            }
          : {
              slug: '',
              title: comment.resourceType === 'PAGE' ? '페이지' : '알 수 없음',
            },
      };
    });

    // Format categories with postCount
    const categories = (categoriesData.data ?? []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      color: cat.color ?? 'blue',
      postCount: cat.postCount ?? cat._count?.posts ?? 0,
    }));

    // Format tags with postCount
    const tags = (tagsData.data ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      postCount: tag.postCount ?? tag._count?.posts ?? 0,
    }));

    // Format recent drafts
    const recentDrafts = (recentDraftsData.data ?? []).map((draft) => ({
      id: draft.id,
      title: draft.title,
      excerpt: draft.excerpt ?? '',
      updatedAt: draft.updatedAt,
    }));

    res.json({
      data: {
        stats: {
          totalPosts: postsData.data?.total ?? 0,
          publishedPosts: postsData.data?.published ?? 0,
          draftPosts: draftsData.data?.total ?? 0,
          totalComments: commentsData.data?.total ?? 0,
          recentComments: commentsData.data?.recent ?? 0,
          newComments: commentsData.data?.new ?? 0,
          totalViews: postsData.data?.totalViews ?? 0,
          totalLikes: postsData.data?.totalLikes ?? 0,
          totalUsers: usersData.data?.total ?? 0,
          totalVisitors,
          recentVisitors,
          openBugReports: bugReports,
        },
        categories,
        tags,
        pages: pagesData.data ?? { static: 0, notice: 0 },
        images: imagesData.data ?? { total: 0, totalSize: 0, linked: 0, usedInDrafts: 0, orphaned: 0, orphanSize: 0 },
        backups: backupsData.data ?? [],
        recentPosts,
        recentDrafts,
        recentComments,
      },
    });
  } catch (error) {
    next(error);
  }
}
