import { tenantPrisma } from '../../../db';

export async function exportData(siteId: string) {
  try {
    const prisma = tenantPrisma.getClient(siteId);

    // Fetch all data in parallel
    const [siteVisitors, bugReports] = await Promise.all([
      prisma.siteVisitor.findMany({
        orderBy: { date: 'desc' },
      }),
      prisma.bugReport.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
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
        tenantId: siteId,
      },
    };
  } catch (error) {
    throw error;
  }
}

export async function restoreData(siteId: string, input: unknown) {
  try {
    const prisma = tenantPrisma.getClient(siteId);
    const { siteVisitors, bugReports } = input as {
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
      siteVisitors: { deleted: 0, restored: 0, skipped: 0 },
      bugReports: { deleted: 0, restored: 0, skipped: 0 },
    };

    const tenantId = siteId;

    // 1. Delete existing data
    const deletedVisitors = await prisma.siteVisitor.deleteMany({ where: { tenantId } });
    const deletedBugReports = await prisma.bugReport.deleteMany({ where: { tenantId } });
    results.siteVisitors.deleted = deletedVisitors.count;
    results.bugReports.deleted = deletedBugReports.count;
    console.info(`[Restore] Deleted ${deletedVisitors.count} siteVisitors and ${deletedBugReports.count} bugReports for tenant ${tenantId}`);

    // 2. Restore siteVisitors
    if (siteVisitors && Array.isArray(siteVisitors)) {
      for (const sv of siteVisitors) {
        try {
          await prisma.siteVisitor.create({
            data: {
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

    // 3. Restore bugReports
    if (bugReports && Array.isArray(bugReports)) {
      for (const br of bugReports) {
        try {
          await prisma.bugReport.create({
            data: {
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

    return {
      success: true,
      data: results,
      meta: {
        restoredAt: new Date().toISOString(),
        tenantId: siteId,
      },
    };
  } catch (error) {
    throw error;
  }
}
