import jwt from 'jsonwebtoken';
import { Tenant } from '../middleware/tenantResolver';
import { AppError } from '../middleware/errorHandler';

export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}

/**
 * JWT 발급 (Tenant별 Secret 사용)
 */
export function generateToken(
  tenant: Tenant,
  userId: string,
  role: string,
  email: string
): string {
  const payload: JWTPayload = {
    userId,
    tenantId: tenant.id,
    role,
    email,
  };

  return jwt.sign(payload, tenant.jwtSecret, {
    expiresIn: tenant.jwtExpiry,
    issuer: `auth-service:${tenant.name}`,
    audience: tenant.domain,
  });
}

/**
 * JWT 검증 (Tenant별 Secret 사용)
 */
export function verifyToken(tenant: Tenant, token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, tenant.jwtSecret, {
      issuer: `auth-service:${tenant.name}`,
      audience: tenant.domain,
    }) as JWTPayload;

    // Tenant ID 일치 확인 (보안 강화)
    if (decoded.tenantId !== tenant.id) {
      throw new AppError('Invalid token for this tenant', 403);
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('유효하지 않은 토큰입니다.', 401);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('만료된 토큰입니다.', 401);
    }
    throw error;
  }
}

/**
 * JWT 갱신
 */
export function refreshToken(tenant: Tenant, oldToken: string): string {
  const decoded = verifyToken(tenant, oldToken);

  return generateToken(tenant, decoded.userId, decoded.role, decoded.email);
}
