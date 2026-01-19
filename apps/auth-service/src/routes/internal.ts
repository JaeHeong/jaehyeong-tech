/**
 * Internal API Routes for Auth Service
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
 * Export all auth data for backup purposes
 *
 * Note: Sensitive data (passwords, secrets) are excluded
 */
router.get('/export', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);

    // Fetch users (excluding password for security)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        tenantId: true,
        email: true,
        // password excluded for security
        googleId: true,
        githubId: true,
        name: true,
        avatar: true,
        bio: true,
        title: true,
        github: true,
        twitter: true,
        linkedin: true,
        website: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch tenant config (excluding secrets)
    const tenant = await prisma.tenant.findFirst({
      select: {
        id: true,
        name: true,
        domain: true,
        // jwtSecret excluded for security
        jwtExpiry: true,
        // OAuth secrets excluded for security
        allowRegistration: true,
        allowGoogleOauth: true,
        allowGithubOauth: true,
        passwordMinLength: true,
        passwordRequireUppercase: true,
        passwordRequireNumber: true,
        passwordRequireSpecial: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        users,
        tenant,
      },
      meta: {
        counts: {
          users: users.length,
        },
        exportedAt: new Date().toISOString(),
        tenantId: req.tenant!.id,
        note: 'Sensitive data (passwords, secrets) excluded from export',
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
  res.json({ status: 'ok', service: 'auth-service', internal: true });
});

export default router;
