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
 * GET /internal/users/basic
 * Get basic user info (id, name, avatar) for multiple user IDs
 * Used by comment-service for admin comments enrichment
 */
router.get('/users/basic', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);
    const idsParam = req.query.ids as string;

    if (!idsParam) {
      res.json({ success: true, data: {} });
      return;
    }

    const ids = idsParam.split(',').filter(Boolean);

    if (ids.length === 0) {
      res.json({ success: true, data: {} });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: ids },
      },
      select: {
        id: true,
        name: true,
        avatar: true,
      },
    });

    // Return as a map for easy lookup
    const usersMap: Record<string, { id: string; name: string; avatar: string | null }> = {};
    for (const user of users) {
      usersMap[user.id] = user;
    }

    res.json({
      success: true,
      data: usersMap,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /internal/restore
 * Restore auth data from backup
 *
 * Note: Passwords and secrets cannot be restored from backup.
 * Users will be upserted (updated if exists, created if not).
 */
router.post('/restore', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);
    const { users, tenant } = req.body as {
      users?: Array<{
        id: string;
        tenantId: string;
        email: string;
        googleId?: string | null;
        githubId?: string | null;
        name: string;
        avatar?: string | null;
        bio?: string | null;
        title?: string | null;
        github?: string | null;
        twitter?: string | null;
        linkedin?: string | null;
        website?: string | null;
        role: 'USER' | 'ADMIN';
        status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
        lastLoginAt?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      tenant?: {
        id: string;
        name: string;
        domain: string;
        jwtExpiry?: string;
        allowRegistration?: boolean;
        allowGoogleOauth?: boolean;
        allowGithubOauth?: boolean;
        passwordMinLength?: number;
        passwordRequireUppercase?: boolean;
        passwordRequireNumber?: boolean;
        passwordRequireSpecial?: boolean;
        isActive?: boolean;
        createdAt: string;
        updatedAt: string;
      };
    };

    const results = {
      users: { deleted: 0, restored: 0, skipped: 0 },
      tenant: { restored: false },
    };

    // 1. Delete all existing users for this tenant (full restore)
    const deleteResult = await prisma.user.deleteMany({
      where: { tenantId: req.tenant!.id },
    });
    results.users.deleted = deleteResult.count;
    console.info(`[Restore] Deleted ${deleteResult.count} existing users for tenant ${req.tenant!.id}`);

    // 2. Restore tenant config (update only, do not create new tenant)
    if (tenant) {
      await prisma.tenant.updateMany({
        where: { id: tenant.id },
        data: {
          domain: tenant.domain,
          jwtExpiry: tenant.jwtExpiry,
          allowRegistration: tenant.allowRegistration,
          allowGoogleOauth: tenant.allowGoogleOauth,
          allowGithubOauth: tenant.allowGithubOauth,
          passwordMinLength: tenant.passwordMinLength,
          passwordRequireUppercase: tenant.passwordRequireUppercase,
          passwordRequireNumber: tenant.passwordRequireNumber,
          passwordRequireSpecial: tenant.passwordRequireSpecial,
          isActive: tenant.isActive,
          updatedAt: new Date(),
        },
      });
      results.tenant.restored = true;
    }

    // 3. Restore users (all users were deleted, so create new ones)
    if (users && Array.isArray(users)) {
      for (const user of users) {
        try {
          await prisma.user.create({
            data: {
              id: user.id,
              tenantId: user.tenantId,
              email: user.email,
              password: '', // Empty password - user must reset
              googleId: user.googleId,
              githubId: user.githubId,
              name: user.name,
              avatar: user.avatar,
              bio: user.bio,
              title: user.title,
              github: user.github,
              twitter: user.twitter,
              linkedin: user.linkedin,
              website: user.website,
              role: user.role,
              status: user.status,
              lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
              createdAt: new Date(user.createdAt),
              updatedAt: new Date(),
            },
          });
          results.users.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore user ${user.id}:`, error);
          results.users.skipped++;
        }
      }
    }

    res.json({
      success: true,
      data: results,
      meta: {
        restoredAt: new Date().toISOString(),
        tenantId: req.tenant!.id,
        note: 'Passwords cannot be restored from backup. New users will need to reset their password.',
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
