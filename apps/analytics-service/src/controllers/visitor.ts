import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import { hashIP, getClientIP } from '../utils/ipHash';

/**
 * POST /api/visitors/track
 * Public: Track a visitor (called on page load)
 */
export async function trackVisitor(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const clientIp = getClientIP(req);
    const ipHash = hashIP(clientIp);

    // Get today's date (UTC) without time
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Create or update visitor record (upsert to avoid unique constraint errors)
    await prisma.siteVisitor.upsert({
      where: {
        tenantId_ipHash_date: {
          tenantId: req.tenant.id,
          ipHash,
          date: today,
        },
      },
      update: {}, // Already exists, do nothing
      create: {
        tenantId: req.tenant.id,
        ipHash,
        date: today,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Track visitor error:', error);
    // Don't fail the request - just log
    res.json({ success: false });
  }
}

/**
 * GET /api/visitors/stats
 * Public: Get visitor statistics
 */
export async function getVisitorStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    // Get today and yesterday dates (UTC)
    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    // Count visitors for today, yesterday, and total
    const [todayCount, yesterdayCount, totalCount] = await Promise.all([
      prisma.siteVisitor.count({
        where: {
          tenantId: req.tenant.id,
          date: today,
        },
      }),
      prisma.siteVisitor.count({
        where: {
          tenantId: req.tenant.id,
          date: yesterday,
        },
      }),
      prisma.siteVisitor.count({
        where: {
          tenantId: req.tenant.id,
        },
      }),
    ]);

    res.json({
      data: {
        total: totalCount,
        today: todayCount,
        yesterday: yesterdayCount,
      },
    });
  } catch (error) {
    console.error('Get visitor stats error:', error);
    res.json({
      data: {
        total: 0,
        today: 0,
        yesterday: 0,
      },
    });
  }
}

/**
 * GET /api/visitors/admin/stats
 * Admin: Get detailed visitor statistics with date range
 */
export async function getDetailedVisitorStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const days = parseInt(req.query.days as string) || 7;
    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0);

    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);

    // Get daily visitor counts
    const dailyStats = await prisma.siteVisitor.groupBy({
      by: ['date'],
      where: {
        tenantId: req.tenant.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Fill in missing dates with 0 visitors
    const filledStats = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const existing = dailyStats.find(
        (s) => s.date.toISOString().split('T')[0] === dateStr
      );

      filledStats.push({
        date: dateStr,
        visitors: existing?._count._all || 0,
      });

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    res.json({
      data: {
        daily: filledStats,
        total: filledStats.reduce((sum, day) => sum + day.visitors, 0),
      },
    });
  } catch (error) {
    next(error);
  }
}
