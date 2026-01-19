/**
 * Internal API Routes for Page Service
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
 * Export all page data for backup purposes
 */
router.get('/export', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);

    // Fetch all data in parallel
    const [pages, pageViews] = await Promise.all([
      prisma.page.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pageView.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        pages,
        pageViews,
      },
      meta: {
        counts: {
          pages: pages.length,
          pageViews: pageViews.length,
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
 * Restore page data from backup
 */
router.post('/restore', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);
    const { pages, pageViews } = req.body as {
      pages?: Array<{
        id: string;
        tenantId: string;
        slug: string;
        title: string;
        type: 'STATIC' | 'NOTICE';
        content: string;
        excerpt?: string | null;
        status: 'DRAFT' | 'PUBLISHED';
        badge?: string | null;
        badgeColor?: string | null;
        isPinned: boolean;
        template?: string | null;
        viewCount: number;
        authorId: string;
        publishedAt?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      pageViews?: Array<{
        id: string;
        tenantId: string;
        pageId: string;
        ipHash: string;
        createdAt: string;
      }>;
    };

    const results = {
      pages: { restored: 0, skipped: 0 },
      pageViews: { restored: 0, skipped: 0 },
    };

    // 1. Restore pages first (pageViews reference them)
    if (pages && Array.isArray(pages)) {
      for (const page of pages) {
        try {
          await prisma.page.upsert({
            where: { id: page.id },
            update: {
              slug: page.slug,
              title: page.title,
              type: page.type,
              content: page.content,
              excerpt: page.excerpt,
              status: page.status,
              badge: page.badge,
              badgeColor: page.badgeColor,
              isPinned: page.isPinned,
              template: page.template,
              viewCount: page.viewCount,
              publishedAt: page.publishedAt ? new Date(page.publishedAt) : null,
              updatedAt: new Date(),
            },
            create: {
              id: page.id,
              tenantId: page.tenantId,
              slug: page.slug,
              title: page.title,
              type: page.type,
              content: page.content,
              excerpt: page.excerpt,
              status: page.status,
              badge: page.badge,
              badgeColor: page.badgeColor,
              isPinned: page.isPinned,
              template: page.template,
              viewCount: page.viewCount,
              authorId: page.authorId,
              publishedAt: page.publishedAt ? new Date(page.publishedAt) : null,
              createdAt: new Date(page.createdAt),
              updatedAt: new Date(),
            },
          });
          results.pages.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore page ${page.id}:`, error);
          results.pages.skipped++;
        }
      }
    }

    // 2. Restore pageViews
    if (pageViews && Array.isArray(pageViews)) {
      for (const pv of pageViews) {
        try {
          await prisma.pageView.upsert({
            where: { id: pv.id },
            update: {
              pageId: pv.pageId,
              ipHash: pv.ipHash,
            },
            create: {
              id: pv.id,
              tenantId: pv.tenantId,
              pageId: pv.pageId,
              ipHash: pv.ipHash,
              createdAt: new Date(pv.createdAt),
            },
          });
          results.pageViews.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore pageView ${pv.id}:`, error);
          results.pageViews.skipped++;
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
  res.json({ status: 'ok', service: 'page-service', internal: true });
});

export const internalRouter = router;
