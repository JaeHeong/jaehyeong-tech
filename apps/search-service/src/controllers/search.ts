import { Request, Response, NextFunction } from 'express';
import { meilisearchService } from '../services/meilisearch';

/**
 * GET /api/search
 * Full-text search across posts
 */
export async function searchPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      res.status(400).json({ error: 'x-tenant-id header is required' });
      return;
    }

    const query = (req.query.q as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const categorySlug = req.query.category as string;
    const tag = req.query.tag as string;
    const sortBy = req.query.sortBy as 'relevance' | 'publishedAt' | 'viewCount' | 'likeCount';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    const result = await meilisearchService.search(query, {
      tenantId,
      page,
      limit,
      categorySlug,
      tag,
      sortBy,
      sortOrder,
    });

    res.json({
      success: true,
      data: result.hits,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      meta: {
        query,
        processingTimeMs: result.processingTimeMs,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/search/stats
 * Get search index statistics
 */
export async function getSearchStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await meilisearchService.getStats();

    res.json({
      success: true,
      data: {
        numberOfDocuments: stats.numberOfDocuments,
        isIndexing: stats.isIndexing,
        fieldDistribution: stats.fieldDistribution,
      },
    });
  } catch (error) {
    next(error);
  }
}
