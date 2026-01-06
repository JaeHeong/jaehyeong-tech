# Jaehyeong Tech Blog

DevOps, MLOps, 클라우드 인프라 등 기술 경험을 기록하는 개인 기술 블로그

**URL**: https://tech.jaehyeong.site

## 기술 스택

### Frontend
- **React 19** - 최신 보안 패치 적용
- **Vite 6** - 빠른 개발 서버 및 빌드
- **TypeScript 5.7** - 타입 안전성
- **Tailwind CSS 3.4** - 반응형 UI
- **React Router 7** - 클라이언트 라우팅

### Backend
- **Node.js 22 LTS** - 런타임
- **Express.js 5** - 웹 프레임워크
- **TypeScript 5.7** - 타입 안전성
- **Prisma 6** - ORM
- **PostgreSQL 16** - 데이터베이스

### Infrastructure
- **Docker & Docker Compose** - 컨테이너화
- **Traefik** - 리버스 프록시 + SSL (Cloudflare DNS)
- **Nginx** - 정적 파일 서빙

## 프로젝트 구조

```
jaehyeong-tech/
├── apps/
│   ├── web/                 # React Frontend
│   │   ├── src/
│   │   │   ├── components/  # 재사용 컴포넌트
│   │   │   ├── pages/       # 페이지 컴포넌트
│   │   │   ├── hooks/       # 커스텀 훅
│   │   │   ├── services/    # API 호출
│   │   │   ├── styles/      # 전역 스타일
│   │   │   └── types/       # 타입 정의
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── api/                 # Express Backend
│       ├── src/
│       │   ├── controllers/ # 요청 핸들러
│       │   ├── routes/      # API 라우트
│       │   ├── services/    # 비즈니스 로직
│       │   └── middleware/  # 미들웨어
│       ├── prisma/
│       │   └── schema.prisma
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   └── shared/              # 공유 타입/유틸리티
│
├── wireframes/              # UI 와이어프레임 (HTML)
├── .env.example
├── pnpm-workspace.yaml
└── package.json             # 워크스페이스 루트
```

## 주요 기능

- [x] 프로젝트 구조 설정
- [x] 반응형 디자인 (모바일/태블릿/데스크톱)
- [x] 다크모드 지원
- [ ] 포스트 CRUD (작성, 조회, 수정, 삭제)
- [ ] 카테고리 및 태그 관리
- [ ] 마크다운 에디터
- [ ] 코드 하이라이팅
- [ ] 검색 기능
- [ ] 조회수/좋아요 추적
- [ ] 관리자 인증

## 시작하기

### 사전 요구사항

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose

### 로컬 개발

```bash
# 저장소 클론
git clone https://github.com/JaeHeong/jaehyeong-tech.git
cd jaehyeong-tech

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env

# PostgreSQL 시작 (Docker) - 로컬 개발용
docker run -d --name tech-db \
  -e POSTGRES_USER=techblog \
  -e POSTGRES_PASSWORD=techblog \
  -e POSTGRES_DB=jaehyeong_tech \
  -p 5433:5432 \
  postgres:16-alpine

# 데이터베이스 마이그레이션
pnpm --filter api db:push
pnpm --filter api db:seed

# 개발 서버 실행
pnpm dev
```

### 프로덕션 배포

```bash
# /home/ubuntu/n8n 디렉토리에서 실행
cd /home/ubuntu/n8n

# 블로그 서비스 빌드 및 실행
docker compose up -d tech-web tech-api tech-db

# DB 마이그레이션 (최초 1회)
docker compose exec tech-api npx prisma migrate deploy
docker compose exec tech-api npx tsx prisma/seed.ts

# 로그 확인
docker compose logs -f tech-web tech-api
```

### 개발 서버 포트

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- PostgreSQL: localhost:5433

## API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인
- `POST /api/auth/register` - 회원가입
- `GET /api/auth/me` - 현재 사용자 정보

### 포스트
- `GET /api/posts` - 포스트 목록
- `GET /api/posts/featured` - 추천 포스트
- `GET /api/posts/:slug` - 포스트 상세
- `POST /api/posts` - 포스트 작성 (인증 필요)
- `PUT /api/posts/:id` - 포스트 수정 (인증 필요)
- `DELETE /api/posts/:id` - 포스트 삭제 (인증 필요)

### 카테고리
- `GET /api/categories` - 카테고리 목록
- `GET /api/categories/:slug` - 카테고리 상세
- `GET /api/categories/:slug/posts` - 카테고리별 포스트

### 태그
- `GET /api/tags` - 태그 목록
- `GET /api/tags/:slug/posts` - 태그별 포스트

## 스크립트

```bash
# 전체 개발 서버 실행
pnpm dev

# Frontend만 실행
pnpm --filter web dev

# Backend만 실행
pnpm --filter api dev

# 빌드
pnpm build

# DB 마이그레이션
pnpm --filter api db:migrate

# DB 시드 데이터
pnpm --filter api db:seed

# Prisma Studio (DB GUI)
pnpm --filter api db:studio
```

## 환경 변수

```env
# Database
DATABASE_URL=postgresql://techblog:techblog@localhost:5433/jaehyeong_tech

# Backend
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key

# Frontend
VITE_API_URL=http://localhost:3000
```

## 라이선스

MIT License
