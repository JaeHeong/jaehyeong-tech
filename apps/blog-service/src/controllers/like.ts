import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';
import { hashIP, getClientIP } from '../utils/ipHash';
import { updateFeaturedPost } from './post';

/**
 * POST /api/posts/:id/like
 * Public: Toggle like on a post (supports both authenticated and anonymous users)
 */
export async function toggleLike(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const { id: postId } = req.params;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post || post.tenantId !== req.tenant.id) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404);
    }

    const userId = req.user?.id;
    const ipHash = userId ? null : hashIP(getClientIP(req));

    // Check if like exists
    let existingLike;

    if (userId) {
      existingLike = await prisma.like.findUnique({
        where: {
          tenantId_postId_userId: {
            tenantId: req.tenant.id,
            postId,
            userId,
          },
        },
      });
    } else if (ipHash) {
      existingLike = await prisma.like.findUnique({
        where: {
          tenantId_postId_ipHash: {
            tenantId: req.tenant.id,
            postId,
            ipHash,
          },
        },
      });
    }

    let liked = false;

    if (existingLike) {
      // Unlike: remove like and decrement count
      await prisma.$transaction([
        prisma.like.delete({
          where: { id: existingLike.id },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);
      liked = false;
    } else {
      // Like: create like and increment count
      await prisma.$transaction([
        prisma.like.create({
          data: {
            tenantId: req.tenant.id,
            postId,
            userId,
            ipHash,
          },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);
      liked = true;

      // Publish event
      await eventPublisher.publish({
        eventType: 'post.liked',
        tenantId: req.tenant.id,
        data: {
          postId,
          userId: userId || 'anonymous',
        },
      });
    }

    // Update featured post
    await updateFeaturedPost(req.tenant.id);

    res.json({
      data: {
        liked,
        likeCount: post.likeCount + (liked ? 1 : -1),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/posts/:id/like
 * Public: Check like status for a post
 */
export async function checkLikeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const { id: postId } = req.params;

    const userId = req.user?.id;
    const ipHash = userId ? null : hashIP(getClientIP(req));

    let existingLike;

    if (userId) {
      existingLike = await prisma.like.findUnique({
        where: {
          tenantId_postId_userId: {
            tenantId: req.tenant.id,
            postId,
            userId,
          },
        },
      });
    } else if (ipHash) {
      existingLike = await prisma.like.findUnique({
        where: {
          tenantId_postId_ipHash: {
            tenantId: req.tenant.id,
            postId,
            ipHash,
          },
        },
      });
    }

    res.json({
      data: {
        liked: !!existingLike,
      },
    });
  } catch (error) {
    next(error);
  }
}
