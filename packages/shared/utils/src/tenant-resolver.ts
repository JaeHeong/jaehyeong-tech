/**
 * Tenant Resolver Middleware
 *
 * Resolves tenant ID from multiple sources (priority order):
 * 1. x-tenant-id header (from JWT claims via Istio - authenticated requests)
 * 2. Host header (subdomain-based - public requests)
 * 3. TENANT_ID environment variable (single-tenant fallback)
 *
 * Best Practice:
 * - Authenticated requests: Istio extracts tenantId from JWT and sets x-tenant-id header
 * - Public requests: Derive tenant from Host header (subdomain)
 * - Single-tenant: Use TENANT_ID env var as fallback
 */

import { Request, Response, NextFunction } from 'express';
import '@shared/types/express';

export interface TenantResolverOptions {
  /** Require tenant to be present (throw error if not found) */
  required?: boolean;
  /** Custom tenant ID resolver function */
  customResolver?: (req: Request) => string | undefined;
  /** Environment variable name for default tenant ID */
  envVarName?: string;
}

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Extract tenant ID from Host header
 * Examples:
 * - dev-tech.jaehyeong.site -> tenant-dev-tech
 * - tech.jaehyeong.site -> tenant-tech
 * - localhost:3000 -> uses env fallback
 */
function extractTenantFromHost(host: string | undefined): string | undefined {
  if (!host) return undefined;

  // Remove port if present
  const hostname = host.split(':')[0];

  // Skip localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }

  // Extract subdomain (first part before the domain)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    // e.g., dev-tech.jaehyeong.site -> dev-tech
    const subdomain = parts[0];
    return `tenant-${subdomain}`;
  }

  return undefined;
}

/**
 * Create tenant resolver middleware
 */
export function createTenantResolver(options: TenantResolverOptions = {}) {
  const { required = true, customResolver, envVarName = 'TENANT_ID' } = options;

  return function resolveTenant(req: Request, res: Response, next: NextFunction) {
    try {
      let tenantId: string | undefined;
      let tenantName: string | undefined;

      // Priority 1: x-tenant-id header (from JWT claims via Istio)
      tenantId = req.headers['x-tenant-id'] as string;
      tenantName = req.headers['x-tenant-name'] as string;

      // Priority 2: Custom resolver (if provided)
      if (!tenantId && customResolver) {
        tenantId = customResolver(req);
      }

      // Priority 3: Host header (subdomain-based)
      if (!tenantId) {
        const host = req.headers['host'] || req.headers['x-forwarded-host'] as string;
        tenantId = extractTenantFromHost(host);

        // Set tenant name from subdomain
        if (tenantId && !tenantName) {
          tenantName = tenantId.replace('tenant-', '');
        }
      }

      // Priority 4: Environment variable (single-tenant fallback)
      if (!tenantId) {
        const envTenantId = process.env[envVarName];
        if (envTenantId) {
          // Add tenant- prefix if not present
          tenantId = envTenantId.startsWith('tenant-') ? envTenantId : `tenant-${envTenantId}`;
          tenantName = tenantName || envTenantId.replace('tenant-', '');
        }
      }

      // Check if tenant is required but not found
      if (required && !tenantId) {
        throw new AppError('Tenant 식별 불가. 인증 토큰 또는 올바른 호스트가 필요합니다.', 400);
      }

      // Set tenant on request
      if (tenantId) {
        req.tenant = {
          id: tenantId,
          name: tenantName,
        };
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Required tenant resolver (throws error if tenant not found)
 */
export const resolveTenant = createTenantResolver({ required: true });

/**
 * Optional tenant resolver (continues without error if tenant not found)
 */
export const optionalTenant = createTenantResolver({ required: false });
