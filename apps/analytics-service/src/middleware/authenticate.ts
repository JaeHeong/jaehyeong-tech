import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || '';

/**
 * Bearer 토큰으로 auth service에서 사용자 정보 조회
 */
async function verifyTokenViaAuthService(
  authHeader: string,
  tenantId: string
): Promise<{ id: string; email: string; role: string; tenantId: string } | null> {
  if (!AUTH_SERVICE_URL) return null;

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/me`, {
      headers: {
        Authorization: authHeader,
        'x-tenant-id': tenantId,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) return null;
    const data = await response.json() as { data: { id: string; email: string; role: string } };
    return { ...data.data, tenantId };
  } catch {
    return null;
  }
}

/**
 * 인증 미들웨어
 *
 * 우선순위:
 * 1. Istio/서비스메시 헤더 (x-user-id, x-user-role 등) - 레거시
 * 2. Authorization: Bearer 토큰 → auth service에서 검증
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;

    // 1. Istio 헤더 기반 인증 (레거시)
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      req.user = {
        id: userId,
        tenantId,
        email: req.headers['x-user-email'] as string || '',
        role: req.headers['x-user-role'] as string || 'USER',
      };
      return next();
    }

    // 2. Bearer 토큰 기반 인증
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    const user = await verifyTokenViaAuthService(authHeader, tenantId);
    if (!user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 선택적 인증 미들웨어
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.headers['x-tenant-id'] as string;

  // 1. Istio 헤더
  const userId = req.headers['x-user-id'] as string;
  if (userId) {
    req.user = {
      id: userId,
      tenantId,
      email: req.headers['x-user-email'] as string || '',
      role: req.headers['x-user-role'] as string || 'USER',
    };
    return next();
  }

  // 2. Bearer 토큰 (optional - 실패해도 통과)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const user = await verifyTokenViaAuthService(authHeader, tenantId);
    if (user) {
      req.user = user;
    }
  }

  next();
}

/**
 * 필수 인증 미들웨어
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError('인증이 필요합니다.', 401));
  }
  next();
}

/**
 * Admin 권한 확인 미들웨어
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError('인증이 필요합니다.', 401));
  }

  if (req.user.role !== 'ADMIN') {
    return next(new AppError('관리자 권한이 필요합니다.', 403));
  }

  next();
}
