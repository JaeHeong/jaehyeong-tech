import { PrismaClient } from '../generated/prisma';
import { getTenantDatabaseUrl } from '@shared/utils';

/**
 * Tenant-aware Prisma Client Manager
 */
class TenantPrismaManager {
  private clients: Map<string, PrismaClient> = new Map();
  private urls: Map<string, string> = new Map();
  private defaultClient: PrismaClient | null = null;

  getClient(tenantId: string): PrismaClient {
    const dbUrl = getTenantDatabaseUrl(tenantId);
    const existingUrl = this.urls.get(tenantId);

    if (existingUrl === dbUrl && this.clients.has(tenantId)) {
      return this.clients.get(tenantId)!;
    }

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
    console.info(`[Page] Created Prisma client for tenant: ${tenantId}`);
    return client;
  }

  getDefaultClient(): PrismaClient {
    if (!this.defaultClient) {
      this.defaultClient = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
    }
    return this.defaultClient;
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(client => client.$disconnect());
    if (this.defaultClient) promises.push(this.defaultClient.$disconnect());
    await Promise.all(promises);
    this.clients.clear();
    this.urls.clear();
    this.defaultClient = null;
    console.info('[Page] All Prisma clients disconnected');
  }
}

export const tenantPrisma = new TenantPrismaManager();

// Legacy export for backward compatibility
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
