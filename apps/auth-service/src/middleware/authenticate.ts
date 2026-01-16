import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwtService';
import { AppError } from './errorHandler';

/**
 * JWT 인증 미들웨어
 * Tenant가 이미 resolve된 상태에서 사용
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenant } = req;

    if (!tenant) {
      throw new AppError('Tenant가 먼저 식별되어야 합니다.', 500);
    }

    // Authorization 헤더 확인
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
