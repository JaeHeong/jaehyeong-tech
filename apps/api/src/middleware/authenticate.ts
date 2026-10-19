import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { verifyToken } from '../modules/auth/services/jwtService';
import { AppError } from './errorHandler';

async function identifyUser(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError('인증이 필요합니다.', 401);
  const payload = verifyToken(req.tenant!, header.slice(7));
  const user = await prisma.user.findFirst({
    where: { id: payload.userId, tenantId: req.tenant!.id, status: 'ACTIVE' },
    select: { id: true, tenantId: true, email: true, role: true },
  });
  if (!user) throw new AppError('유효한 사용자가 아닙니다.', 401);
  req.user = user;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    await identifyUser(req);
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    try { await identifyUser(req); } catch { /* Public reads remain available. */ }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  next(req.user ? undefined : new AppError('인증이 필요합니다.', 401));
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  next(req.user?.role === 'ADMIN' ? undefined : new AppError('관리자 권한이 필요합니다.', 403));
}
