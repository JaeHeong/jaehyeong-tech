import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /api/bookmarks
 * Protected: Get user's bookmarks
 */
export async function getBookmarks(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where: {
          tenantId: req.tenant.id,
          userId: req.user.id,
        },
        include: {
          post: {
            include: {
              category: true,
              tags: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bookmark.count({
        where: {
          tenantId: req.tenant.id,
          userId: req.user.id,
        },
      }),
    ]);

    res.json({
      data: bookmarks,
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
 * POST /api/bookmarks/:postId
 * Protected: Toggle bookmark for a post
 */
export async function toggleBookmark(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    const { postId } = req.params;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post || post.tenantId !== req.tenant.id) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404);
    }

    // Check if bookmark exists
    const existingBookmark = await prisma.bookmark.findUnique({
      where: {
        tenantId_postId_userId: {
          tenantId: req.tenant.id,
          postId,
          userId: req.user.id,
        },
      },
    });

    let bookmarked = false;

    if (existingBookmark) {
      // Remove bookmark
      await prisma.bookmark.delete({
        where: { id: existingBookmark.id },
      });
      bookmarked = false;
    } else {
      // Add bookmark
      await prisma.bookmark.create({
        data: {
          tenantId: req.tenant.id,
          postId,
          userId: req.user.id,
        },
      });
      bookmarked = true;

      // Publish event
      await eventPublisher.publish({
        eventType: 'post.bookmarked',
        tenantId: req.tenant.id,
        data: {
          postId,
          userId: req.user.id,
        },
      });
    }

    res.json({
      data: {
        bookmarked,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bookmarks/:postId/status
 * Protected: Check bookmark status for a post
 */
export async function checkBookmarkStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    const { postId } = req.params;

    const bookmark = await prisma.bookmark.findUnique({
      where: {
        tenantId_postId_userId: {
          tenantId: req.tenant.id,
          postId,
          userId: req.user.id,
        },
      },
    });

    res.json({
      data: {
        bookmarked: !!bookmark,
      },
    });
  } catch (error) {
    next(error);
  }
}
