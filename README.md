# Jaehyeong Tech Blog

DevOps, MLOps, 클라우드 인프라 경험을 기록하는 개인 기술 블로그.

- Production: https://tech.jaehyeong.com
- Node.js 22, pnpm 9.15.0, TypeScript, React 19, Express 5, Prisma 6, PostgreSQL 16

## 구조

```text
외부 방문자 → Cloudflare Tunnel → Cilium Gateway
                                  ├─ /api/*, RSS, sitemap → api:3000 → PostgreSQL
                                  │                         ├─ 공용 Redis (선택적 캐시)
                                  │                         └─ OCI Object Storage
                                  └─ /* → web:80
```

웹과 API는 각각 하나의 Deployment, PostgreSQL은 하나의 StatefulSet으로 실행한다.
내부 DB·캐시 연결에는 Kubernetes Service 주소를 사용하며 Cloudflare Tunnel을 거치지 않는다.
API 모듈 사이에는 HTTP 호출이나 메시지 브로커가 없다.

```text
apps/api/
  prisma/schema.prisma      # 운영 DB와 일치하는 단일 스키마
  src/db.ts                 # 단일 Prisma 연결 풀
  src/middleware/           # 인증, 블로그 설정, 오류 처리
  src/modules/
    auth/                   # 로그인, 회원, 작성자 프로필
    blog/                   # 글, 초안, 카테고리, 태그, 검색, RSS
    comment/                # 댓글
    page/                   # 공지와 소개 페이지
    analytics/              # 방문 통계와 관리자 대시보드
    storage/                # 이미지, OCI 파일, 백업
apps/web/                   # React, Vite, TipTap
packages/shared/types/      # 공통 타입
packages/shared/utils/      # 공통 유틸과 Redis 캐시
```

에디터, 자동 임시 저장, 회원 로그인, 댓글, 좋아요, 북마크, 공지, 통계, 파일 업로드와 기존 JSON 백업 형식을 유지한다.
검색은 공개 글의 제목·본문·요약·카테고리·태그를 PostgreSQL에서 직접 조회한다.
공백으로 나눈 검색어를 모두 포함하는 글을 찾으며 기본 정렬은 최신 발행일 순이다.
Meilisearch의 오타 보정과 관련도 순위는 제공하지 않는다.

## 로컬 개발과 검증

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
pnpm test
pnpm dev
```

API 기본 포트는 3000, Vite 개발 서버는 5173이다.
로컬 API 설정 예시는 `.env.example`을 `apps/api/.env`로 복사해 사용한다.
API에는 `DATABASE_URL`, `TENANT_ID`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`를 설정한다.
기존 사이트의 `TENANT_ID` 기본값은 `tenant-jaehyeong-tech`이다.
이 ID와 DB의 블로그 설정 행은 이미지 경로·회원·기존 글의 호환성을 위해 유지한다.
외부의 `x-user-*`, `x-tenant-*` 헤더로 인증하거나 사이트를 선택하지 않는다.

Redis는 `REDIS_URL`, `CACHE_NAMESPACE`로 설정한다.
키 형식은 `프로젝트:환경:모듈:키`이고 TTL을 사용한다.
Redis 연결은 백그라운드에서 시도하며, 명령은 기본 150ms 안에 완료되지 않으면 캐시를 건너뛴다.
장애 후 기본 5초 동안 재시도하지 않는다.
캐시는 원본 데이터나 로그인 세션, 작업 큐를 저장하는 용도로 사용하지 않는다.

```sh
# 실제 DB에서 명시적으로 수행하는 읽기 전용 확인.
# DATABASE_URL에는 connection_limit=1을 포함한다.
# 운영과 일치하는 JWT 키와 TENANT_ID가 필요하다.
node apps/api/test/smoke.cjs
```

스키마를 합치는 과정에서 테이블·ID·운영 데이터는 변경하지 않는다.
컨테이너 시작 시 `db push`, 마이그레이션, 초기 데이터 삽입을 자동 실행하지 않는다.
기존 DB에 배포할 때는 먼저 스키마 차이를 확인하고 백업을 확보한다.

## CI/CD

GitHub Actions의 `.github/workflows/build-deploy-msa.yml`은 API와 웹 이미지 2개를 빌드한다.
파일 이름은 기존 워크플로 링크 호환성을 위해 유지한다.
`main`에 코드가 올라오면 빌드하고, API 이미지 빌드 중 타입 검사와 자동 테스트도 실행한다.
ARM64 노드에 맞춰 ARM64 이미지와 커밋 해시 태그를 사용한다.
기존 공개 패키지 접근 권한을 유지하기 위해 통합 API 이미지는 `jaehyeong-tech-blog` 패키지에 저장한다.

```sh
# 빌드 후 두 이미지 태그를 함께 GitOps 저장소에 반영
# 먼저 my-k8s-gitops에 통합 API용 매니페스트가 있어야 한다.
gh workflow run build-deploy-msa.yml -f environment=prod -f deploy=true
```

GitOps 대상은 `JaeHeong/my-k8s-gitops`의 `apps/jaehyeong-tech/values-prod.yaml` 또는 `values-dev.yaml`이다.
GitHub Actions는 두 이미지 빌드가 모두 성공한 경우에만 태그를 변경한다.
ArgoCD가 매니페스트를 적용하고 새 API의 readiness를 확인한 뒤 이전 서비스를 정리한다.
GitHub Secrets는 `GITOPS_SSH_KEY`, `VITE_GOOGLE_CLIENT_ID`를 사용하고,
이미지 레지스트리 인증에는 Actions의 `GITHUB_TOKEN`을 사용한다.

공용 Redis와 Redis Operator, Cilium, Sealed Secrets, Reloader는 유지한다.
RabbitMQ·Meilisearch는 PostgreSQL 검색 전환 검증 후 제거하며,
롤백을 위해 이전 이미지와 영속 볼륨을 보존한다.
