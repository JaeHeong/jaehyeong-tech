/**
 * Tenant Resolver Middleware
 *
 * Resolves tenant ID from multiple sources (priority order):
 * 1. x-tenant-id header (from JWT claims via Istio - authenticated requests)
 * 2. Host header (subdomain-based - public requests)
 * 3. TENANT_ID environment variable (single-tenant fallback)
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import '@shared/types/express';

/**
 * Extract tenant ID from Host header
 */
function extractTenantFromHost(host: string | undefined): string | undefined {
  if (!host) return undefined;
  const hostname = host.split(':')[0];
  if (hostname === 'localhost' || hostname === '127.0.0.1') return undefined;
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return `tenant-${parts[0]}`;
  }
  return undefined;
}

/**
 * Tenant 식별 미들웨어 (다중 소스)
 */
export function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    let tenantId = req.headers['x-tenant-id'] as string;
    let tenantName = req.headers['x-tenant-name'] as string | undefined;

    // Host header fallback
    if (!tenantId) {
      const host = req.headers['host'] || req.headers['x-forwarded-host'] as string;
      tenantId = extractTenantFromHost(host);
      if (tenantId) tenantName = tenantId.replace('tenant-', '');
    }

    // Environment variable fallback
    if (!tenantId && process.env.TENANT_ID) {
      const envId = process.env.TENANT_ID;
      tenantId = envId.startsWith('tenant-') ? envId : `tenant-${envId}`;
      tenantName = tenantName || envId.replace('tenant-', '');
    }

    if (!tenantId) {
      throw new AppError('Tenant 식별 불가. 인증 토큰 또는 올바른 호스트가 필요합니다.', 400);
    }

    req.tenant = { id: tenantId, name: tenantName };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 선택적 Tenant 식별
 */
export function optionalTenant(req: Request, res: Response, next: NextFunction) {
  let tenantId = req.headers['x-tenant-id'] as string;
  let tenantName = req.headers['x-tenant-name'] as string | undefined;

  if (!tenantId) {
    const host = req.headers['host'] || req.headers['x-forwarded-host'] as string;
    tenantId = extractTenantFromHost(host);
    if (tenantId) tenantName = tenantId.replace('tenant-', '');
  }

  if (!tenantId && process.env.TENANT_ID) {
    const envId = process.env.TENANT_ID;
    tenantId = envId.startsWith('tenant-') ? envId : `tenant-${envId}`;
    tenantName = tenantName || envId.replace('tenant-', '');
  }

  if (tenantId) {
    req.tenant = { id: tenantId, name: tenantName };
  }

  next();
}
