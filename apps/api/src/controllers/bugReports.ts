import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'
import crypto from 'crypto'

// Helper to hash IP for privacy
function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.JWT_SECRET).digest('hex').slice(0, 16)
}

// Create a bug report (public)
export async function createBugReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, category, priority, description, email } = req.body

    if (!title?.trim()) {
      throw new AppError('제목을 입력해주세요.', 400)
    }

    if (!category) {
      throw new AppError('카테고리를 선택해주세요.', 400)
    }

    if (!description?.trim()) {
      throw new AppError('설명을 입력해주세요.', 400)
    }

    // Validate category
    const validCategories = ['ui', 'functional', 'performance', 'security', 'etc']
    if (!validCategories.includes(category)) {
      throw new AppError('유효하지 않은 카테고리입니다.', 400)
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high']
    const finalPriority = validPriorities.includes(priority) ? priority : 'medium'

    // Get IP hash for spam prevention
    const ip = req.ip || req.socket.remoteAddress || ''
    const ipHash = hashIP(ip)

    // Create bug report
    const bugReport = await prisma.bugReport.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        category: category.toUpperCase() as 'UI' | 'FUNCTIONAL' | 'PERFORMANCE' | 'SECURITY' | 'ETC',
        priority: finalPriority.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH',
        email: email?.trim() || null,
        ipHash,
      },
    })

    res.status(201).json({
      data: {
        id: bugReport.id,
        message: '버그 리포트가 제출되었습니다.',
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get all bug reports - public (without sensitive info)
export async function getPublicBugReports(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100)
    const skip = (page - 1) * limit
    const status = req.query.status as string
    const category = req.query.category as string

    const where: Record<string, unknown> = {}
    if (status) where.status = status.toUpperCase()
    if (category) where.category = category.toUpperCase()

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
          // Exclude: description, email, ipHash, updatedAt for privacy
        },
      }),
      prisma.bugReport.count({ where }),
    ])

    res.json({
      data: bugReports,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get all bug reports (admin only) - with full details
export async function getBugReports(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100)
    const skip = (page - 1) * limit
    const status = req.query.status as string
    const category = req.query.category as string

    const where: Record<string, unknown> = {}
    if (status) where.status = status.toUpperCase()
    if (category) where.category = category.toUpperCase()

    const [bugReports, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bugReport.count({ where }),
    ])

    res.json({
      data: bugReports,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get single bug report - public (without sensitive info)
export async function getPublicBugReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    const bugReport = await prisma.bugReport.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        // Exclude: email, ipHash, updatedAt for privacy
      },
    })

    if (!bugReport) {
      throw new AppError('버그 리포트를 찾을 수 없습니다.', 404)
    }

    res.json({ data: bugReport })
  } catch (error) {
    next(error)
  }
}

// Get single bug report (admin only) - with full details
export async function getBugReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { id } = req.params

    const bugReport = await prisma.bugReport.findUnique({
      where: { id },
    })

    if (!bugReport) {
      throw new AppError('버그 리포트를 찾을 수 없습니다.', 404)
    }

    res.json({ data: bugReport })
  } catch (error) {
    next(error)
  }
}

// Update bug report status (admin only)
export async function updateBugReportStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
    if (!validStatuses.includes(status)) {
      throw new AppError('유효하지 않은 상태입니다.', 400)
    }

    const bugReport = await prisma.bugReport.update({
      where: { id },
      data: { status },
    })

    res.json({ data: bugReport })
  } catch (error) {
    next(error)
  }
}

// Update bug report (admin only) - for admin response and other updates
export async function updateBugReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { id } = req.params
    const { status, priority, adminResponse } = req.body

    const updateData: Record<string, unknown> = {}

    // Validate and set status
    if (status) {
      const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
      if (!validStatuses.includes(status)) {
        throw new AppError('유효하지 않은 상태입니다.', 400)
      }
      updateData.status = status
    }

    // Validate and set priority
    if (priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH']
      if (!validPriorities.includes(priority)) {
        throw new AppError('유효하지 않은 우선순위입니다.', 400)
      }
      updateData.priority = priority
    }

    // Set admin response
    if (adminResponse !== undefined) {
      updateData.adminResponse = adminResponse.trim() || null
      if (adminResponse.trim()) {
        updateData.respondedAt = new Date()
      }
    }

    const bugReport = await prisma.bugReport.update({
      where: { id },
      data: updateData,
    })

    res.json({ data: bugReport })
  } catch (error) {
    next(error)
  }
}

// Delete bug report (admin only)
export async function deleteBugReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { id } = req.params

    await prisma.bugReport.delete({
      where: { id },
    })

    res.json({ message: '버그 리포트가 삭제되었습니다.' })
  } catch (error) {
    next(error)
  }
}
