import { Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';
import { hashIP, getClientIP } from '../utils/ipHash';
import slugifyLib from 'slugify';

type SlugifyFn = (str: string, opts?: { lower?: boolean; strict?: boolean }) => string;
const slugify: SlugifyFn =
  (slugifyLib as unknown as { default?: SlugifyFn }).default ||
  (slugifyLib as unknown as SlugifyFn);

// Timezone for view reset (default: KST)
const VIEW_RESET_TIMEZONE = process.env.VIEW_RESET_TIMEZONE || 'Asia/Seoul';

/**
 * Get today's midnight in the configured timezone
 * Used for daily view count reset
 */
function getTodayMidnight(timezone: string = VIEW_RESET_TIMEZONE): Date {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
  const [year, month, day] = dateStr.split('-').map(Number);
  const midnightLocal = new Date(Date.UTC(year, month - 1, day));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(midnightLocal);
  const offsetPart = parts.find(p => p.type === 'timeZoneName');

  let offsetHours = 0;
  if (offsetPart) {
    const match = offsetPart.value.match(/GMT([+-]?\d+)/);
    if (match) {
      offsetHours = parseInt(match[1], 10);
    }
  }

  return new Date(midnightLocal.getTime() - offsetHours * 60 * 60 * 1000);
}

/**
 * GET /api/pages
 * Public: Get all published pages with filtering by type
 */
export async function getPages(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as 'STATIC' | 'NOTICE' | undefined;

    const where: Record<string, unknown> = {
      tenantId: req.tenant.id,
      status: 'PUBLISHED',
    };

    if (type) {
      where.type = type;
    }

    const [pages, total] = await Promise.all([
      prisma.page.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.page.count({ where }),
    ]);

    res.json({
      data: pages,
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
 * GET /api/notices
 * Public: Get notices (shortcut for type=NOTICE)
 */
export async function getNotices(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const where = {
      tenantId: req.tenant.id,
      status: 'PUBLISHED' as const,
      type: 'NOTICE' as const,
    };

    const [notices, total] = await Promise.all([
      prisma.page.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.page.count({ where }),
    ]);

    res.json({
      data: notices,
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
 * GET /api/pages/:slug
 * Public: Get page by slug (increments view count)
 */
export async function getPageBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { slug } = req.params;

    const page = await prisma.page.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
    });

    if (!page) {
      throw new AppError('페이지를 찾을 수 없습니다.', 404);
    }

    // Visibility check
    if (page.status !== 'PUBLISHED') {
      const isAdmin = req.user?.role === 'ADMIN';
      if (!isAdmin) {
        throw new AppError('페이지를 찾을 수 없습니다.', 404);
      }
    }

    // Track unique view by IP hash (daily reset at midnight in configured timezone)
    const ipHash = hashIP(getClientIP(req));
    let viewIncremented = false;
    const todayMidnight = getTodayMidnight();

    // Check if this IP has viewed this page today
    const existingView = await prisma.pageView.findUnique({
      where: {
        tenantId_pageId_ipHash: {
          tenantId: req.tenant.id,
          pageId: page.id,
          ipHash,
        },
      },
    });

    if (!existingView) {
      // New unique view - create view record and increment count
      await prisma.$transaction([
        prisma.pageView.create({
          data: {
            tenantId: req.tenant.id,
            pageId: page.id,
            ipHash,
          },
        }),
        prisma.page.update({
          where: { id: page.id },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
      viewIncremented = true;
    } else if (existingView.createdAt < todayMidnight) {
      // View record exists but is from before today's midnight - new day, increment count
      await prisma.$transaction([
        prisma.pageView.update({
          where: { id: existingView.id },
          data: { createdAt: new Date() },
        }),
        prisma.page.update({
          where: { id: page.id },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
      viewIncremented = true;
    }

    res.json({
      data: {
        ...page,
        viewCount: viewIncremented ? page.viewCount + 1 : page.viewCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/notices/:slug/adjacent
 * Public: Get adjacent notices (previous and next)
 */
export async function getAdjacentNotices(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { slug } = req.params;

    const currentNotice = await prisma.page.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
      select: { id: true, publishedAt: true, createdAt: true, type: true },
    });

    if (!currentNotice || currentNotice.type !== 'NOTICE') {
      throw new AppError('공지사항을 찾을 수 없습니다.', 404);
    }

    const publishedAt = currentNotice.publishedAt || currentNotice.createdAt;

    const [prevNotice, nextNotice] = await Promise.all([
      prisma.page.findFirst({
        where: {
          tenantId: req.tenant.id,
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
          tenantId: req.tenant.id,
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
    ]);

    res.json({
      data: {
        prev: prevNotice,
        next: nextNotice,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/pages/admin
 * Admin: Get all pages (including drafts)
 */
export async function getAllPagesAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as 'STATIC' | 'NOTICE' | undefined;
    const status = req.query.status as 'DRAFT' | 'PUBLISHED' | undefined;

    const where: Record<string, unknown> = {
      tenantId: req.tenant.id,
    };

    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }

    const [pages, total] = await Promise.all([
      prisma.page.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.page.count({ where }),
    ]);

    res.json({
      data: pages,
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
 * GET /api/pages/admin/:id
 * Admin: Get page by ID
 */
export async function getPageById(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;

    const page = await prisma.page.findUnique({
      where: { id },
    });

    if (!page || page.tenantId !== req.tenant.id) {
      throw new AppError('페이지를 찾을 수 없습니다.', 404);
    }

    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/pages
 * Admin: Create page
 */
export async function createPage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { title, content, excerpt, type, status, badge, badgeColor, isPinned, template } =
      req.body;

    const slug = slugify(title, { lower: true, strict: true });

    // Check for duplicate slug
    const existing = await prisma.page.findUnique({
      where: {
        tenantId_slug: {
          tenantId: req.tenant.id,
          slug,
        },
      },
    });

    if (existing) {
      throw new AppError('이미 같은 제목의 페이지가 있습니다.', 400);
    }

    const page = await prisma.page.create({
      data: {
        tenantId: req.tenant.id,
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
        authorId: req.user.id,
      },
    });

    // Publish event
    await eventPublisher.publish({
      eventType: 'page.created',
      tenantId: req.tenant.id,
      data: {
        pageId: page.id,
        title: page.title,
        type: page.type,
        authorId: page.authorId,
      },
    });

    res.status(201).json({ data: page });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/pages/:id
 * Admin: Update page
 */
export async function updatePage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;
    const { title, content, excerpt, type, status, badge, badgeColor, isPinned, template } =
      req.body;

    const existing = await prisma.page.findUnique({ where: { id } });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('페이지를 찾을 수 없습니다.', 404);
    }

    const updateData: Record<string, unknown> = {};

    if (title && title !== existing.title) {
      updateData.title = title;
      updateData.slug = slugify(title, { lower: true, strict: true });
    }
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'PUBLISHED' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }
    if (badge !== undefined) updateData.badge = badge;
    if (badgeColor !== undefined) updateData.badgeColor = badgeColor;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    if (template !== undefined) updateData.template = template;

    const page = await prisma.page.update({
      where: { id },
      data: updateData,
    });

    // Publish event
    await eventPublisher.publish({
      eventType: 'page.updated',
      tenantId: req.tenant.id,
      data: {
        pageId: page.id,
        changes: updateData,
      },
    });

    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/pages/:id
 * Admin: Delete page
 */
export async function deletePage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const { id } = req.params;

    const existing = await prisma.page.findUnique({ where: { id } });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('페이지를 찾을 수 없습니다.', 404);
    }

    await prisma.page.delete({ where: { id } });

    // Publish event
    await eventPublisher.publish({
      eventType: 'page.deleted',
      tenantId: req.tenant.id,
      data: {
        pageId: id,
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/pages/stats
 * Admin: Get page statistics
 */
export async function getPageStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const prisma = tenantPrisma.getClient(req.tenant.id);
    const [total, published, drafts, notices, staticPages] = await Promise.all([
      prisma.page.count({ where: { tenantId: req.tenant.id } }),
      prisma.page.count({ where: { tenantId: req.tenant.id, status: 'PUBLISHED' } }),
      prisma.page.count({ where: { tenantId: req.tenant.id, status: 'DRAFT' } }),
      prisma.page.count({ where: { tenantId: req.tenant.id, type: 'NOTICE' } }),
      prisma.page.count({ where: { tenantId: req.tenant.id, type: 'STATIC' } }),
    ]);

    res.json({
      data: {
        total,
        published,
        drafts,
        notice: notices,
        static: staticPages,
      },
    });
  } catch (error) {
    next(error);
  }
}
