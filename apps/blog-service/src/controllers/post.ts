import { Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';
import { calculateReadingTime } from '../utils/readingTime';
import { hashIP, getClientIP } from '../utils/ipHash';
import slugifyLib from 'slugify';

// Type for slugify function
type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string;
const slugify: SlugifyFn =
  (slugifyLib as unknown as { default?: SlugifyFn }).default ||
  (slugifyLib as unknown as SlugifyFn);

// Auth service URL for internal calls (K8s service discovery)
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://jaehyeong-tech-dev-auth:3001';

// Author info type
interface AuthorInfo {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
}

/**
 * Fetch author info from auth-service (internal API)
 */
async function fetchAuthorFromAuthService(
  tenantId: string,
  authorId: string
): Promise<AuthorInfo | null> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/users/${authorId}/public`, {
      headers: {
        'x-tenant-id': tenantId,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch author ${authorId}: ${response.status}`);
      return null;
    }

    const json = await response.json();
    return json.data as AuthorInfo;
  } catch (error) {
    console.error(`Error fetching author ${authorId}:`, error);
    return null;
  }
}

// Featured post constants
const LIKE_WEIGHT = 5; // 1 like = 5 views worth

/**
 * Update featured post - sets featured=true on the post with highest score
 * Score = (likeCount * LIKE_WEIGHT) + viewCount
 * Only one post can be featured at a time per tenant
 */
export async function updateFeaturedPost(tenantId: string) {
  try {
    const prisma = tenantPrisma.getClient(tenantId);
    // Find all PUBLIC posts for this tenant and calculate score
    const posts = await prisma.post.findMany({
      where: { tenantId, status: 'PUBLIC' },
      select: { id: true, featured: true, likeCount: true, viewCount: true },
    });

    if (posts.length === 0) return;

    // Calculate score for each post and find the top one
    const topPost = posts.reduce((best, post) => {
      const postScore = post.likeCount * LIKE_WEIGHT + post.viewCount;
      const bestScore = best.likeCount * LIKE_WEIGHT + best.viewCount;
      return postScore > bestScore ? post : best;
    });

    // Only update if the top post is not already featured
    if (!topPost.featured) {
      // Remove featured from all posts
      await prisma.post.updateMany({
        where: { tenantId, featured: true },
        data: { featured: false },
      });

      // Set featured on the top post
      await prisma.post.update({
        where: { id: topPost.id },
        data: { featured: true },
      });
    }
  } catch (error) {
    console.error('Failed to update featured post:', error);
  }
}

/**
 * GET /api/posts
 * Public: Get posts with filtering and pagination
 */
export async function getPosts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;
    const tag = req.query.tag as string;
    const search = req.query.search as string;
    const statusFilter = req.query.status as string;
    const sortBy = (req.query.sortBy as string) || 'publishedAt';
    const featured = req.query.featured as string;

    const isAdmin = req.user?.role === 'ADMIN';

    const where: Record<string, unknown> = {
      tenantId: req.tenant.id,
    };

    // Status filtering
    if (statusFilter === 'PUBLISHED' || statusFilter === 'ALL') {
      if (!isAdmin) throw new AppError('권한이 없습니다.', 403);
      where.status = { in: ['PUBLIC', 'PRIVATE'] };
    } else if (statusFilter === 'PRIVATE') {
      if (!isAdmin) throw new AppError('권한이 없습니다.', 403);
      where.status = 'PRIVATE';
    } else if (statusFilter === 'DRAFT') {
      if (!isAdmin) throw new AppError('권한이 없습니다.', 403);
      where.status = 'DRAFT';
    } else if (statusFilter === 'PUBLIC') {
      where.status = 'PUBLIC';
    } else {
      // Default: Admin sees all, others see PUBLIC only
      if (isAdmin) {
        where.status = { in: ['PUBLIC', 'PRIVATE', 'DRAFT'] };
      } else {
        where.status = 'PUBLIC';
      }
    }

    // Category filter
    if (category) {
      where.category = { slug: category };
    }

    // Tag filter
    if (tag) {
      where.tags = { some: { slug: tag } };
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { category: { name: { contains: search, mode: 'insensitive' } } },
        { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    // Featured filter
    if (featured === 'true') {
      where.featured = true;
    }

    // Sorting
    let orderByField: 'publishedAt' | 'updatedAt' | 'viewCount' | 'likeCount' = 'publishedAt';
    if (sortBy === 'viewCount' || sortBy === 'likeCount' || sortBy === 'updatedAt') {
      orderByField = sortBy;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          category: true,
          tags: true,
        },
        orderBy: { [orderByField]: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    res.json({
      data: posts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/posts/featured
 * Public: Get featured posts
 */
export async function getFeaturedPosts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const posts = await prisma.post.findMany({
      where: { tenantId: req.tenant.id, status: 'PUBLIC', featured: true },
      include: {
        category: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    });

    res.json({ data: posts });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/posts/top-viewed
 * Public: Get top post by popularity score
 */
export async function getTopViewedPost(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const categorySlug = req.query.category as string;

    const where: Record<string, unknown> = {
      tenantId: req.tenant.id,
      status: 'PUBLIC',
    };

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        category: true,
        tags: true,
      },
      take: 20,
    });

    // Sort by popularity score: (likeCount * 5) + viewCount
    const sorted = posts.sort((a, b) => {
      const scoreA = a.likeCount * LIKE_WEIGHT + a.viewCount;
      const scoreB = b.likeCount * LIKE_WEIGHT + b.viewCount;
      return scoreB - scoreA;
    });

    res.json({ data: sorted[0] || null });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/posts/:slug
 * Public: Get post by slug (increments view count)
 */
export async function getPostBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { slug } = req.params;

    const post = await prisma.post.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
      include: {
        category: true,
        tags: true,
      },
    });

    if (!post) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404);
    }

    // Visibility check
    if (post.status !== 'PUBLIC') {
      const isAdmin = req.user?.role === 'ADMIN';
      if (!isAdmin) {
        throw new AppError('게시글을 찾을 수 없습니다.', 404);
      }
    }

    // Track unique view by IP hash (24-hour based)
    const ipHash = hashIP(getClientIP(req));
    let viewIncremented = false;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Check if this IP has viewed this post within the last 24 hours
    const existingView = await prisma.postView.findUnique({
      where: {
        tenantId_postId_ipHash: {
          tenantId: req.tenant.id,
          postId: post.id,
          ipHash,
        },
      },
    });

    if (!existingView) {
      // New unique view - create view record and increment count
      await prisma.$transaction([
        prisma.postView.create({
          data: {
            tenantId: req.tenant.id,
            postId: post.id,
            ipHash,
          },
        }),
        prisma.post.update({
          where: { id: post.id },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
      viewIncremented = true;
    } else if (existingView.createdAt < twentyFourHoursAgo) {
      // View record exists but is older than 24 hours - update timestamp and increment count
      await prisma.$transaction([
        prisma.postView.update({
          where: { id: existingView.id },
          data: { createdAt: new Date() },
        }),
        prisma.post.update({
          where: { id: post.id },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
      viewIncremented = true;
    }

    // Update featured post if view count changed
    if (viewIncremented) {
      await updateFeaturedPost(req.tenant.id);
    }

    // Fetch author from auth-service
    const author = await fetchAuthorFromAuthService(req.tenant.id, post.authorId);

    res.json({
      data: {
        ...post,
        viewCount: post.viewCount + (viewIncremented ? 1 : 0),
        author,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/posts/:slug/adjacent
 * Public: Get adjacent posts (previous and next)
 */
export async function getAdjacentPosts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { slug } = req.params;

    const currentPost = await prisma.post.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
      select: { id: true, publishedAt: true, status: true },
    });

    if (!currentPost) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404);
    }

    const whereClause = {
      tenantId: req.tenant.id,
      status: 'PUBLIC' as const,
    };

    // Get previous post (older)
    const prevPost = await prisma.post.findFirst({
      where: {
        ...whereClause,
        publishedAt: { lt: currentPost.publishedAt || new Date() },
        id: { not: currentPost.id },
      },
      orderBy: { publishedAt: 'desc' },
      select: { slug: true, title: true, coverImage: true },
    });

    // Get next post (newer)
    const nextPost = await prisma.post.findFirst({
      where: {
        ...whereClause,
        publishedAt: { gt: currentPost.publishedAt || new Date() },
        id: { not: currentPost.id },
      },
      orderBy: { publishedAt: 'asc' },
      select: { slug: true, title: true, coverImage: true },
    });

    res.json({
      data: {
        prev: prevPost,
        next: nextPost,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/posts/:slug/related
 * Public: Get related posts (weighted scoring)
 */
export async function getRelatedPosts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { slug } = req.params;
    const limit = 3;

    const currentPost = await prisma.post.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
      select: {
        id: true,
        categoryId: true,
        tags: { select: { id: true } },
      },
    });

    if (!currentPost) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404);
    }

    const currentTagIds = currentPost.tags.map((t) => t.id);

    // Get candidate posts
    const candidates = await prisma.post.findMany({
      where: {
        tenantId: req.tenant.id,
        status: 'PUBLIC',
        id: { not: currentPost.id },
        OR: [
          { categoryId: currentPost.categoryId },
          { tags: { some: { id: { in: currentTagIds } } } },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        publishedAt: true,
        categoryId: true,
        category: { select: { name: true, slug: true } },
        tags: { select: { id: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });

    // Calculate weighted score
    const scoredPosts = candidates.map((post) => {
      let score = 0;

      // Same category: +2 points
      if (post.categoryId === currentPost.categoryId) {
        score += 2;
      }

      // Each shared tag: +1 point
      const postTagIds = post.tags.map((t) => t.id);
      const sharedTags = postTagIds.filter((id) => currentTagIds.includes(id));
      score += sharedTags.length;

      return { ...post, score };
    });

    // Sort by score, then by publishedAt
    scoredPosts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
    });

    // Take top N and remove internal fields
    const relatedPosts = scoredPosts
      .slice(0, limit)
      .map(({ score, tags, categoryId, ...post }) => post);

    res.json({ data: relatedPosts });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/posts
 * Admin: Create post
 */
export async function createPost(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    if (req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { title, excerpt, content, coverImage, categoryId, tagIds, status, featured } =
      req.body;

    let slug = slugify(title, { lower: true, strict: true });

    // If slug is empty (e.g., Korean-only title), use timestamp
    if (!slug) {
      slug = `post-${Date.now()}`;
    }

    // Check for duplicate slug
    const existing = await prisma.post.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
    });

    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    // Calculate reading time
    const readingTime = calculateReadingTime(content);

    // Determine post status
    const postStatus = status === 'PRIVATE' ? 'PRIVATE' : status === 'DRAFT' ? 'DRAFT' : 'PUBLIC';
    const postPublishedAt =
      postStatus !== 'DRAFT'
        ? req.body.publishedAt
          ? new Date(req.body.publishedAt)
          : new Date()
        : null;

    const post = await prisma.post.create({
      data: {
        tenantId: req.tenant.id,
        slug,
        title,
        excerpt,
        content,
        coverImage,
        readingTime,
        status: postStatus,
        featured: featured || false,
        publishedAt: postPublishedAt,
        authorId: req.user.id,
        category: { connect: { id: categoryId } },
        tags: tagIds ? { connect: tagIds.map((id: string) => ({ id })) } : undefined,
      },
      include: {
        category: true,
        tags: true,
      },
    });

    // Update featured post
    await updateFeaturedPost(req.tenant.id);

    // Publish event
    await eventPublisher.publish({
      eventType: 'post.created',
      tenantId: req.tenant.id,
      data: {
        postId: post.id,
        title: post.title,
        authorId: post.authorId,
        categoryId: post.categoryId,
      },
    });

    res.status(201).json({ data: post });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/posts/:id
 * Admin: Update post
 */
export async function updatePost(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    if (req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;
    const { title, excerpt, content, coverImage, categoryId, tagIds, status, featured } =
      req.body;

    const existing = await prisma.post.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404);
    }

    const updateData: Record<string, unknown> = {};

    if (title && title !== existing.title) {
      updateData.title = title;
      let newSlug = slugify(title, { lower: true, strict: true });

      if (!newSlug) {
        newSlug = `post-${Date.now()}`;
      }

      // Check for duplicate slug
      const duplicateSlug = await prisma.post.findFirst({
        where: {
          tenantId: req.tenant.id,
          slug: newSlug,
          id: { not: id },
        },
      });

      if (duplicateSlug) {
        newSlug = `${newSlug}-${Date.now()}`;
      }

      updateData.slug = newSlug;
    }

    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) {
      updateData.content = content;
      updateData.readingTime = calculateReadingTime(content);
    }
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (categoryId) updateData.category = { connect: { id: categoryId } };
    if (status !== undefined) {
      updateData.status = status === 'PRIVATE' ? 'PRIVATE' : status === 'DRAFT' ? 'DRAFT' : 'PUBLIC';
    }
    if (req.body.publishedAt !== undefined) {
      updateData.publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : new Date();
    }
    if (featured !== undefined) updateData.featured = featured;

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...updateData,
        tags: tagIds ? { set: tagIds.map((tagId: string) => ({ id: tagId })) } : undefined,
      },
      include: {
        category: true,
        tags: true,
      },
    });

    // Publish event
    await eventPublisher.publish({
      eventType: 'post.updated',
      tenantId: req.tenant.id,
      data: {
        postId: post.id,
        changes: updateData,
      },
    });

    res.json({ data: post });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/posts/:id
 * Admin: Delete post
 */
export async function deletePost(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    if (req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;

    const existing = await prisma.post.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404);
    }

    await prisma.post.delete({ where: { id } });

    // Publish event
    await eventPublisher.publish({
      eventType: 'post.deleted',
      tenantId: req.tenant.id,
      data: {
        postId: id,
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/posts/admin/:id
 * Admin: Get post by ID for editing
 */
export async function getPostById(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        category: true,
        tags: true,
      },
    });

    if (!post || post.tenantId !== req.tenant.id) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404);
    }

    // Fetch author from auth-service
    const author = await fetchAuthorFromAuthService(req.tenant.id, post.authorId);

    res.json({ data: { ...post, author } });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/posts/bulk-delete
 * Admin: Bulk delete posts
 */
export async function bulkDeletePosts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new AppError('삭제할 게시글 ID 목록이 필요합니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);

    // Get all posts to delete (verify tenant ownership)
    const posts = await prisma.post.findMany({
      where: {
        id: { in: ids },
        tenantId: req.tenant.id,
      },
      select: { id: true },
    });

    if (posts.length === 0) {
      throw new AppError('삭제할 게시글을 찾을 수 없습니다.', 404);
    }

    const postIds = posts.map((p) => p.id);

    // Delete the posts (cascades to related records)
    const result = await prisma.post.deleteMany({
      where: { id: { in: postIds } },
    });

    // Publish events for each deleted post
    for (const postId of postIds) {
      await eventPublisher.publish({
        eventType: 'post.deleted',
        tenantId: req.tenant.id,
        data: { postId },
      });
    }

    // Update featured post
    await updateFeaturedPost(req.tenant.id);

    res.json({ data: { deletedCount: result.count } });
  } catch (error) {
    next(error);
  }
}
