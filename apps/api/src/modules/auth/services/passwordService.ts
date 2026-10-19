import bcrypt from 'bcryptjs';
import { Tenant } from '../middleware/tenantResolver';
import { AppError } from '../middleware/errorHandler';

/**
 * 비밀번호 정책 검증 (Tenant별 설정)
 */
export function validatePassword(tenant: Tenant, password: string): void {
  if (password.length < tenant.passwordMinLength) {
    throw new AppError(
      `비밀번호는 최소 ${tenant.passwordMinLength}자 이상이어야 합니다.`,
      400
    );
  }

  if (tenant.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    throw new AppError('비밀번호에 대문자가 포함되어야 합니다.', 400);
  }

  if (tenant.passwordRequireNumber && !/[0-9]/.test(password)) {
    throw new AppError('비밀번호에 숫자가 포함되어야 합니다.', 400);
  }

  if (tenant.passwordRequireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    throw new AppError('비밀번호에 특수문자가 포함되어야 합니다.', 400);
  }
}

/**
 * 비밀번호 해시
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
