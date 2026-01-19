/**
 * Internal API Routes for Blog Service
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
 * Only allows requests from within the cluster (via Istio mesh)
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
 * Export all blog data for backup purposes
 *
 * Returns: posts, drafts, categories, tags with all relationships
 */
router.get('/export', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);

    // Fetch all data in parallel
    const [posts, drafts, categories, tags] = await Promise.all([
      prisma.post.findMany({
        include: {
          category: true,
          tags: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.draft.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.tag.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        posts,
        drafts,
        categories,
        tags,
      },
      meta: {
        counts: {
          posts: posts.length,
          drafts: drafts.length,
          categories: categories.length,
          tags: tags.length,
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
 * GET /internal/draft-image-urls
 * Get image URLs used in draft content (for orphan detection)
 */
router.get('/draft-image-urls', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);

    // Get all drafts with content
    const drafts = await prisma.draft.findMany({
      select: { content: true },
    });

    // Extract image URLs from draft content
    const imageUrls = new Set<string>();
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;

    for (const draft of drafts) {
      if (!draft.content) continue;

      // HTML img tags
      let match;
      while ((match = imgRegex.exec(draft.content)) !== null) {
        imageUrls.add(match[1]);
      }

      // Markdown images
      while ((match = mdImgRegex.exec(draft.content)) !== null) {
        imageUrls.add(match[1]);
      }
    }

    res.json({
      success: true,
      data: {
        urls: Array.from(imageUrls),
        count: imageUrls.size,
      },
      meta: {
        draftsScanned: drafts.length,
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
  res.json({ status: 'ok', service: 'blog-service', internal: true });
});

export const internalRouter = router;
