import crypto from 'crypto';
import { Request } from 'express';

/**
 * Hash IP address for unique tracking
 * Uses SHA-256 with a salt from environment variable
 */
export function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-production';
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
}

/**
 * Get client IP address (considering reverse proxy)
 * Checks X-Forwarded-For header first, falls back to req.ip
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}
