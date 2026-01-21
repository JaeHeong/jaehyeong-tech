import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwtService';
import { AppError } from './errorHandler';
import { Tenant } from './tenantResolver';

/**
 * JWT 인증 미들웨어
 *
 * 인증 방식 (우선순위):
 * 1. Istio 헤더 기반: x-user-id, x-user-email, x-user-role 헤더가 있으면 사용
 *    (Istio RequestAuthentication에서 JWT 검증 후 헤더로 주입)
 * 2. Authorization 헤더 기반: Bearer 토큰을 직접 검증 (fallback)
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;

    if (!tenant) {
      throw new AppError('Tenant가 먼저 식별되어야 합니다.', 500);
    }

    // 1. Istio 헤더 기반 인증 (우선)
    const userId = req.headers['x-user-id'] as string;
    const email = req.headers['x-user-email'] as string;
    const role = req.headers['x-user-role'] as string;

    if (userId) {
      req.user = {
        id: userId,
        tenantId: tenant.id,
        email: email || '',
        role: role || 'USER',
      };
      return next();
    }

    // 2. Authorization 헤더 기반 인증 (fallback)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('인증 토큰이 제공되지 않았습니다.', 401);
    }

    const token = authHeader.substring(7);

    // JWT 검증
    const payload = verifyToken(tenant, token);

    // Request에 사용자 정보 첨부
    req.user = {
      id: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Admin 권한 확인 미들웨어
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    if (req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}
