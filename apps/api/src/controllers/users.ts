import type { Response, NextFunction } from 'express'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'
import { UserStatus } from '@prisma/client'

// Get users list with pagination, search, and status filter
export async function getUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''
    const status = req.query.status as UserStatus | 'all' | undefined

    const whereClause: {
      OR?: { name?: { contains: string; mode: 'insensitive' }; email?: { contains: string; mode: 'insensitive' } }[]
      status?: UserStatus
    } = {}

    // Search by name or email
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Filter by status
    if (status && status !== 'all') {
      whereClause.status = status as UserStatus
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              comments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where: whereClause }),
    ])

    res.json({
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        status: user.status,
        commentCount: user._count.comments,
        createdAt: user.createdAt.toISOString(),
      })),
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

// Get user statistics with comparisons
export async function getUserStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    // This week (Monday to today)
    const dayOfWeek = now.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const thisWeekStart = new Date(todayStart)
    thisWeekStart.setDate(thisWeekStart.getDate() - daysFromMonday)

    // Last week (previous Monday to Sunday)
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(thisWeekStart)

    // This month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    const [
      totalUsers,
      suspendedUsers,
      todayNewUsers,
      yesterdayNewUsers,
      thisWeekNewUsers,
      lastWeekNewUsers,
      thisMonthNewUsers,
      lastMonthNewUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: thisWeekStart } } }),
      prisma.user.count({ where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd } } }),
      prisma.user.count({ where: { createdAt: { gte: thisMonthStart } } }),
      prisma.user.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    ])

    res.json({
      data: {
        totalUsers,
        suspendedUsers,
        activeUsers: totalUsers - suspendedUsers,
        todayNewUsers,
        yesterdayNewUsers,
        thisWeekNewUsers,
        lastWeekNewUsers,
        thisMonthNewUsers,
        lastMonthNewUsers,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Update user status (suspend/activate)
export async function updateUserStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { id } = req.params
    const { status } = req.body

    if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      throw new AppError('올바른 상태값을 입력해주세요.', 400)
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404)
    }

    // Cannot change admin status
    if (user.role === 'ADMIN') {
      throw new AppError('관리자의 상태는 변경할 수 없습니다.', 403)
    }

    // Cannot change own status
    if (user.id === req.user.id) {
      throw new AppError('자신의 상태는 변경할 수 없습니다.', 403)
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    res.json({
      data: {
        ...updatedUser,
        createdAt: updatedUser.createdAt.toISOString(),
      },
    })
  } catch (error) {
    next(error)
  }
}

// Delete user
export async function deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { id } = req.params

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404)
    }

    // Cannot delete admin
    if (user.role === 'ADMIN') {
      throw new AppError('관리자는 삭제할 수 없습니다.', 403)
    }

    // Cannot delete self
    if (user.id === req.user.id) {
      throw new AppError('자신을 삭제할 수 없습니다.', 403)
    }

    // Delete user (cascades to comments, likes, etc.)
    await prisma.user.delete({ where: { id } })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

// Get signup trend (daily/weekly/monthly)
export async function getSignupTrend(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const period = (req.query.period as string) || 'daily'
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let data: { date: string; count: number }[] = []

    if (period === 'daily') {
      // Last 14 days
      const days = 14
      const startDate = new Date(todayStart)
      startDate.setDate(startDate.getDate() - days + 1)

      const users = await prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      })

      // Group by date
      const countByDate: Record<string, number> = {}
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0] as string
        countByDate[dateStr] = 0
      }

      users.forEach((user) => {
        const dateStr = user.createdAt.toISOString().split('T')[0] as string
        if (dateStr in countByDate) {
          countByDate[dateStr] = (countByDate[dateStr] ?? 0) + 1
        }
      })

      data = Object.entries(countByDate).map(([date, count]) => ({ date, count }))
    } else if (period === 'weekly') {
      // Last 8 weeks
      const weeks = 8
      const dayOfWeek = now.getDay()
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const thisWeekStart = new Date(todayStart)
      thisWeekStart.setDate(thisWeekStart.getDate() - daysFromMonday)

      const startDate = new Date(thisWeekStart)
      startDate.setDate(startDate.getDate() - (weeks - 1) * 7)

      const users = await prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      })

      // Group by week
      for (let i = 0; i < weeks; i++) {
        const weekStart = new Date(startDate)
        weekStart.setDate(weekStart.getDate() + i * 7)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        const count = users.filter((user) => user.createdAt >= weekStart && user.createdAt < weekEnd).length

        const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`
        data.push({ date: weekLabel, count })
      }
    } else if (period === 'monthly') {
      // Last 6 months
      const months = 6

      for (let i = months - 1; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)

        const count = await prisma.user.count({
          where: { createdAt: { gte: monthStart, lte: monthEnd } },
        })

        const monthLabel = `${monthStart.getMonth() + 1}월`
        data.push({ date: monthLabel, count })
      }
    }

    // Calculate summary
    const total = data.reduce((sum, d) => sum + d.count, 0)
    const average = data.length > 0 ? total / data.length : 0
    const max = data.reduce((m, d) => (d.count > m.count ? d : m), { date: '', count: 0 })

    res.json({
      data: {
        trend: data,
        summary: {
          total,
          average: Math.round(average * 10) / 10,
          max: { date: max.date, count: max.count },
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get signup pattern by day of week
export async function getSignupPattern(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    // Get all users from the last 3 months for a meaningful pattern
    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: threeMonthsAgo } },
      select: { createdAt: true },
    })

    // Count by day of week (0 = Sunday, 1 = Monday, ... 6 = Saturday)
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const countByDay: number[] = [0, 0, 0, 0, 0, 0, 0]
    const weeksByDay: number[] = [0, 0, 0, 0, 0, 0, 0]

    // Count weeks for each day to calculate average
    const startDay = threeMonthsAgo.getDay()
    const totalDays = Math.ceil((now.getTime() - threeMonthsAgo.getTime()) / (1000 * 60 * 60 * 24))

    for (let i = 0; i < 7; i++) {
      weeksByDay[i] = Math.floor((totalDays + ((7 - startDay + i) % 7)) / 7)
    }

    users.forEach((user) => {
      const day = user.createdAt.getDay()
      countByDay[day] = (countByDay[day] ?? 0) + 1
    })

    // Build pattern data for Monday-Sunday order
    // dayNames index: 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
    // We want Monday-Sunday order: 월(1), 화(2), 수(3), 목(4), 금(5), 토(6), 일(0)
    const dayOrder = [1, 2, 3, 4, 5, 6, 0] // JavaScript day indices in Monday-Sunday order

    const reordered = dayOrder.map((dayIdx) => {
      const weeks = weeksByDay[dayIdx] ?? 1
      const count = countByDay[dayIdx] ?? 0
      const avg = weeks > 0 ? count / weeks : 0
      return {
        day: dayNames[dayIdx] ?? '',
        count,
        average: Math.round(avg * 10) / 10,
      }
    })

    // Find peak day
    const peakDay = reordered.reduce(
      (max, day) => (day.average > max.average ? day : max),
      { day: '', count: 0, average: 0 },
    )

    res.json({
      data: {
        pattern: reordered,
        peakDay: peakDay.day,
      },
    })
  } catch (error) {
    next(error)
  }
}
