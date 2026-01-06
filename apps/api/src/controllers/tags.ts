import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'

export async function getTags(_req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await prisma.tag.findMany({
      include: {
        _count: { select: { posts: { where: { status: 'PUBLIC' } } } },
      },
      orderBy: { name: 'asc' },
    })

    const data = tags.map((tag) => ({
      ...tag,
      postCount: tag._count.posts,
      _count: undefined,
    }))

    res.json({ data })
  } catch (error) {
    next(error)
  }
}

export async function getTagBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params

    const tag = await prisma.tag.findUnique({
      where: { slug },
      include: {
        _count: { select: { posts: { where: { status: 'PUBLIC' } } } },
      },
    })

    if (!tag) {
      throw new AppError('태그를 찾을 수 없습니다.', 404)
    }

    res.json({
      data: {
        ...tag,
        postCount: tag._count.posts,
        _count: undefined,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getTagPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10

    const tag = await prisma.tag.findUnique({ where: { slug } })
    if (!tag) {
      throw new AppError('태그를 찾을 수 없습니다.', 404)
    }

    const where = {
      tags: { some: { id: tag.id } },
      status: 'PUBLIC' as const,
    }

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
        tag,
      },
    })
  } catch (error) {
    next(error)
  }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function createTag(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { name, slug } = req.body

    if (!name) {
      throw new AppError('태그 이름은 필수입니다.', 400)
    }

    const finalSlug = slug || generateSlug(name)

    // Check for duplicate slug
    const existing = await prisma.tag.findUnique({ where: { slug: finalSlug } })
    if (existing) {
      throw new AppError('이미 존재하는 슬러그입니다.', 400)
    }

    const tag = await prisma.tag.create({
      data: { name, slug: finalSlug },
    })

    res.status(201).json({ data: { ...tag, postCount: 0 } })
  } catch (error) {
    next(error)
  }
}

export async function updateTag(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { id } = req.params
    const { name, slug } = req.body

    const existing = await prisma.tag.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError('태그를 찾을 수 없습니다.', 404)
    }

    const finalSlug = slug || (name ? generateSlug(name) : existing.slug)

    // Check for duplicate slug (excluding current tag)
    if (finalSlug !== existing.slug) {
      const duplicate = await prisma.tag.findUnique({ where: { slug: finalSlug } })
      if (duplicate) {
        throw new AppError('이미 존재하는 슬러그입니다.', 400)
      }
    }

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        name: name || existing.name,
        slug: finalSlug,
      },
      include: {
        _count: { select: { posts: { where: { status: 'PUBLIC' } } } },
      },
    })

    res.json({
      data: {
        ...tag,
        postCount: tag._count.posts,
        _count: undefined,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function deleteTag(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { id } = req.params

    const existing = await prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    })

    if (!existing) {
      throw new AppError('태그를 찾을 수 없습니다.', 404)
    }

    await prisma.tag.delete({ where: { id } })

    res.json({ message: '태그가 삭제되었습니다.' })
  } catch (error) {
    next(error)
  }
}
