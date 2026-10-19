import { tenantPrisma } from '../../../db';

export async function exportData(siteId: string) {
  try {
    const prisma = tenantPrisma.getClient(siteId);

    // Fetch all data in parallel
    const [pages, pageViews] = await Promise.all([
      prisma.page.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pageView.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      success: true,
      data: {
        pages,
        pageViews,
      },
      meta: {
        counts: {
          pages: pages.length,
          pageViews: pageViews.length,
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
    const { pages, pageViews } = input as {
      pages?: Array<{
        id: string;
        tenantId: string;
        slug: string;
        title: string;
        type: 'STATIC' | 'NOTICE';
        content: string;
        excerpt?: string | null;
        status: 'DRAFT' | 'PUBLISHED';
        badge?: string | null;
        badgeColor?: string | null;
        isPinned: boolean;
        template?: string | null;
        viewCount: number;
        authorId: string;
        publishedAt?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      pageViews?: Array<{
        id: string;
        tenantId: string;
        pageId: string;
        ipHash: string;
        createdAt: string;
      }>;
    };

    const results = {
      pages: { deleted: 0, restored: 0, skipped: 0 },
      pageViews: { deleted: 0, restored: 0, skipped: 0 },
    };

    const tenantId = siteId;

    // 1. Delete existing data (pageViews first due to FK)
    const deletedPageViews = await prisma.pageView.deleteMany({ where: { tenantId } });
    const deletedPages = await prisma.page.deleteMany({ where: { tenantId } });
    results.pageViews.deleted = deletedPageViews.count;
    results.pages.deleted = deletedPages.count;
    console.info(`[Restore] Deleted ${deletedPages.count} pages and ${deletedPageViews.count} pageViews for tenant ${tenantId}`);

    // 2. Restore pages first (pageViews reference them)
    if (pages && Array.isArray(pages)) {
      for (const page of pages) {
        try {
          await prisma.page.create({
            data: {
              id: page.id,
              tenantId: page.tenantId,
              slug: page.slug,
              title: page.title,
              type: page.type,
              content: page.content,
              excerpt: page.excerpt,
              status: page.status,
              badge: page.badge,
              badgeColor: page.badgeColor,
              isPinned: page.isPinned,
              template: page.template,
              viewCount: page.viewCount,
              authorId: page.authorId,
              publishedAt: page.publishedAt ? new Date(page.publishedAt) : null,
              createdAt: new Date(page.createdAt),
              updatedAt: new Date(),
            },
          });
          results.pages.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore page ${page.id}:`, error);
          results.pages.skipped++;
        }
      }
    }

    // 3. Restore pageViews
    if (pageViews && Array.isArray(pageViews)) {
      for (const pv of pageViews) {
        try {
          await prisma.pageView.create({
            data: {
              id: pv.id,
              tenantId: pv.tenantId,
              pageId: pv.pageId,
              ipHash: pv.ipHash,
              createdAt: new Date(pv.createdAt),
            },
          });
          results.pageViews.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore pageView ${pv.id}:`, error);
          results.pageViews.skipped++;
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
