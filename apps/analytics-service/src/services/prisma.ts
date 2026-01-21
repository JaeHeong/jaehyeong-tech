import { PrismaClient } from '../generated/prisma';
import { getTenantDatabaseUrl } from '@shared/utils';

/**
 * Tenant-aware Prisma Client Manager
 *
 * Manages PrismaClient instances per tenant for dynamic database routing.
 * Each tenant can have its own dedicated database, or share the default one.
 */
class TenantPrismaManager {
  private clients: Map<string, PrismaClient> = new Map();
  private urls: Map<string, string> = new Map();
  private defaultClient: PrismaClient | null = null;

  /**
   * Get PrismaClient for a specific tenant
   */
  getClient(tenantId: string): PrismaClient {
    const dbUrl = getTenantDatabaseUrl(tenantId);

    // Check if we have a cached client with the same URL
    const existingUrl = this.urls.get(tenantId);
    if (existingUrl === dbUrl && this.clients.has(tenantId)) {
      return this.clients.get(tenantId)!;
    }

    // URL changed or new tenant - create new client
    const existingClient = this.clients.get(tenantId);
    if (existingClient) {
      existingClient.$disconnect().catch(console.error);
    }

    const client = new PrismaClient({
      datasourceUrl: dbUrl,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    this.clients.set(tenantId, client);
    this.urls.set(tenantId, dbUrl);

    console.info(`[Analytics] Created Prisma client for tenant: ${tenantId}`);
    return client;
  }

  /**
   * Get default PrismaClient (for non-tenant operations like health checks)
   */
  getDefaultClient(): PrismaClient {
    if (!this.defaultClient) {
      this.defaultClient = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
    }
    return this.defaultClient;
  }

  /**
   * Disconnect all clients (for graceful shutdown)
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(client =>
      client.$disconnect()
    );

    if (this.defaultClient) {
      promises.push(this.defaultClient.$disconnect());
    }

    await Promise.all(promises);
    this.clients.clear();
    this.urls.clear();
    this.defaultClient = null;

    console.info('[Analytics] All Prisma clients disconnected');
  }

  /**
   * Get connection stats
   */
  getStats(): { totalConnections: number; tenants: string[] } {
    return {
      totalConnections: this.clients.size + (this.defaultClient ? 1 : 0),
      tenants: Array.from(this.clients.keys()),
    };
  }
}

// Singleton instance
export const tenantPrisma = new TenantPrismaManager();

// Legacy export for backward compatibility (uses default client)
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await tenantPrisma.disconnectAll();
  await prisma.$disconnect();
});

process.on('SIGTERM', async () => {
  await tenantPrisma.disconnectAll();
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await tenantPrisma.disconnectAll();
  await prisma.$disconnect();
});
