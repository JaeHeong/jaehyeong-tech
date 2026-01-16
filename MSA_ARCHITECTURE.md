# MSA (Microservices Architecture) 구조

## 📋 개요

이 프로젝트는 모놀리식 아키텍처에서 마이크로서비스 아키텍처(MSA)로 리팩토링되었습니다.

## 🏗️ 서비스 구조

### Microservices

| 서비스 | 포트 | 설명 | 데이터베이스 |
|--------|------|------|--------------|
| **Auth Service** | 3001 | 사용자 인증, 테넌트 관리 | postgres-auth |
| **Comment Service** | 3002 | 댓글 시스템 | postgres-comment |
| **Storage Service** | 3003 | 파일 저장 (OCI) | postgres-storage |
| **Blog Service** | 3013 | 블로그 포스트, 카테고리, 태그 | postgres-blog |
| **Page Service** | 3004 | 정적 페이지, 공지사항 | postgres-page |
| **Analytics Service** | 3005 | 방문자 추적, 버그 리포트 | postgres-analytics |

### Infrastructure

| 컴포넌트 | 포트 | 설명 |
|----------|------|------|
| **Kong API Gateway** | 8000, 8001 | API 게이트웨이, 라우팅 |
| **RabbitMQ** | 5672, 15672 | 메시지 브로커 (이벤트 기반 통신) |
| **Redis** | 6379 | 캐시 |
| **PostgreSQL** | 5432-5437 | 서비스별 전용 데이터베이스 |

## 🔄 서비스 간 통신

### 1. 동기 통신 (REST API)
- API Gateway (Kong)를 통한 라우팅
- JWT 기반 인증
- 테넌트 식별 (X-Tenant-Name 헤더)

### 2. 비동기 통신 (Event-Driven)
- RabbitMQ를 통한 이벤트 발행/구독
- 주요 이벤트:
  - `user.created`, `user.updated`
  - `post.created`, `post.updated`, `post.deleted`
  - `page.created`, `page.updated`, `page.deleted`
  - `comment.created`, `comment.updated`, `comment.moderated`
  - `file.uploaded`, `file.deleted`

## 🚀 실행 방법

### 개발 환경

```bash
# 1. 의존성 설치
pnpm install

# 2. 각 서비스별 Prisma 마이그레이션
cd apps/auth-service && pnpm prisma migrate dev
cd apps/comment-service && pnpm prisma migrate dev
cd apps/storage-service && pnpm prisma migrate dev
cd apps/blog-service && pnpm prisma migrate dev
cd apps/page-service && pnpm prisma migrate dev
cd apps/analytics-service && pnpm prisma migrate dev

# 3. 각 서비스 개별 실행
cd apps/auth-service && pnpm dev
cd apps/comment-service && pnpm dev
cd apps/storage-service && pnpm dev
cd apps/blog-service && pnpm dev
cd apps/page-service && pnpm dev
cd apps/analytics-service && pnpm dev
```

### Docker Compose (전체 스택)

```bash
# 전체 서비스 빌드 및 실행
docker-compose -f docker-compose.full.yaml up -d

# 로그 확인
docker-compose -f docker-compose.full.yaml logs -f

# 서비스 중지
docker-compose -f docker-compose.full.yaml down
```

### Kubernetes (프로덕션)

```bash
# 1. Namespace 생성
kubectl apply -f k8s/namespace/

# 2. 인프라 배포
kubectl apply -f k8s/rabbitmq/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/postgresql/

# 3. 서비스 배포
kubectl apply -f k8s/auth-service/
kubectl apply -f k8s/comment-service/
kubectl apply -f k8s/storage-service/
kubectl apply -f k8s/blog-service/
kubectl apply -f k8s/page-service/
kubectl apply -f k8s/analytics-service/

# 4. API Gateway 배포
kubectl apply -f k8s/kong/

# 5. 상태 확인
kubectl get pods -n msa-services
kubectl get services -n msa-services
```

## 🔑 API 엔드포인트

### Auth Service (3001)
```
POST   /api/auth/register          - 사용자 등록
POST   /api/auth/login             - 로그인
POST   /api/auth/refresh           - 토큰 갱신
POST   /api/tenants                - 테넌트 생성 (Super Admin)
GET    /api/tenants                - 테넌트 목록
GET    /api/users                  - 사용자 목록
```

### Comment Service (3002)
```
GET    /api/comments               - 댓글 목록
POST   /api/comments               - 댓글 작성
PUT    /api/comments/:id           - 댓글 수정
DELETE /api/comments/:id           - 댓글 삭제
POST   /api/comments/:id/moderate  - 댓글 승인/거부 (Admin)
```

### Storage Service (3003)
```
POST   /api/files                  - 파일 업로드
GET    /api/files/:id              - 파일 메타데이터 조회
GET    /api/files                  - 파일 목록
DELETE /api/files/:id              - 파일 삭제
```

### Blog Service (3013)
```
GET    /api/posts                  - 포스트 목록
GET    /api/posts/:slug            - 포스트 조회
POST   /api/posts                  - 포스트 작성 (Admin)
POST   /api/posts/:id/like         - 좋아요 토글
GET    /api/categories             - 카테고리 목록
GET    /api/tags                   - 태그 목록
GET    /api/bookmarks              - 북마크 목록 (인증 필요)
```

### Page Service (3004)
```
GET    /api/pages                  - 페이지 목록
GET    /api/pages/:slug            - 페이지 조회
GET    /api/notices                - 공지사항 목록
POST   /api/pages                  - 페이지 작성 (Admin)
```

### Analytics Service (3005)
```
POST   /api/visitors/track         - 방문자 추적
GET    /api/visitors/stats         - 방문자 통계
POST   /api/bug-reports            - 버그 리포트 제출
GET    /api/bug-reports/public     - 버그 리포트 목록
```

## 🔐 인증 및 권한

### Multi-tenancy
- 모든 요청에 `X-Tenant-Name` 또는 `X-Tenant-ID` 헤더 필요
- Subdomain 기반 테넌트 식별 지원

### JWT 인증
```
Authorization: Bearer <JWT_TOKEN>
```

### 권한 레벨
- **Public**: 인증 불필요
- **User**: 인증된 사용자
- **Admin**: 관리자 권한 필요

## 📊 데이터베이스 스키마

각 서비스는 독립적인 데이터베이스를 가집니다 (Database-per-Service 패턴).

### Auth Service
- `Tenant`: 테넌트 정보, JWT Secret
- `User`: 사용자, 역할, 비밀번호

### Comment Service
- `Tenant`: 테넌트
- `Comment`: 댓글 (resource-agnostic)

### Storage Service
- `Tenant`: 테넌트
- `File`: 파일 메타데이터 (OCI 경로)

### Blog Service
- `Tenant`: 테넌트
- `Post`: 블로그 포스트
- `Category`: 카테고리
- `Tag`: 태그
- `Like`: 좋아요
- `Bookmark`: 북마크
- `PostView`: 조회수

### Page Service
- `Tenant`: 테넌트
- `Page`: 정적 페이지/공지사항
- `PageView`: 조회수

### Analytics Service
- `Tenant`: 테넌트
- `SiteVisitor`: 방문자 (일별)
- `BugReport`: 버그 리포트

## 🎯 주요 기능

### Multi-tenancy
- 테넌트별 데이터 완전 격리
- 테넌트별 JWT Secret
- 테넌트별 설정 관리

### Event-Driven Architecture
- RabbitMQ를 통한 느슨한 결합
- 이벤트 소싱 패턴
- 비동기 처리

### Resource-Agnostic Design
- Comment Service: 모든 리소스에 댓글 지원
- Storage Service: 모든 리소스에 파일 첨부 지원

### Privacy & Security
- IP 해싱 (조회수, 방문자 추적)
- 비밀번호 해싱 (bcrypt)
- JWT 토큰 기반 인증

## 📝 환경 변수

각 서비스는 `.env` 파일을 통해 설정합니다.

### 공통 환경 변수
```env
NODE_ENV=production
PORT=3xxx
DATABASE_URL=postgresql://...
RABBITMQ_URL=amqp://...
```

### Auth Service
```env
JWT_SECRET=your-jwt-secret
SUPER_ADMIN_API_KEY=your-super-admin-key
```

### Storage Service
```env
OCI_NAMESPACE=your-oci-namespace
OCI_BUCKET=your-oci-bucket
OCI_ACCESS_KEY=your-oci-access-key
OCI_SECRET_KEY=your-oci-secret-key
```

### Blog/Page/Analytics Service
```env
IP_HASH_SALT=your-ip-hash-salt
```

## 🔧 모니터링 & 로깅

### Health Checks
모든 서비스는 다음 엔드포인트를 제공합니다:
- `GET /health` - 서비스 상태 확인
- `GET /ready` - 준비 상태 확인 (DB 연결 등)

### Logging
- 구조화된 JSON 로깅
- 서비스별 로그 레벨 설정
- 중앙 집중식 로그 수집 (추후 ELK Stack 통합)

## 🚨 문제 해결

### 서비스가 시작되지 않을 때
```bash
# 1. 데이터베이스 연결 확인
docker ps | grep postgres

# 2. RabbitMQ 연결 확인
docker ps | grep rabbitmq

# 3. 로그 확인
docker-compose -f docker-compose.full.yaml logs <service-name>
```

### 데이터베이스 마이그레이션 오류
```bash
# Prisma 클라이언트 재생성
cd apps/<service-name>
pnpm prisma generate

# 마이그레이션 초기화
pnpm prisma migrate reset
```

## 📚 추가 문서

- [API 문서](./API_DOCUMENTATION.md)
- [배포 가이드](./DEPLOYMENT_GUIDE.md)
- [개발 가이드](./DEVELOPMENT_GUIDE.md)
- [마이그레이션 가이드](./MIGRATION_GUIDE.md)
