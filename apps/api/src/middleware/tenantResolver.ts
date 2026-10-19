import type { Request, Response, NextFunction } from 'express';
import type { Tenant as SiteConfig } from '../generated/prisma';
import { prisma } from '../db';
import { AppError } from './errorHandler';

export type Tenant = SiteConfig;
export const siteId = process.env.TENANT_ID || 'tenant-jaehyeong-tech';

// Keep existing IDs and configuration in the database. Public headers never select a site.
export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.tenant) {
      const site = await prisma.tenant.findUnique({ where: { id: siteId } });
      if (!site?.isActive) throw new AppError('블로그 설정을 찾을 수 없습니다.', 503);
      req.tenant = site;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export const optionalTenant = resolveTenant;
