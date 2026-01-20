import { Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import { Tenant } from '../middleware/tenantResolver';
import { hashPassword, validatePassword } from '../services/passwordService';

/**
 * 사용자 프로필 업데이트
 */
export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const userId = req.user!.id;
    const { name, bio, title, avatar, github, twitter, linkedin, website } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        bio,
        title,
        avatar,
        github,
        twitter,
        linkedin,
        website,
      },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        title: true,
        avatar: true,
        github: true,
        twitter: true,
        linkedin: true,
        website: true,
        role: true,
      },
    });

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

/**
 * 비밀번호 변경
 */
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    // 1. 현재 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404);
    }

    // 2. 현재 비밀번호 검증
    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new AppError('현재 비밀번호가 일치하지 않습니다.', 400);
    }

    // 3. 새 비밀번호 정책 검증
    validatePassword(tenant, newPassword);

    // 4. 새 비밀번호 해시 및 업데이트
    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자 목록 조회 (관리자 전용)
 */
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { role, status, search, page = 1, limit = 20 } = req.query;

    const where: any = {
      tenantId: tenant.id,
    };

    if (role && role !== 'all') {
      where.role = role;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    // Search by name or email
    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          bio: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        skip,
        take: Number(limit),
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Fetch comment counts from comment-service
    let commentCounts: Record<string, number> = {};
    const userIds = users.map((user) => user.id);

    if (userIds.length > 0) {
      try {
        const commentServiceUrl = process.env.COMMENT_SERVICE_URL || 'http://comment-service:3003';
        const response = await fetch(
          `${commentServiceUrl}/internal/comments/count-by-users?userIds=${userIds.join(',')}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-request': 'true',
              'x-tenant-id': tenant.id,
            },
          }
        );

        if (response.ok) {
          const data = (await response.json()) as { data?: Record<string, number> };
          commentCounts = data.data || {};
        }
      } catch (error) {
        console.error('Failed to fetch comment counts from comment-service:', error);
        // Continue without comment counts
      }
    }

    // Transform to include commentCount
    const usersWithCommentCount = users.map((user) => ({
      ...user,
      commentCount: commentCounts[user.id] || 0,
    }));

    res.json({
      data: usersWithCommentCount,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자 역할 변경 (관리자 전용)
 * Admin protection: Cannot modify other admins
 */
export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { userId } = req.params;
    const { role } = req.body;

    // Tenant 격리 확인
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: tenant.id,
      },
    });

    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404);
    }

    // Admin protection: Cannot modify other admin's role
    if (user.role === 'ADMIN' && user.id !== req.user!.id) {
      throw new AppError('다른 관리자의 역할은 변경할 수 없습니다.', 403);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    res.json({ data: updatedUser });
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자 정지/활성화 (관리자 전용)
 * Admin protection: Cannot modify other admins
 */
export async function updateUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { userId } = req.params;
    const { status } = req.body;

    // Tenant 격리 확인
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: tenant.id,
      },
    });

    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404);
    }

    // Admin protection: Cannot modify other admin's status
    if (user.role === 'ADMIN' && user.id !== req.user!.id) {
      throw new AppError('다른 관리자의 상태는 변경할 수 없습니다.', 403);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    res.json({ data: updatedUser });
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자 삭제 (관리자 전용)
 * Admin protection: Cannot delete admins
 * DELETE /api/users/:userId
 */
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { userId } = req.params;

    // Tenant 격리 확인
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: tenant.id,
      },
    });

    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404);
    }

    // Admin protection: Cannot delete admins
    if (user.role === 'ADMIN') {
      throw new AppError('관리자 계정은 삭제할 수 없습니다.', 403);
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({
      data: {
        success: true,
        message: '사용자가 삭제되었습니다.',
        deletedUserId: userId,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자 검색 (관리자 전용)
 * GET /api/users/search?q=검색어
 */
export async function searchUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || typeof q !== 'string') {
      throw new AppError('검색어를 입력해주세요.', 400);
    }

    const searchTerm = q.trim();
    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          tenantId: tenant.id,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({
        where: {
          tenantId: tenant.id,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    res.json({
      data: users,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        searchTerm,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 가입 추이 분석 (관리자 전용)
 * GET /api/users/signup-trend?period=daily|weekly|monthly
 */
export async function getSignupTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { period = 'daily' } = req.query;

    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today

    // Generate all periods with 0 values first
    const allPeriods: { key: string; date: string; count: number }[] = [];

    if (period === 'daily') {
      // 14 days
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        allPeriods.push({ key, date: `${month}-${day}`, count: 0 });
      }
    } else if (period === 'weekly') {
      // 8 weeks (starting from current week going back)
      const currentMonday = new Date(now);
      const dayOfWeek = currentMonday.getDay();
      currentMonday.setDate(currentMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      currentMonday.setHours(0, 0, 0, 0);

      for (let i = 7; i >= 0; i--) {
        const monday = new Date(currentMonday);
        monday.setDate(monday.getDate() - i * 7);
        const key = monday.toISOString().split('T')[0];
        const month = monday.getMonth() + 1;
        const day = monday.getDate();
        allPeriods.push({ key, date: `${month}/${day}`, count: 0 });
      }
    } else if (period === 'monthly') {
      // 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const month = d.getMonth() + 1;
        allPeriods.push({ key, date: `${month}월`, count: 0 });
      }
    }

    // Get the earliest date for query
    const startDate = new Date(allPeriods[0].key);
    startDate.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group users by period key
    const grouped: Record<string, number> = {};
    users.forEach((user) => {
      const date = new Date(user.createdAt);
      let key: string;

      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        // Get the Monday of the week
        const dayOfWeek = date.getDay();
        const monday = new Date(date);
        monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        key = monday.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      grouped[key] = (grouped[key] || 0) + 1;
    });

    // Merge counts into allPeriods
    allPeriods.forEach((p) => {
      if (grouped[p.key]) {
        p.count = grouped[p.key];
      }
    });

    // Create trend array with formatted dates
    const trend = allPeriods.map((p) => ({ date: p.date, count: p.count }));

    // Calculate summary
    const total = trend.reduce((sum, item) => sum + item.count, 0);
    const average = trend.length > 0 ? Math.round((total / trend.length) * 10) / 10 : 0;
    const maxItem = trend.reduce((max, item) => (item.count > max.count ? item : max), { date: '-', count: 0 });

    res.json({
      data: {
        trend,
        summary: {
          total,
          average,
          max: { date: maxItem.date, count: maxItem.count },
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 요일별 가입 패턴 분석 (관리자 전용)
 * GET /api/users/signup-pattern
 */
export async function getSignupPattern(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);

    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: { createdAt: true },
    });

    // Group by day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeekCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    users.forEach((user) => {
      const dayOfWeek = new Date(user.createdAt).getDay();
      dayOfWeekCounts[dayOfWeek]++;
    });

    // Calculate average per day (total users / 7 days as baseline)
    const totalWeeks = Math.max(1, Math.ceil(users.length / 7));

    const pattern = dayOfWeekCounts.map((count, index) => ({
      day: dayNames[index],
      count,
      average: Math.round((count / totalWeeks) * 10) / 10,
    }));

    // Find peak day
    const maxCount = Math.max(...dayOfWeekCounts);
    const peakDayIndex = dayOfWeekCounts.indexOf(maxCount);

    res.json({
      data: {
        pattern,
        peakDay: dayNames[peakDayIndex],
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자 통계 조회
 * GET /api/users/stats
 */
export async function getUserStats(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    // 이번 주 시작 (월요일)
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisWeekStart = new Date(todayStart.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 이번 달 시작
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const baseWhere = { tenantId: tenant.id };

    const [
      totalUsers,
      activeUsers,
      todayNewUsers,
      yesterdayNewUsers,
      thisWeekNewUsers,
      lastWeekNewUsers,
      thisMonthNewUsers,
      lastMonthNewUsers,
    ] = await Promise.all([
      prisma.user.count({ where: baseWhere }),
      prisma.user.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
      prisma.user.count({ where: { ...baseWhere, createdAt: { gte: todayStart } } }),
      prisma.user.count({
        where: { ...baseWhere, createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.user.count({ where: { ...baseWhere, createdAt: { gte: thisWeekStart } } }),
      prisma.user.count({
        where: { ...baseWhere, createdAt: { gte: lastWeekStart, lt: thisWeekStart } },
      }),
      prisma.user.count({ where: { ...baseWhere, createdAt: { gte: thisMonthStart } } }),
      prisma.user.count({
        where: { ...baseWhere, createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
      }),
    ]);

    res.json({
      data: {
        total: totalUsers, // For analytics-service compatibility
        totalUsers,
        activeUsers,
        todayNewUsers,
        yesterdayNewUsers,
        thisWeekNewUsers,
        lastWeekNewUsers,
        thisMonthNewUsers,
        lastMonthNewUsers,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자 공개 정보 조회 (Internal API - 서비스간 통신용)
 * 인증 없이 호출 가능, tenantId + userId로 조회
 */
export async function getUserPublicInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { userId } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        bio: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}
