import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import slugifyLib from 'slugify';

type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string;
const slugify: SlugifyFn =
  (slugifyLib as unknown as { default?: SlugifyFn }).default ||
  (slugifyLib as unknown as SlugifyFn);

/**
 * GET /api/tags
 * Public: Get all tags
 */
export async function getTags(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const tags = await prisma.tag.findMany({
      where: { tenantId: req.tenant.id },
      include: {
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ data: tags });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tags/:slug
 * Public: Get tag by slug
 */
export async function getTagBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const { slug } = req.params;

    const tag = await prisma.tag.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });

    if (!tag) {
      throw new AppError('태그를 찾을 수 없습니다.', 404);
    }

    res.json({ data: tag });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tags
 * Admin: Create tag
 */
export async function createTag(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const { name } = req.body;

    let slug = slugify(name, { lower: true, strict: true });

    if (!slug) {
      slug = `tag-${Date.now()}`;
    }

    // Check for duplicate slug
    const existing = await prisma.tag.findUnique({
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

    const tag = await prisma.tag.create({
      data: {
        tenantId: req.tenant.id,
        name,
        slug,
      },
    });

    res.status(201).json({ data: tag });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/tags/:id
 * Admin: Update tag
 */
export async function updateTag(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const { id } = req.params;
    const { name } = req.body;

    const existing = await prisma.tag.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('태그를 찾을 수 없습니다.', 404);
    }

    const updateData: Record<string, unknown> = {};

    if (name && name !== existing.name) {
      updateData.name = name;

      let newSlug = slugify(name, { lower: true, strict: true });

      if (!newSlug) {
        newSlug = `tag-${Date.now()}`;
      }

      // Check for duplicate slug
      const duplicateSlug = await prisma.tag.findFirst({
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

    const tag = await prisma.tag.update({
      where: { id },
      data: updateData,
    });

    res.json({ data: tag });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/tags/:id
 * Admin: Delete tag
 */
export async function deleteTag(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const { id } = req.params;

    const existing = await prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('태그를 찾을 수 없습니다.', 404);
    }

    // Check if tag is used
    if (existing._count.posts > 0) {
      throw new AppError('게시글이 있는 태그는 삭제할 수 없습니다.', 400);
    }

    await prisma.tag.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
