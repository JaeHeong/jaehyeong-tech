import { PrismaClient } from './generated/prisma';

// One database and one connection pool for the entire blog.
export const prisma = new PrismaClient({ log: ['error'] });

// Compatibility for domain controllers; tenant-specific pools are no longer created.
export const tenantPrisma = {
  getClient: (_siteId: string) => prisma,
  disconnectAll: () => prisma.$disconnect(),
};
