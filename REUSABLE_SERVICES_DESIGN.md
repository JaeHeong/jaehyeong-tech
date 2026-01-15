# 재사용 가능한 서비스 설계

## 개요

MSA 아키텍처에서 일부 서비스는 **도메인 독립적**으로 설계하여 다른 프로젝트에서도 재사용할 수 있습니다.

---

## 서비스 분류

### 🎯 Core Domain (프로젝트 특화)

**jaehyeong-tech에만 종속**

| 서비스 | 이유 | 재사용성 |
|--------|------|----------|
| **Blog Service** | 블로그 특화 로직 (추천 포스트, 읽기 시간) | ❌ 낮음 |
| **Page Service** | 블로그 페이지 관리 (공지사항, 소개) | ❌ 낮음 |

---

### 🔧 Supporting Domain (재사용 가능)

**설정 커스터마이징으로 다른 프로젝트 적용 가능**

| 서비스 | 재사용 시나리오 | 재사용성 |
|--------|----------------|----------|
| **Auth Service** | 모든 웹 애플리케이션의 인증/인가 | ✅ 높음 |
| **Comment Service** | 댓글 기능이 필요한 모든 플랫폼 | ✅ 높음 |
| **Storage Service** | 파일 업로드가 필요한 모든 서비스 | ✅ 높음 |

---

### 🌐 Generic Domain (완전 범용)

**그대로 어디든 적용 가능**

| 서비스 | 재사용 시나리오 | 재사용성 |
|--------|----------------|----------|
| **Analytics Service** | 모든 웹 서비스의 통계/분석 | ✅ 매우 높음 |

---

## 재사용 가능 서비스 설계 전략

### 핵심 원칙

1. **멀티 테넌시 (Multi-Tenancy)**: 여러 프로젝트가 하나의 서비스 인스턴스 공유
2. **설정 기반 커스터마이징**: 하드코딩 없이 설정으로 동작 변경
3. **도메인 독립성**: 특정 비즈니스 로직 의존성 제거
4. **API 버전 관리**: 하위 호환성 유지

---

## 1. Auth Service (범용 인증 서비스)

### 현재 설계 (jaehyeong-tech 전용)

```typescript
// 단일 프로젝트 하드코딩
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '7d';

async function register(email, password) {
  const user = await prisma.user.create({
    data: { email, password: await hash(password) }
  });

  return generateToken(user);
}
```

**문제점**:
- 단일 DB 사용
- 고정된 JWT 설정
- 프로젝트별 요구사항 반영 불가

---

### 범용 설계 (멀티 테넌트)

#### 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│              Auth Service (Universal)                    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │          Tenant Configuration                    │   │
│  │  - JWT settings per tenant                       │   │
│  │  - OAuth providers per tenant                    │   │
│  │  - Password policy per tenant                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │          User Management (Tenant Isolated)       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────▼────┐          ┌────▼────┐         ┌────▼────┐
    │ Tenant: │          │ Tenant: │         │ Tenant: │
    │jaehyeong│          │ my-shop │         │ my-blog │
    │  -tech  │          │         │         │         │
    └─────────┘          └─────────┘         └─────────┘
```

#### 데이터베이스 스키마

```sql
-- Tenant 테이블 (프로젝트 정보)
CREATE TABLE "Tenant" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  domain VARCHAR(255) NOT NULL,

  -- JWT 설정
  jwt_secret VARCHAR(512) NOT NULL,
  jwt_expiry VARCHAR(10) DEFAULT '7d',

  -- OAuth 설정
  google_client_id VARCHAR(255),
  google_client_secret VARCHAR(512),
  github_client_id VARCHAR(255),
  github_client_secret VARCHAR(512),

  -- 비밀번호 정책
  password_min_length INT DEFAULT 8,
  password_require_uppercase BOOLEAN DEFAULT true,
  password_require_number BOOLEAN DEFAULT true,
  password_require_special BOOLEAN DEFAULT false,

  -- 기능 토글
  allow_registration BOOLEAN DEFAULT true,
  allow_google_oauth BOOLEAN DEFAULT false,
  allow_github_oauth BOOLEAN DEFAULT false,

  -- 메타
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User 테이블 (테넌트별 격리)
CREATE TABLE "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,

  email VARCHAR(255) NOT NULL,
  password VARCHAR(255),

  google_id VARCHAR(255),
  github_id VARCHAR(255),

  name VARCHAR(255),
  avatar TEXT,
  bio TEXT,

  role VARCHAR(50) DEFAULT 'USER',
  status VARCHAR(50) DEFAULT 'ACTIVE',

  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, google_id),
  UNIQUE(tenant_id, github_id)
);

CREATE INDEX idx_user_tenant ON "User"(tenant_id);
CREATE INDEX idx_user_email ON "User"(tenant_id, email);
```

**핵심**: `tenant_id`로 데이터 격리

---

#### API 설계

**모든 요청에 Tenant 식별 필요**

**방법 1: Header 방식**
```http
POST /api/auth/register
Host: auth-service.example.com
X-Tenant-ID: jaehyeong-tech
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**방법 2: Subdomain 방식** (추천)
```http
POST /api/auth/register
Host: jaehyeong-tech.auth-service.example.com
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

서브도메인에서 자동으로 `tenant_id` 추출

---

#### 미들웨어 구현

```typescript
// middleware/tenantResolver.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  // 1. Subdomain에서 추출
  const hostname = req.hostname; // jaehyeong-tech.auth-service.example.com
  const subdomain = hostname.split('.')[0];

  // 2. 또는 Header에서 추출
  const tenantId = req.headers['x-tenant-id'] as string || subdomain;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant not specified' });
  }

  // 3. Tenant 조회
  const tenant = await prisma.tenant.findUnique({
    where: { name: tenantId },
  });

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  // 4. Request에 첨부
  req.tenant = tenant;
  next();
}
```

---

#### 컨트롤러 구현

```typescript
// controllers/auth.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export async function register(req: Request, res: Response) {
  const { email, password, name } = req.body;
  const tenant = req.tenant!; // 미들웨어에서 주입됨

  // 1. Tenant 설정 확인
  if (!tenant.allowRegistration) {
    return res.status(403).json({ error: 'Registration is disabled' });
  }

  // 2. 비밀번호 정책 검증
  if (password.length < tenant.passwordMinLength) {
    return res.status(400).json({
      error: `Password must be at least ${tenant.passwordMinLength} characters`
    });
  }

  if (tenant.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain uppercase letter' });
  }

  // 3. 사용자 생성 (Tenant 격리)
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email,
      password: hashedPassword,
      name,
    },
  });

  // 4. JWT 발급 (Tenant별 Secret)
  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
    },
    tenant.jwtSecret,
    { expiresIn: tenant.jwtExpiry }
  );

  return res.status(201).json({ token, user });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const tenant = req.tenant!;

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
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 2. 비밀번호 검증
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 3. JWT 발급
  const token = jwt.sign(
    { userId: user.id, tenantId: tenant.id, role: user.role },
    tenant.jwtSecret,
    { expiresIn: tenant.jwtExpiry }
  );

  // 4. 마지막 로그인 시간 업데이트
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return res.status(200).json({ token, user });
}
```

---

#### JWT 검증 미들웨어

```typescript
// middleware/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  const tenant = req.tenant!;

  try {
    // Tenant별 Secret으로 검증
    const decoded = jwt.verify(token, tenant.jwtSecret) as {
      userId: string;
      tenantId: string;
      role: string;
    };

    // Tenant 일치 확인
    if (decoded.tenantId !== tenant.id) {
      return res.status(403).json({ error: 'Invalid token for this tenant' });
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'User not active' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

#### Tenant 관리 API

```typescript
// controllers/tenant.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';

// Tenant 생성 (관리자 전용)
export async function createTenant(req: Request, res: Response) {
  const {
    name,
    domain,
    allowRegistration = true,
    allowGoogleOauth = false,
    passwordMinLength = 8,
  } = req.body;

  // JWT Secret 자동 생성
  const jwtSecret = crypto.randomBytes(64).toString('hex');

  const tenant = await prisma.tenant.create({
    data: {
      name,
      domain,
      jwtSecret,
      allowRegistration,
      allowGoogleOauth,
      passwordMinLength,
    },
  });

  return res.status(201).json({ tenant });
}

// Tenant 설정 업데이트
export async function updateTenant(req: Request, res: Response) {
  const { tenantId } = req.params;
  const updates = req.body;

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: updates,
  });

  return res.status(200).json({ tenant });
}
```

---

#### 사용 예시

**jaehyeong-tech에서 사용**:
```typescript
// 회원가입
const response = await fetch('https://jaehyeong-tech.auth-service.com/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123',
  }),
});
```

**my-shop에서 사용**:
```typescript
// 회원가입 (같은 Auth Service, 다른 Tenant)
const response = await fetch('https://my-shop.auth-service.com/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'customer@example.com',
    password: 'MyShopPass456',
  }),
});
```

**완전 격리**: 데이터베이스 레벨에서 분리됨

---

## 2. Comment Service (범용 댓글 서비스)

### 현재 설계 (jaehyeong-tech 전용)

```typescript
// Post에 종속
Comment {
  postId: string;  // Blog Service의 Post ID
}
```

**문제점**:
- Post에만 댓글 가능
- 다른 엔티티(상품, 동영상 등)에 적용 불가

---

### 범용 설계 (리소스 독립적)

#### 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│            Comment Service (Universal)                   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │    Resource-Agnostic Comment System              │   │
│  │  - Comments on ANY resource                      │   │
│  │  - resourceType + resourceId                     │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────▼────┐          ┌────▼────┐         ┌────▼────┐
    │Resource:│          │Resource:│         │Resource:│
    │  Post   │          │ Product │         │  Video  │
    └─────────┘          └─────────┘         └─────────┘
```

#### 데이터베이스 스키마

```sql
-- Comment 테이블 (리소스 독립적)
CREATE TABLE "Comment" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,

  -- 리소스 식별 (범용)
  resource_type VARCHAR(50) NOT NULL,  -- 'post', 'product', 'video', etc.
  resource_id VARCHAR(255) NOT NULL,    -- 외부 리소스 ID

  -- 댓글 내용
  content TEXT NOT NULL,

  -- 작성자 (익명/회원 모두 지원)
  author_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
  guest_password VARCHAR(255),  -- 익명 댓글 수정/삭제용

  -- 계층 구조
  parent_id UUID REFERENCES "Comment"(id) ON DELETE CASCADE,

  -- 기능 플래그
  is_private BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,

  -- 메타
  ip_hash VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comment_tenant ON "Comment"(tenant_id);
CREATE INDEX idx_comment_resource ON "Comment"(resource_type, resource_id);
CREATE INDEX idx_comment_parent ON "Comment"(parent_id);
CREATE INDEX idx_comment_author ON "Comment"(author_id);
```

**핵심**: `resource_type` + `resource_id`로 모든 리소스에 댓글 지원

---

#### API 설계

```typescript
// 댓글 작성 (범용)
POST /api/comments
{
  "resourceType": "post",           // 또는 "product", "video"
  "resourceId": "post-slug-123",
  "content": "Great article!",
  "authorId": "user-uuid",          // 선택적 (회원 댓글)
  "guestName": "Anonymous",         // 선택적 (익명 댓글)
  "guestPassword": "password123"    // 선택적 (익명 댓글)
}

// 리소스의 댓글 조회
GET /api/comments?resourceType=post&resourceId=post-slug-123

// 대댓글 작성
POST /api/comments
{
  "resourceType": "post",
  "resourceId": "post-slug-123",
  "content": "I agree!",
  "parentId": "parent-comment-uuid"
}
```

---

#### 컨트롤러 구현

```typescript
// controllers/comment.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

export async function createComment(req: Request, res: Response) {
  const {
    resourceType,
    resourceId,
    content,
    authorId,
    guestName,
    guestPassword,
    parentId,
    isPrivate = false,
  } = req.body;

  const tenant = req.tenant!;

  // 검증
  if (!resourceType || !resourceId || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!authorId && (!guestName || !guestPassword)) {
    return res.status(400).json({
      error: 'Either authorId or guest credentials required'
    });
  }

  // 익명 댓글 비밀번호 해싱
  const hashedGuestPassword = guestPassword
    ? await bcrypt.hash(guestPassword, 10)
    : null;

  // IP 해시 (스팸 방지)
  const ipHash = hashIp(req.ip);

  // 댓글 생성
  const comment = await prisma.comment.create({
    data: {
      tenantId: tenant.id,
      resourceType,
      resourceId,
      content,
      authorId,
      guestName,
      guestPassword: hashedGuestPassword,
      parentId,
      isPrivate,
      ipHash,
    },
    include: {
      author: {
        select: { id: true, name: true, avatar: true },
      },
    },
  });

  return res.status(201).json({ comment });
}

export async function getComments(req: Request, res: Response) {
  const { resourceType, resourceId } = req.query;
  const tenant = req.tenant!;

  if (!resourceType || !resourceId) {
    return res.status(400).json({ error: 'resourceType and resourceId required' });
  }

  // 계층 구조 조회
  const comments = await prisma.comment.findMany({
    where: {
      tenantId: tenant.id,
      resourceType: resourceType as string,
      resourceId: resourceId as string,
      parentId: null,  // 최상위 댓글만
      isDeleted: false,
    },
    include: {
      author: {
        select: { id: true, name: true, avatar: true },
      },
      replies: {
        where: { isDeleted: false },
        include: {
          author: {
            select: { id: true, name: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({ comments });
}

export async function updateComment(req: Request, res: Response) {
  const { id } = req.params;
  const { content, guestPassword } = req.body;
  const tenant = req.tenant!;
  const user = req.user; // 인증된 사용자 (선택적)

  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if (!comment || comment.tenantId !== tenant.id) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  // 권한 검증
  if (comment.authorId) {
    // 회원 댓글: 작성자만 수정 가능
    if (!user || user.id !== comment.authorId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
  } else {
    // 익명 댓글: 비밀번호 확인
    const isValid = await bcrypt.compare(guestPassword, comment.guestPassword!);
    if (!isValid) {
      return res.status(403).json({ error: 'Invalid password' });
    }
  }

  // 수정
  const updated = await prisma.comment.update({
    where: { id },
    data: { content, updatedAt: new Date() },
  });

  return res.status(200).json({ comment: updated });
}
```

---

#### 사용 예시

**jaehyeong-tech (블로그 포스트 댓글)**:
```typescript
// 포스트에 댓글 작성
await fetch('https://jaehyeong-tech.comment-service.com/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resourceType: 'post',
    resourceId: 'my-first-post',
    content: 'Great article!',
    authorId: 'user-uuid',
  }),
});
```

**my-shop (상품 리뷰)**:
```typescript
// 상품에 댓글 (리뷰) 작성
await fetch('https://my-shop.comment-service.com/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resourceType: 'product',
    resourceId: 'product-123',
    content: 'Excellent quality!',
    authorId: 'customer-uuid',
  }),
});
```

**my-tube (동영상 댓글)**:
```typescript
// 동영상에 댓글 작성
await fetch('https://my-tube.comment-service.com/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resourceType: 'video',
    resourceId: 'video-abc',
    content: 'Amazing video!',
    guestName: 'Anonymous',
    guestPassword: 'temp123',
  }),
});
```

**완전 범용**: 어떤 리소스에도 댓글 가능

---

## 3. Storage Service (범용 파일 저장소)

### 범용 설계

#### 데이터베이스 스키마

```sql
CREATE TABLE "File" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,

  -- 파일 정보
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mimetype VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,

  -- 저장소 정보
  storage_provider VARCHAR(50) NOT NULL,  -- 'oci', 's3', 'gcs', 'local'
  storage_path TEXT NOT NULL,

  -- 리소스 연결 (선택적)
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),

  -- 메타
  uploaded_by UUID REFERENCES "User"(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 인덱스
  CONSTRAINT idx_file_tenant_resource
    UNIQUE(tenant_id, resource_type, resource_id, filename)
);

CREATE INDEX idx_file_tenant ON "File"(tenant_id);
CREATE INDEX idx_file_resource ON "File"(resource_type, resource_id);
```

#### API 설계

```typescript
// 파일 업로드
POST /api/upload
Content-Type: multipart/form-data

{
  file: <binary>,
  resourceType: "post",     // 선택적
  resourceId: "post-123",   // 선택적
}

// 파일 조회
GET /api/files/:id

// 리소스의 파일 목록
GET /api/files?resourceType=post&resourceId=post-123
```

---

## 4. Analytics Service (범용 분석)

### 범용 설계

#### 데이터베이스 스키마

```sql
CREATE TABLE "Event" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,

  -- 이벤트 정보
  event_type VARCHAR(50) NOT NULL,  -- 'page_view', 'resource_view', 'click', etc.

  -- 리소스 (선택적)
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),

  -- 사용자
  user_id UUID REFERENCES "User"(id),

  -- 추적
  ip_hash VARCHAR(64),
  user_agent TEXT,
  referrer TEXT,

  -- 메타
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_tenant ON "Event"(tenant_id);
CREATE INDEX idx_event_type ON "Event"(event_type);
CREATE INDEX idx_event_resource ON "Event"(resource_type, resource_id);
CREATE INDEX idx_event_date ON "Event"(created_at);
```

---

## 배포 전략

### 옵션 1: 독립 레포지토리 + 독립 배포

```
jaehyeong-tech/               (메인 프로젝트)
├── apps/blog-service
├── apps/page-service
└── apps/mfe-*

universal-auth-service/        (별도 레포)
├── src/
├── prisma/
└── Dockerfile

universal-comment-service/     (별도 레포)
├── src/
├── prisma/
└── Dockerfile

universal-storage-service/     (별도 레포)
└── ...
```

**장점**:
- 완전 독립적인 개발/배포
- 다른 프로젝트에서 쉽게 사용 가능
- 버전 관리 명확

**단점**:
- 레포지토리 관리 복잡
- 코드 중복 가능성

---

### 옵션 2: 모노레포 + 독립 배포 (추천)

```
jaehyeong-tech/
├── apps/
│   ├── blog-service/          (프로젝트 특화)
│   ├── page-service/          (프로젝트 특화)
│   ├── auth-service/          (범용)
│   ├── comment-service/       (범용)
│   ├── storage-service/       (범용)
│   └── analytics-service/     (범용)
└── packages/
    └── shared/
```

**배포**:
- 각 서비스 독립적으로 컨테이너화
- 범용 서비스는 Docker Hub 공개 가능
- 다른 프로젝트에서 `docker pull` 사용

---

## 사용 예시

### Tenant 초기화

```bash
# jaehyeong-tech Tenant 생성
curl -X POST https://auth-service.com/api/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "jaehyeong-tech",
    "domain": "jaehyeong.tech",
    "allowRegistration": true,
    "allowGoogleOauth": true,
    "passwordMinLength": 8
  }'

# 응답
{
  "tenant": {
    "id": "tenant-uuid",
    "name": "jaehyeong-tech",
    "jwtSecret": "auto-generated-secret",
    ...
  }
}
```

---

### 다른 프로젝트에서 사용

```bash
# my-shop Tenant 생성
curl -X POST https://auth-service.com/api/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-shop",
    "domain": "myshop.com",
    "allowRegistration": true,
    "passwordMinLength": 12,
    "passwordRequireSpecial": true
  }'
```

이제 my-shop은 같은 Auth Service를 사용하지만 **완전히 격리된 사용자 DB**를 가집니다.

---

## 비용 분석

### 단일 인스턴스 vs 멀티 프로젝트 공유

**시나리오**: 3개 프로젝트

**개별 배포**:
```
jaehyeong-tech Auth: $50/월
my-shop Auth: $50/월
my-blog Auth: $50/월
━━━━━━━━━━━━━━━━━━━━━━━
총: $150/월
```

**멀티 테넌트 공유**:
```
Universal Auth Service (3 프로젝트 공유): $100/월
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총: $100/월 (33% 절감)
```

---

## 보안 고려사항

### 1. Tenant 격리 보장

```typescript
// ❌ 나쁜 예: Tenant 검증 누락
const user = await prisma.user.findUnique({ where: { id } });

// ✅ 좋은 예: 항상 Tenant 검증
const user = await prisma.user.findUnique({
  where: {
    id,
    tenantId: req.tenant.id,  // Tenant 격리
  },
});
```

### 2. JWT Secret 격리

- 각 Tenant별로 독립적인 JWT Secret
- Tenant A의 토큰으로 Tenant B 접근 불가

### 3. Database Row-Level Security (선택적)

```sql
-- PostgreSQL RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "User"
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

---

## 마이그레이션 계획

### Phase 1: 현재 설계로 구축 (0-3개월)

- jaehyeong-tech 전용으로 먼저 구축
- Auth Service, Comment Service 완성

### Phase 2: 범용화 리팩토링 (3-4개월)

- Tenant 모델 추가
- 멀티 테넌시 구조로 전환
- 기존 데이터 마이그레이션

### Phase 3: 다른 프로젝트 적용 (4개월+)

- 새 프로젝트에 범용 서비스 적용
- 피드백 수집 및 개선

---

## 결론

Auth Service, Comment Service, Storage Service는 **범용 서비스로 설계 가능**하며, 다음과 같은 이점이 있습니다:

1. **재사용성**: 여러 프로젝트에서 사용
2. **비용 절감**: 인프라 공유로 비용 감소
3. **일관성**: 동일한 인증/댓글 로직 사용
4. **유지보수**: 한 곳에서 수정 → 모든 프로젝트 반영

**추천 접근**:
1. 초기에는 jaehyeong-tech 전용으로 구축
2. 안정화 후 범용화 리팩토링
3. 새 프로젝트에 적용하며 검증

---

**문서 버전**: 1.0
**작성일**: 2026-01-15
**작성자**: Claude (AI Assistant)
