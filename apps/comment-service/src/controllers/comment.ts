import { Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';
import { hashIP, getClientIP, commentCache } from '@shared/utils';
import { CommentStatus } from '@shared/types';

/**
 * 댓글 생성
 * 인증된 사용자 또는 익명 사용자 모두 가능
 */
export async function createComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { resourceType, resourceId, content, guestName, guestEmail, parentId } = req.body;

    // 인증된 사용자인지 익명 사용자인지 확인
    const authorId = req.user?.id;

    if (!authorId && !guestName) {
      throw new AppError('인증되지 않은 경우 guestName이 필요합니다.', 400);
    }

    // IP 해싱 (스팸 방지)
    const ipHash = hashIP(getClientIP(req as any));

    // 댓글 생성
    // 인증된 사용자의 댓글은 자동 승인, 익명 댓글은 승인 대기
    const comment = await prisma.comment.create({
      data: {
        tenantId: tenant.id,
        resourceType: resourceType.toLowerCase(), // Normalize to lowercase
        resourceId,
        content,
        authorId,
        guestName,
        guestEmail,
        parentId,
        ipHash,
        status: authorId ? 'APPROVED' : 'PENDING',
      },
      include: {
        parent: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'comment.created',
      tenantId: tenant.id,
      data: {
        commentId: comment.id,
        resourceType: comment.resourceType,
        resourceId: comment.resourceId,
        authorId: comment.authorId ?? undefined,
      },
    });

    res.status(201).json({
      data: {
        id: comment.id,
        resourceType: comment.resourceType,
        resourceId: comment.resourceId,
        content: comment.content,
        authorId: comment.authorId,
        guestName: comment.guestName,
        parentId: comment.parentId,
        status: comment.status,
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 목록 조회
 * 특정 리소스의 댓글 목록
 */
export async function getComments(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { resourceType, resourceId, status, parentId } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const where: any = {
      tenantId: tenant.id,
      isDeleted: false,
    };

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (status) {
      where.status = status;
    } else {
      // 기본적으로 승인된 댓글만 표시
      where.status = 'APPROVED';
    }

    if (parentId === 'null' || parentId === null) {
      // 최상위 댓글만
      where.parentId = null;
    } else if (parentId) {
      // 특정 댓글의 대댓글
      where.parentId = parentId;
    }

    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        select: {
          id: true,
          content: true,
          authorId: true,
          guestName: true,
          resourceType: true,
          resourceId: true,
          status: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              replies: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.comment.count({ where }),
    ]);

    res.json({
      data: comments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 상세 조회
 */
export async function getComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { id } = req.params;

    const comment = await prisma.comment.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        parent: {
          select: {
            id: true,
            content: true,
          },
        },
        replies: {
          where: {
            isDeleted: false,
            status: 'APPROVED',
          },
          select: {
            id: true,
            content: true,
            authorId: true,
            guestName: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404);
    }

    res.json({ data: comment });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 수정
 * 본인만 수정 가능
 */
export async function updateComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { id } = req.params;
    const { content } = req.body;

    // 댓글 조회
    const comment = await prisma.comment.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404);
    }

    // 권한 확인 (본인 또는 관리자만 수정 가능)
    if (comment.authorId && comment.authorId !== req.user?.id && req.user?.role !== 'ADMIN') {
      throw new AppError('댓글을 수정할 권한이 없습니다.', 403);
    }

    // 익명 댓글은 수정 불가 (보안상)
    if (!comment.authorId) {
      throw new AppError('익명 댓글은 수정할 수 없습니다.', 403);
    }

    // 댓글 수정
    const updated = await prisma.comment.update({
      where: { id },
      data: {
        content,
        status: 'PENDING', // 수정 시 다시 승인 대기
      },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'comment.updated',
      tenantId: tenant.id,
      data: {
        commentId: updated.id,
        changes: {
          content,
          status: 'PENDING' as CommentStatus,
        },
      },
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 삭제
 * 본인만 삭제 가능
 */
export async function deleteComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { id } = req.params;

    // 댓글 조회
    const comment = await prisma.comment.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404);
    }

    // 권한 확인
    if (comment.authorId && comment.authorId !== req.user?.id && req.user?.role !== 'ADMIN') {
      throw new AppError('댓글을 삭제할 권한이 없습니다.', 403);
    }

    // Soft delete
    await prisma.comment.update({
      where: { id },
      data: { isDeleted: true },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'comment.deleted',
      tenantId: tenant.id,
      data: {
        commentId: comment.id,
        resourceType: comment.resourceType,
        resourceId: comment.resourceId,
      },
    });

    res.json({ message: '댓글이 삭제되었습니다.' });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 승인 (관리자 전용)
 */
export async function approveComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { id } = req.params;

    const comment = await prisma.comment.update({
      where: {
        id,
        tenantId: tenant.id,
      },
      data: {
        status: 'APPROVED',
      },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'comment.approved',
      tenantId: tenant.id,
      data: {
        commentId: comment.id,
        resourceType: comment.resourceType,
        resourceId: comment.resourceId,
      },
    });

    res.json({ data: comment });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 거부/스팸 처리 (관리자 전용)
 */
export async function updateCommentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { id } = req.params;
    const { status } = req.body;

    const comment = await prisma.comment.update({
      where: {
        id,
        tenantId: tenant.id,
      },
      data: {
        status,
      },
    });

    res.json({ data: comment });
  } catch (error) {
    next(error);
  }
}

/**
 * 최근 댓글 목록 조회 (공개)
 * 사이드바나 대시보드에서 사용
 */
export async function getRecentComments(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const limit = Math.min(Number(req.query.limit) || 5, 10);

    const comments = await prisma.comment.findMany({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        isPrivate: false,
        status: 'APPROVED',
        resourceType: 'post', // 블로그 포스트 댓글만
      },
      select: {
        id: true,
        content: true,
        authorId: true,
        guestName: true,
        resourceId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Collect post IDs for enrichment
    const postIds = new Set<string>();
    for (const comment of comments) {
      if (comment.resourceId) {
        postIds.add(comment.resourceId);
      }
    }

    // Fetch post info from blog-service
    let postsMap: Record<string, { id: string; slug: string; title: string }> = {};
    if (postIds.size > 0) {
      try {
        const blogServiceUrl = process.env.BLOG_SERVICE_URL || 'http://blog-service:3002';
        const response = await fetch(`${blogServiceUrl}/internal/posts/basic?ids=${Array.from(postIds).join(',')}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-request': 'true',
            'x-tenant-id': tenant.id,
          },
        });
        if (response.ok) {
          const data = await response.json() as { success: boolean; data: typeof postsMap };
          postsMap = data.data || {};
        }
      } catch (err) {
        console.error('Failed to fetch post info from blog-service:', err);
      }
    }

    // Fetch author info from auth-service
    const authorIds = new Set<string>();
    for (const comment of comments) {
      if (comment.authorId) {
        authorIds.add(comment.authorId);
      }
    }

    let authorsMap: Record<string, { id: string; name: string; avatar: string | null }> = {};
    if (authorIds.size > 0) {
      try {
        const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
        const response = await fetch(`${authServiceUrl}/internal/users/basic?ids=${Array.from(authorIds).join(',')}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-request': 'true',
            'x-tenant-id': tenant.id,
          },
        });
        if (response.ok) {
          const data = await response.json() as { success: boolean; data: typeof authorsMap };
          authorsMap = data.data || {};
        }
      } catch (err) {
        console.error('Failed to fetch author info from auth-service:', err);
      }
    }

    // Filter out comments without valid posts and enrich with post/author info
    const enrichedComments = comments
      .filter((comment) => comment.resourceId && postsMap[comment.resourceId])
      .map((comment) => {
        const author = comment.authorId ? authorsMap[comment.authorId] : null;
        const post = postsMap[comment.resourceId!];
        return {
          id: comment.id,
          content: comment.content.length > 80
            ? comment.content.substring(0, 80) + '...'
            : comment.content,
          authorName: author?.name || comment.guestName || '익명',
          authorAvatar: author?.avatar || null,
          createdAt: comment.createdAt.toISOString(),
          post: {
            id: post.id,
            slug: post.slug,
            title: post.title,
          },
        };
      });

    res.json({ data: enrichedComments });
  } catch (error) {
    next(error);
  }
}

/**
 * 내 댓글 목록 조회 (인증된 사용자 전용)
 */
export async function getMyComments(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('로그인이 필요합니다.', 401);
    }

    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

    const where = {
      tenantId: tenant.id,
      authorId: req.user.id,
      isDeleted: false,
    };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        select: {
          id: true,
          content: true,
          resourceType: true,
          resourceId: true,
          isPrivate: true,
          parentId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { replies: true },
          },
        },
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);

    // Collect unique post IDs for enrichment
    const postIds = new Set<string>();
    for (const comment of comments) {
      if (comment.resourceType === 'post' && comment.resourceId) {
        postIds.add(comment.resourceId);
      }
    }

    // Fetch post info from blog-service
    let postsMap: Record<string, { id: string; slug: string; title: string }> = {};
    if (postIds.size > 0) {
      try {
        const blogServiceUrl = process.env.BLOG_SERVICE_URL || 'http://blog-service:3002';
        const response = await fetch(`${blogServiceUrl}/internal/posts/basic?ids=${Array.from(postIds).join(',')}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-request': 'true',
            'x-tenant-id': tenant.id,
          },
        });
        if (response.ok) {
          const data = await response.json() as { success: boolean; data: typeof postsMap };
          postsMap = data.data || {};
        }
      } catch (err) {
        console.error('Failed to fetch post info from blog-service:', err);
      }
    }

    res.json({
      data: comments.map((c) => ({
        id: c.id,
        content: c.content,
        isPrivate: c.isPrivate,
        parentId: c.parentId,
        replyCount: c._count.replies,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        post: c.resourceType === 'post' && c.resourceId
          ? postsMap[c.resourceId] || { id: c.resourceId, slug: c.resourceId, title: '삭제된 게시글' }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/comments/stats
 * Comment statistics for dashboard
 */
export async function getCommentStats(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, recent, newComments] = await Promise.all([
      prisma.comment.count({
        where: { tenantId: tenant.id, isDeleted: false },
      }),
      prisma.comment.count({
        where: { tenantId: tenant.id, isDeleted: false, createdAt: { gte: weekAgo } },
      }),
      prisma.comment.count({
        where: { tenantId: tenant.id, isDeleted: false, createdAt: { gte: twentyFourHoursAgo } },
      }),
    ]);

    res.json({ data: { total, recent, new: newComments } });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/comments/count
 * Get comment count for a specific resource
 */
export async function getCommentCount(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { resourceType, resourceId } = req.query;

    if (!resourceType || !resourceId) {
      throw new AppError('resourceType과 resourceId가 필요합니다.', 400);
    }

    const count = await prisma.comment.count({
      where: {
        tenantId: tenant.id,
        resourceType: resourceType as string,
        resourceId: resourceId as string,
        isDeleted: false,
        status: 'APPROVED',
      },
    });

    res.json({ data: { count } });
  } catch (error) {
    next(error);
  }
}

/**
 * 관리자용 모든 댓글 조회
 * GET /api/comments/admin
 */
export async function getAllComments(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { status, resourceType, includeDeleted } = req.query;

    const where: any = {
      tenantId: tenant.id,
    };

    // includeDeleted가 true이면 삭제된 댓글도 포함
    if (includeDeleted !== 'true') {
      where.isDeleted = false;
    }

    if (status) {
      where.status = status;
    }

    if (resourceType) {
      where.resourceType = resourceType;
    }

    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        select: {
          id: true,
          content: true,
          authorId: true,
          guestName: true,
          guestEmail: true,
          resourceType: true,
          resourceId: true,
          status: true,
          parentId: true,
          isPrivate: true,
          isDeleted: true,
          ipHash: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.comment.count({ where }),
    ]);

    // Collect unique post IDs and author IDs for enrichment
    const postIds = new Set<string>();
    const authorIds = new Set<string>();

    for (const comment of comments) {
      if (comment.resourceType?.toLowerCase() === 'post' && comment.resourceId) {
        postIds.add(comment.resourceId);
      }
      if (comment.authorId) {
        authorIds.add(comment.authorId);
      }
    }

    // Fetch post and author info in PARALLEL with Redis caching
    let postsMap: Record<string, { id: string; slug: string; title: string }> = {};
    let authorsMap: Record<string, { id: string; name: string; avatar: string | null }> = {};

    const fetchPromises: Promise<void>[] = [];

    // Fetch post info from blog-service (with cache)
    if (postIds.size > 0) {
      fetchPromises.push((async () => {
        const cacheKey = `posts:basic:${Array.from(postIds).sort().join(',')}`;
        const cached = await commentCache.get<typeof postsMap>(cacheKey);
        if (cached) {
          postsMap = cached;
          return;
        }

        try {
          const blogServiceUrl = process.env.BLOG_SERVICE_URL || 'http://blog-service:3002';
          const response = await fetch(`${blogServiceUrl}/internal/posts/basic?ids=${Array.from(postIds).join(',')}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-request': 'true',
              'x-tenant-id': tenant.id,
            },
          });
          if (response.ok) {
            const data = await response.json() as { success: boolean; data: typeof postsMap };
            postsMap = data.data || {};
            await commentCache.set(cacheKey, postsMap, 120); // Cache for 2 min
          }
        } catch (err) {
          console.error('Failed to fetch post info from blog-service:', err);
        }
      })());
    }

    // Fetch author info from auth-service (with cache)
    if (authorIds.size > 0) {
      fetchPromises.push((async () => {
        const cacheKey = `authors:basic:${Array.from(authorIds).sort().join(',')}`;
        const cached = await commentCache.get<typeof authorsMap>(cacheKey);
        if (cached) {
          authorsMap = cached;
          return;
        }

        try {
          const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
          const response = await fetch(`${authServiceUrl}/internal/users/basic?ids=${Array.from(authorIds).join(',')}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-request': 'true',
              'x-tenant-id': tenant.id,
            },
          });
          if (response.ok) {
            const data = await response.json() as { success: boolean; data: typeof authorsMap };
            authorsMap = data.data || {};
            await commentCache.set(cacheKey, authorsMap, 300); // Cache for 5 min
          }
        } catch (err) {
          console.error('Failed to fetch author info from auth-service:', err);
        }
      })());
    }

    // Wait for all fetches in parallel
    await Promise.all(fetchPromises);

    // Enrich comments with post and author info
    const enrichedComments = comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      isPrivate: comment.isPrivate,
      isDeleted: comment.isDeleted,
      status: comment.status,
      guestName: comment.guestName,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      author: comment.authorId ? authorsMap[comment.authorId] || null : null,
      post: comment.resourceType?.toLowerCase() === 'post' && comment.resourceId
        ? postsMap[comment.resourceId] || null
        : null,
    }));

    res.json({
      data: enrichedComments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 관리자 댓글 삭제 (단일)
 * DELETE /api/comments/admin/:id
 */
export async function adminDeleteComment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { id } = req.params;

    // Soft delete
    await prisma.comment.update({
      where: {
        id,
        tenantId: tenant.id,
      },
      data: { isDeleted: true },
    });

    res.json({ message: '댓글이 삭제되었습니다.' });
  } catch (error) {
    next(error);
  }
}

/**
 * 관리자 댓글 일괄 삭제
 */
export async function bulkDeleteComments(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new AppError('삭제할 댓글 ID 목록이 필요합니다.', 400);
    }

    // Soft delete (tenant 확인 포함)
    const result = await prisma.comment.updateMany({
      where: {
        id: { in: ids },
        tenantId: tenant.id,
      },
      data: { isDeleted: true },
    });

    res.json({ data: { deletedCount: result.count } });
  } catch (error) {
    next(error);
  }
}

/**
 * Internal API: Get comment counts by user IDs
 * GET /internal/comments/count-by-users?userIds=id1,id2,...
 */
export async function getCommentCountsByUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { userIds } = req.query;

    if (!userIds || typeof userIds !== 'string') {
      res.json({ data: {} });
      return;
    }

    const userIdList = userIds.split(',').filter(Boolean);
    if (userIdList.length === 0) {
      res.json({ data: {} });
      return;
    }

    // Group by authorId and count comments
    const counts = await prisma.comment.groupBy({
      by: ['authorId'],
      where: {
        tenantId: tenant.id,
        authorId: { in: userIdList },
        isDeleted: false,
      },
      _count: {
        id: true,
      },
    });

    // Convert to { userId: count } format
    const result: Record<string, number> = {};
    for (const item of counts) {
      if (item.authorId) {
        result[item.authorId] = item._count.id;
      }
    }

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
