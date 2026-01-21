import * as crypto from 'crypto';

export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}
