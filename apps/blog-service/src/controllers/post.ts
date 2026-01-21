import { Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';
import { calculateReadingTime } from '../utils/readingTime';
import { hashIP, getClientIP } from '../utils/ipHash';
import { blogCache } from '@shared/utils';
import slugifyLib from 'slugify';

// Type for slugify function
type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string;
const slugify: SlugifyFn =
  (slugifyLib as unknown as { default?: SlugifyFn }).default ||
  (slugifyLib as unknown as SlugifyFn);

// Auth service URL for internal calls (K8s service discovery)
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://jaehyeong-tech-dev-auth:3001';
// Storage service URL for internal calls
const STORAGE_SERVICE_URL = process.env.STORAGE_SERVICE_URL || 'http://storage-service:3006';
// Timezone for view reset (default: KST)
const VIEW_RESET_TIMEZONE = process.env.VIEW_RESET_TIMEZONE || 'Asia/Seoul';

/**
 * Get today's midnight in the configured timezone
 * Used for daily view count reset
 */
function getTodayMidnight(timezone: string = VIEW_RESET_TIMEZONE): Date {
  const now = new Date();
  // Format current date in the target timezone to get the date string
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
  // Create a date at midnight in the target timezone
  // Parse as local date then adjust for timezone offset
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create date at midnight UTC, then adjust for timezone
  const midnightLocal = new Date(Date.UTC(year, month - 1, day));

  // Get the timezone offset at that time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(midnightLocal);
  const offsetPart = parts.find(p => p.type === 'timeZoneName');

  // Parse offset like "GMT+9" or "GMT-5"
  let offsetHours = 0;
  if (offsetPart) {
    const match = offsetPart.value.match(/GMT([+-]?\d+)/);
    if (match) {
      offsetHours = parseInt(match[1], 10);
    }
  }

  // Subtract the offset to get UTC time of midnight in that timezone
  return new Date(midnightLocal.getTime() - offsetHours * 60 * 60 * 1000);
}

/**
 * Extract image URLs from HTML content and coverImage
 */
function extractImageUrls(content: string | null, coverImage: string | null): string[] {
  const urls: string[] = [];

  // Add coverImage if exists
  if (coverImage) {
    urls.push(coverImage);
  }

  if (!content) return urls;

  // Extract from HTML img tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  // Extract from Markdown images
  const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  while ((match = mdImgRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

/**
 * Link files to a resource via storage-service
 */
async function linkFilesToResource(
  tenantId: string,
  tenantName: string,
  urls: string[],
  resourceType: string,
  resourceId: string
): Promise<void> {
  if (urls.length === 0) return;

  try {
    const response = await fetch(`${STORAGE_SERVICE_URL}/internal/link-files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
        'x-tenant-id': tenantId,
        'x-tenant-name': tenantName,
      },
      body: JSON.stringify({ urls, resourceType, resourceId }),
    });

    if (!response.ok) {
      console.warn(`[Blog] Failed to link files: ${response.status}`);
    } else {
      const result = await response.json() as { linked: number };
      console.log(`[Blog] Linked ${result.linked} files to ${resourceType}:${resourceId}`);
    }
  } catch (error) {
    console.error('[Blog] Error linking files:', error);
    // Don't throw - linking failure shouldn't block post creation
  }
}

/**
 * Unlink files from a resource via storage-service
 */
async function unlinkFiles(
  tenantId: string,
  tenantName: string,
  urls: string[]
): Promise<void> {
  if (urls.length === 0) return;

  try {
    const response = await fetch(`${STORAGE_SERVICE_URL}/internal/unlink-files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
        'x-tenant-id': tenantId,
        'x-tenant-name': tenantName,
      },
      body: JSON.stringify({ urls }),
    });

    if (!response.ok) {
      console.warn(`[Blog] Failed to unlink files: ${response.status}`);
    } else {
      const result = await response.json() as { unlinked: number };
      console.log(`[Blog] Unlinked ${result.unlinked} files`);
    }
  } catch (error) {
    console.error('[Blog] Error unlinking files:', error);
  }
}

/**
 * Get linked files for a resource from storage-service
 */
async function getLinkedFiles(
  tenantId: string,
  tenantName: string,
  resourceType: string,
  resourceId: string
): Promise<string[]> {
  try {
    const response = await fetch(
      `${STORAGE_SERVICE_URL}/internal/linked-files/${resourceType}/${resourceId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-request': 'true',
          'x-tenant-id': tenantId,
          'x-tenant-name': tenantName,
        },
      }
    );

    if (!response.ok) {
      console.warn(`[Blog] Failed to get linked files: ${response.status}`);
      return [];
    }

    const result = await response.json() as { urls: string[] };
    return result.urls || [];
  } catch (error) {
    console.error('[Blog] Error getting linked files:', error);
    return [];
  }
}

// Author info type
interface AuthorInfo {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
}

/**
 * Fetch author info from auth-service (internal API) with Redis caching
 */
async function fetchAuthorFromAuthService(
  tenantId: string,
  authorId: string
): Promise<AuthorInfo | null> {
  const cacheKey = `author:${tenantId}:${authorId}`;

  // Check cache first
  const cached = await blogCache.get<AuthorInfo>(cacheKey);
  if (cached) {
    return cached;
  }

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

    const json = (await response.json()) as { data: AuthorInfo };
    const author = json.data;

    // Cache for 5 minutes
    await blogCache.set(cacheKey, author, 300);

    return author;
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

    // Track unique view (daily reset at midnight in configured timezone)
    // - Logged-in users: user ID based deduplication
    // - Anonymous users: IP hash based deduplication
    const userId = req.user?.id;
    const identifier = userId ? `user:${userId}` : hashIP(getClientIP(req));
    let viewIncremented = false;
    const todayMidnight = getTodayMidnight();

    // Check if this user/IP has viewed this post today
    const existingView = await prisma.postView.findUnique({
      where: {
        tenantId_postId_ipHash: {
          tenantId: req.tenant.id,
          postId: post.id,
          ipHash: identifier,
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
            ipHash: identifier,
            userId: userId || null,
          },
        }),
        prisma.post.update({
          where: { id: post.id },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
      viewIncremented = true;
    } else if (existingView.createdAt < todayMidnight) {
      // View record exists but is from before today's midnight - new day, increment count
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

    // Get previous and next posts in PARALLEL
    const [prevPost, nextPost] = await Promise.all([
      // Previous post (older)
      prisma.post.findFirst({
        where: {
          ...whereClause,
          publishedAt: { lt: currentPost.publishedAt || new Date() },
          id: { not: currentPost.id },
        },
        orderBy: { publishedAt: 'desc' },
        select: { slug: true, title: true, coverImage: true },
      }),
      // Next post (newer)
      prisma.post.findFirst({
        where: {
          ...whereClause,
          publishedAt: { gt: currentPost.publishedAt || new Date() },
          id: { not: currentPost.id },
        },
        orderBy: { publishedAt: 'asc' },
        select: { slug: true, title: true, coverImage: true },
      }),
    ]);

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

    // Link images to the post (extract from content and coverImage)
    const imageUrls = extractImageUrls(post.content, post.coverImage);
    await linkFilesToResource(
      req.tenant.id,
      req.tenant.name,
      imageUrls,
      'POST',
      post.id
    );

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

    // Get currently linked files before update
    const previouslyLinkedUrls = await getLinkedFiles(
      req.tenant.id,
      req.tenant.name,
      'POST',
      id
    );

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

    // Get new image URLs from updated content
    const newImageUrls = extractImageUrls(post.content, post.coverImage);
    const newImageUrlSet = new Set(newImageUrls);

    // Find images that were removed (in previous but not in new)
    const removedUrls = previouslyLinkedUrls.filter((url) => !newImageUrlSet.has(url));

    // Unlink removed images
    if (removedUrls.length > 0) {
      await unlinkFiles(req.tenant.id, req.tenant.name, removedUrls);
    }

    // Link new images to the post
    await linkFilesToResource(
      req.tenant.id,
      req.tenant.name,
      newImageUrls,
      'POST',
      post.id
    );

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

    // Get linked files before deletion
    const linkedUrls = await getLinkedFiles(
      req.tenant.id,
      req.tenant.name,
      'POST',
      id
    );

    await prisma.post.delete({ where: { id } });

    // Unlink all images that were linked to this post
    if (linkedUrls.length > 0) {
      await unlinkFiles(req.tenant.id, req.tenant.name, linkedUrls);
    }

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

    // Get all linked files for these posts before deletion
    const linkedUrlsPromises = postIds.map((postId) =>
      getLinkedFiles(req.tenant.id, req.tenant.name, 'POST', postId)
    );
    const linkedUrlsArrays = await Promise.all(linkedUrlsPromises);
    const allLinkedUrls = linkedUrlsArrays.flat();

    // Delete the posts (cascades to related records)
    const result = await prisma.post.deleteMany({
      where: { id: { in: postIds } },
    });

    // Unlink all images that were linked to these posts
    if (allLinkedUrls.length > 0) {
      await unlinkFiles(req.tenant.id, req.tenant.name, allLinkedUrls);
    }

    // Publish events for each deleted post in PARALLEL
    await Promise.all(
      postIds.map((postId) =>
        eventPublisher.publish({
          eventType: 'post.deleted',
          tenantId: req.tenant.id,
          data: { postId },
        })
      )
    );

    // Update featured post
    await updateFeaturedPost(req.tenant.id);

    res.json({ data: { deletedCount: result.count } });
  } catch (error) {
    next(error);
  }
}

/**
 * Get post statistics
 * GET /api/posts/stats
 */
export async function getPostStats(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);

    const [total, published, privatePosts, totalViews, totalLikes] = await Promise.all([
      prisma.post.count({ where: { tenantId: tenant.id } }),
      prisma.post.count({ where: { tenantId: tenant.id, status: 'PUBLIC' } }),
      prisma.post.count({ where: { tenantId: tenant.id, status: 'PRIVATE' } }),
      prisma.post.aggregate({
        where: { tenantId: tenant.id },
        _sum: { viewCount: true },
      }),
      prisma.like.count({ where: { tenantId: tenant.id } }),
    ]);

    res.json({
      data: {
        total,
        published,
        private: privatePosts,
        totalViews: totalViews._sum.viewCount || 0,
        totalLikes,
      },
    });
  } catch (error) {
    next(error);
  }
}
