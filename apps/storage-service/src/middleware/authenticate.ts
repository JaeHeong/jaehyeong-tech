import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * 선택적 JWT 인증 미들웨어
 * 토큰이 있으면 검증하고, 없으면 익명 사용자로 처리
 *
 * 실제 프로덕션에서는 Auth Service와 통신하거나
 * 공유된 JWT Secret으로 검증해야 함
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // TODO: Auth Service와 통신하거나 JWT 검증
      // 여기서는 임시로 토큰에서 간단한 정보만 추출
      // 실제로는 Auth Service의 JWT Secret으로 검증해야 함

      // 임시 구현: 토큰이 있으면 인증된 것으로 간주
      req.user = {
        id: 'user-id', // 실제로는 JWT에서 추출
        tenantId: req.tenant?.id || '',
        email: 'user@example.com',
        role: 'USER',
      };
    }

    // 인증되지 않아도 계속 진행 (익명 댓글 허용)
    next();
  } catch (error) {
    // 인증 실패해도 익명으로 처리
    next();
  }
}

/**
 * 필수 인증 미들웨어
 * 관리자 기능에 사용
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401);
    }

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
