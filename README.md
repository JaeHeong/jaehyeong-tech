# Jaehyeong Tech Blog

DevOps, MLOps, 클라우드 인프라 등 기술 경험을 기록하는 개인 기술 블로그

**URL**: https://tech.jaehyeong.com

## 아키텍처

MSA (Microservice Architecture) 기반으로 7개 서비스로 구성:

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    Istio Gateway                         │
                    │               (istio-system/main-gateway)                │
                    └────────────────────────┬────────────────────────────────┘
                                             │
                    ┌────────────────────────┴────────────────────────────────┐
                    │                   VirtualService                         │
                    │              (Istio Routing + JWT Auth)                  │
                    └─────────┬───────┬───────┬───────┬───────┬───────┬──────┘
                              │       │       │       │       │       │
           ┌──────────────────┼───────┼───────┼───────┼───────┼───────┼──────────────────┐
           │                  │       │       │       │       │       │                  │
     ┌─────┴─────┐    ┌───────┴───┐ ┌─┴─┐ ┌───┴───┐ ┌─┴─┐ ┌───┴───┐ ┌─┴─┐           ┌───┴───┐
     │    web    │    │   auth    │ │blog│ │comment│ │page│ │analytics│ │storage│    │  DB   │
     │  (React)  │    │ (Express) │ │    │ │       │ │    │ │         │ │       │    │(Postgres)│
     │   :80     │    │   :3001   │ │:3002│ │ :3003 │ │:3004│ │  :3005  │ │ :3006 │    │ :5432 │
     └───────────┘    └───────────┘ └────┘ └───────┘ └────┘ └─────────┘ └───────┘    └───────┘
                              │       │       │       │       │       │
                              └───────┴───────┴───────┴───────┴───────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │     RabbitMQ      │
                                    │   (Event Bus)     │
                                    └───────────────────┘
```

### 서비스 구성

| 서비스 | 포트 | 역할 |
|--------|------|------|
| **web** | 80 | React 프론트엔드 (Nginx) |
| **auth-service** | 3001 | 인증, 사용자 관리, JWT 발급 |
| **blog-service** | 3002 | 포스트, 카테고리, 태그 관리 |
| **comment-service** | 3003 | 댓글 시스템 |
| **page-service** | 3004 | 공지사항, 정적 페이지 관리 |
| **analytics-service** | 3005 | 조회수, 좋아요, 통계 |
| **storage-service** | 3006 | 파일 업로드, 백업/복원 (OCI) |

### API 라우팅 (Istio VirtualService)

| 경로 | 서비스 |
|------|--------|
| `/api/auth/*`, `/api/users/*`, `/api/tenants/*` | auth-service |
| `/api/posts/*`, `/api/categories/*`, `/api/tags/*`, `/api/drafts/*` | blog-service |
| `/api/comments/*` | comment-service |
| `/api/pages/*` | page-service |
| `/api/analytics/*`, `/api/visitors/*`, `/api/likes/*`, `/api/stats/*` | analytics-service |
| `/api/files/*`, `/api/upload/*`, `/api/backups/*`, `/api/images/*` | storage-service |
| `/*` | web |

## 기술 스택

### Frontend (`apps/web`)
- **React 19** + **TypeScript 5.7**
- **Vite 6** - 빌드 도구
- **Tailwind CSS 3.4** - 스타일링
- **React Router 7** - 클라이언트 라우팅
- **TipTap 3** - WYSIWYG 에디터
- **Lowlight** - 코드 하이라이팅

### Backend (`apps/*-service`)
- **Node.js 22 LTS** + **TypeScript 5.7**
- **Express.js 5** - 웹 프레임워크
- **Prisma 6** - ORM
- **PostgreSQL 16** - 데이터베이스
- **RabbitMQ** - 메시지 브로커 (서비스 간 이벤트)
- **Redis** - 캐싱
- **JWT (RS256)** - 인증 (비대칭 키)
- **Zod** - 스키마 검증

### Infrastructure
- **Kubernetes** - 컨테이너 오케스트레이션
- **Istio** - 서비스 메쉬 (mTLS, JWT 인증, 라우팅)
- **ArgoCD** - GitOps 배포
- **Sealed Secrets** - 암호화된 Secret 관리
- **Cloudflare Tunnel** - 외부 접근
- **OCI Object Storage** - 이미지/백업 저장소

## 프로젝트 구조

```
jaehyeong-tech/
├── apps/
│   ├── web/                    # React Frontend
│   │   ├── src/
│   │   │   ├── components/     # UI 컴포넌트
│   │   │   ├── pages/          # 페이지 컴포넌트
│   │   │   ├── contexts/       # React Context
│   │   │   ├── hooks/          # 커스텀 훅
│   │   │   ├── services/       # API 클라이언트
│   │   │   └── types/          # 타입 정의
│   │   └── Dockerfile
│   │
│   ├── auth-service/           # 인증 서비스
│   │   └── src/
│   │       ├── controllers/    # auth, users, tenants
│   │       ├── services/       # JWT, OAuth
│   │       └── middleware/     # 인증 미들웨어
│   │
│   ├── blog-service/           # 블로그 서비스
│   │   └── src/
│   │       ├── controllers/    # posts, categories, tags, drafts
│   │       └── services/       # 비즈니스 로직
│   │
│   ├── comment-service/        # 댓글 서비스
│   │   └── src/
│   │       └── controllers/    # comments
│   │
│   ├── page-service/           # 페이지 서비스
│   │   └── src/
│   │       └── controllers/    # pages (notices, static)
│   │
│   ├── analytics-service/      # 분석 서비스
│   │   └── src/
│   │       └── controllers/    # stats, views, likes
│   │
│   └── storage-service/        # 스토리지 서비스
│       └── src/
│           ├── controllers/    # upload, backups, images
│           └── services/       # OCI Object Storage
│
├── packages/
│   └── shared/                 # 공유 패키지
│       ├── types/              # 공통 타입
│       └── utils/              # 공통 유틸 (Redis, Prisma 등)
│
├── .github/
│   └── workflows/
│       └── build-deploy-msa.yml  # CI/CD (dev/prod)
│
├── docker-compose.yml          # 로컬 개발용
├── pnpm-workspace.yaml
└── package.json
```

## 주요 기능

### 포스트 작성 (TipTap 에디터)

| 기능 | 설명 | 사용법 |
|------|------|--------|
| **제목** | H1, H2, H3 | 툴바 또는 `/1`, `/2`, `/3` |
| **텍스트 서식** | 굵게, 기울임, 취소선 | 툴바 또는 `Ctrl+B`, `Ctrl+I` |
| **인용문** | 기본 블록쿼트 | 툴바 또는 `/quote` |
| **Callout** | 노션 스타일 콜아웃 (6종) | 툴바 또는 `/callout` |
| **Pull Quote** | 큰 따옴표 강조 인용 | 툴바 또는 `/pullquote` |
| **코드 블록** | 30+ 언어 구문 강조 | 툴바 또는 `/code` |
| **리스트** | 순서/비순서 목록 | 툴바 또는 `/ul`, `/ol` |
| **링크** | 일반 링크 삽입 | 툴바 |
| **북마크** | 노션 스타일 링크 카드 | 링크 모달 → 북마크 버튼 |
| **이미지** | 드래그 앤 드롭 업로드 | 툴바 (OCI 저장) |
| **YouTube** | 영상 임베드 | 툴바 |
| **구분선** | 가로선 | `/hr` |

### Callout 타입

| 타입 | 아이콘 | 용도 |
|------|--------|------|
| info | 💡 | 정보 안내 |
| warning | ⚠️ | 주의 사항 |
| error | 🚨 | 오류/위험 |
| success | ✅ | 성공/완료 |
| note | 📝 | 메모 |
| tip | 🔥 | 유용한 팁 |

### 관리자 기능

- JWT 기반 인증 (RS256 비대칭 키)
- Google OAuth 로그인
- 포스트 작성/수정/삭제
- 임시 저장 기능 (자동 저장, 임시 저장 목록)
- 대시보드 통계 (포스트, 조회수, 좋아요, 댓글)
- 카테고리/태그 관리
- 공지사항 관리 (작성/수정/삭제, 뱃지, 상단 고정)
- 정적 페이지 관리
- 댓글 관리 (조회, 삭제, 비밀 댓글 확인)
- 프로필 설정 (이름, 아바타, 소셜 링크)
- 데이터 백업/복원 (OCI Object Storage)
- 고아 이미지 정리 (DB 기반 추적)

### 사용자 기능

- 반응형 디자인 (모바일/태블릿/데스크톱)
- 다크모드 지원
- 포스트 목록/상세 보기
- 카테고리별/태그별 필터링
- 전체 검색
- 조회수 표시 (IP 기반 중복 방지)
- 예상 읽기 시간
- 좋아요 기능 (로그인/비로그인 모두 가능)
- 댓글 시스템 (익명/회원, 대댓글, 비밀 댓글)
- 공지사항 (뱃지, 고정 공지, 페이지네이션)

### SEO

- `/sitemap.xml` - 동적 사이트맵 생성
- `/rss.xml` - RSS 피드
- `/robots.txt` - 검색 엔진 크롤러 설정

## 배포

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/build-deploy-msa.yml
# 환경 선택: dev / prod
# 서비스 선택: build_all, build_web, build_auth, etc.
```

**배포 흐름:**
1. GitHub Actions에서 선택된 서비스 Docker 이미지 빌드
2. GHCR (ghcr.io)에 이미지 푸시
3. GitOps repo (my-k8s-gitops)의 values 파일 이미지 태그 업데이트
4. ArgoCD가 변경 감지하여 자동 배포

### 수동 배포 (GitHub CLI)

```bash
# 모든 서비스 빌드/배포 (Prod)
gh workflow run "Build and Deploy (MSA)" -f environment=prod -f build_all=true

# 특정 서비스만 빌드/배포 (Dev)
gh workflow run "Build and Deploy (MSA)" -f environment=dev -f build_web=true

# 여러 서비스 동시에
gh workflow run "Build and Deploy (MSA)" \
  -f environment=prod \
  -f build_auth=true \
  -f build_blog=true

# 실행 확인
gh run list --limit 3
gh run watch
```

## 로컬 개발

### 사전 요구사항

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose

### 개발 환경 실행

```bash
# 저장소 클론
git clone https://github.com/JaeHeong/jaehyeong-tech.git
cd jaehyeong-tech

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.template .env

# 인프라 서비스 시작 (PostgreSQL, RabbitMQ, Redis)
docker compose up -d

# 개발 서버 실행 (전체)
pnpm dev

# 개별 서비스 실행
pnpm --filter web dev           # Frontend (localhost:5173)
pnpm --filter auth-service dev  # Auth (localhost:3001)
pnpm --filter blog-service dev  # Blog (localhost:3002)
```

### 개발 포트

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Auth Service | http://localhost:3001 |
| Blog Service | http://localhost:3002 |
| Comment Service | http://localhost:3003 |
| Page Service | http://localhost:3004 |
| Analytics Service | http://localhost:3005 |
| Storage Service | http://localhost:3006 |

## 스크립트

```bash
pnpm dev                    # 전체 개발 서버 실행
pnpm build                  # 빌드
pnpm typecheck              # 타입 체크
pnpm lint                   # 린트
pnpm db:migrate             # DB 마이그레이션
pnpm db:generate            # Prisma 클라이언트 생성
```

## 환경 변수

```env
# Database
DATABASE_URL=postgresql://...

# Auth
JWT_PRIVATE_KEY=...  # RS256 Private Key
JWT_PUBLIC_KEY=...   # RS256 Public Key
GOOGLE_CLIENT_ID=...

# Storage (OCI)
OCI_TENANCY=...
OCI_USER=...
OCI_FINGERPRINT=...
OCI_PRIVATE_KEY=...
OCI_REGION=...
OCI_BUCKET_NAME=...

# Message Queue
RABBITMQ_URL=amqp://...

# Service URLs (MSA)
AUTH_SERVICE_URL=http://auth-service:3001
BLOG_SERVICE_URL=http://blog-service:3002
COMMENT_SERVICE_URL=http://comment-service:3003
PAGE_SERVICE_URL=http://page-service:3004
ANALYTICS_SERVICE_URL=http://analytics-service:3005
STORAGE_SERVICE_URL=http://storage-service:3006
```

## 관련 저장소

- **GitOps**: [my-k8s-gitops](https://github.com/JaeHeong/my-k8s-gitops) - Kubernetes 배포 매니페스트

## 라이선스

MIT License
