/**
 * Internal API Routes for Blog Service
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
 * Only allows requests from within the cluster (via Istio mesh)
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
 * Export all blog data for backup purposes
 *
 * Returns: posts, drafts, categories, tags with all relationships
 */
router.get('/export', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);

    // Fetch all data in parallel
    const [posts, drafts, categories, tags] = await Promise.all([
      prisma.post.findMany({
        include: {
          category: true,
          tags: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.draft.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.tag.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        posts,
        drafts,
        categories,
        tags,
      },
      meta: {
        counts: {
          posts: posts.length,
          drafts: drafts.length,
          categories: categories.length,
          tags: tags.length,
        },
        exportedAt: new Date().toISOString(),
        tenantId: req.tenant!.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/draft-image-urls
 * Get image URLs used in draft content (for orphan detection)
 */
router.get('/draft-image-urls', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);

    // Get all drafts with content
    const drafts = await prisma.draft.findMany({
      select: { content: true },
    });

    // Extract image URLs from draft content
    const imageUrls = new Set<string>();
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;

    for (const draft of drafts) {
      if (!draft.content) continue;

      // HTML img tags
      let match;
      while ((match = imgRegex.exec(draft.content)) !== null) {
        imageUrls.add(match[1]);
      }

      // Markdown images
      while ((match = mdImgRegex.exec(draft.content)) !== null) {
        imageUrls.add(match[1]);
      }
    }

    res.json({
      success: true,
      data: {
        urls: Array.from(imageUrls),
        count: imageUrls.size,
      },
      meta: {
        draftsScanned: drafts.length,
        tenantId: req.tenant!.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/posts/basic
 * Get basic post info (id, slug, title) for multiple post IDs
 * Used by comment-service for admin comments enrichment
 */
router.get('/posts/basic', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
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

    const posts = await prisma.post.findMany({
      where: {
        id: { in: ids },
      },
      select: {
        id: true,
        slug: true,
        title: true,
      },
    });

    // Return as a map for easy lookup
    const postsMap: Record<string, { id: string; slug: string; title: string }> = {};
    for (const post of posts) {
      postsMap[post.id] = post;
    }

    res.json({
      success: true,
      data: postsMap,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /internal/restore
 * Restore blog data from backup
 *
 * Restore order: categories -> tags -> posts -> drafts
 * Posts are upserted, relationships are recreated
 */
router.post('/restore', verifyInternalRequest, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = tenantPrisma.getClient(req.tenant!.id);
    const { posts, drafts, categories, tags } = req.body as {
      posts?: Array<{
        id: string;
        tenantId: string;
        slug: string;
        title: string;
        excerpt: string;
        content: string;
        coverImage?: string | null;
        viewCount: number;
        likeCount: number;
        readingTime: number;
        status: 'DRAFT' | 'PUBLIC' | 'PRIVATE';
        featured: boolean;
        publishedAt?: string | null;
        authorId: string;
        categoryId: string;
        category?: { id: string; name: string } | null;
        tags?: Array<{ id: string; name: string; slug: string }>;
        createdAt: string;
        updatedAt: string;
      }>;
      drafts?: Array<{
        id: string;
        tenantId: string;
        title?: string | null;
        content: string;
        excerpt?: string | null;
        coverImage?: string | null;
        categoryId?: string | null;
        tagIds: string[];
        authorId: string;
        createdAt: string;
        updatedAt: string;
      }>;
      categories?: Array<{
        id: string;
        tenantId: string;
        name: string;
        slug: string;
        description?: string | null;
        icon?: string | null;
        color?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      tags?: Array<{
        id: string;
        tenantId: string;
        name: string;
        slug: string;
        createdAt: string;
        updatedAt: string;
      }>;
    };

    const results = {
      categories: { restored: 0, skipped: 0 },
      tags: { restored: 0, skipped: 0 },
      posts: { restored: 0, skipped: 0 },
      drafts: { restored: 0, skipped: 0 },
    };

    // 1. Restore categories first (posts depend on them)
    if (categories && Array.isArray(categories)) {
      for (const category of categories) {
        try {
          await prisma.category.upsert({
            where: { id: category.id },
            update: {
              name: category.name,
              slug: category.slug,
              description: category.description,
              icon: category.icon,
              color: category.color,
              updatedAt: new Date(),
            },
            create: {
              id: category.id,
              tenantId: category.tenantId,
              name: category.name,
              slug: category.slug,
              description: category.description,
              icon: category.icon,
              color: category.color,
              createdAt: new Date(category.createdAt),
              updatedAt: new Date(),
            },
          });
          results.categories.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore category ${category.id}:`, error);
          results.categories.skipped++;
        }
      }
    }

    // 2. Restore tags (posts depend on them)
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        try {
          await prisma.tag.upsert({
            where: { id: tag.id },
            update: {
              name: tag.name,
              slug: tag.slug,
              updatedAt: new Date(),
            },
            create: {
              id: tag.id,
              tenantId: tag.tenantId,
              name: tag.name,
              slug: tag.slug,
              createdAt: new Date(tag.createdAt),
              updatedAt: new Date(),
            },
          });
          results.tags.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore tag ${tag.id}:`, error);
          results.tags.skipped++;
        }
      }
    }

    // 3. Restore posts (with category and tag relationships)
    if (posts && Array.isArray(posts)) {
      for (const post of posts) {
        try {
          // Extract tag IDs from the included tags
          const tagIds = post.tags?.map(t => t.id) || [];

          await prisma.post.upsert({
            where: { id: post.id },
            update: {
              slug: post.slug,
              title: post.title,
              excerpt: post.excerpt,
              content: post.content,
              coverImage: post.coverImage,
              viewCount: post.viewCount,
              likeCount: post.likeCount,
              readingTime: post.readingTime,
              status: post.status,
              featured: post.featured,
              publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
              categoryId: post.categoryId,
              tags: {
                set: tagIds.map(id => ({ id })),
              },
              updatedAt: new Date(),
            },
            create: {
              id: post.id,
              tenantId: post.tenantId,
              slug: post.slug,
              title: post.title,
              excerpt: post.excerpt,
              content: post.content,
              coverImage: post.coverImage,
              viewCount: post.viewCount,
              likeCount: post.likeCount,
              readingTime: post.readingTime,
              status: post.status,
              featured: post.featured,
              publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
              authorId: post.authorId,
              categoryId: post.categoryId,
              tags: {
                connect: tagIds.map(id => ({ id })),
              },
              createdAt: new Date(post.createdAt),
              updatedAt: new Date(),
            },
          });
          results.posts.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore post ${post.id}:`, error);
          results.posts.skipped++;
        }
      }
    }

    // 4. Restore drafts
    if (drafts && Array.isArray(drafts)) {
      for (const draft of drafts) {
        try {
          await prisma.draft.upsert({
            where: { id: draft.id },
            update: {
              title: draft.title,
              content: draft.content,
              excerpt: draft.excerpt,
              coverImage: draft.coverImage,
              categoryId: draft.categoryId,
              tagIds: draft.tagIds || [],
              updatedAt: new Date(),
            },
            create: {
              id: draft.id,
              tenantId: draft.tenantId,
              title: draft.title,
              content: draft.content,
              excerpt: draft.excerpt,
              coverImage: draft.coverImage,
              authorId: draft.authorId,
              categoryId: draft.categoryId,
              tagIds: draft.tagIds || [],
              createdAt: new Date(draft.createdAt),
              updatedAt: new Date(),
            },
          });
          results.drafts.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore draft ${draft.id}:`, error);
          results.drafts.skipped++;
        }
      }
    }

    res.json({
      success: true,
      data: results,
      meta: {
        restoredAt: new Date().toISOString(),
        tenantId: req.tenant!.id,
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
  res.json({ status: 'ok', service: 'blog-service', internal: true });
});

export const internalRouter = router;
