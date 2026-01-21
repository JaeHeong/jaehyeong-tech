import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { meilisearchService, PostDocument } from '../services/meilisearch';

const router: IRouter = Router();

const BLOG_SERVICE_URL = process.env.BLOG_SERVICE_URL || 'http://jaehyeong-tech-prod-blog:3002';

// Strip HTML tags from content for indexing
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Middleware to verify internal request
 */
function verifyInternalRequest(req: Request, res: Response, next: NextFunction): void {
  const internalHeader = req.headers['x-internal-request'];
  if (internalHeader !== 'true') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'This endpoint is only accessible for internal service communication',
    });
    return;
  }
  next();
}

/**
 * POST /internal/reindex
 * Reindex all posts from blog-service
 */
router.post('/reindex', verifyInternalRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      res.status(400).json({ error: 'x-tenant-id header is required' });
      return;
    }

    console.info(`🔄 Starting reindex for tenant: ${tenantId}`);

    // Fetch all public posts from blog-service
    const response = await fetch(`${BLOG_SERVICE_URL}/internal/posts/all`, {
      headers: {
        'x-internal-request': 'true',
        'x-tenant-id': tenantId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    const result = await response.json() as { data: unknown[] };
    const posts = result.data;

    // Transform posts to Meilisearch documents
    const documents: PostDocument[] = posts
      .filter((post: { status: string }) => post.status === 'PUBLIC')
      .map((post: {
        id: string;
        tenantId: string;
        slug: string;
        title: string;
        excerpt?: string;
        content?: string;
        categoryId: string;
        category?: { name: string; slug: string };
        tags?: { name: string }[];
        authorId: string;
        author?: { name: string };
        status: string;
        publishedAt?: string;
        createdAt: string;
        updatedAt: string;
        viewCount?: number;
        likeCount?: number;
      }) => ({
        id: post.id,
        tenantId: post.tenantId,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt || '',
        content: stripHtml(post.content || ''),
        categoryId: post.categoryId,
        categoryName: post.category?.name || '',
        categorySlug: post.category?.slug || '',
        tags: post.tags?.map((t) => t.name) || [],
        authorId: post.authorId,
        authorName: post.author?.name || '',
        status: post.status,
        publishedAt: post.publishedAt ? new Date(post.publishedAt).getTime() : null,
        createdAt: new Date(post.createdAt).getTime(),
        updatedAt: new Date(post.updatedAt).getTime(),
        viewCount: post.viewCount || 0,
        likeCount: post.likeCount || 0,
      }));

    // Bulk index
    await meilisearchService.bulkIndex(documents);

    res.json({
      success: true,
      data: {
        indexed: documents.length,
        tenantId,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /internal/index
 * Index a single post (called by blog-service)
 */
router.post('/index', verifyInternalRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = req.body as PostDocument;

    if (!post.id) {
      res.status(400).json({ error: 'Post ID is required' });
      return;
    }

    if (post.status === 'PUBLIC') {
      await meilisearchService.indexPost(post);
    } else {
      // Remove from index if not public
      await meilisearchService.deletePost(post.id);
    }

    res.json({
      success: true,
      data: { postId: post.id },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /internal/index/:postId
 * Remove a post from index
 */
router.delete('/index/:postId', verifyInternalRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.params;

    await meilisearchService.deletePost(postId);

    res.json({
      success: true,
      data: { postId },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/health
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'search-service', internal: true });
});

export const internalRouter: IRouter = router;
