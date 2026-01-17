import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { tenantPrisma } from '../services/prisma';
import { AppError } from '../middleware/errorHandler';
import { Tenant } from '../middleware/tenantResolver';
import { generateToken } from '../services/jwtService';
import { validatePassword, hashPassword, verifyPassword } from '../services/passwordService';

// Admin email whitelist - only these emails get ADMIN role
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

/**
 * 회원가입
 */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { email, password, name } = req.body;

    // 1. 회원가입 허용 확인
    if (!tenant.allowRegistration) {
      throw new AppError('이 서비스는 현재 회원가입을 받지 않습니다.', 403);
    }

    // 2. 이메일 중복 확인 (Tenant 격리)
    const existing = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        },
      },
    });

    if (existing) {
      throw new AppError('이미 사용 중인 이메일입니다.', 400);
    }

    // 3. 비밀번호 정책 검증
    validatePassword(tenant, password);

    // 4. 비밀번호 해시
    const hashedPassword = await hashPassword(password);

    // 5. 사용자 생성 (Tenant 격리)
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        password: hashedPassword,
        name,
        role: 'USER',
      },
    });

    // 6. JWT 발급
    const token = generateToken(tenant, user.id, user.role, user.email);

    res.status(201).json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 로그인
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { email, password } = req.body;

    // 1. 사용자 조회 (Tenant 격리)
    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        },
      },
    });

    if (!user || !user.password) {
      throw new AppError('이메일 또는 비밀번호가 일치하지 않습니다.', 401);
    }

    // 2. 비밀번호 검증
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      throw new AppError('이메일 또는 비밀번호가 일치하지 않습니다.', 401);
    }

    // 3. 계정 상태 확인
    if (user.status !== 'ACTIVE') {
      throw new AppError('정지된 계정입니다.', 403);
    }

    // 4. JWT 발급
    const token = generateToken(tenant, user.id, user.role, user.email);

    // 5. 마지막 로그인 시간 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Google OAuth 로그인
 */
export async function googleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { credential } = req.body;

    // 1. Google OAuth 허용 확인
    if (!tenant.allowGoogleOauth) {
      throw new AppError('Google 로그인이 비활성화되어 있습니다.', 403);
    }

    if (!tenant.googleClientId) {
      throw new AppError('Google OAuth가 설정되지 않았습니다.', 500);
    }

    // 2. Google ID Token 검증
    const client = new OAuth2Client(tenant.googleClientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: tenant.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new AppError('유효하지 않은 Google 토큰입니다.', 401);
    }

    // 3. 사용자 조회 또는 생성 (Tenant 격리)
    let user = await prisma.user.findUnique({
      where: {
        tenantId_googleId: {
          tenantId: tenant.id,
          googleId: payload.sub,
        },
      },
    });

    if (!user) {
      // 이메일로 기존 사용자 확인
      user = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: payload.email!,
          },
        },
      });

      if (user) {
        // 기존 사용자에 Google ID 연결
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: payload.sub,
            avatar: payload.picture,
          },
        });
      } else {
        // 새 사용자 생성 - admin 이메일이면 ADMIN role
        const role = ADMIN_EMAILS.includes(payload.email!.toLowerCase()) ? 'ADMIN' : 'USER';
        user = await prisma.user.create({
          data: {
            tenantId: tenant.id,
            email: payload.email!,
            googleId: payload.sub,
            name: payload.name || payload.email!,
            avatar: payload.picture,
            role,
          },
        });
      }
    }

    // 기존 사용자도 admin 이메일이면 role 업데이트
    if (ADMIN_EMAILS.includes(payload.email!.toLowerCase()) && user.role !== 'ADMIN') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
    }

    // 4. 계정 상태 확인
    if (user.status !== 'ACTIVE') {
      throw new AppError('정지된 계정입니다.', 403);
    }

    // 5. JWT 발급
    const token = generateToken(tenant, user.id, user.role, user.email);

    // 6. 마지막 로그인 시간 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 현재 사용자 정보 조회
 */
export async function getCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        title: true,
        github: true,
        twitter: true,
        linkedin: true,
        website: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404);
    }

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

/**
 * 현재 사용자 정보 수정
 */
export async function updateCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant as Tenant;
    const prisma = tenantPrisma.getClient(tenant.id);
    const userId = req.user!.id;

    const { name, avatar, bio } = req.body;

    // Validate name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new AppError('이름은 필수입니다.', 400);
      }
      if (name.length > 50) {
        throw new AppError('이름은 50자 이내로 입력해주세요.', 400);
      }
    }

    // Validate bio
    if (bio !== undefined && bio !== null) {
      if (typeof bio !== 'string') {
        throw new AppError('소개는 문자열이어야 합니다.', 400);
      }
      if (bio.length > 200) {
        throw new AppError('소개는 200자 이내로 입력해주세요.', 400);
      }
    }

    const updateData: { name?: string; avatar?: string | null; bio?: string | null } = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (avatar !== undefined) {
      updateData.avatar = avatar || null;
    }
    if (bio !== undefined) {
      updateData.bio = bio || null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        title: true,
        github: true,
        twitter: true,
        linkedin: true,
        website: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({
      data: {
        ...updatedUser,
        createdAt: updatedUser.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}
