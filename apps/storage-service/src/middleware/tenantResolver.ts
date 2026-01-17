/**
 * Tenant Resolver Middleware
 *
 * Reads x-tenant-id header set by Istio (JWT claim or EnvoyFilter default).
 * No application-level fallback logic - Istio handles all tenant resolution.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import '@shared/types/express';

/**
 * Required tenant resolver - throws error if x-tenant-id not present
 */
export function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    const tenantName = req.headers['x-tenant-name'] as string | undefined;

    if (!tenantId) {
      throw new AppError('x-tenant-id 헤더가 필요합니다.', 400);
    }

    req.tenant = {
      id: tenantId,
      name: tenantName || tenantId.replace('tenant-', ''),
    };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional tenant resolver - continues without error if x-tenant-id not present
 */
export function optionalTenant(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  const tenantName = req.headers['x-tenant-name'] as string | undefined;

  if (tenantId) {
    req.tenant = {
      id: tenantId,
      name: tenantName || tenantId.replace('tenant-', ''),
    };
  }

  next();
}
