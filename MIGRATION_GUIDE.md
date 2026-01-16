# MSA 마이그레이션 가이드

## 개요

이 가이드는 기존 모놀리식 애플리케이션에서 새로운 MSA 구조로 마이그레이션하는 방법을 설명합니다.

## 마이그레이션 전략

### Phase별 진행 상황

✅ **Phase 0**: Infrastructure & Shared Packages
✅ **Phase 1**: Auth Service (사용자/테넌트 인증)
✅ **Phase 2**: Comment Service (댓글)
✅ **Phase 3**: Storage Service (파일 저장)
✅ **Phase 4**: Blog Service (블로그 포스트)
✅ **Phase 5**: Page Service (정적 페이지/공지사항)
✅ **Phase 6**: Analytics Service (방문자 추적, 버그 리포트)

## 데이터 마이그레이션

### 1. 기존 데이터 백업

```bash
# PostgreSQL 백업
pg_dump -U postgres -d your_database > backup.sql
```

### 2. 테넌트 데이터 생성

```bash
# Super Admin API Key로 테넌트 생성
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -H "X-Super-Admin-Key: your-super-admin-key" \
  -d '{
    "name": "default",
    "jwtSecret": "your-jwt-secret",
    "jwtExpiry": "7d"
  }'
```

### 3. 사용자 데이터 마이그레이션

기존 `users` 테이블 → Auth Service `User` 모델

```sql
-- 기존 데이터 조회
SELECT id, email, password, name, role FROM users;

-- Auth Service로 마이그레이션 (API 사용)
-- POST /api/auth/register for each user
```

### 4. 블로그 데이터 마이그레이션

#### Posts
기존 `posts` 테이블 → Blog Service `Post` 모델

**주요 변경사항:**
- `authorId`: 외부 참조 (Auth Service의 User ID)
- `tenantId`: 새로 추가
- `status`: `DRAFT` → `PUBLIC/PRIVATE/DRAFT`

```javascript
// 마이그레이션 스크립트 예시
const oldPosts = await oldDb.post.findMany();

for (const oldPost of oldPosts) {
  await fetch('http://localhost:3013/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Name': 'default',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: oldPost.title,
      content: oldPost.content,
      excerpt: oldPost.excerpt,
      coverImage: oldPost.coverImage,
      status: oldPost.status === 'DRAFT' ? 'DRAFT' : 'PUBLIC',
      categoryId: oldPost.categoryId,
      tagIds: oldPost.tags.map(t => t.id),
    }),
  });
}
```

#### Categories & Tags
기존 `categories`, `tags` → Blog Service 모델

```javascript
// Categories
const oldCategories = await oldDb.category.findMany();
for (const cat of oldCategories) {
  await fetch('http://localhost:3013/api/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Name': 'default',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
    }),
  });
}
```

### 5. 댓글 데이터 마이그레이션

기존 `comments` 테이블 → Comment Service `Comment` 모델

**주요 변경사항:**
- `postId` → `resourceType: 'post'`, `resourceId: postId`
- `authorId`: 외부 참조 또는 `guestName` (익명)
- `status`: 새로 추가 (`PENDING`, `APPROVED`, `REJECTED`, `SPAM`)

```javascript
const oldComments = await oldDb.comment.findMany();

for (const comment of oldComments) {
  await fetch('http://localhost:3002/api/comments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Name': 'default',
      'Authorization': comment.authorId ? `Bearer ${userToken}` : undefined,
    },
    body: JSON.stringify({
      resourceType: 'post',
      resourceId: comment.postId,
      content: comment.content,
      guestName: comment.author ? undefined : comment.guestName,
      guestPassword: comment.guestPassword,
    }),
  });
}
```

### 6. 이미지 데이터 마이그레이션

기존 `images` 테이블 + OCI Storage → Storage Service `File` 모델

**주요 변경사항:**
- 파일 메타데이터는 Storage Service로
- 실제 파일은 OCI Object Storage에 그대로 유지

```javascript
const oldImages = await oldDb.image.findMany();

for (const image of oldImages) {
  // Storage Service에 메타데이터 생성
  await prisma.file.create({
    data: {
      tenantId: 'default-tenant-id',
      fileName: image.filename,
      originalFileName: image.filename,
      mimeType: image.mimetype,
      size: image.size,
      url: image.url,
      objectName: image.objectName,
      resourceType: image.postId ? 'post' : undefined,
      resourceId: image.postId,
      folder: image.folder,
    },
  });
}
```

### 7. 페이지 데이터 마이그레이션

기존 `pages` 테이블 → Page Service `Page` 모델

```javascript
const oldPages = await oldDb.page.findMany();

for (const page of oldPages) {
  await fetch('http://localhost:3004/api/pages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Name': 'default',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: page.title,
      content: page.content,
      excerpt: page.excerpt,
      type: page.type, // STATIC or NOTICE
      status: page.status, // DRAFT or PUBLISHED
      badge: page.badge,
      badgeColor: page.badgeColor,
      isPinned: page.isPinned,
      template: page.template,
    }),
  });
}
```

## 프론트엔드 통합

### API 엔드포인트 변경

#### 기존 (모놀리식)
```javascript
// 모든 요청이 단일 서버로
fetch('http://localhost:3000/api/posts')
fetch('http://localhost:3000/api/comments')
```

#### 신규 (MSA)
```javascript
// Kong API Gateway를 통해 라우팅
fetch('http://localhost:8000/api/posts')     // → Blog Service
fetch('http://localhost:8000/api/comments')  // → Comment Service
fetch('http://localhost:8000/api/files')     // → Storage Service
```

### 환경 변수 설정

```env
# .env.local (프론트엔드)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_TENANT_NAME=default
```

### API 클라이언트 업데이트

```typescript
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const TENANT_NAME = process.env.NEXT_PUBLIC_TENANT_NAME;

export async function apiRequest(endpoint: string, options?: RequestInit) {
  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Name': TENANT_NAME,
      ...options?.headers,
    },
  });
}
```

### 인증 토큰 전달

```typescript
// lib/auth.ts
export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'X-Tenant-Name': TENANT_NAME,
  };
}

// 사용 예시
fetch('http://localhost:8000/api/posts', {
  headers: getAuthHeaders(),
});
```

## 배포 순서

### 1. 인프라 배포 (우선)
```bash
# PostgreSQL, RabbitMQ, Redis
docker-compose -f docker-compose.full.yaml up -d rabbitmq redis postgres-auth postgres-comment postgres-storage postgres-blog postgres-page postgres-analytics
```

### 2. Auth Service 배포 (필수)
```bash
docker-compose -f docker-compose.full.yaml up -d auth-service
```

### 3. 다른 서비스 배포
```bash
docker-compose -f docker-compose.full.yaml up -d comment-service storage-service blog-service page-service analytics-service
```

### 4. API Gateway 배포
```bash
docker-compose -f docker-compose.full.yaml up -d kong
```

### 5. 프론트엔드 재배포
```bash
# 환경 변수 업데이트 후
npm run build
npm start
```

## 롤백 계획

### 긴급 롤백 (문제 발생 시)

1. **Kong 라우팅 변경**: 구 서버로 트래픽 우회
2. **서비스 중지**: 문제 서비스만 중지
3. **데이터베이스 복원**: 백업에서 복원

```bash
# 특정 서비스 중지
docker-compose -f docker-compose.full.yaml stop blog-service

# 로그 확인
docker-compose -f docker-compose.full.yaml logs blog-service

# 재시작
docker-compose -f docker-compose.full.yaml restart blog-service
```

## 모니터링

### Health Check
```bash
# 모든 서비스 상태 확인
curl http://localhost:3001/health  # Auth
curl http://localhost:3002/health  # Comment
curl http://localhost:3003/health  # Storage
curl http://localhost:3013/health  # Blog
curl http://localhost:3004/health  # Page
curl http://localhost:3005/health  # Analytics
```

### Metrics
- RabbitMQ Management UI: http://localhost:15672 (admin/admin)
- Kong Admin API: http://localhost:8001

## 주의사항

1. **데이터 정합성**: 마이그레이션 중 데이터 변경 금지
2. **트랜잭션**: 관련 데이터는 함께 마이그레이션
3. **테스트**: 각 서비스별 독립 테스트 후 통합 테스트
4. **모니터링**: 마이그레이션 후 최소 1주일 집중 모니터링

## 문제 해결

### 서비스 간 통신 실패
```bash
# 네트워크 확인
docker network inspect msa-network

# 서비스 로그 확인
docker-compose -f docker-compose.full.yaml logs -f <service-name>
```

### 데이터베이스 연결 실패
```bash
# PostgreSQL 연결 테스트
docker exec -it postgres-auth psql -U postgres -d auth_service
```

### RabbitMQ 메시지 누락
```bash
# RabbitMQ 큐 확인
docker exec -it msa-rabbitmq rabbitmqctl list_queues
```

## 추가 리소스

- [MSA Architecture 문서](./MSA_ARCHITECTURE.md)
- [API 문서](./API_DOCUMENTATION.md)
- [개발 가이드](./DEVELOPMENT_GUIDE.md)
