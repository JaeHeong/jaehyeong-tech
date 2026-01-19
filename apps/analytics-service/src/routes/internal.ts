/**
 * Internal API Routes for Analytics Service
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
 * Export all analytics data for backup purposes
 */
router.get('/export', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);

    // Fetch all data in parallel
    const [siteVisitors, bugReports] = await Promise.all([
      prisma.siteVisitor.findMany({
        orderBy: { date: 'desc' },
      }),
      prisma.bugReport.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        siteVisitors,
        bugReports,
      },
      meta: {
        counts: {
          siteVisitors: siteVisitors.length,
          bugReports: bugReports.length,
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
 * Restore analytics data from backup
 */
router.post('/restore', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);
    const { siteVisitors, bugReports } = req.body as {
      siteVisitors?: Array<{
        id: string;
        tenantId: string;
        ipHash: string;
        date: string;
        createdAt: string;
      }>;
      bugReports?: Array<{
        id: string;
        tenantId: string;
        title: string;
        description: string;
        category: 'UI' | 'FUNCTIONAL' | 'PERFORMANCE' | 'SECURITY' | 'ETC';
        priority: 'LOW' | 'MEDIUM' | 'HIGH';
        status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
        email?: string | null;
        ipHash?: string | null;
        adminResponse?: string | null;
        respondedAt?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    };

    const results = {
      siteVisitors: { restored: 0, skipped: 0 },
      bugReports: { restored: 0, skipped: 0 },
    };

    // 1. Restore siteVisitors
    if (siteVisitors && Array.isArray(siteVisitors)) {
      for (const sv of siteVisitors) {
        try {
          await prisma.siteVisitor.upsert({
            where: { id: sv.id },
            update: {
              ipHash: sv.ipHash,
              date: new Date(sv.date),
            },
            create: {
              id: sv.id,
              tenantId: sv.tenantId,
              ipHash: sv.ipHash,
              date: new Date(sv.date),
              createdAt: new Date(sv.createdAt),
            },
          });
          results.siteVisitors.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore siteVisitor ${sv.id}:`, error);
          results.siteVisitors.skipped++;
        }
      }
    }

    // 2. Restore bugReports
    if (bugReports && Array.isArray(bugReports)) {
      for (const br of bugReports) {
        try {
          await prisma.bugReport.upsert({
            where: { id: br.id },
            update: {
              title: br.title,
              description: br.description,
              category: br.category,
              priority: br.priority,
              status: br.status,
              email: br.email,
              ipHash: br.ipHash,
              adminResponse: br.adminResponse,
              respondedAt: br.respondedAt ? new Date(br.respondedAt) : null,
              updatedAt: new Date(),
            },
            create: {
              id: br.id,
              tenantId: br.tenantId,
              title: br.title,
              description: br.description,
              category: br.category,
              priority: br.priority,
              status: br.status,
              email: br.email,
              ipHash: br.ipHash,
              adminResponse: br.adminResponse,
              respondedAt: br.respondedAt ? new Date(br.respondedAt) : null,
              createdAt: new Date(br.createdAt),
              updatedAt: new Date(),
            },
          });
          results.bugReports.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore bugReport ${br.id}:`, error);
          results.bugReports.skipped++;
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
  res.json({ status: 'ok', service: 'analytics-service', internal: true });
});

export const internalRouter = router;
