import { Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import slugifyLib from 'slugify';

type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string;
const slugify: SlugifyFn =
  (slugifyLib as unknown as { default?: SlugifyFn }).default ||
  (slugifyLib as unknown as SlugifyFn);

/**
 * GET /api/categories
 * Public: Get all categories with post counts
 * Returns postCount (PUBLIC posts) and privateCount (PRIVATE posts, admin only)
 */
export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const categories = await prisma.category.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { name: 'asc' },
    });

    // Get post counts by status for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const publicCount = await prisma.post.count({
          where: {
            tenantId: req.tenant!.id,
            categoryId: category.id,
            status: 'PUBLIC',
          },
        });

        const privateCount = await prisma.post.count({
          where: {
            tenantId: req.tenant!.id,
            categoryId: category.id,
            status: 'PRIVATE',
          },
        });

        return {
          ...category,
          postCount: publicCount,
          privateCount,
        };
      })
    );

    res.json({ data: categoriesWithCounts });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/categories/:slug
 * Public: Get category by slug with post counts
 */
export async function getCategoryBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { slug } = req.params;

    const category = await prisma.category.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
    });

    if (!category) {
      throw new AppError('카테고리를 찾을 수 없습니다.', 404);
    }

    // Get post counts by status
    const [publicCount, privateCount] = await Promise.all([
      prisma.post.count({
        where: {
          tenantId: req.tenant.id,
          categoryId: category.id,
          status: 'PUBLIC',
        },
      }),
      prisma.post.count({
        where: {
          tenantId: req.tenant.id,
          categoryId: category.id,
          status: 'PRIVATE',
        },
      }),
    ]);

    res.json({
      data: {
        ...category,
        postCount: publicCount,
        privateCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/categories/:slug/posts
 * Public: Get posts by category slug
 */
export async function getCategoryPosts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { slug } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const isAdmin = req.user?.role === 'ADMIN';

    const category = await prisma.category.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
    });

    if (!category) {
      throw new AppError('카테고리를 찾을 수 없습니다.', 404);
    }

    // Admin sees PUBLIC + PRIVATE, others see PUBLIC only
    const statuses: ('PUBLIC' | 'PRIVATE')[] = isAdmin ? ['PUBLIC', 'PRIVATE'] : ['PUBLIC'];
    const where = {
      tenantId: req.tenant.id,
      categoryId: category.id,
      status: { in: statuses },
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          category: true,
          tags: true,
        },
        orderBy: { publishedAt: 'desc' },
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
        category,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/categories
 * Admin: Create category
 */
export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { name, description, icon, color } = req.body;

    let slug = slugify(name, { lower: true, strict: true });

    if (!slug) {
      slug = `category-${Date.now()}`;
    }

    // Check for duplicate slug
    const existing = await prisma.category.findUnique({
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

    const category = await prisma.category.create({
      data: {
        tenantId: req.tenant.id,
        name,
        slug,
        description,
        icon,
        color,
      },
    });

    res.status(201).json({ data: category });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/categories/:id
 * Admin: Update category
 */
export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;
    const { name, description, icon, color } = req.body;

    const existing = await prisma.category.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('카테고리를 찾을 수 없습니다.', 404);
    }

    const updateData: Record<string, unknown> = {};

    if (name && name !== existing.name) {
      updateData.name = name;

      let newSlug = slugify(name, { lower: true, strict: true });

      if (!newSlug) {
        newSlug = `category-${Date.now()}`;
      }

      // Check for duplicate slug
      const duplicateSlug = await prisma.category.findFirst({
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

    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    res.json({ data: category });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/categories/:id
 * Admin: Delete category
 */
export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;

    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('카테고리를 찾을 수 없습니다.', 404);
    }

    // Check if category has posts
    if (existing._count.posts > 0) {
      throw new AppError('게시글이 있는 카테고리는 삭제할 수 없습니다.', 400);
    }

    await prisma.category.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
