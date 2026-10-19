import { tenantPrisma } from '../../../db';

export async function exportData(siteId: string) {
  try {
    const prisma = tenantPrisma.getClient(siteId);

    const comments = await prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: {
        comments,
      },
      meta: {
        counts: {
          comments: comments.length,
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
    const { comments } = input as {
      comments?: Array<{
        id: string;
        tenantId: string;
        resourceType: string;
        resourceId: string;
        content: string;
        authorId?: string | null;
        guestName?: string | null;
        guestEmail?: string | null;
        parentId?: string | null;
        status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SPAM';
        isPrivate: boolean;
        isDeleted: boolean;
        ipHash: string;
        createdAt: string;
        updatedAt: string;
      }>;
    };

    const results = {
      comments: { deleted: 0, restored: 0, skipped: 0 },
    };

    const tenantId = siteId;

    // 1. Delete all existing comments for this tenant
    const deleteResult = await prisma.comment.deleteMany({
      where: { tenantId },
    });
    results.comments.deleted = deleteResult.count;
    console.info(`[Restore] Deleted ${deleteResult.count} comments for tenant ${tenantId}`);

    // 2. Restore comments (sort by parentId to restore parents first)
    if (comments && Array.isArray(comments)) {
      const sortedComments = [...comments].sort((a, b) => {
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        return 0;
      });

      for (const comment of sortedComments) {
        try {
          await prisma.comment.create({
            data: {
              id: comment.id,
              tenantId: comment.tenantId,
              resourceType: comment.resourceType,
              resourceId: comment.resourceId,
              content: comment.content,
              authorId: comment.authorId,
              guestName: comment.guestName,
              guestEmail: comment.guestEmail,
              parentId: comment.parentId,
              status: comment.status,
              isPrivate: comment.isPrivate,
              isDeleted: comment.isDeleted,
              ipHash: comment.ipHash,
              createdAt: new Date(comment.createdAt),
              updatedAt: new Date(),
            },
          });
          results.comments.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore comment ${comment.id}:`, error);
          results.comments.skipped++;
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
