import { Request } from 'express';

export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '0.0.0.0';
}

export function getSubdomain(req: Request): string | undefined {
  const hostname = req.hostname;
  const parts = hostname.split('.');

  if (parts.length >= 3) {
    return parts[0];
  }

  return undefined;
}

export function getTenantIdentifier(req: Request): string | undefined {
  if (req.headers['x-tenant-id']) {
    return req.headers['x-tenant-id'] as string;
  }

  if (req.headers['x-tenant-name']) {
    return req.headers['x-tenant-name'] as string;
  }

  return getSubdomain(req);
}
