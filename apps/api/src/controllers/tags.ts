import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'

export async function getTags(_req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await prisma.tag.findMany({
      include: {
        _count: { select: { posts: { where: { published: true } } } },
      },
      orderBy: { name: 'asc' },
    })

    const data = tags.map((tag: { _count: { posts: number }; [key: string]: unknown }) => ({
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
        _count: { select: { posts: { where: { published: true } } } },
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
      published: true,
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
