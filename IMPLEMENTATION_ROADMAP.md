# MSA 구현 로드맵 (Action Plan)

## 현재 상태

### ✅ 완료된 작업
- [x] 전체 코드베이스 분석
- [x] MSA 아키텍처 설계
- [x] Tenant 모델 기반 범용화 설계
- [x] 서비스 분리 계획
- [x] 데이터베이스 스키마 설계
- [x] GitHub Actions Workflow 설계
- [x] Kubernetes 배포 YAML 작성
- [x] GitOps 전략 수립

### 📋 완성된 문서
1. `MSA_REFACTORING_PLAN.md` - 전체 MSA 리팩토링 계획
2. `MESSAGING_COMPARISON.md` - RabbitMQ 선택 (vs Kafka)
3. `REUSABLE_SERVICES_DESIGN.md` - 범용 서비스 설계
4. `UNIVERSAL_MSA_IMPLEMENTATION.md` - 실제 구현 코드 (2,366줄)
5. `FINAL_ARCHITECTURE.md` - 최종 아키텍처 시각화
6. `DEPLOYMENT_STRATEGY.md` - 배포 전략 및 K8s YAML

---

## 다음 단계: 실제 구현

### Phase 0: 인프라 준비 (1-2주)

**목표**: 개발 환경 및 공유 인프라 구축

#### Week 1: 로컬 개발 환경

```bash
# 1. 모노레포 구조 준비
mkdir -p apps/{auth-service,comment-service,storage-service,analytics-service,blog-service,page-service}
mkdir -p packages/shared
mkdir -p k8s/{auth-service,comment-service,storage-service}

# 2. 공통 패키지 설정
cd packages/shared
npm init -y
# types, utils, events 추가
```

**체크리스트**:
- [ ] pnpm workspace 설정
- [ ] TypeScript 공통 설정 (`tsconfig.base.json`)
- [ ] ESLint/Prettier 설정
- [ ] 공통 타입 정의 (`packages/shared/types`)
- [ ] 공통 이벤트 정의 (`packages/shared/events`)

#### Week 2: Kubernetes 인프라

**로컬 개발 (Minikube/Kind)**:
```bash
# 1. Minikube 시작
minikube start --cpus=4 --memory=8192

# 2. 네임스페이스 생성
kubectl create namespace jaehyeong-tech-dev

# 3. PostgreSQL 배포 (개발용)
kubectl apply -f k8s/postgresql/

# 4. RabbitMQ 배포
kubectl apply -f k8s/rabbitmq/

# 5. Redis 배포
kubectl apply -f k8s/redis/
```

**체크리스트**:
- [ ] PostgreSQL (개발용)
- [ ] RabbitMQ (Management UI 포함)
- [ ] Redis
- [ ] Kong Gateway (기본 설정)
- [ ] Traefik Ingress Controller

---

### Phase 1: Auth Service 구축 (2주)

**목표**: 첫 번째 마이크로서비스 완성 및 패턴 확립

#### Week 1: 기본 구조

**1. 프로젝트 초기화**
```bash
cd apps/auth-service
npm init -y
npm install express prisma typescript @types/node @types/express
npm install jsonwebtoken bcryptjs
npm install -D ts-node nodemon
```

**2. Prisma 스키마 작성**
```bash
# apps/auth-service/prisma/schema.prisma
npx prisma init
# Tenant + User 모델 작성 (UNIVERSAL_MSA_IMPLEMENTATION.md 참고)
```

**3. 디렉토리 구조 생성**
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
│   │   └── tenant.ts
│   ├── services/
│   │   ├── prisma.ts
│   │   ├── jwtService.ts
│   │   └── passwordService.ts
│   ├── app.ts
│   └── server.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

**체크리스트**:
- [ ] Prisma 스키마 작성 (Tenant, User)
- [ ] Tenant Resolver Middleware
- [ ] JWT Service (Tenant별 Secret)
- [ ] Password Service (Tenant별 정책)
- [ ] Auth Controller (register, login, googleLogin)
- [ ] Health Check 엔드포인트

#### Week 2: 테스트 및 배포

**1. 통합 테스트 작성**
```typescript
// apps/auth-service/tests/integration/auth.test.ts
describe('Auth Service', () => {
  it('should allow same email in different tenants', async () => {
    // Tenant 격리 테스트
  });

  it('should prevent cross-tenant token usage', async () => {
    // JWT 격리 테스트
  });
});
```

**2. Dockerfile 작성**
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

**3. Kubernetes 배포**
```bash
# Tenant 초기화 (jaehyeong-tech)
kubectl run -it --rm tenant-init --image=curlimages/curl --restart=Never -- \
  curl -X POST http://auth-service:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"jaehyeong-tech","domain":"jaehyeong.tech"}'

# 배포 확인
kubectl get pods -n jaehyeong-tech-dev
kubectl logs -f auth-service-xxx
```

**체크리스트**:
- [ ] 단위 테스트 (Services)
- [ ] 통합 테스트 (Controllers)
- [ ] Tenant 격리 테스트
- [ ] Dockerfile 작성
- [ ] Kubernetes Deployment
- [ ] Health Check 확인
- [ ] jaehyeong-tech Tenant 생성

**마일스톤**: Auth Service 완성 및 배포 ✅

---

### Phase 2: Comment Service 구축 (2주)

**목표**: 범용 댓글 서비스 구축 (리소스 독립적)

#### Week 1: 기본 구현

**1. Prisma 스키마**
```prisma
model Comment {
  id           String   @id @default(cuid())
  tenantId     String
  resourceType String   // 'post', 'product', 'video', etc.
  resourceId   String   // 외부 리소스 ID
  content      String
  authorId     String?
  guestName    String?
  guestPassword String?
  // ...
}
```

**2. Controller 구현**
```typescript
// apps/comment-service/src/controllers/comment.ts
export async function createComment(req, res, next) {
  const tenant = req.tenant!;
  const { resourceType, resourceId, content } = req.body;

  await prisma.comment.create({
    data: {
      tenantId: tenant.id,
      resourceType,
      resourceId,
      content,
      // ...
    }
  });
}
```

**체크리스트**:
- [ ] Comment 모델 (resourceType + resourceId)
- [ ] CRUD Controller
- [ ] Tenant Resolver
- [ ] Auth Service 연동 (사용자 정보 조회)
- [ ] IP 해싱 (스팸 방지)
- [ ] 계층 구조 (대댓글)

#### Week 2: RabbitMQ 연동 및 테스트

**1. 이벤트 구독**
```typescript
// apps/comment-service/src/events/subscriber.ts
await channel.bindQueue(queue, 'blog-events', 'post.deleted');

channel.consume(queue, async (msg) => {
  const event = JSON.parse(msg.content.toString());

  if (msg.fields.routingKey === 'post.deleted') {
    // 연관 댓글 삭제
    await prisma.comment.deleteMany({
      where: {
        tenantId: event.tenantId,
        resourceType: 'post',
        resourceId: event.postId
      }
    });
  }

  channel.ack(msg);
});
```

**체크리스트**:
- [ ] RabbitMQ Publisher/Subscriber
- [ ] `post.deleted` 이벤트 구독
- [ ] 통합 테스트
- [ ] Kubernetes 배포
- [ ] Blog Service 연동 테스트

**마일스톤**: Comment Service 완성 ✅

---

### Phase 3: Storage Service 구축 (2주)

**목표**: 범용 파일 저장소 서비스

#### Week 1: 기본 구현

**1. Multer + Sharp 이미지 최적화**
```typescript
// apps/storage-service/src/services/imageOptimizer.ts
export async function optimizeImage(buffer: Buffer, mimetype: string) {
  const optimized = await sharp(buffer)
    .resize(1200, null, { withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  return {
    buffer: optimized,
    size: optimized.length,
    format: 'webp',
    // ...
  };
}
```

**2. OCI 연동**
```typescript
// apps/storage-service/src/services/oci.ts
export async function uploadToOCI(filename: string, buffer: Buffer, folder: string) {
  const objectName = `${folder}/${filename}`;

  await objectStorage.putObject({
    namespaceName,
    bucketName,
    objectName,
    putObjectBody: buffer,
  });

  return generatePublicUrl(objectName);
}
```

**체크리스트**:
- [ ] File 모델 (resourceType + resourceId)
- [ ] 이미지 업로드 (Multer)
- [ ] 이미지 최적화 (Sharp)
- [ ] OCI 연동
- [ ] 고아 파일 정리 (Cron Job)

#### Week 2: 테스트 및 배포

**체크리스트**:
- [ ] 업로드 테스트 (20MB 제한)
- [ ] 이미지 최적화 테스트
- [ ] OCI 연동 테스트
- [ ] Kubernetes 배포
- [ ] Blog Service 연동

**마일스톤**: Storage Service 완성 ✅

---

### Phase 4: Blog Service 리팩토링 (2주)

**목표**: 기존 Blog 로직을 새 서비스로 이동

#### Week 1: 서비스 분리

**1. 기존 코드 마이그레이션**
```bash
# 기존 코드에서 Post 관련 로직 복사
cp apps/api/src/controllers/posts.ts apps/blog-service/src/controllers/post.ts
cp apps/api/src/controllers/categories.ts apps/blog-service/src/controllers/category.ts
cp apps/api/src/controllers/tags.ts apps/blog-service/src/controllers/tag.ts
```

**2. Tenant 적용**
```typescript
// 기존 코드 수정
export async function getPosts(req, res, next) {
  const tenant = req.tenant!;  // 추가

  const posts = await prisma.post.findMany({
    where: {
      tenantId: tenant.id,  // 추가
      status: 'PUBLIC'
    }
  });
}
```

**체크리스트**:
- [ ] Post Controller 이동
- [ ] Category Controller 이동
- [ ] Tag Controller 이동
- [ ] Draft Controller 이동
- [ ] Tenant Resolver 적용
- [ ] Auth Service 연동 (JWT 검증)

#### Week 2: 이벤트 발행 및 테스트

**1. 이벤트 발행**
```typescript
// apps/blog-service/src/events/publisher.ts
export async function publishPostDeleted(postId: string, tenantId: string) {
  channel.publish(
    'blog-events',
    'post.deleted',
    Buffer.from(JSON.stringify({ postId, tenantId }))
  );
}
```

**체크리스트**:
- [ ] `post.created` 이벤트 발행
- [ ] `post.deleted` 이벤트 발행
- [ ] Comment Service 연동 테스트
- [ ] Storage Service 연동 테스트
- [ ] 기존 API 호환성 테스트
- [ ] Kubernetes 배포

**마일스톤**: Blog Service 완성 ✅

---

### Phase 5: Page Service 리팩토링 (1주)

**목표**: 페이지 관리 서비스 분리

**체크리스트**:
- [ ] Page Controller 이동
- [ ] Tenant Resolver 적용
- [ ] 통합 테스트
- [ ] Kubernetes 배포

**마일스톤**: Page Service 완성 ✅

---

### Phase 6: Analytics Service 구축 (1주)

**목표**: 통계 및 분석 서비스

**체크리스트**:
- [ ] PostView, PageView 모델
- [ ] 조회수 추적 API
- [ ] 통계 대시보드 API
- [ ] Google Analytics 연동
- [ ] Kubernetes 배포

**마일스톤**: Analytics Service 완성 ✅

---

### Phase 7: Micro Frontends 구축 (4주)

**목표**: 프론트엔드 모듈화

#### Week 1-2: Shell App + Blog MFE

**1. Shell App (Container)**
```bash
cd apps/mfe-shell
npm create vite@latest . -- --template react-ts
npm install @originjs/vite-plugin-federation
```

**2. Module Federation 설정**
```typescript
// vite.config.ts
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'shell',
      remotes: {
        blog: 'http://localhost:3100/assets/remoteEntry.js',
        admin: 'http://localhost:3200/assets/remoteEntry.js',
        user: 'http://localhost:3300/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
});
```

**체크리스트**:
- [ ] Shell App (Header, Footer, Sidebar)
- [ ] AuthContext 공유
- [ ] Blog MFE (포스트 목록, 상세, 댓글)
- [ ] 라우팅 통합
- [ ] API 호출 (Kong Gateway)

#### Week 3-4: Admin MFE + User MFE

**체크리스트**:
- [ ] Admin MFE (TipTap 에디터 포함)
- [ ] User MFE (프로필, 북마크)
- [ ] E2E 테스트 (Playwright)
- [ ] Kubernetes 배포 (Nginx)

**마일스톤**: Micro Frontends 완성 ✅

---

### Phase 8: 통합 및 테스트 (2주)

**목표**: 전체 시스템 통합 테스트 및 최적화

#### Week 1: 통합 테스트

**1. API 호환성 테스트**
```typescript
describe('API Compatibility', () => {
  it('should maintain backward compatibility', async () => {
    // 기존 API 응답 형식 유지 확인
  });
});
```

**2. E2E 테스트**
```typescript
// tests/e2e/user-flow.spec.ts
test('complete user flow', async ({ page }) => {
  // 1. 회원가입
  await page.goto('/');
  await page.click('text=회원가입');
  // ...

  // 2. 로그인
  // 3. 포스트 조회
  // 4. 댓글 작성
  // 5. 북마크
});
```

**체크리스트**:
- [ ] API 호환성 테스트
- [ ] Tenant 격리 테스트
- [ ] Cross-service 통합 테스트
- [ ] E2E 테스트 (주요 사용자 플로우)
- [ ] 성능 테스트 (k6)
- [ ] 부하 테스트

#### Week 2: 최적화 및 문서화

**1. 캐싱 전략**
```typescript
// Redis 캐싱 적용
const categories = await redis.get('categories:all');
if (!categories) {
  const data = await prisma.category.findMany();
  await redis.setex('categories:all', 3600, JSON.stringify(data));
}
```

**2. 모니터링 설정**
```yaml
# Prometheus + Grafana
- ServiceMonitor for each service
- Alert rules
- Grafana dashboards
```

**체크리스트**:
- [ ] Redis 캐싱 (카테고리, 태그, 프로필)
- [ ] Prometheus + Grafana 설정
- [ ] Alert Rules 설정
- [ ] API 문서 (OpenAPI/Swagger)
- [ ] README 업데이트
- [ ] 배포 가이드 작성

**마일스톤**: 전체 시스템 통합 완료 ✅

---

### Phase 9: 프로덕션 배포 (1주)

**목표**: 프로덕션 환경 전환

#### 배포 전 체크리스트

**보안**:
- [ ] Secret 관리 (Sealed Secrets)
- [ ] HTTPS 설정 (Let's Encrypt)
- [ ] CORS 설정
- [ ] Rate Limiting 확인
- [ ] SQL Injection 방지 확인

**성능**:
- [ ] HPA 설정
- [ ] Resource Limits 확인
- [ ] CDN 설정 (정적 파일)
- [ ] Database Connection Pool

**모니터링**:
- [ ] Prometheus Alerts
- [ ] Slack 알림 설정
- [ ] Error Tracking (Sentry)
- [ ] Log Aggregation (ELK)

**백업**:
- [ ] Database 백업 자동화
- [ ] Disaster Recovery 계획
- [ ] Rollback 계획

#### 배포 전략

**Blue-Green 배포**:
```bash
# 1. Green 환경 배포
kubectl apply -f k8s/prod/ --dry-run=server

# 2. 헬스 체크
kubectl get pods -n jaehyeong-tech-prod

# 3. 트래픽 전환 (5% → 50% → 100%)
kubectl patch ingress jaehyeong-tech \
  -p '{"spec":{"rules":[{"host":"jaehyeong.tech","http":{"paths":[{"backend":{"service":{"name":"mfe-shell-green"}}}]}}]}}'

# 4. 모니터링 (에러율, 레이턴시)
# 5. 문제 없으면 Blue 환경 제거
```

**체크리스트**:
- [ ] Green 환경 배포
- [ ] 트래픽 5% 전환
- [ ] 모니터링 30분
- [ ] 트래픽 50% 전환
- [ ] 모니터링 1시간
- [ ] 트래픽 100% 전환
- [ ] Blue 환경 제거

**마일스톤**: 프로덕션 배포 완료 🎉

---

## 전체 타임라인

```
Phase 0: 인프라 준비        ████████████████ (2주)
Phase 1: Auth Service       ████████████████ (2주)
Phase 2: Comment Service    ████████████████ (2주)
Phase 3: Storage Service    ████████████████ (2주)
Phase 4: Blog Service       ████████████████ (2주)
Phase 5: Page Service       ████████ (1주)
Phase 6: Analytics Service  ████████ (1주)
Phase 7: Micro Frontends    ████████████████████████████████ (4주)
Phase 8: 통합 및 테스트     ████████████████ (2주)
Phase 9: 프로덕션 배포      ████████ (1주)
                            ═══════════════════════════════════
                            Total: 17주 (약 4개월)
```

---

## 즉시 시작할 수 있는 작업

### 1. 모노레포 구조 생성

```bash
# 프로젝트 루트에서
mkdir -p apps/{auth-service,comment-service,storage-service,analytics-service,blog-service,page-service}
mkdir -p apps/{mfe-shell,mfe-blog,mfe-admin,mfe-user}
mkdir -p packages/shared/{types,utils,events}
mkdir -p k8s/{auth-service,comment-service,storage-service,rabbitmq,redis,kong-gateway}
mkdir -p .github/workflows

# pnpm workspace 설정
cat > pnpm-workspace.yaml << EOF
packages:
  - 'apps/*'
  - 'packages/*'
EOF
```

### 2. 공통 타입 정의

```typescript
// packages/shared/types/index.ts
export interface Tenant {
  id: string;
  name: string;
  domain: string;
  jwtSecret: string;
  jwtExpiry: string;
  // ...
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  // ...
}
```

### 3. GitHub Actions Workflow 추가

```bash
# Workflow 파일 복사
cp DEPLOYMENT_STRATEGY.md .github/workflows/build-and-deploy.yaml
# (문서에서 YAML 부분 추출)
```

---

## 우선순위

### 🔴 High Priority (즉시 시작)

1. **Phase 0: 인프라 준비** (금주)
   - 모노레포 구조 생성
   - 로컬 Kubernetes 환경
   - PostgreSQL, RabbitMQ, Redis 배포

2. **Phase 1: Auth Service** (다음 2주)
   - 첫 MSA 패턴 확립
   - Tenant 모델 검증
   - JWT 격리 테스트

### 🟡 Medium Priority

3. **Phase 2-3: Comment & Storage Service** (3-4주 후)
   - 범용 서비스 패턴 확립
   - RabbitMQ 이벤트 테스트

4. **Phase 4-6: 프로젝트 서비스** (5-7주 후)
   - 기존 로직 마이그레이션
   - API 호환성 유지

### 🟢 Low Priority

5. **Phase 7-9: Frontend & Production** (8주 이후)
   - Micro Frontends
   - 프로덕션 배포

---

## 현재 브랜치 작업

```bash
# 현재 브랜치
git branch
# * claude/plan-msa-refactor-BkFbg

# PR 생성 후 main 머지
# 새 브랜치로 구현 시작
git checkout main
git pull origin main
git checkout -b feature/auth-service

# Phase 1 구현 시작!
cd apps/auth-service
npm init -y
```

---

## 추천: 다음 즉시 할 일

### 옵션 1: 계획 검토 및 PR 생성

```bash
# 문서 검토 후 PR 생성
gh pr create \
  --title "docs: MSA 리팩토링 계획 수립" \
  --body "전체 MSA 아키텍처 및 구현 계획 문서 작성"
```

### 옵션 2: 즉시 구현 시작 (Phase 0)

```bash
# 1. 모노레포 구조 생성
./scripts/setup-monorepo.sh

# 2. Auth Service 초기화
cd apps/auth-service
npm init -y
npx prisma init

# 3. Tenant + User 스키마 작성
# (UNIVERSAL_MSA_IMPLEMENTATION.md 참고)
```

---

## 어떤 방향으로 진행하시겠어요?

**A. 계획 검토 및 승인 후 시작** (추천)
   - PR 생성 → 검토 → 머지 → Phase 0 시작

**B. 즉시 Phase 0 시작**
   - 인프라 준비부터 바로 시작

**C. 특정 Phase부터 시작**
   - 예: Auth Service만 먼저 구현

**D. 계획 수정 필요**
   - 추가 질문이나 변경 사항 있음

---

**문서 버전**: 1.0
**작성일**: 2026-01-16
**다음 체크포인트**: Phase 0 완료 시점
