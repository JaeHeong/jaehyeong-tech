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
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

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

    interface RecentPost {
      id: string;
      title: string;
      slug: string;
      status: string;
      viewCount: number;
      createdAt: string;
    }

    interface RecentDraft {
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
    }

    interface RecentComment {
      id: string;
      content: string;
      guestName?: string;
      authorId?: string;
      resourceId: string;
      createdAt: string;
    }

    interface Backup {
      name: string;
      fullPath: string;
      createdAt: string | null;
      description: string | null;
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
      fetchFromService<Array<{ id: string; name: string; slug: string; postCount: number }>>(
        `${BLOG_SERVICE_URL}/api/categories`,
        tenant.id,
        token
      ),
      // Blog service - tags
      fetchFromService<Array<{ id: string; name: string; slug: string; postCount?: number }>>(
        `${BLOG_SERVICE_URL}/api/tags`,
        tenant.id,
        token
      ),
      // Blog service - recent posts
      fetchFromService<RecentPost[]>(
        `${BLOG_SERVICE_URL}/api/posts?limit=5&sort=createdAt&order=desc`,
        tenant.id,
        token
      ),
      // Blog service - recent drafts
      fetchFromService<RecentDraft[]>(
        `${BLOG_SERVICE_URL}/api/drafts?limit=5`,
        tenant.id,
        token
      ),
      // Comment service - recent comments
      fetchFromService<RecentComment[]>(
        `${COMMENT_SERVICE_URL}/api/comments?limit=5`,
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
        categories: categoriesData.data ?? [],
        tags: tagsData.data ?? [],
        pages: pagesData.data ?? { static: 0, notice: 0 },
        images: imagesData.data ?? { total: 0, totalSize: 0, linked: 0, usedInDrafts: 0, orphaned: 0, orphanSize: 0 },
        backups: backupsData.data ?? [],
        recentPosts: recentPostsData.data ?? [],
        recentDrafts: recentDraftsData.data ?? [],
        recentComments: recentCommentsData.data ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
}
