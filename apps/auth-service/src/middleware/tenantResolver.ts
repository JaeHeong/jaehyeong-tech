import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { AppError } from './errorHandler';

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  jwtSecret: string;
  jwtExpiry: string;
  googleClientId: string | null;
  googleClientSecret: string | null;
  allowRegistration: boolean;
  allowGoogleOauth: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  isActive: boolean;
}

/**
 * Tenant 식별 미들웨어
 *
 * 우선순위:
 * 1. X-Tenant-ID 헤더
 * 2. X-Tenant-Name 헤더
 * 3. Subdomain (jaehyeong-tech.auth-service.com → jaehyeong-tech)
 */
export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    let tenantIdentifier: string | undefined;

    // 1. X-Tenant-ID 헤더 확인
    if (req.headers['x-tenant-id']) {
      tenantIdentifier = req.headers['x-tenant-id'] as string;
    }
    // 2. X-Tenant-Name 헤더 확인
    else if (req.headers['x-tenant-name']) {
      tenantIdentifier = req.headers['x-tenant-name'] as string;
    }
    // 3. Subdomain 확인
    else {
      const hostname = req.hostname;
      const parts = hostname.split('.');

      // jaehyeong-tech.auth-service.com → jaehyeong-tech
      if (parts.length >= 3) {
        tenantIdentifier = parts[0];
      }
    }

    if (!tenantIdentifier) {
      throw new AppError(
        'Tenant을 식별할 수 없습니다. X-Tenant-Name 헤더를 제공하거나 서브도메인을 사용하세요.',
        400
      );
    }

    // Strip "tenant-" prefix if present (Istio EnvoyFilter sets x-tenant-id with prefix)
    const tenantName = tenantIdentifier.startsWith('tenant-')
      ? tenantIdentifier.slice(7)
      : tenantIdentifier;

    // Tenant 조회
    const tenant = await prisma.tenant.findUnique({
      where: { name: tenantName },
    });

    if (!tenant) {
      throw new AppError(`Tenant를 찾을 수 없습니다: ${tenantIdentifier}`, 404);
    }

    if (!tenant.isActive) {
      throw new AppError('이 Tenant는 비활성화 상태입니다.', 403);
    }

    // Request에 첨부
    req.tenant = tenant as Tenant;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 선택적 Tenant 식별 (Tenant 없어도 통과)
 */
export async function optionalTenant(req: Request, res: Response, next: NextFunction) {
  try {
    await resolveTenant(req, res, () => {});
  } catch {
    // Tenant 없어도 계속 진행
  }
  next();
}
