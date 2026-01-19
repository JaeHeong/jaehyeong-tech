/**
 * Internal API Routes for Comment Service
 *
 * These endpoints are only accessible within the Kubernetes cluster
 * for service-to-service communication (e.g., backup aggregation).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import { resolveTenant } from '../middleware/tenantResolver';
import '@shared/types/express';

const router: Router = Router();

/**
 * Middleware to verify internal request
 */
function verifyInternalRequest(req: Request, res: Response, next: NextFunction): void {
  const internalHeader = req.headers['x-internal-request'];
  if (internalHeader !== 'true') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'This endpoint is only accessible for internal service communication'
    });
    return;
  }
  next();
}

/**
 * GET /internal/export
 * Export all comments for backup purposes
 */
router.get('/export', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);

    const comments = await prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        comments,
      },
      meta: {
        counts: {
          comments: comments.length,
        },
        exportedAt: new Date().toISOString(),
        tenantId: req.tenant!.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /internal/restore
 * Restore comment data from backup
 */
router.post('/restore', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);
    const { comments } = req.body as {
      comments?: Array<{
        id: string;
        tenantId: string;
        resourceType: string;
        resourceId: string;
        content: string;
        authorId?: string | null;
        guestName?: string | null;
        guestEmail?: string | null;
        parentId?: string | null;
        status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SPAM';
        isPrivate: boolean;
        isDeleted: boolean;
        ipHash: string;
        createdAt: string;
        updatedAt: string;
      }>;
    };

    const results = {
      comments: { deleted: 0, restored: 0, skipped: 0 },
    };

    const tenantId = req.tenant!.id;

    // 1. Delete all existing comments for this tenant
    const deleteResult = await prisma.comment.deleteMany({
      where: { tenantId },
    });
    results.comments.deleted = deleteResult.count;
    console.info(`[Restore] Deleted ${deleteResult.count} comments for tenant ${tenantId}`);

    // 2. Restore comments (sort by parentId to restore parents first)
    if (comments && Array.isArray(comments)) {
      const sortedComments = [...comments].sort((a, b) => {
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        return 0;
      });

      for (const comment of sortedComments) {
        try {
          await prisma.comment.create({
            data: {
              id: comment.id,
              tenantId: comment.tenantId,
              resourceType: comment.resourceType,
              resourceId: comment.resourceId,
              content: comment.content,
              authorId: comment.authorId,
              guestName: comment.guestName,
              guestEmail: comment.guestEmail,
              parentId: comment.parentId,
              status: comment.status,
              isPrivate: comment.isPrivate,
              isDeleted: comment.isDeleted,
              ipHash: comment.ipHash,
              createdAt: new Date(comment.createdAt),
              updatedAt: new Date(),
            },
          });
          results.comments.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore comment ${comment.id}:`, error);
          results.comments.skipped++;
        }
      }
    }

    res.json({
      success: true,
      data: results,
      meta: {
        restoredAt: new Date().toISOString(),
        tenantId: req.tenant!.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/health
 * Internal health check for service mesh
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'comment-service', internal: true });
});

export default router;
