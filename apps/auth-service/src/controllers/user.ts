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
    const { role, status, page = 1, limit = 20 } = req.query;

    const where: any = {
      tenantId: tenant.id,
    };

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
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

    res.json({
      data: users,
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
 * 사용자 통계 조회 (Internal API - 서비스간 통신용)
 * GET /api/users/stats
 */
export async function getUserStats(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);

    const total = await prisma.user.count({
      where: { tenantId: tenant.id, role: 'USER' },
    });

    res.json({ data: { total } });
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
