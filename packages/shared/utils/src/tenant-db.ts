/**
 * Tenant Database URL Manager
 *
 * Manages dynamic database URLs per tenant.
 * Each service uses its own Prisma client with the URL from this manager.
 *
 * Environment variables pattern:
 * - DATABASE_URL_<TENANT_ID>: Tenant-specific database URL
 *   (e.g., DATABASE_URL_JAEHYEONG_TECH for tenant "jaehyeong-tech")
 * - DATABASE_URL: Default fallback for tenants without specific URL
 *
 * Usage in service:
 * ```typescript
 * import { TenantDbUrlManager } from '@shared/utils';
 * import { PrismaClient } from '../generated/prisma';
 *
 * const urlManager = TenantDbUrlManager.getInstance();
 *
 * // In middleware or request handler:
 * const dbUrl = urlManager.getDatabaseUrl(tenantId);
 * const prisma = new PrismaClient({ datasourceUrl: dbUrl });
 * ```
 */

export interface TenantDbConfig {
  tenantId: string;
  url: string;
  isDedicated: boolean;
}

export class TenantDbUrlManager {
  private static instance: TenantDbUrlManager;
  private defaultUrl: string;
  private urlCache: Map<string, TenantDbConfig> = new Map();

  private constructor() {
    this.defaultUrl = process.env.DATABASE_URL || '';
    this.loadTenantConfigs();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TenantDbUrlManager {
    if (!TenantDbUrlManager.instance) {
      TenantDbUrlManager.instance = new TenantDbUrlManager();
    }
    return TenantDbUrlManager.instance;
  }

  /**
   * Load tenant configs from environment variables
   */
  private loadTenantConfigs(): void {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('DATABASE_URL_')) {
        const normalizedId = key.replace('DATABASE_URL_', '');
        const tenantId = normalizedId.toLowerCase().replace(/_/g, '-');
        const url = process.env[key]!;

        this.urlCache.set(tenantId, {
          tenantId,
          url,
          isDedicated: true,
        });

        console.info(`[TenantDB] Loaded dedicated DB for tenant: ${tenantId}`);
      }
    }
  }

  /**
   * Normalize tenant ID to environment variable format
   * jaehyeong-tech -> JAEHYEONG_TECH
   */
  private normalizeToEnvKey(tenantId: string): string {
    return tenantId.toUpperCase().replace(/-/g, '_');
  }

  /**
   * Get DATABASE_URL for a specific tenant
   * Priority:
   * 1. DATABASE_URL_<TENANT_ID> (cached or from env)
   * 2. DATABASE_URL (default)
   */
  getDatabaseUrl(tenantId: string): string {
    // Check cache first
    const cached = this.urlCache.get(tenantId);
    if (cached) {
      return cached.url;
    }

    // Check environment variable
    const envKey = `DATABASE_URL_${this.normalizeToEnvKey(tenantId)}`;
    const tenantSpecificUrl = process.env[envKey];

    if (tenantSpecificUrl) {
      // Cache it
      this.urlCache.set(tenantId, {
        tenantId,
        url: tenantSpecificUrl,
        isDedicated: true,
      });
      return tenantSpecificUrl;
    }

    // Return default
    return this.defaultUrl;
  }

  /**
   * Get tenant database config
   */
  getTenantConfig(tenantId: string): TenantDbConfig {
    const url = this.getDatabaseUrl(tenantId);
    const cached = this.urlCache.get(tenantId);

    return {
      tenantId,
      url,
      isDedicated: cached?.isDedicated ?? false,
    };
  }

  /**
   * Check if tenant has a dedicated database
   */
  hasDedicatedDatabase(tenantId: string): boolean {
    const config = this.getTenantConfig(tenantId);
    return config.isDedicated;
  }

  /**
   * Get all configured tenant IDs with dedicated databases
   */
  getConfiguredTenants(): string[] {
    return Array.from(this.urlCache.keys());
  }

  /**
   * Get default database URL
   */
  getDefaultUrl(): string {
    return this.defaultUrl;
  }

  /**
   * Reload configs from environment (useful for hot reloading)
   */
  reload(): void {
    this.urlCache.clear();
    this.defaultUrl = process.env.DATABASE_URL || '';
    this.loadTenantConfigs();
  }
}

// Export singleton getter for convenience
export const tenantDbUrlManager = TenantDbUrlManager.getInstance();

/**
 * Get database URL for a tenant
 */
export const getTenantDatabaseUrl = (tenantId: string): string => {
  return TenantDbUrlManager.getInstance().getDatabaseUrl(tenantId);
};
