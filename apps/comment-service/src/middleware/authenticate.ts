import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * 인증 미들웨어 (Istio 헤더 기반)
 *
 * Istio RequestAuthentication에서 JWT 검증 후 헤더로 주입:
 * - x-user-id: JWT claim에서 추출된 user ID
 * - x-user-email: JWT claim에서 추출된 email
 * - x-user-role: JWT claim에서 추출된 role
 * - x-tenant-id: JWT claim에서 추출된 tenant ID
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.headers['x-user-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    const email = req.headers['x-user-email'] as string;
    const role = req.headers['x-user-role'] as string;

    if (!userId || !tenantId) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    req.user = {
      id: userId,
      tenantId,
      email: email || '',
      role: role || 'USER',
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 선택적 인증 미들웨어
 * 토큰이 있으면 사용자 정보 설정, 없으면 익명으로 처리
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string;
  const tenantId = req.headers['x-tenant-id'] as string;
  const email = req.headers['x-user-email'] as string;
  const role = req.headers['x-user-role'] as string;

  if (userId && tenantId) {
    req.user = {
      id: userId,
      tenantId,
      email: email || '',
      role: role || 'USER',
    };
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
