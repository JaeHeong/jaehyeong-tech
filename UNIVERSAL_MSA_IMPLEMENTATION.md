# 범용 MSA 구현 계획서 (코드 기반)

## 목차
1. [현재 코드 분석](#현재-코드-분석)
2. [범용화 설계](#범용화-설계)
3. [데이터베이스 스키마 설계](#데이터베이스-스키마-설계)
4. [서비스별 구현 상세](#서비스별-구현-상세)
5. [실제 코드 예시](#실제-코드-예시)
6. [마이그레이션 전략](#마이그레이션-전략)
7. [테스트 전략](#테스트-전략)

---

## 현재 코드 분석

### 1. Auth Service 현재 상태

**문제점**:
```typescript
// apps/api/src/controllers/auth.ts:26-32
function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET  // ❌ 단일 Secret
  if (!secret) {
    throw new AppError('서버 설정 오류', 500)
  }
  return jwt.sign({ userId }, secret, { expiresIn: '7d' })  // ❌ 고정 만료시간
}
```

```typescript
// apps/api/src/middleware/auth.ts:30-35
const secret = process.env.JWT_SECRET  // ❌ 단일 Secret
if (!secret) {
  throw new AppError('서버 설정 오류', 500)
}
const decoded = jwt.verify(token, secret) as { userId: string }
```

```prisma
// apps/api/prisma/schema.prisma:10-35
model User {
  id        String     @id @default(cuid())
  email     String     @unique  // ❌ 전역 unique (tenant 격리 불가)
  // ... no tenantId field
}
```

**범용화 필요사항**:
- ✅ Tenant 모델 추가
- ✅ User.tenantId 추가
- ✅ User unique constraint 변경: `@@unique([tenantId, email])`
- ✅ Tenant별 JWT Secret 관리
- ✅ Tenant별 설정 (JWT 만료시간, 비밀번호 정책 등)

---

### 2. Comment Service 현재 상태

**문제점**:
```prisma
// apps/api/prisma/schema.prisma:213-240
model Comment {
  id            String    @id @default(cuid())
  content       String
  post          Post      @relation(fields: [postId], references: [id])
  postId        String    // ❌ Post에만 종속
  // ... no resourceType, resourceId fields
}
```

```typescript
// apps/api/src/controllers/comments.ts:174-179
export async function createComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params  // ❌ Post만 지원
    if (!postId) {
      throw new AppError('게시글 ID가 필요합니다.', 400)
    }
```

**범용화 필요사항**:
- ✅ Comment.tenantId 추가
- ✅ `postId` 제거 → `resourceType` + `resourceId` 추가
- ✅ 리소스 독립적인 API 설계

---

### 3. Storage Service 현재 상태

**문제점**:
```prisma
// apps/api/prisma/schema.prisma:70-85
model Image {
  id         String   @id @default(cuid())
  url        String
  objectName String
  filename   String
  size       Int
  mimetype   String
  folder     String   @default("posts")
  post       Post?    @relation(fields: [postId], references: [id])
  postId     String?  // ❌ Post에만 연결 가능
}
```

**범용화 필요사항**:
- ✅ Image.tenantId 추가
- ✅ `postId` 제거 → `resourceType` + `resourceId` 추가
- ✅ 다양한 리소스 타입 지원

---

## 범용화 설계

### 아키텍처 원칙

1. **멀티 테넌시**: 모든 데이터는 `tenantId`로 격리
2. **리소스 독립성**: `resourceType` + `resourceId`로 모든 엔티티 참조
3. **설정 기반**: 하드코딩 없이 Tenant별 설정으로 동작 제어
4. **보안 우선**: Tenant 간 데이터 누출 방지

---

## 데이터베이스 스키마 설계

### Prisma Schema (범용화)

```prisma
// apps/auth-service/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ========================================
// Tenant Model (핵심)
// ========================================
model Tenant {
  id   String @id @default(cuid())
  name String @unique  // 고유 식별자 (jaehyeong-tech, my-shop)

  // 도메인 설정
  domain String  // jaehyeong.tech, myshop.com

  // JWT 설정
  jwtSecret String  // Tenant별 독립적인 JWT Secret
  jwtExpiry String  @default("7d")  // 7d, 30d, 1y

  // OAuth 설정
  googleClientId     String?
  googleClientSecret String?
  githubClientId     String?
  githubClientSecret String?

  // 기능 토글
  allowRegistration Boolean @default(true)
  allowGoogleOauth  Boolean @default(false)
  allowGithubOauth  Boolean @default(false)

  // 비밀번호 정책
  passwordMinLength        Int     @default(8)
  passwordRequireUppercase Boolean @default(true)
  passwordRequireNumber    Boolean @default(true)
  passwordRequireSpecial   Boolean @default(false)

  // 메타
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  users User[]

  @@map("tenants")
}

// ========================================
// User Model (Tenant 격리)
// ========================================
model User {
  id       String  @id @default(cuid())
  tenant   Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId String

  email     String
  password  String?  // OAuth 사용자는 비밀번호 없음
  googleId  String?
  githubId  String?

  name   String
  avatar String?
  bio    String?
  title  String?

  // Social links
  github   String?
  twitter  String?
  linkedin String?
  website  String?

  role   Role       @default(USER)
  status UserStatus @default(ACTIVE)

  // Metadata
  lastLoginAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Unique constraints (Tenant 격리)
  @@unique([tenantId, email])
  @@unique([tenantId, googleId])
  @@unique([tenantId, githubId])
  @@index([tenantId])
  @@index([tenantId, email])
  @@map("users")
}

enum Role {
  USER
  ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}
```

```prisma
// apps/comment-service/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ========================================
// Tenant Model (참조용)
// ========================================
model Tenant {
  id       String    @id
  name     String    @unique
  comments Comment[]

  @@map("tenants")
}

// ========================================
// Comment Model (범용 리소스)
// ========================================
model Comment {
  id       String @id @default(cuid())
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId String

  // 범용 리소스 식별
  resourceType String  // 'post', 'product', 'video', 'ticket', 등
  resourceId   String  // 외부 리소스의 ID

  // 댓글 내용
  content String

  // 작성자 (Tenant의 User ID 또는 null)
  authorId String?  // Tenant User ID (외부 참조, FK 없음)

  // 익명 사용자 지원
  guestName     String?
  guestPassword String?  // bcrypt 해시

  // 계층 구조 (대댓글)
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  parentId String?
  replies  Comment[] @relation("CommentReplies")

  // 기능
  isPrivate Boolean @default(false)
  isDeleted Boolean @default(false)

  // 메타데이터
  ipHash    String  // 스팸 방지
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
  @@index([tenantId, resourceType, resourceId])
  @@index([parentId])
  @@map("comments")
}
```

```prisma
// apps/storage-service/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ========================================
// Tenant Model (참조용)
// ========================================
model Tenant {
  id    String @id
  name  String @unique
  files File[]

  @@map("tenants")
}

// ========================================
// File Model (범용 저장소)
// ========================================
model File {
  id       String @id @default(cuid())
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId String

  // 파일 정보
  filename         String  // 저장된 파일명
  originalFilename String  // 원본 파일명
  mimetype         String
  size             Int     // bytes

  // 저장소 정보
  storageProvider String  // 'oci', 's3', 'gcs', 'local'
  storagePath     String  // 전체 경로
  objectName      String  // 객체 이름 (OCI, S3 등)
  folder          String  // 폴더 (posts, avatars, documents)

  // 범용 리소스 연결 (선택적)
  resourceType String?  // 'post', 'product', 'user-avatar', 등
  resourceId   String?  // 외부 리소스 ID

  // 메타데이터
  uploadedBy String?  // Tenant User ID
  width      Int?     // 이미지인 경우
  height     Int?     // 이미지인 경우

  createdAt DateTime @default(now())

  @@index([tenantId])
  @@index([tenantId, resourceType, resourceId])
  @@index([tenantId, folder])
  @@map("files")
}
```

---

## 서비스별 구현 상세

### 1. Auth Service

#### 프로젝트 구조

```
apps/auth-service/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── controllers/
│   │   ├── auth.ts
│   │   ├── tenant.ts
│   │   └── user.ts
│   ├── middleware/
│   │   ├── tenantResolver.ts
│   │   ├── authenticate.ts
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── tenant.ts
│   │   └── user.ts
│   ├── services/
│   │   ├── prisma.ts
│   │   ├── jwtService.ts
│   │   └── passwordService.ts
│   ├── validation/
│   │   └── schemas.ts
│   ├── app.ts
│   └── server.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

#### 실제 구현 코드

**Tenant Resolver Middleware**

```typescript
// apps/auth-service/src/middleware/tenantResolver.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.js';
import { AppError } from './errorHandler.js';

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  jwtSecret: string;
  jwtExpiry: string;
  googleClientId: string | null;
  googleClientSecret: string | null;
  allowRegistration: boolean;
  allowGoogleOauth: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

/**
 * Tenant 식별 미들웨어
 *
 * 우선순위:
 * 1. X-Tenant-ID 헤더
 * 2. X-Tenant-Name 헤더
 * 3. Subdomain (jaehyeong-tech.auth-service.com → jaehyeong-tech)
 */
export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    let tenantIdentifier: string | undefined;

    // 1. X-Tenant-ID 헤더 확인
    if (req.headers['x-tenant-id']) {
      tenantIdentifier = req.headers['x-tenant-id'] as string;
    }
    // 2. X-Tenant-Name 헤더 확인
    else if (req.headers['x-tenant-name']) {
      tenantIdentifier = req.headers['x-tenant-name'] as string;
    }
    // 3. Subdomain 확인
    else {
      const hostname = req.hostname;
      const parts = hostname.split('.');

      // jaehyeong-tech.auth-service.com → jaehyeong-tech
      if (parts.length >= 3) {
        tenantIdentifier = parts[0];
      }
    }

    if (!tenantIdentifier) {
      throw new AppError(
        'Tenant을 식별할 수 없습니다. X-Tenant-Name 헤더를 제공하거나 서브도메인을 사용하세요.',
        400
      );
    }

    // Tenant 조회
    const tenant = await prisma.tenant.findUnique({
      where: { name: tenantIdentifier },
    });

    if (!tenant) {
      throw new AppError(`Tenant를 찾을 수 없습니다: ${tenantIdentifier}`, 404);
    }

    // Request에 첨부
    req.tenant = tenant as Tenant;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 선택적 Tenant 식별 (Tenant 없어도 통과)
 */
export async function optionalTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await resolveTenant(req, res, () => {});
  } catch {
    // Tenant 없어도 계속 진행
  }
  next();
}
```

**JWT Service (Tenant별 Secret 관리)**

```typescript
// apps/auth-service/src/services/jwtService.ts
import jwt from 'jsonwebtoken';
import { Tenant } from '../middleware/tenantResolver.js';
import { AppError } from '../middleware/errorHandler.js';

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
export function refreshToken(
  tenant: Tenant,
  oldToken: string
): string {
  const decoded = verifyToken(tenant, oldToken);

  return generateToken(
    tenant,
    decoded.userId,
    decoded.role,
    decoded.email
  );
}
```

**Password Service (Tenant별 정책 적용)**

```typescript
// apps/auth-service/src/services/passwordService.ts
import bcrypt from 'bcryptjs';
import { Tenant } from '../middleware/tenantResolver.js';
import { AppError } from '../middleware/errorHandler.js';

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
```

**Auth Controller (범용화)**

```typescript
// apps/auth-service/src/controllers/auth.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateToken } from '../services/jwtService.js';
import {
  validatePassword,
  hashPassword,
  verifyPassword,
} from '../services/passwordService.js';

/**
 * 회원가입
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
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
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
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
export async function googleLogin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const { credential } = req.body;

    // 1. Google OAuth 허용 확인
    if (!tenant.allowGoogleOauth) {
      throw new AppError('Google 로그인이 비활성화되어 있습니다.', 403);
    }

    // 2. Google ID Token 검증 (기존 로직 활용)
    // ... (credential 검증 코드)

    const payload = {
      sub: 'google-id',
      email: 'user@example.com',
      name: 'User Name',
      picture: 'https://avatar.com/avatar.jpg',
    };

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
            email: payload.email,
          },
        },
      });

      if (user) {
        // 기존 사용자에 Google ID 연결
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub },
        });
      } else {
        // 새 사용자 생성
        user = await prisma.user.create({
          data: {
            tenantId: tenant.id,
            email: payload.email,
            googleId: payload.sub,
            name: payload.name,
            avatar: payload.picture,
            role: 'USER',
          },
        });
      }
    }

    // 4. JWT 발급
    const token = generateToken(tenant, user.id, user.role, user.email);

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
 * 내 정보 조회
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const userId = (req as any).user.id;

    // Tenant 격리 확인
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        tenantId: tenant.id,  // 필수!
      },
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
```

**Tenant Controller (관리자용)**

```typescript
// apps/auth-service/src/controllers/tenant.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../services/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Tenant 생성 (슈퍼 관리자 전용)
 */
export async function createTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // TODO: 슈퍼 관리자 권한 확인

    const {
      name,
      domain,
      jwtExpiry = '7d',
      allowRegistration = true,
      allowGoogleOauth = false,
      googleClientId,
      googleClientSecret,
      passwordMinLength = 8,
      passwordRequireUppercase = true,
      passwordRequireNumber = true,
      passwordRequireSpecial = false,
    } = req.body;

    // 1. 이름 중복 확인
    const existing = await prisma.tenant.findUnique({
      where: { name },
    });

    if (existing) {
      throw new AppError('이미 존재하는 Tenant 이름입니다.', 400);
    }

    // 2. JWT Secret 자동 생성
    const jwtSecret = crypto.randomBytes(64).toString('hex');

    // 3. Tenant 생성
    const tenant = await prisma.tenant.create({
      data: {
        name,
        domain,
        jwtSecret,
        jwtExpiry,
        allowRegistration,
        allowGoogleOauth,
        googleClientId,
        googleClientSecret,
        passwordMinLength,
        passwordRequireUppercase,
        passwordRequireNumber,
        passwordRequireSpecial,
      },
    });

    res.status(201).json({
      data: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        jwtExpiry: tenant.jwtExpiry,
        allowRegistration: tenant.allowRegistration,
        allowGoogleOauth: tenant.allowGoogleOauth,
        passwordPolicy: {
          minLength: tenant.passwordMinLength,
          requireUppercase: tenant.passwordRequireUppercase,
          requireNumber: tenant.passwordRequireNumber,
          requireSpecial: tenant.passwordRequireSpecial,
        },
        createdAt: tenant.createdAt,
      },
      message: `Tenant '${name}' 생성 완료. JWT Secret은 안전하게 저장되었습니다.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Tenant 설정 업데이트
 */
export async function updateTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { tenantId } = req.params;
    const updates = req.body;

    // JWT Secret은 수정 불가
    delete updates.jwtSecret;

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updates,
    });

    res.json({ data: tenant });
  } catch (error) {
    next(error);
  }
}

/**
 * Tenant 목록 조회
 */
export async function listTenants(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        allowRegistration: true,
        allowGoogleOauth: true,
        createdAt: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: tenants });
  } catch (error) {
    next(error);
  }
}
```

**Authenticate Middleware (범용화)**

```typescript
// apps/auth-service/src/middleware/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.js';
import { AppError } from './errorHandler.js';
import { verifyToken } from '../services/jwtService.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * JWT 인증 미들웨어 (Tenant 격리)
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;

    if (!tenant) {
      throw new AppError('Tenant 정보가 필요합니다.', 400);
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('인증이 필요합니다.', 401);
    }

    // JWT 검증 (Tenant별 Secret)
    const decoded = verifyToken(tenant, token);

    // 사용자 조회 (Tenant 격리)
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
        tenantId: tenant.id,  // 필수!
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 401);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('정지된 계정입니다.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 선택적 인증
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await authenticate(req, res, () => {});
  } catch {
    // 인증 실패해도 계속 진행
  }
  next();
}

/**
 * 관리자 권한 확인
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'ADMIN') {
    return next(new AppError('관리자 권한이 필요합니다.', 403));
  }
  next();
}
```

**Routes**

```typescript
// apps/auth-service/src/routes/auth.ts
import { Router } from 'express';
import * as authController from '../controllers/auth.js';
import { resolveTenant } from '../middleware/tenantResolver.js';
import { authenticate } from '../middleware/authenticate.js';

export const authRouter = Router();

// 모든 요청에 Tenant 식별 필수
authRouter.use(resolveTenant);

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.post('/google', authController.googleLogin);
authRouter.get('/me', authenticate, authController.getMe);
```

```typescript
// apps/auth-service/src/routes/tenant.ts
import { Router } from 'express';
import * as tenantController from '../controllers/tenant.js';

export const tenantRouter = Router();

// TODO: 슈퍼 관리자 인증 미들웨어 추가
tenantRouter.post('/', tenantController.createTenant);
tenantRouter.get('/', tenantController.listTenants);
tenantRouter.put('/:tenantId', tenantController.updateTenant);
```

**App.ts**

```typescript
// apps/auth-service/src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { tenantRouter } from './routes/tenant.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Body parsing
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantRouter);

// Error handler
app.use(errorHandler);

export default app;
```

---

### 2. Comment Service

#### 프로젝트 구조

```
apps/comment-service/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── controllers/
│   │   └── comment.ts
│   ├── middleware/
│   │   ├── tenantResolver.ts
│   │   ├── authenticate.ts
│   │   └── errorHandler.ts
│   ├── routes/
│   │   └── comment.ts
│   ├── services/
│   │   ├── prisma.ts
│   │   └── authService.ts  // Auth Service 호출
│   ├── app.ts
│   └── server.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

#### 실제 구현 코드

**Comment Controller (범용화)**

```typescript
// apps/comment-service/src/controllers/comment.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../services/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

// IP 해싱
function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt';
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
}

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip || 'unknown';
}

/**
 * 댓글 작성 (범용 리소스)
 */
export async function createComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const user = (req as any).user;  // 선택적 인증

    const {
      resourceType,
      resourceId,
      content,
      guestName,
      guestPassword,
      parentId,
      isPrivate = false,
    } = req.body;

    // 1. 필수 필드 검증
    if (!resourceType || !resourceId) {
      throw new AppError('resourceType과 resourceId가 필요합니다.', 400);
    }

    if (!content || content.trim().length === 0) {
      throw new AppError('댓글 내용을 입력해주세요.', 400);
    }

    if (content.length > 2000) {
      throw new AppError('댓글은 2000자를 초과할 수 없습니다.', 400);
    }

    // 2. 비공개 댓글은 로그인 필요
    if (isPrivate && !user) {
      throw new AppError('비공개 댓글은 로그인 후 작성할 수 있습니다.', 401);
    }

    // 3. 부모 댓글 확인 (대댓글인 경우)
    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId, tenantId: tenant.id },
        select: {
          id: true,
          resourceType: true,
          resourceId: true,
          parentId: true,
          isDeleted: true,
        },
      });

      if (!parent) {
        throw new AppError('원본 댓글을 찾을 수 없습니다.', 404);
      }

      if (parent.resourceType !== resourceType || parent.resourceId !== resourceId) {
        throw new AppError('다른 리소스의 댓글에 답글을 작성할 수 없습니다.', 400);
      }

      if (parent.isDeleted) {
        throw new AppError('삭제된 댓글에 답글을 작성할 수 없습니다.', 400);
      }

      if (parent.parentId) {
        throw new AppError('대댓글에는 답글을 작성할 수 없습니다.', 400);
      }
    }

    // 4. 댓글 데이터 준비
    const commentData: any = {
      tenantId: tenant.id,
      resourceType,
      resourceId,
      content: content.trim(),
      isPrivate,
      ipHash: hashIP(getClientIP(req)),
    };

    if (parentId) {
      commentData.parentId = parentId;
    }

    // 5. 작성자 정보
    if (user) {
      // 로그인 사용자
      commentData.authorId = user.id;
    } else {
      // 익명 사용자
      if (!guestName || guestName.trim().length === 0) {
        throw new AppError('이름을 입력해주세요.', 400);
      }
      if (!guestPassword || guestPassword.length < 4) {
        throw new AppError('비밀번호는 4자 이상이어야 합니다.', 400);
      }

      commentData.guestName = guestName.trim();
      commentData.guestPassword = await bcrypt.hash(guestPassword, 10);
    }

    // 6. 댓글 생성
    const comment = await prisma.comment.create({
      data: commentData,
    });

    res.status(201).json({
      data: {
        id: comment.id,
        resourceType: comment.resourceType,
        resourceId: comment.resourceId,
        content: comment.content,
        authorId: comment.authorId,
        guestName: comment.guestName,
        parentId: comment.parentId,
        isPrivate: comment.isPrivate,
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 조회 (리소스별)
 */
export async function getComments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const user = (req as any).user;  // 선택적 인증
    const isAdmin = user?.role === 'ADMIN';

    const { resourceType, resourceId } = req.query;

    if (!resourceType || !resourceId) {
      throw new AppError('resourceType과 resourceId가 필요합니다.', 400);
    }

    // Where 조건 구성
    const whereClause: any = {
      tenantId: tenant.id,
      resourceType: resourceType as string,
      resourceId: resourceId as string,
      parentId: null,  // 최상위 댓글만
      isDeleted: false,
    };

    // 비공개 댓글 필터링
    if (!isAdmin) {
      if (user) {
        whereClause.OR = [
          { isPrivate: false },
          { authorId: user.id },
        ];
      } else {
        whereClause.isPrivate = false;
      }
    }

    // 댓글 조회
    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: {
        replies: {
          where: {
            isDeleted: false,
            ...(isAdmin ? {} : user ? {
              OR: [{ isPrivate: false }, { authorId: user.id }],
            } : { isPrivate: false }),
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 총 댓글 수
    const totalCount = await prisma.comment.count({
      where: {
        tenantId: tenant.id,
        resourceType: resourceType as string,
        resourceId: resourceId as string,
        isDeleted: false,
        ...(isAdmin ? {} : { isPrivate: false }),
      },
    });

    res.json({
      data: {
        comments,
        totalCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 수정
 */
export async function updateComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const user = (req as any).user;
    const { id } = req.params;
    const { content, guestPassword, isPrivate } = req.body;

    // 댓글 조회 (Tenant 격리)
    const comment = await prisma.comment.findUnique({
      where: { id, tenantId: tenant.id },
    });

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404);
    }

    if (comment.isDeleted) {
      throw new AppError('삭제된 댓글은 수정할 수 없습니다.', 400);
    }

    // 권한 확인
    const isAdmin = user?.role === 'ADMIN';
    const isOwner = comment.authorId === user?.id;

    if (!isAdmin && !isOwner) {
      // 익명 댓글: 비밀번호 확인
      if (comment.guestPassword) {
        if (!guestPassword) {
          throw new AppError('비밀번호를 입력해주세요.', 400);
        }
        const isValid = await bcrypt.compare(guestPassword, comment.guestPassword);
        if (!isValid) {
          throw new AppError('비밀번호가 일치하지 않습니다.', 403);
        }
      } else {
        throw new AppError('수정 권한이 없습니다.', 403);
      }
    }

    // 내용 검증
    if (!content || content.trim().length === 0) {
      throw new AppError('댓글 내용을 입력해주세요.', 400);
    }

    if (content.length > 2000) {
      throw new AppError('댓글은 2000자를 초과할 수 없습니다.', 400);
    }

    // 수정
    const updateData: any = {
      content: content.trim(),
    };

    if (isPrivate !== undefined && (isAdmin || isOwner)) {
      updateData.isPrivate = isPrivate;
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: updateData,
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 삭제
 */
export async function deleteComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const user = (req as any).user;
    const { id } = req.params;
    const { guestPassword } = req.body || {};

    // 댓글 조회
    const comment = await prisma.comment.findUnique({
      where: { id, tenantId: tenant.id },
      include: {
        _count: { select: { replies: true } },
      },
    });

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404);
    }

    if (comment.isDeleted) {
      throw new AppError('이미 삭제된 댓글입니다.', 400);
    }

    // 권한 확인
    const isAdmin = user?.role === 'ADMIN';
    const isOwner = comment.authorId === user?.id;

    if (!isAdmin && !isOwner) {
      // 익명 댓글: 비밀번호 확인
      if (comment.guestPassword) {
        if (!guestPassword) {
          throw new AppError('비밀번호를 입력해주세요.', 400);
        }
        const isValid = await bcrypt.compare(guestPassword, comment.guestPassword);
        if (!isValid) {
          throw new AppError('비밀번호가 일치하지 않습니다.', 403);
        }
      } else {
        throw new AppError('삭제 권한이 없습니다.', 403);
      }
    }

    // 답글이 있으면 Soft Delete, 없으면 Hard Delete
    if (comment._count.replies > 0) {
      await prisma.comment.update({
        where: { id },
        data: {
          isDeleted: true,
          content: '',
          guestName: null,
          guestPassword: null,
        },
      });
    } else {
      await prisma.comment.delete({ where: { id } });
    }

    res.json({
      data: {
        success: true,
        message: '댓글이 삭제되었습니다.',
      },
    });
  } catch (error) {
    next(error);
  }
}
```

**Auth Service 호출**

```typescript
// apps/comment-service/src/services/authService.ts
import fetch from 'node-fetch';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

/**
 * Auth Service에서 사용자 정보 조회
 */
export async function getUserInfo(
  tenantName: string,
  userId: string
): Promise<{ id: string; name: string; avatar: string | null } | null> {
  try {
    const response = await fetch(
      `${AUTH_SERVICE_URL}/api/users/${userId}`,
      {
        headers: {
          'X-Tenant-Name': tenantName,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Failed to fetch user info:', error);
    return null;
  }
}

/**
 * 다중 사용자 정보 조회
 */
export async function getUsersInfo(
  tenantName: string,
  userIds: string[]
): Promise<Map<string, { id: string; name: string; avatar: string | null }>> {
  try {
    const response = await fetch(
      `${AUTH_SERVICE_URL}/api/users/batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Name': tenantName,
        },
        body: JSON.stringify({ userIds }),
      }
    );

    if (!response.ok) {
      return new Map();
    }

    const data = await response.json();
    const userMap = new Map();

    for (const user of data.data) {
      userMap.set(user.id, user);
    }

    return userMap;
  } catch (error) {
    console.error('Failed to fetch users info:', error);
    return new Map();
  }
}
```

---

### 3. Storage Service

#### 실제 구현 코드

```typescript
// apps/storage-service/src/controllers/file.ts
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { prisma } from '../services/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { uploadToOCI, deleteFromOCI } from '../services/oci.js';
import { optimizeImage } from '../services/imageOptimizer.js';

// Multer 설정
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,  // 20MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  },
});

/**
 * 파일 업로드 (범용)
 */
export async function uploadFile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const user = (req as any).user;

    if (!req.file) {
      throw new AppError('파일이 업로드되지 않았습니다.', 400);
    }

    const {
      resourceType,
      resourceId,
      folder = 'general',
      optimizeType = 'post',
    } = req.query;

    // 파일명 생성
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(req.file.originalname);
    const filename = `${Date.now()}-${uniqueSuffix}${ext}`;

    // 이미지 최적화
    const buffer = req.file.buffer;
    const optimized = await optimizeImage(
      buffer,
      req.file.mimetype,
      { type: optimizeType as any }
    );

    // OCI 업로드
    const objectName = `${tenant.name}/${folder}/${filename}`;
    const url = await uploadToOCI(
      filename,
      optimized.buffer,
      optimized.mimetype,
      `${tenant.name}/${folder}`
    );

    // 메타데이터 저장
    const file = await prisma.file.create({
      data: {
        tenantId: tenant.id,
        filename,
        originalFilename: req.file.originalname,
        mimetype: optimized.mimetype,
        size: optimized.size,
        storageProvider: 'oci',
        storagePath: url,
        objectName,
        folder: folder as string,
        resourceType: resourceType as string | undefined,
        resourceId: resourceId as string | undefined,
        uploadedBy: user?.id,
        width: optimized.width,
        height: optimized.height,
      },
    });

    res.status(201).json({
      data: {
        id: file.id,
        url: file.storagePath,
        filename: file.filename,
        originalFilename: file.originalFilename,
        size: file.size,
        mimetype: file.mimetype,
        width: file.width,
        height: file.height,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 파일 삭제
 */
export async function deleteFile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const user = (req as any).user;
    const { id } = req.params;

    // 파일 조회 (Tenant 격리)
    const file = await prisma.file.findUnique({
      where: { id, tenantId: tenant.id },
    });

    if (!file) {
      throw new AppError('파일을 찾을 수 없습니다.', 404);
    }

    // 권한 확인 (업로드한 사용자 또는 관리자)
    const isAdmin = user?.role === 'ADMIN';
    const isOwner = file.uploadedBy === user?.id;

    if (!isAdmin && !isOwner) {
      throw new AppError('삭제 권한이 없습니다.', 403);
    }

    // OCI에서 삭제
    await deleteFromOCI(file.objectName);

    // DB에서 삭제
    await prisma.file.delete({ where: { id } });

    res.json({
      data: {
        success: true,
        message: '파일이 삭제되었습니다.',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 리소스의 파일 목록 조회
 */
export async function getFiles(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const { resourceType, resourceId } = req.query;

    if (!resourceType || !resourceId) {
      throw new AppError('resourceType과 resourceId가 필요합니다.', 400);
    }

    const files = await prisma.file.findMany({
      where: {
        tenantId: tenant.id,
        resourceType: resourceType as string,
        resourceId: resourceId as string,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: files });
  } catch (error) {
    next(error);
  }
}

/**
 * 고아 파일 정리 (리소스와 연결되지 않은 파일)
 */
export async function cleanupOrphanFiles(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenant = req.tenant!;
    const user = (req as any).user;

    if (user?.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const { olderThanHours = 24 } = req.query;

    // 24시간 이상 된 고아 파일 조회
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - Number(olderThanHours));

    const orphans = await prisma.file.findMany({
      where: {
        tenantId: tenant.id,
        resourceType: null,
        resourceId: null,
        createdAt: {
          lt: threshold,
        },
      },
    });

    // 삭제
    let deletedCount = 0;
    for (const file of orphans) {
      try {
        await deleteFromOCI(file.objectName);
        await prisma.file.delete({ where: { id: file.id } });
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete orphan file: ${file.id}`, error);
      }
    }

    res.json({
      data: {
        deletedCount,
        message: `${deletedCount}개의 고아 파일이 삭제되었습니다.`,
      },
    });
  } catch (error) {
    next(error);
  }
}
```

---

## 마이그레이션 전략

### Phase 1: Tenant 초기화

```bash
# Tenant 생성 스크립트
# scripts/init-tenant.sh

#!/bin/bash

TENANT_NAME="jaehyeong-tech"
DOMAIN="jaehyeong.tech"

curl -X POST http://auth-service:3001/api/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "'$TENANT_NAME'",
    "domain": "'$DOMAIN'",
    "allowRegistration": true,
    "allowGoogleOauth": true,
    "googleClientId": "'$GOOGLE_CLIENT_ID'",
    "googleClientSecret": "'$GOOGLE_CLIENT_SECRET'",
    "passwordMinLength": 8,
    "passwordRequireUppercase": true,
    "passwordRequireNumber": true,
    "passwordRequireSpecial": false
  }'
```

### Phase 2: 기존 데이터 마이그레이션

```typescript
// scripts/migrate-existing-data.ts
import { PrismaClient as OldPrismaClient } from '@prisma/old-client';
import { PrismaClient as NewPrismaClient } from '@prisma/new-client';

const oldPrisma = new OldPrismaClient({
  datasourceUrl: process.env.OLD_DATABASE_URL,
});

const newPrisma = new NewPrismaClient({
  datasourceUrl: process.env.NEW_DATABASE_URL,
});

const TENANT_ID = process.env.TENANT_ID!;

async function migrateUsers() {
  console.log('Migrating users...');

  const oldUsers = await oldPrisma.user.findMany();

  for (const user of oldUsers) {
    await newPrisma.user.create({
      data: {
        id: user.id,
        tenantId: TENANT_ID,
        email: user.email,
        password: user.password,
        googleId: user.googleId,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }

  console.log(`Migrated ${oldUsers.length} users`);
}

async function migrateComments() {
  console.log('Migrating comments...');

  const oldComments = await oldPrisma.comment.findMany();

  for (const comment of oldComments) {
    await newPrisma.comment.create({
      data: {
        id: comment.id,
        tenantId: TENANT_ID,
        resourceType: 'post',  // 기존 Comment는 모두 post
        resourceId: comment.postId,
        content: comment.content,
        authorId: comment.authorId,
        guestName: comment.guestName,
        guestPassword: comment.guestPassword,
        parentId: comment.parentId,
        isPrivate: comment.isPrivate,
        isDeleted: comment.isDeleted,
        ipHash: comment.ipHash || '',
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      },
    });
  }

  console.log(`Migrated ${oldComments.length} comments`);
}

async function migrateImages() {
  console.log('Migrating images...');

  const oldImages = await oldPrisma.image.findMany();

  for (const image of oldImages) {
    await newPrisma.file.create({
      data: {
        id: image.id,
        tenantId: TENANT_ID,
        filename: image.filename,
        originalFilename: image.filename,
        mimetype: image.mimetype,
        size: image.size,
        storageProvider: 'oci',
        storagePath: image.url,
        objectName: image.objectName,
        folder: image.folder,
        resourceType: image.postId ? 'post' : null,
        resourceId: image.postId,
        createdAt: image.createdAt,
      },
    });
  }

  console.log(`Migrated ${oldImages.length} images`);
}

async function main() {
  try {
    await migrateUsers();
    await migrateComments();
    await migrateImages();

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await oldPrisma.$disconnect();
    await newPrisma.$disconnect();
  }
}

main();
```

---

## 테스트 전략

### 통합 테스트

```typescript
// apps/auth-service/tests/integration/auth.test.ts
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/services/prisma';

describe('Auth Service - Multi-Tenancy', () => {
  let tenant1Id: string;
  let tenant2Id: string;

  beforeAll(async () => {
    // Tenant 1 생성
    const tenant1 = await prisma.tenant.create({
      data: {
        name: 'tenant1',
        domain: 'tenant1.com',
        jwtSecret: 'secret1',
      },
    });
    tenant1Id = tenant1.id;

    // Tenant 2 생성
    const tenant2 = await prisma.tenant.create({
      data: {
        name: 'tenant2',
        domain: 'tenant2.com',
        jwtSecret: 'secret2',
      },
    });
    tenant2Id = tenant2.id;
  });

  describe('User Isolation', () => {
    it('should allow same email in different tenants', async () => {
      const email = 'user@example.com';

      // Tenant 1에 사용자 생성
      const res1 = await request(app)
        .post('/api/auth/register')
        .set('X-Tenant-Name', 'tenant1')
        .send({
          email,
          password: 'Password123',
          name: 'User1',
        });

      expect(res1.status).toBe(201);

      // Tenant 2에 같은 이메일로 사용자 생성 (성공해야 함)
      const res2 = await request(app)
        .post('/api/auth/register')
        .set('X-Tenant-Name', 'tenant2')
        .send({
          email,
          password: 'Password123',
          name: 'User2',
        });

      expect(res2.status).toBe(201);
      expect(res1.body.data.user.id).not.toBe(res2.body.data.user.id);
    });

    it('should not allow cross-tenant token usage', async () => {
      // Tenant 1 사용자 생성 및 토큰 발급
      const res1 = await request(app)
        .post('/api/auth/register')
        .set('X-Tenant-Name', 'tenant1')
        .send({
          email: 'test@tenant1.com',
          password: 'Password123',
          name: 'Test User',
        });

      const token1 = res1.body.data.token;

      // Tenant 2에서 Tenant 1의 토큰 사용 시도 (실패해야 함)
      const res2 = await request(app)
        .get('/api/auth/me')
        .set('X-Tenant-Name', 'tenant2')
        .set('Authorization', `Bearer ${token1}`);

      expect(res2.status).toBe(401);
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.$disconnect();
  });
});
```

---

## 배포

### Dockerfile (Auth Service)

```dockerfile
# apps/auth-service/Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build
RUN pnpm build

# Production image
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

### Kubernetes Deployment

```yaml
# k8s/auth-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: jaehyeong-tech
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: ghcr.io/jaehyeong/auth-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-service-secret
              key: database-url
        - name: PORT
          value: "3001"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: jaehyeong-tech
spec:
  selector:
    app: auth-service
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
```

---

## 요약

이 문서는 실제 코드를 기반으로 한 범용 MSA 구현 계획입니다:

1. **Tenant 모델**: 모든 서비스의 핵심
2. **Tenant 격리**: 모든 쿼리에 `tenantId` 필수
3. **리소스 독립성**: `resourceType` + `resourceId`로 범용 참조
4. **JWT Secret 격리**: Tenant별 독립적인 Secret
5. **설정 기반**: 하드코딩 없이 Tenant별 커스터마이징

이제 이 계획대로 구현하면 jaehyeong-tech뿐만 아니라 다른 프로젝트에서도 재사용 가능한 범용 MSA가 완성됩니다.

---

**문서 버전**: 2.0
**작성일**: 2026-01-15
**기준 코드**: apps/api/src (현재 코드베이스)
