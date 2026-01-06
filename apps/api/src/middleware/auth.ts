import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../services/prisma.js'
import { AppError } from './errorHandler.js'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new AppError('서버 설정 오류', 500)
    }

    const decoded = jwt.verify(token, secret) as { userId: string }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true },
    })

    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 401)
    }

    req.user = user
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('유효하지 않은 토큰입니다.', 401))
    } else {
      next(error)
    }
  }
}

export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return next()
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      return next()
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return next()
    }

    const decoded = jwt.verify(token, secret) as { userId: string }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true },
    })

    if (user) {
      req.user = user
    }

    next()
  } catch {
    next()
  }
}

export function requireAdmin(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'ADMIN') {
    return next(new AppError('관리자 권한이 필요합니다.', 403))
  }
  next()
}
