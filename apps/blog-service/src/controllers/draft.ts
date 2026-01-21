import { Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';
import { calculateReadingTime } from '../utils/readingTime';
import { updateFeaturedPost } from './post';
import slugifyLib from 'slugify';

// Type for slugify function
type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string;
const slugify: SlugifyFn =
  (slugifyLib as unknown as { default?: SlugifyFn }).default ||
  (slugifyLib as unknown as SlugifyFn);

// Storage service URL for internal calls
const STORAGE_SERVICE_URL = process.env.STORAGE_SERVICE_URL || 'http://storage-service:3006';

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
    // Don't throw - linking failure shouldn't block publish
  }
}

/**
 * GET /api/drafts
 * Admin: Get all drafts for current user
 */
export async function getDrafts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);

    const drafts = await prisma.draft.findMany({
      where: {
        tenantId: req.tenant.id,
        authorId: req.user.id,
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ data: drafts });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/drafts/:id
 * Admin: Get draft by ID
 */
export async function getDraftById(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;

    const draft = await prisma.draft.findFirst({
      where: {
        id,
        tenantId: req.tenant.id,
      },
    });

    if (!draft) {
      throw new AppError('초안을 찾을 수 없습니다.', 404);
    }

    // Check ownership (Admin can access all drafts)
    if (draft.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403);
    }

    res.json({ data: draft });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/drafts
 * Admin: Create a new draft
 */
export async function createDraft(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { title, content, excerpt, coverImage, categoryId, tagIds } = req.body;

    const draft = await prisma.draft.create({
      data: {
        tenantId: req.tenant.id,
        title: title || null,
        content: content || '',
        excerpt: excerpt || null,
        coverImage: coverImage || null,
        categoryId: categoryId || null,
        tagIds: tagIds || [],
        authorId: req.user.id,
      },
    });

    res.status(201).json({ data: draft });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/drafts/:id
 * Admin: Update a draft
 */
export async function updateDraft(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;
    const { title, content, excerpt, coverImage, categoryId, tagIds } = req.body;

    const existing = await prisma.draft.findFirst({
      where: {
        id,
        tenantId: req.tenant.id,
      },
    });

    if (!existing) {
      throw new AppError('초안을 찾을 수 없습니다.', 404);
    }

    if (existing.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403);
    }

    const draft = await prisma.draft.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        content: content !== undefined ? content : existing.content,
        excerpt: excerpt !== undefined ? excerpt : existing.excerpt,
        coverImage: coverImage !== undefined ? coverImage : existing.coverImage,
        categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        tagIds: tagIds !== undefined ? tagIds : existing.tagIds,
      },
    });

    res.json({ data: draft });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/drafts/:id
 * Admin: Delete a draft
 */
export async function deleteDraft(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;

    const existing = await prisma.draft.findFirst({
      where: {
        id,
        tenantId: req.tenant.id,
      },
    });

    if (!existing) {
      throw new AppError('초안을 찾을 수 없습니다.', 404);
    }

    if (existing.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403);
    }

    await prisma.draft.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/drafts/:id/publish
 * Admin: Publish a draft as a post
 */
export async function publishDraft(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('권한이 없습니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;
    const { status, categoryId, tagIds, publishedAt } = req.body;

    const draft = await prisma.draft.findFirst({
      where: {
        id,
        tenantId: req.tenant.id,
      },
    });

    if (!draft) {
      throw new AppError('초안을 찾을 수 없습니다.', 404);
    }

    // Validation for publishing
    if (!draft.title?.trim()) {
      throw new AppError('제목을 입력해주세요.', 400);
    }
    if (!draft.content?.trim() || draft.content === '<p></p>') {
      throw new AppError('내용을 입력해주세요.', 400);
    }

    const finalCategoryId = categoryId || draft.categoryId;
    if (!finalCategoryId) {
      throw new AppError('카테고리를 선택해주세요.', 400);
    }

    // Validate category exists
    const categoryExists = await prisma.category.findFirst({
      where: { id: finalCategoryId, tenantId: req.tenant.id },
    });
    if (!categoryExists) {
      throw new AppError('존재하지 않는 카테고리입니다.', 400);
    }

    // Generate slug from title
    let slug = slugify(draft.title, { lower: true, strict: true });

    // If slug is empty (e.g., Korean-only title), use timestamp
    if (!slug) {
      slug = `post-${Date.now()}`;
    }

    // Check for duplicate slug and make unique if needed
    const existingPost = await prisma.post.findFirst({
      where: { tenantId: req.tenant.id, slug },
    });
    if (existingPost) {
      slug = `${slug}-${Date.now()}`;
    }

    // Calculate reading time
    const readingTime = calculateReadingTime(draft.content);

    // Extract text for excerpt if not provided
    let excerpt = draft.excerpt;
    if (!excerpt) {
      const tempDiv = draft.content.replace(/<[^>]*>/g, ' ');
      excerpt = tempDiv.slice(0, 200);
    }

    const finalTagIds = tagIds || draft.tagIds || [];

    // Create post from draft
    const post = await prisma.post.create({
      data: {
        tenantId: req.tenant.id,
        slug,
        title: draft.title,
        excerpt,
        content: draft.content,
        coverImage: draft.coverImage,
        readingTime,
        status: status || 'PUBLIC',
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        authorId: req.user.id,
        categoryId: finalCategoryId,
        tags:
          finalTagIds.length > 0
            ? { connect: finalTagIds.map((tagId: string) => ({ id: tagId })) }
            : undefined,
      },
      include: {
        category: true,
        tags: true,
      },
    });

    // Delete the draft after successful publish
    await prisma.draft.delete({ where: { id } });

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
 * GET /api/drafts/stats
 * Get draft statistics
 */
export async function getDraftStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);

    const total = await prisma.draft.count({
      where: { tenantId: req.tenant.id },
    });

    res.json({ data: { total } });
  } catch (error) {
    next(error);
  }
}
