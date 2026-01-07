import type { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'
import slugifyLib from 'slugify'

type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string
const slugify: SlugifyFn = (slugifyLib as unknown as { default?: SlugifyFn }).default || (slugifyLib as unknown as SlugifyFn)

// Hash IP address for unique view tracking
function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-production'
  return crypto.createHash('sha256').update(ip + salt).digest('hex')
}

// Get client IP (considering reverse proxy)
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
  }
  return req.ip || 'unknown'
}

// Get all pages (public - only published, with filtering by type)
export async function getPages(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const type = req.query.type as 'STATIC' | 'NOTICE' | undefined

    const where: Record<string, unknown> = { status: 'PUBLISHED' }

    if (type) {
      where.type = type
    }

    const [pages, total] = await Promise.all([
      prisma.page.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: [
          { isPinned: 'desc' },
          { publishedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.page.count({ where }),
    ])

    res.json({
      data: pages,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get notices (public - shortcut for type=NOTICE)
export async function getNotices(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10

    const where = { status: 'PUBLISHED' as const, type: 'NOTICE' as const }

    const [notices, total] = await Promise.all([
      prisma.page.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: [
          { isPinned: 'desc' },
          { publishedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.page.count({ where }),
    ])

    res.json({
      data: notices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get page by slug (public)
export async function getPageBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params

    const page = await prisma.page.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    })

    if (!page) {
      throw new AppError('페이지를 찾을 수 없습니다.', 404)
    }

    if (page.status !== 'PUBLISHED') {
      const authReq = req as AuthRequest
      if (!authReq.user || authReq.user.role !== 'ADMIN') {
        throw new AppError('페이지를 찾을 수 없습니다.', 404)
      }
    }

    // Track unique view by IP hash (24-hour based)
    const ipHash = hashIP(getClientIP(req))
    let viewIncremented = false
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Check if this IP has viewed this page within the last 24 hours
    const existingView = await prisma.pageView.findUnique({
      where: {
        pageId_ipHash: {
          pageId: page.id,
          ipHash,
        },
      },
    })

    if (!existingView) {
      // New unique view - create view record and increment count
      await prisma.$transaction([
        prisma.pageView.create({
          data: {
            pageId: page.id,
            ipHash,
          },
        }),
        prisma.page.update({
          where: { id: page.id },
          data: { viewCount: { increment: 1 } },
        }),
      ])
      viewIncremented = true
    } else if (existingView.createdAt < twentyFourHoursAgo) {
      // View record exists but is older than 24 hours - update timestamp and increment count
      await prisma.$transaction([
        prisma.pageView.update({
          where: {
            pageId_ipHash: {
              pageId: page.id,
              ipHash,
            },
          },
          data: { createdAt: new Date() },
        }),
        prisma.page.update({
          where: { id: page.id },
          data: { viewCount: { increment: 1 } },
        }),
      ])
      viewIncremented = true
    }

    res.json({
      data: {
        ...page,
        viewCount: viewIncremented ? page.viewCount + 1 : page.viewCount
      }
    })
  } catch (error) {
    next(error)
  }
}

// Admin: Get all pages (including drafts)
export async function getAllPagesAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const type = req.query.type as 'STATIC' | 'NOTICE' | undefined
    const status = req.query.status as 'DRAFT' | 'PUBLISHED' | undefined

    const where: Record<string, unknown> = {}

    if (type) {
      where.type = type
    }
    if (status) {
      where.status = status
    }

    const [pages, total] = await Promise.all([
      prisma.page.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: [
          { isPinned: 'desc' },
          { updatedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.page.count({ where }),
    ])

    res.json({
      data: pages,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

// Admin: Get page by ID
export async function getPageById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    })

    if (!page) {
      throw new AppError('페이지를 찾을 수 없습니다.', 404)
    }

    res.json({ data: page })
  } catch (error) {
    next(error)
  }
}

// Admin: Create page
export async function createPage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { title, content, excerpt, type, status, badge, badgeColor, isPinned, template } = req.body

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const slug = slugify(title, { lower: true, strict: true })

    // Check for duplicate slug
    const existing = await prisma.page.findUnique({ where: { slug } })
    if (existing) {
      throw new AppError('이미 같은 제목의 페이지가 있습니다.', 400)
    }

    const page = await prisma.page.create({
      data: {
        slug,
        title,
        content,
        excerpt,
        type: type || 'NOTICE',
        status: status || 'DRAFT',
        badge,
        badgeColor,
        isPinned: isPinned || false,
        template,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        author: { connect: { id: req.user.id } },
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    })

    res.status(201).json({ data: page })
  } catch (error) {
    next(error)
  }
}

// Admin: Update page
export async function updatePage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { title, content, excerpt, type, status, badge, badgeColor, isPinned, template } = req.body

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const existing = await prisma.page.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError('페이지를 찾을 수 없습니다.', 404)
    }

    const updateData: Record<string, unknown> = {}

    if (title && title !== existing.title) {
      updateData.title = title
      updateData.slug = slugify(title, { lower: true, strict: true })
    }
    if (content !== undefined) updateData.content = content
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (type !== undefined) updateData.type = type
    if (status !== undefined) {
      updateData.status = status
      if (status === 'PUBLISHED' && !existing.publishedAt) {
        updateData.publishedAt = new Date()
      }
    }
    if (badge !== undefined) updateData.badge = badge
    if (badgeColor !== undefined) updateData.badgeColor = badgeColor
    if (isPinned !== undefined) updateData.isPinned = isPinned
    if (template !== undefined) updateData.template = template

    const page = await prisma.page.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    })

    res.json({ data: page })
  } catch (error) {
    next(error)
  }
}

// Admin: Delete page
export async function deletePage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const existing = await prisma.page.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError('페이지를 찾을 수 없습니다.', 404)
    }

    await prisma.page.delete({ where: { id } })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

// Get adjacent notices (previous and next)
export async function getAdjacentNotices(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params

    const currentNotice = await prisma.page.findUnique({
      where: { slug },
      select: { id: true, publishedAt: true, createdAt: true, type: true },
    })

    if (!currentNotice || currentNotice.type !== 'NOTICE') {
      throw new AppError('공지사항을 찾을 수 없습니다.', 404)
    }

    const publishedAt = currentNotice.publishedAt || currentNotice.createdAt

    const [prevNotice, nextNotice] = await Promise.all([
      prisma.page.findFirst({
        where: {
          type: 'NOTICE',
          status: 'PUBLISHED',
          OR: [
            { publishedAt: { lt: publishedAt } },
            {
              publishedAt: publishedAt,
              id: { lt: currentNotice.id },
            },
          ],
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        select: { slug: true, title: true },
      }),
      prisma.page.findFirst({
        where: {
          type: 'NOTICE',
          status: 'PUBLISHED',
          OR: [
            { publishedAt: { gt: publishedAt } },
            {
              publishedAt: publishedAt,
              id: { gt: currentNotice.id },
            },
          ],
        },
        orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
        select: { slug: true, title: true },
      }),
    ])

    res.json({
      data: {
        prev: prevNotice,
        next: nextNotice,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Admin: Get page stats
export async function getPageStats(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [total, published, drafts, notices, staticPages] = await Promise.all([
      prisma.page.count(),
      prisma.page.count({ where: { status: 'PUBLISHED' } }),
      prisma.page.count({ where: { status: 'DRAFT' } }),
      prisma.page.count({ where: { type: 'NOTICE' } }),
      prisma.page.count({ where: { type: 'STATIC' } }),
    ])

    res.json({
      data: {
        total,
        published,
        drafts,
        notices,
        staticPages,
      },
    })
  } catch (error) {
    next(error)
  }
}
