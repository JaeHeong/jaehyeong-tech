import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import { hashIP, getClientIP } from '../utils/ipHash';

/**
 * POST /api/bug-reports
 * Public: Create a bug report
 */
export async function createBugReport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const { title, category, priority, description, email } = req.body;

    if (!title?.trim()) {
      throw new AppError('제목을 입력해주세요.', 400);
    }

    if (!category) {
      throw new AppError('카테고리를 선택해주세요.', 400);
    }

    if (!description?.trim()) {
      throw new AppError('설명을 입력해주세요.', 400);
    }

    // Validate category
    const validCategories = ['UI', 'FUNCTIONAL', 'PERFORMANCE', 'SECURITY', 'ETC'];
    if (!validCategories.includes(category.toUpperCase())) {
      throw new AppError('유효하지 않은 카테고리입니다.', 400);
    }

    // Validate priority
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
    const finalPriority = validPriorities.includes(priority?.toUpperCase())
      ? priority.toUpperCase()
      : 'MEDIUM';

    // Get IP hash for spam prevention
    const ip = getClientIP(req);
    const ipHash = hashIP(ip);

    // Create bug report
    const bugReport = await prisma.bugReport.create({
      data: {
        tenantId: req.tenant.id,
        title: title.trim(),
        description: description.trim(),
        category: category.toUpperCase() as 'UI' | 'FUNCTIONAL' | 'PERFORMANCE' | 'SECURITY' | 'ETC',
        priority: finalPriority as 'LOW' | 'MEDIUM' | 'HIGH',
        email: email?.trim() || null,
        ipHash,
      },
    });

    res.status(201).json({
      data: {
        id: bugReport.id,
        message: '버그 리포트가 제출되었습니다.',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bug-reports/public
 * Public: Get all bug reports (without sensitive info)
 */
export async function getPublicBugReports(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const category = req.query.category as string;

    const where: Record<string, unknown> = {
      tenantId: req.tenant.id,
    };

    if (status) where.status = status.toUpperCase();
    if (category) where.category = category.toUpperCase();

    const [bugReports, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          category: true,
          priority: true,
          status: true,
          createdAt: true,
          // Exclude: description, email, ipHash, adminResponse, respondedAt, updatedAt
        },
      }),
      prisma.bugReport.count({ where }),
    ]);

    res.json({
      data: bugReports,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bug-reports/public/:id
 * Public: Get single bug report (without sensitive info)
 */
export async function getPublicBugReport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    const { id } = req.params;

    const bugReport = await prisma.bugReport.findFirst({
      where: {
        id,
        tenantId: req.tenant.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        adminResponse: true,
        respondedAt: true,
        createdAt: true,
        // Exclude: email, ipHash, updatedAt
      },
    });

    if (!bugReport) {
      throw new AppError('버그 리포트를 찾을 수 없습니다.', 404);
    }

    res.json({ data: bugReport });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bug-reports/admin
 * Admin: Get all bug reports (with full details)
 */
export async function getBugReports(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const category = req.query.category as string;

    const where: Record<string, unknown> = {
      tenantId: req.tenant.id,
    };

    if (status) where.status = status.toUpperCase();
    if (category) where.category = category.toUpperCase();

    const [bugReports, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bugReport.count({ where }),
    ]);

    res.json({
      data: bugReports,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bug-reports/admin/:id
 * Admin: Get single bug report (with full details)
 */
export async function getBugReport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const { id } = req.params;

    const bugReport = await prisma.bugReport.findUnique({
      where: { id },
    });

    if (!bugReport || bugReport.tenantId !== req.tenant.id) {
      throw new AppError('버그 리포트를 찾을 수 없습니다.', 404);
    }

    res.json({ data: bugReport });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/bug-reports/admin/:id
 * Admin: Update bug report (status, priority, admin response)
 */
export async function updateBugReport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const { id } = req.params;
    const { status, priority, adminResponse } = req.body;

    const existing = await prisma.bugReport.findUnique({ where: { id } });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('버그 리포트를 찾을 수 없습니다.', 404);
    }

    const updateData: Record<string, unknown> = {};

    // Validate and set status
    if (status) {
      const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        throw new AppError('유효하지 않은 상태입니다.', 400);
      }
      updateData.status = status.toUpperCase();
    }

    // Validate and set priority
    if (priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
      if (!validPriorities.includes(priority.toUpperCase())) {
        throw new AppError('유효하지 않은 우선순위입니다.', 400);
      }
      updateData.priority = priority.toUpperCase();
    }

    // Set admin response
    if (adminResponse !== undefined) {
      updateData.adminResponse = adminResponse.trim() || null;
      if (adminResponse.trim()) {
        updateData.respondedAt = new Date();
      }
    }

    const bugReport = await prisma.bugReport.update({
      where: { id },
      data: updateData,
    });

    res.json({ data: bugReport });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/bug-reports/admin/:id
 * Admin: Delete bug report
 */
export async function deleteBugReport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      throw new AppError('Tenant을 식별할 수 없습니다.', 400);
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const { id } = req.params;

    const existing = await prisma.bugReport.findUnique({ where: { id } });

    if (!existing || existing.tenantId !== req.tenant.id) {
      throw new AppError('버그 리포트를 찾을 수 없습니다.', 404);
    }

    await prisma.bugReport.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
