import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Import shared types - this registers the global Express.Request extension
import '@shared/types/express';

/**
 * Tenant 식별 미들웨어 (Istio 헤더 기반)
 *
 * Istio RequestAuthentication에서 JWT 검증 후 헤더로 주입:
 * - x-tenant-id: JWT claim에서 추출된 tenant ID
 * - x-tenant-name: (optional) tenant name
 */
export function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const tenantName = req.headers['x-tenant-name'] as string | undefined;

    if (!tenantId) {
      throw new AppError('Tenant 식별 불가. x-tenant-id 헤더가 필요합니다.', 400);
    }

    req.tenant = {
      id: tenantId,
      name: tenantName,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 선택적 Tenant 식별 (Tenant 없어도 통과)
 */
export function optionalTenant(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.headers['x-tenant-id'] as string;
  const tenantName = req.headers['x-tenant-name'] as string | undefined;

  if (tenantId) {
    req.tenant = {
      id: tenantId,
      name: tenantName,
    };
  }

  next();
}
