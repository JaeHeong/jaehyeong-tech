import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * 슈퍼 관리자 인증 확인
 * DOCUMENTATION_REVIEW.md 권장사항 반영
 */
function verifySuperAdmin(req: Request): void {
  const superAdminKey = req.headers['x-super-admin-key'];

  if (!process.env.SUPER_ADMIN_API_KEY) {
    throw new AppError('슈퍼 관리자 API Key가 설정되지 않았습니다.', 500);
  }

  if (superAdminKey !== process.env.SUPER_ADMIN_API_KEY) {
    throw new AppError('슈퍼 관리자 권한이 필요합니다.', 403);
  }
}

/**
 * Tenant 생성 (슈퍼 관리자 전용)
 */
export async function createTenant(req: Request, res: Response, next: NextFunction) {
  try {
    // 슈퍼 관리자 권한 확인
    verifySuperAdmin(req);

    const {
      name,
      domain,
      jwtExpiry = '7d',
      allowRegistration = true,
      allowGoogleOauth = false,
      googleClientId,
      googleClientSecret,
      passwordMinLength = 8,
      passwordRequireUppercase = true,
      passwordRequireNumber = true,
      passwordRequireSpecial = false,
    } = req.body;

    // 1. 이름 중복 확인
    const existing = await prisma.tenant.findUnique({
      where: { name },
    });

    if (existing) {
      throw new AppError('이미 존재하는 Tenant 이름입니다.', 400);
    }

    // 2. JWT Secret 자동 생성
    const jwtSecret = crypto.randomBytes(64).toString('hex');

    // 3. Tenant 생성
    const tenant = await prisma.tenant.create({
      data: {
        name,
        domain,
        jwtSecret,
        jwtExpiry,
        allowRegistration,
        allowGoogleOauth,
        googleClientId,
        googleClientSecret,
        passwordMinLength,
        passwordRequireUppercase,
        passwordRequireNumber,
        passwordRequireSpecial,
      },
    });

    res.status(201).json({
      data: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        jwtExpiry: tenant.jwtExpiry,
        allowRegistration: tenant.allowRegistration,
        allowGoogleOauth: tenant.allowGoogleOauth,
        passwordPolicy: {
          minLength: tenant.passwordMinLength,
          requireUppercase: tenant.passwordRequireUppercase,
          requireNumber: tenant.passwordRequireNumber,
          requireSpecial: tenant.passwordRequireSpecial,
        },
        createdAt: tenant.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Tenant 목록 조회 (슈퍼 관리자 전용)
 */
export async function listTenants(req: Request, res: Response, next: NextFunction) {
  try {
    verifySuperAdmin(req);

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        isActive: true,
        allowRegistration: true,
        allowGoogleOauth: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ data: tenants });
  } catch (error) {
    next(error);
  }
}

/**
 * Tenant 정보 조회 (슈퍼 관리자 전용)
 */
export async function getTenant(req: Request, res: Response, next: NextFunction) {
  try {
    verifySuperAdmin(req);

    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new AppError('Tenant를 찾을 수 없습니다.', 404);
    }

    // jwtSecret은 민감 정보이므로 제외
    const { jwtSecret, googleClientSecret, ...tenantData } = tenant;

    res.json({ data: tenantData });
  } catch (error) {
    next(error);
  }
}

/**
 * Tenant 업데이트 (슈퍼 관리자 전용)
 */
export async function updateTenant(req: Request, res: Response, next: NextFunction) {
  try {
    verifySuperAdmin(req);

    const { id } = req.params;
    const {
      domain,
      jwtExpiry,
      allowRegistration,
      allowGoogleOauth,
      googleClientId,
      googleClientSecret,
      passwordMinLength,
      passwordRequireUppercase,
      passwordRequireNumber,
      passwordRequireSpecial,
      isActive,
    } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        domain,
        jwtExpiry,
        allowRegistration,
        allowGoogleOauth,
        googleClientId,
        googleClientSecret,
        passwordMinLength,
        passwordRequireUppercase,
        passwordRequireNumber,
        passwordRequireSpecial,
        isActive,
      },
    });

    const { jwtSecret, ...tenantData } = tenant;

    res.json({ data: tenantData });
  } catch (error) {
    next(error);
  }
}
