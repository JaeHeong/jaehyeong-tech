import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'
import slugifyLib from 'slugify'

type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string
const slugify: SlugifyFn = (slugifyLib as unknown as { default?: SlugifyFn }).default || (slugifyLib as unknown as SlugifyFn)

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { posts: { where: { status: 'PUBLIC' } } } },
      },
      orderBy: { name: 'asc' },
    })

    const data = categories.map((cat) => ({
      ...cat,
      postCount: cat._count.posts,
      _count: undefined,
    }))

    res.json({ data })
  } catch (error) {
    next(error)
  }
}

export async function getCategoryBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params

    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        _count: { select: { posts: { where: { status: 'PUBLIC' } } } },
      },
    })

    if (!category) {
      throw new AppError('카테고리를 찾을 수 없습니다.', 404)
    }

    res.json({
      data: {
        ...category,
        postCount: category._count.posts,
        _count: undefined,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getCategoryPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10

    const category = await prisma.category.findUnique({ where: { slug } })
    if (!category) {
      throw new AppError('카테고리를 찾을 수 없습니다.', 404)
    }

    const where = { categoryId: category.id, status: 'PUBLIC' as const }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: true,
          tags: true,
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    res.json({
      data: posts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        category,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function createCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, description, icon, color } = req.body

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const slug = slugify(name, { lower: true, strict: true })

    const category = await prisma.category.create({
      data: { name, slug, description, icon, color },
    })

    res.status(201).json({ data: category })
  } catch (error) {
    next(error)
  }
}

export async function updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { name, description, icon, color } = req.body

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const updateData: Record<string, unknown> = {}
    if (name) {
      updateData.name = name
      updateData.slug = slugify(name, { lower: true, strict: true })
    }
    if (description !== undefined) updateData.description = description
    if (icon !== undefined) updateData.icon = icon
    if (color !== undefined) updateData.color = color

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    })

    res.json({ data: category })
  } catch (error) {
    next(error)
  }
}

export async function deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    // Check if category has posts
    const postCount = await prisma.post.count({ where: { categoryId: id } })
    if (postCount > 0) {
      throw new AppError('게시글이 있는 카테고리는 삭제할 수 없습니다.', 400)
    }

    await prisma.category.delete({ where: { id } })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
