import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Tenant } from '../middleware/tenantResolver';
import { AppError } from '../middleware/errorHandler';

export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}

// RS256 키 (환경변수에서 로드)
const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';

// 키 ID (고정값 또는 키 해시)
const keyId = 'jaehyeong-tech-jwt-key-1';

/**
 * JWT 발급 (RS256)
 */
export function generateToken(
  tenant: Tenant,
  userId: string,
  role: string,
  email: string
): string {
  if (!privateKey) {
    throw new AppError('JWT private key not configured', 500);
  }

  const payload: JWTPayload = {
    userId,
    tenantId: tenant.id,
    role,
    email,
  };

  const options: jwt.SignOptions = {
    algorithm: 'RS256',
    expiresIn: tenant.jwtExpiry as jwt.SignOptions['expiresIn'],
    issuer: `https://${tenant.domain}`,
    audience: tenant.domain,
    keyid: keyId,
  };

  return jwt.sign(payload, privateKey, options);
}

/**
 * JWT 검증 (RS256)
 */
export function verifyToken(tenant: Tenant, token: string): JWTPayload {
  if (!publicKey) {
    throw new AppError('JWT public key not configured', 500);
  }

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: `https://${tenant.domain}`,
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

/**
 * JWKS (JSON Web Key Set) 생성
 * Istio RequestAuthentication에서 사용
 */
export function getJWKS(): { keys: any[] } {
  if (!publicKey) {
    return { keys: [] };
  }

  try {
    // PEM을 JWK로 변환
    const keyObject = crypto.createPublicKey(publicKey);
    const jwk = keyObject.export({ format: 'jwk' });

    return {
      keys: [
        {
          ...jwk,
          kid: keyId,
          use: 'sig',
          alg: 'RS256',
        },
      ],
    };
  } catch (error) {
    console.error('Failed to generate JWKS:', error);
    return { keys: [] };
  }
}
