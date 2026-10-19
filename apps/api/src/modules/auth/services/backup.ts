import { tenantPrisma } from '../../../db';

export async function exportData(siteId: string) {
  try {
    const prisma = tenantPrisma.getClient(siteId);

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

    return {
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
        tenantId: siteId,
        note: 'Sensitive data (passwords, secrets) excluded from export',
      },
    };
  } catch (error) {
    throw error;
  }
}

export async function restoreData(siteId: string, input: unknown) {
  try {
    const prisma = tenantPrisma.getClient(siteId);
    const { users, tenant } = input as {
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
      where: { tenantId: siteId },
    });
    results.users.deleted = deleteResult.count;
    console.info(`[Restore] Deleted ${deleteResult.count} existing users for tenant ${siteId}`);

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

    return {
      success: true,
      data: results,
      meta: {
        restoredAt: new Date().toISOString(),
        tenantId: siteId,
        note: 'Passwords cannot be restored from backup. New users will need to reset their password.',
      },
    };
  } catch (error) {
    throw error;
  }
}
