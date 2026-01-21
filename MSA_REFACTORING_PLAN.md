# Full MSA 리팩토링 계획서

## 목차
1. [개요](#개요)
2. [현재 아키텍처 분석](#현재-아키텍처-분석)
3. [목표 MSA 아키텍처](#목표-msa-아키텍처)
4. [백엔드 마이크로서비스 분리](#백엔드-마이크로서비스-분리)
5. [Micro Frontends 아키텍처](#micro-frontends-아키텍처)
6. [서비스 간 통신 전략](#서비스-간-통신-전략)
7. [데이터베이스 분리 전략](#데이터베이스-분리-전략)
8. [API Gateway 및 인증](#api-gateway-및-인증)
9. [인프라 및 배포 전략](#인프라-및-배포-전략)
10. [마이그레이션 로드맵](#마이그레이션-로드맵)

---

## 개요

### 현재 상태
- **아키텍처**: 모노레포 + 분리된 프론트엔드/백엔드
- **백엔드**: 단일 Express.js 애플리케이션 (21개 라우터)
- **프론트엔드**: 단일 React SPA (30+ 페이지)
- **데이터베이스**: 단일 PostgreSQL 인스턴스
- **배포**: Docker + Kubernetes + GitOps

### 목표
- **Full MSA**: 도메인 기반 마이크로서비스 분리
- **Micro Frontends**: 페이지/도메인 기반 프론트엔드 분리
- **독립 배포**: 각 서비스의 독립적인 배포 파이프라인
- **확장성**: 수평적 확장 가능한 아키텍처
- **장애 격리**: 서비스 장애가 전체 시스템에 영향을 주지 않도록

---

## 현재 아키텍처 분석

### 도메인 식별
분석 결과 6개의 주요 비즈니스 도메인이 식별되었습니다:

1. **블로깅 도메인**: Post, Category, Tag, Draft
2. **콘텐츠 상호작용 도메인**: Comment, Like, Bookmark
3. **사용자 관리 도메인**: User, Auth
4. **페이지 관리 도메인**: Page, Notice
5. **분석 및 통계 도메인**: Analytics, Stats, Visitors
6. **저장소 도메인**: Image, Backup (OCI)

### 현재 문제점
- **확장성 제한**: 단일 서비스로 인한 수평 확장 제약
- **배포 리스크**: 한 기능 변경이 전체 시스템 재배포 필요
- **기술 종속**: 단일 기술 스택 (Express + React)
- **장애 전파**: 한 기능의 장애가 전체 시스템 영향
- **팀 협업 제약**: 단일 코드베이스에서 작업 충돌

---

## 목표 MSA 아키텍처

### 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Traefik / Nginx      │
                    │   (Reverse Proxy)      │
                    └───────────┬────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
    ┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
    │  Micro Frontend │  │ Micro Frontend│  │ Micro Frontend │
    │    Container    │  │   Container   │  │   Container   │
    │  (Shell App)    │  │ (Blog Module) │  │ (Admin Module)│
    └────────┬────────┘  └───────┬───────┘  └────────┬───────┘
             │                   │                    │
             └───────────────────┼────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     API Gateway         │
                    │   (Kong / Traefik)      │
                    │  + Authentication       │
                    │  + Rate Limiting        │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼────────┐   ┌───────▼────────┐   ┌───────▼────────┐
│  Auth Service  │   │  Blog Service  │   │ Content Service│
│  (User + JWT)  │   │(Post+Category) │   │(Comment+Like)  │
│   Port: 3001   │   │   Port: 3002   │   │   Port: 3003   │
└───────┬────────┘   └───────┬────────┘   └───────┬────────┘
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐         ┌────▼────┐
   │   DB    │          │   DB    │         │   DB    │
   │ (Users) │          │ (Posts) │         │(Comments)│
   └─────────┘          └─────────┘         └─────────┘

┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Page Service │   │Analytics Svc  │   │ Storage Svc   │
│ (Notice+Page) │   │(Stats+Views)  │   │(Image+Backup) │
│  Port: 3004   │   │  Port: 3005   │   │  Port: 3006   │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
   ┌────▼────┐         ┌────▼────┐        ┌────▼────┐
   │   DB    │         │   DB    │        │   OCI   │
   │ (Pages) │         │ (Views) │        │ Storage │
   └─────────┘         └─────────┘        └─────────┘

        ┌────────────────────────────────┐
        │    Message Queue (RabbitMQ)    │
        │  - Event Bus for Services      │
        └────────────────────────────────┘

        ┌────────────────────────────────┐
        │    Cache Layer (Redis)         │
        │  - Session, Cache, Rate Limit  │
        └────────────────────────────────┘
```

---

## 백엔드 마이크로서비스 분리

### 1. Auth Service (인증/사용자 관리 서비스)

**책임**:
- 사용자 등록/로그인
- JWT 토큰 발급 및 검증
- Google OAuth 처리
- 사용자 프로필 관리
- 역할 기반 접근 제어 (RBAC)

**API 엔드포인트**:
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/google
GET    /api/auth/me
PUT    /api/auth/profile
GET    /api/auth/validate-token
POST   /api/auth/refresh-token
GET    /api/users
PUT    /api/users/:id/status
GET    /api/author
```

**데이터베이스 스키마**:
```sql
User {
  id, email, password, googleId,
  name, avatar, bio,
  role (USER/ADMIN),
  status (ACTIVE/SUSPENDED),
  createdAt, updatedAt
}
```

**외부 의존성**:
- Google OAuth API
- Redis (세션 캐시)

**포트**: 3001

---

### 2. Blog Service (블로그 콘텐츠 서비스)

**책임**:
- 포스트 CRUD
- 카테고리/태그 관리
- 임시 저장 (Draft) 관리
- 추천 포스트 알고리즘
- 관련 포스트 추천
- 읽기 시간 계산

**API 엔드포인트**:
```
GET    /api/posts
GET    /api/posts/:slug
POST   /api/posts
PUT    /api/posts/:slug
DELETE /api/posts/:slug
GET    /api/posts/featured
GET    /api/posts/:slug/adjacent
GET    /api/posts/:slug/related

GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id

GET    /api/tags
POST   /api/tags
PUT    /api/tags/:id
DELETE /api/tags/:id

GET    /api/drafts
POST   /api/drafts
PUT    /api/drafts/:id
DELETE /api/drafts/:id
POST   /api/drafts/:id/publish
```

**데이터베이스 스키마**:
```sql
Post {
  id, slug, title, excerpt, content,
  coverImage, authorId (FK),
  categoryId (FK),
  viewCount, likeCount, readingTime,
  status (DRAFT/PUBLIC/PRIVATE),
  featured, publishedAt
}

Category {
  id, name, slug, description,
  icon, color, postCount
}

Tag {
  id, name, slug
}

PostTag {
  postId (FK), tagId (FK)
}

Draft {
  id, title, content, excerpt,
  coverImage, categoryId, tagIds[],
  authorId (FK), createdAt, updatedAt
}
```

**이벤트 발행**:
- `post.created`: 새 포스트 생성 시
- `post.updated`: 포스트 수정 시
- `post.deleted`: 포스트 삭제 시
- `post.published`: Draft → Post 발행 시

**포트**: 3002

---

### 3. Content Interaction Service (콘텐츠 상호작용 서비스)

**책임**:
- 댓글 작성/수정/삭제 (계층 구조)
- 좋아요 토글 (로그인/비로그인)
- 북마크 관리
- IP 기반 스팸 방지
- 비밀 댓글 처리

**API 엔드포인트**:
```
GET    /api/comments/post/:postId
POST   /api/comments
PUT    /api/comments/:id
DELETE /api/comments/:id

POST   /api/likes/:postId/toggle
GET    /api/likes/:postId/status

GET    /api/bookmarks
POST   /api/bookmarks/:postId
DELETE /api/bookmarks/:postId
```

**데이터베이스 스키마**:
```sql
Comment {
  id, content, postId (FK),
  authorId (FK, nullable),
  guestName, guestPassword (hashed),
  parentId (Self FK),
  isPrivate, isDeleted,
  createdAt, updatedAt
}

Like {
  id, postId (FK),
  userId (FK, nullable),
  ipHash, createdAt
}

Bookmark {
  id, postId (FK),
  userId (FK), createdAt
}
```

**이벤트 구독**:
- `post.deleted`: 연관 댓글/좋아요/북마크 삭제

**이벤트 발행**:
- `comment.created`: 포스트 통계 업데이트
- `like.toggled`: 포스트 likeCount 업데이트

**포트**: 3003

---

### 4. Page Service (페이지 관리 서비스)

**책임**:
- 공지사항 관리
- 정적 페이지 관리
- 페이지 타입 관리 (STATIC/NOTICE)
- 고정 페이지 (Pinned)
- 뱃지 관리

**API 엔드포인트**:
```
GET    /api/pages
GET    /api/pages/:slug
POST   /api/pages
PUT    /api/pages/:id
DELETE /api/pages/:id
GET    /api/pages/notices
```

**데이터베이스 스키마**:
```sql
Page {
  id, slug, title,
  type (STATIC/NOTICE),
  content, status (DRAFT/PUBLISHED),
  badge, isPinned, template,
  authorId (FK), createdAt, updatedAt
}
```

**이벤트 발행**:
- `page.created`
- `page.updated`
- `page.deleted`

**포트**: 3004

---

### 5. Analytics Service (분석 및 통계 서비스)

**책임**:
- 조회수 추적 (IP 기반 중복 제거)
- 방문자 통계
- 대시보드 통계 (포스트, 댓글, 좋아요 수)
- Google Analytics API 연동
- 버그 리포트 관리

**API 엔드포인트**:
```
POST   /api/views/post/:postId
POST   /api/views/page/:pageId
GET    /api/visitors
GET    /api/stats
GET    /api/analytics/realtime
GET    /api/analytics/pageviews

GET    /api/bug-reports
POST   /api/bug-reports
PUT    /api/bug-reports/:id/response
```

**데이터베이스 스키마**:
```sql
PostView {
  id, postId (FK),
  ipHash, createdAt
}

PageView {
  id, pageId (FK),
  ipHash, createdAt
}

SiteVisitor {
  id, ipHash, date (UNIQUE)
}

BugReport {
  id, title, description,
  category, priority,
  status (PENDING/IN_PROGRESS/RESOLVED),
  adminResponse, respondedAt,
  createdAt
}
```

**이벤트 구독**:
- `post.created`: 통계 업데이트
- `post.deleted`: 조회수 데이터 정리
- `comment.created`: 댓글 수 통계 업데이트

**외부 의존성**:
- Google Analytics API

**포트**: 3005

---

### 6. Storage Service (저장소 서비스)

**책임**:
- 이미지 업로드/다운로드/삭제
- 썸네일 생성 (Sharp)
- 고아 이미지 정리 (24시간 미사용)
- 데이터 백업/복원 (JSON)
- OCI Object Storage 통합

**API 엔드포인트**:
```
POST   /api/upload
DELETE /api/images/:id
GET    /api/images/orphans
DELETE /api/images/orphans

POST   /api/backups
GET    /api/backups
POST   /api/backups/:id/restore
```

**데이터베이스 스키마**:
```sql
Image {
  id, url, objectName (OCI),
  filename, size, mimetype,
  folder, postId (FK, nullable),
  createdAt, updatedAt
}
```

**이벤트 구독**:
- `post.created`: 이미지 postId 매핑
- `post.deleted`: 연관 이미지 삭제

**외부 의존성**:
- OCI Object Storage

**포트**: 3006

---

### 7. API Gateway (Kong / Traefik / Express Gateway)

**책임**:
- 라우팅 및 로드 밸런싱
- 인증/인가 (JWT 검증)
- Rate Limiting
- CORS 처리
- 요청/응답 로깅
- 서킷 브레이커

**라우팅 규칙**:
```
/api/auth/*        → Auth Service (3001)
/api/users/*       → Auth Service (3001)
/api/posts/*       → Blog Service (3002)
/api/categories/*  → Blog Service (3002)
/api/tags/*        → Blog Service (3002)
/api/drafts/*      → Blog Service (3002)
/api/comments/*    → Content Service (3003)
/api/likes/*       → Content Service (3003)
/api/bookmarks/*   → Content Service (3003)
/api/pages/*       → Page Service (3004)
/api/views/*       → Analytics Service (3005)
/api/stats/*       → Analytics Service (3005)
/api/analytics/*   → Analytics Service (3005)
/api/visitors/*    → Analytics Service (3005)
/api/bug-reports/* → Analytics Service (3005)
/api/upload/*      → Storage Service (3006)
/api/images/*      → Storage Service (3006)
/api/backups/*     → Storage Service (3006)
```

**인증 플로우**:
1. 클라이언트 → API Gateway (JWT in Authorization Header)
2. Gateway → Auth Service (Token Validation)
3. Gateway → Target Service (with User Context)

**포트**: 8080

---

## Micro Frontends 아키텍처

### Module Federation vs Single-SPA

**추천: Module Federation (Webpack 5 / Vite Federation)**

이유:
- Vite 기반 프로젝트와 호환성
- 런타임 통합
- 독립 배포 가능
- 공유 의존성 관리

### Micro Frontend 분리 전략

```
┌─────────────────────────────────────────────────────────────┐
│                    Shell App (Container)                     │
│  - 라우팅 오케스트레이션                                      │
│  - 공유 컨텍스트 (Auth, Theme)                                │
│  - 공통 컴포넌트 (Header, Footer)                             │
│  Port: 3000                                                  │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼─────┐ ┌──▼───────┐ ┌─▼──────────┐
│  Blog MFE   │ │ Admin MFE│ │  User MFE  │
│  Port: 3100 │ │Port: 3200│ │ Port: 3300 │
└─────────────┘ └──────────┘ └────────────┘
```

---

### 1. Shell App (Container Application)

**책임**:
- 애플리케이션 쉘 (Header, Footer, Navigation)
- 라우팅 오케스트레이션
- 인증 컨텍스트 공유
- 테마 관리 (다크모드)
- 에러 바운더리

**포함 컴포넌트**:
- `Header.tsx`
- `Footer.tsx`
- `Sidebar.tsx` (공통)
- `MobileProfileModal.tsx`
- `AuthContext.tsx`
- `ModalContext.tsx`
- `ToastContext.tsx`

**라우팅**:
```tsx
<Routes>
  <Route path="/" element={<BlogMFE />} />
  <Route path="/posts/*" element={<BlogMFE />} />
  <Route path="/categories/*" element={<BlogMFE />} />
  <Route path="/search" element={<BlogMFE />} />

  <Route path="/admin/*" element={<AdminMFE />} />

  <Route path="/my/*" element={<UserMFE />} />
  <Route path="/login" element={<UserMFE />} />
</Routes>
```

**공유 모듈**:
```javascript
// vite.config.ts
export default defineConfig({
  plugins: [
    federation({
      name: 'shell',
      remotes: {
        blog: 'http://localhost:3100/assets/remoteEntry.js',
        admin: 'http://localhost:3200/assets/remoteEntry.js',
        user: 'http://localhost:3300/assets/remoteEntry.js',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'react-router-dom': { singleton: true },
      },
    }),
  ],
});
```

**배포**: `ghcr.io/jaehyeong/mfe-shell:tag`

---

### 2. Blog MFE (블로그 모듈)

**책임**:
- 포스트 목록/상세
- 카테고리/태그 필터링
- 검색
- 댓글 섹션
- 좋아요/북마크
- 공지사항

**포함 페이지**:
- `HomePage`
- `PostListPage`
- `PostDetailPage`
- `CategoryPage`
- `SearchPage`
- `NoticePage`

**포함 컴포넌트**:
- `CommentSection.tsx`
- `PostCard.tsx`
- `PostMetadata.tsx`
- `RelatedPosts.tsx`
- `AdjacentPosts.tsx`

**라우팅**:
```tsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/posts" element={<PostListPage />} />
  <Route path="/posts/:slug" element={<PostDetailPage />} />
  <Route path="/categories/:slug" element={<CategoryPage />} />
  <Route path="/search" element={<SearchPage />} />
  <Route path="/notices" element={<NoticePage />} />
</Routes>
```

**Federation 설정**:
```javascript
// vite.config.ts
export default defineConfig({
  plugins: [
    federation({
      name: 'blog',
      filename: 'remoteEntry.js',
      exposes: {
        './BlogRouter': './src/BlogRouter.tsx',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'react-router-dom': { singleton: true },
      },
    }),
  ],
  build: {
    target: 'esnext',
  },
});
```

**배포**: `ghcr.io/jaehyeong/mfe-blog:tag`

**포트**: 3100

---

### 3. Admin MFE (관리자 모듈)

**책임**:
- 대시보드
- 포스트/카테고리/태그 관리
- 댓글 관리
- 사용자 관리
- 분석 대시보드
- 백업/복원

**포함 페이지**:
- `AdminDashboardPage`
- `AdminPostsPage`
- `AdminPostEditorPage` (TipTap 에디터)
- `AdminDraftsPage`
- `AdminCategoriesPage`
- `AdminTagsPage`
- `AdminCommentsPage`
- `AdminUsersPage`
- `AdminPagesPage`
- `AdminAnalyticsPage`
- `AdminManagementPage`

**포함 컴포넌트**:
- `TipTapEditor.tsx` (145KB)
- `AdminLayout.tsx`
- `RadialWheelMenu.tsx`
- `DashboardStats.tsx`

**라우팅**:
```tsx
<Routes>
  <Route path="/admin" element={<AdminDashboardPage />} />
  <Route path="/admin/posts" element={<AdminPostsPage />} />
  <Route path="/admin/posts/new" element={<AdminPostEditorPage />} />
  <Route path="/admin/posts/edit/:slug" element={<AdminPostEditorPage />} />
  <Route path="/admin/drafts" element={<AdminDraftsPage />} />
  <Route path="/admin/categories" element={<AdminCategoriesPage />} />
  <Route path="/admin/tags" element={<AdminTagsPage />} />
  <Route path="/admin/comments" element={<AdminCommentsPage />} />
  <Route path="/admin/users" element={<AdminUsersPage />} />
  <Route path="/admin/pages" element={<AdminPagesPage />} />
  <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
  <Route path="/admin/management" element={<AdminManagementPage />} />
</Routes>
```

**Federation 설정**:
```javascript
// vite.config.ts
export default defineConfig({
  plugins: [
    federation({
      name: 'admin',
      filename: 'remoteEntry.js',
      exposes: {
        './AdminRouter': './src/AdminRouter.tsx',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'react-router-dom': { singleton: true },
        '@tiptap/react': { singleton: true },
      },
    }),
  ],
});
```

**배포**: `ghcr.io/jaehyeong/mfe-admin:tag`

**포트**: 3200

---

### 4. User MFE (사용자 모듈)

**책임**:
- 로그인/회원가입
- 프로필 관리
- 북마크 목록
- 내 댓글
- 설정

**포함 페이지**:
- `LoginPage`
- `MyBookmarksPage`
- `MyCommentsPage`
- `MySettingsPage`
- `BugReportPage`
- `BugReportListPage`

**라우팅**:
```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/my/bookmarks" element={<MyBookmarksPage />} />
  <Route path="/my/comments" element={<MyCommentsPage />} />
  <Route path="/my/settings" element={<MySettingsPage />} />
  <Route path="/bug-report" element={<BugReportPage />} />
  <Route path="/bug-reports" element={<BugReportListPage />} />
</Routes>
```

**Federation 설정**:
```javascript
// vite.config.ts
export default defineConfig({
  plugins: [
    federation({
      name: 'user',
      filename: 'remoteEntry.js',
      exposes: {
        './UserRouter': './src/UserRouter.tsx',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'react-router-dom': { singleton: true },
      },
    }),
  ],
});
```

**배포**: `ghcr.io/jaehyeong/mfe-user:tag`

**포트**: 3300

---

### 공유 패키지 (`packages/shared`)

**목적**: 타입, 유틸리티, 공통 컴포넌트 공유

**구조**:
```
packages/shared/
├── types/
│   ├── api.ts          # API 요청/응답 타입
│   ├── models.ts       # 데이터 모델 타입
│   └── index.ts
├── utils/
│   ├── dateFormat.ts
│   ├── readingTime.ts
│   └── index.ts
├── components/
│   ├── Button.tsx
│   ├── Modal.tsx
│   ├── Toast.tsx
│   └── index.ts
└── package.json
```

**사용 예시**:
```typescript
// apps/mfe-blog/src/pages/PostDetailPage.tsx
import { Post, ApiResponse } from '@jaehyeong-tech/shared/types';
import { formatDate } from '@jaehyeong-tech/shared/utils';
```

---

## 서비스 간 통신 전략

### 1. 동기 통신: REST API

**사용 시나리오**:
- 클라이언트 → API Gateway → 마이크로서비스
- 즉시 응답이 필요한 경우

**장점**:
- 간단한 구현
- 즉각적인 응답
- HTTP 표준 활용

**단점**:
- 타이트한 결합
- 서비스 장애 전파

**예시**:
```typescript
// Blog Service에서 Author 정보 조회
const author = await fetch('http://auth-service:3001/api/users/' + authorId);
```

---

### 2. 비동기 통신: 이벤트 기반 (RabbitMQ / Kafka)

**추천: RabbitMQ**

이유:
- 소규모 MSA에 적합
- 간단한 설정
- 메시지 보장
- 재시도 메커니즘

**이벤트 플로우**:

```
┌──────────────┐    post.created    ┌─────────────────┐
│ Blog Service ├───────────────────→│   RabbitMQ      │
└──────────────┘                    │  Exchange/Queue │
                                    └────────┬────────┘
                                             │
                        ┌────────────────────┼────────────────┐
                        │                    │                │
                   ┌────▼───────┐   ┌───────▼──────┐  ┌──────▼──────┐
                   │ Analytics  │   │   Storage    │  │   Content   │
                   │  Service   │   │   Service    │  │   Service   │
                   │ (조회수 초기화)│   │(이미지 매핑) │  │(통계 업데이트)│
                   └────────────┘   └──────────────┘  └─────────────┘
```

**이벤트 정의**:

```typescript
// packages/shared/events/post.events.ts
export enum PostEvent {
  CREATED = 'post.created',
  UPDATED = 'post.updated',
  DELETED = 'post.deleted',
  PUBLISHED = 'post.published',
}

export interface PostCreatedEvent {
  postId: string;
  slug: string;
  authorId: string;
  categoryId: string;
  coverImage?: string;
  publishedAt: Date;
}

export interface PostDeletedEvent {
  postId: string;
  slug: string;
}
```

**Publisher 예시 (Blog Service)**:

```typescript
// apps/blog-service/src/events/publisher.ts
import amqp from 'amqplib';

export class EventPublisher {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async connect() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange('blog-events', 'topic', { durable: true });
  }

  async publishPostCreated(event: PostCreatedEvent) {
    this.channel.publish(
      'blog-events',
      'post.created',
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    );
  }
}
```

**Subscriber 예시 (Analytics Service)**:

```typescript
// apps/analytics-service/src/events/subscriber.ts
import amqp from 'amqplib';

export class EventSubscriber {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async connect() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('blog-events', 'topic', { durable: true });
    const q = await this.channel.assertQueue('analytics-queue', { durable: true });

    await this.channel.bindQueue(q.queue, 'blog-events', 'post.*');

    this.channel.consume(q.queue, async (msg) => {
      if (msg) {
        const event = JSON.parse(msg.content.toString());

        if (msg.fields.routingKey === 'post.created') {
          await this.handlePostCreated(event);
        }

        this.channel.ack(msg);
      }
    });
  }

  private async handlePostCreated(event: PostCreatedEvent) {
    // 조회수 초기화 로직
    console.log('Post created:', event.postId);
  }
}
```

---

### 3. 서비스 간 직접 호출 (Internal API)

**사용 시나리오**:
- 긴급한 데이터 조회
- 트랜잭션 필요 시

**보안**: 내부 네트워크에서만 접근, API Key 인증

**예시**:
```typescript
// Content Service에서 Post 존재 여부 확인
const postExists = await fetch(
  'http://blog-service:3002/internal/posts/' + postId + '/exists',
  { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
);
```

---

### 4. 캐싱 전략 (Redis)

**캐싱 대상**:
- 카테고리 목록 (TTL: 1시간)
- 태그 목록 (TTL: 1시간)
- 사용자 프로필 (TTL: 30분)
- 포스트 조회수 (TTL: 5분, Write-back)

**예시**:
```typescript
// Blog Service에서 카테고리 캐싱
async getCategories() {
  const cached = await redis.get('categories:all');
  if (cached) return JSON.parse(cached);

  const categories = await prisma.category.findMany();
  await redis.setex('categories:all', 3600, JSON.stringify(categories));

  return categories;
}
```

---

## 데이터베이스 분리 전략

### 원칙: Database per Service

각 마이크로서비스는 자신의 데이터베이스를 소유합니다.

### 데이터베이스 분리 맵

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│ Auth Service   │     │ Blog Service   │     │ Content Svc    │
│                │     │                │     │                │
│ PostgreSQL     │     │ PostgreSQL     │     │ PostgreSQL     │
│ auth_db        │     │ blog_db        │     │ content_db     │
│                │     │                │     │                │
│ - User         │     │ - Post         │     │ - Comment      │
│                │     │ - Category     │     │ - Like         │
│                │     │ - Tag          │     │ - Bookmark     │
│                │     │ - PostTag      │     │                │
│                │     │ - Draft        │     │                │
└────────────────┘     └────────────────┘     └────────────────┘

┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│ Page Service   │     │ Analytics Svc  │     │ Storage Svc    │
│                │     │                │     │                │
│ PostgreSQL     │     │ PostgreSQL     │     │ PostgreSQL     │
│ page_db        │     │ analytics_db   │     │ storage_db     │
│                │     │                │     │                │
│ - Page         │     │ - PostView     │     │ - Image        │
│                │     │ - PageView     │     │                │
│                │     │ - SiteVisitor  │     │ OCI Object     │
│                │     │ - BugReport    │     │ Storage        │
└────────────────┘     └────────────────┘     └────────────────┘
```

---

### 데이터 일관성 문제 해결

#### 문제 1: Post 삭제 시 관련 데이터 정리

**시나리오**:
Blog Service에서 포스트를 삭제하면, Content Service의 댓글, Like, Bookmark도 삭제해야 함.

**해결책: Saga 패턴 (Choreography)**

```typescript
// Blog Service
async deletePost(postId: string) {
  // 1. Post 삭제
  await prisma.post.delete({ where: { id: postId } });

  // 2. 이벤트 발행
  await eventPublisher.publishPostDeleted({ postId });
}

// Content Service (구독)
async handlePostDeleted(event: PostDeletedEvent) {
  await prisma.comment.deleteMany({ where: { postId: event.postId } });
  await prisma.like.deleteMany({ where: { postId: event.postId } });
  await prisma.bookmark.deleteMany({ where: { postId: event.postId } });
}

// Analytics Service (구독)
async handlePostDeleted(event: PostDeletedEvent) {
  await prisma.postView.deleteMany({ where: { postId: event.postId } });
}

// Storage Service (구독)
async handlePostDeleted(event: PostDeletedEvent) {
  const images = await prisma.image.findMany({ where: { postId: event.postId } });
  for (const img of images) {
    await ociClient.deleteObject(img.objectName);
    await prisma.image.delete({ where: { id: img.id } });
  }
}
```

---

#### 문제 2: 포스트 목록에 Author 정보 표시

**시나리오**:
Blog Service의 Post에는 authorId만 있고, User 정보는 Auth Service에 있음.

**해결책 1: API Composition (Backend for Frontend)**

```typescript
// API Gateway 또는 BFF
async getPostsWithAuthors(limit: number) {
  // 1. Blog Service에서 포스트 조회
  const posts = await fetch('http://blog-service:3002/api/posts?limit=' + limit);

  // 2. Author ID 추출
  const authorIds = [...new Set(posts.map(p => p.authorId))];

  // 3. Auth Service에서 Author 정보 조회
  const authors = await fetch('http://auth-service:3001/api/users?ids=' + authorIds.join(','));

  // 4. 조합
  const postsWithAuthors = posts.map(post => ({
    ...post,
    author: authors.find(a => a.id === post.authorId),
  }));

  return postsWithAuthors;
}
```

**해결책 2: 데이터 복제 (CQRS)**

```typescript
// Blog Service에서 Author 정보 일부 복제
Post {
  id, slug, title, content,
  authorId,
  authorName,    // 복제
  authorAvatar,  // 복제
}

// Auth Service에서 사용자 정보 변경 시 이벤트 발행
async updateProfile(userId: string, data: ProfileUpdateData) {
  await prisma.user.update({ where: { id: userId }, data });

  // 이벤트 발행
  await eventPublisher.publishUserProfileUpdated({
    userId,
    name: data.name,
    avatar: data.avatar,
  });
}

// Blog Service에서 구독하여 Author 정보 업데이트
async handleUserProfileUpdated(event: UserProfileUpdatedEvent) {
  await prisma.post.updateMany({
    where: { authorId: event.userId },
    data: {
      authorName: event.name,
      authorAvatar: event.avatar,
    },
  });
}
```

**추천: 해결책 2 (CQRS)**
- 이유: 읽기 성능 최적화, API Gateway 부하 감소

---

#### 문제 3: 좋아요 수 업데이트

**시나리오**:
Content Service에서 좋아요가 토글되면 Blog Service의 Post.likeCount를 업데이트해야 함.

**해결책: 이벤트 기반 업데이트**

```typescript
// Content Service
async toggleLike(postId: string, userId: string, ipHash: string) {
  const existing = await prisma.like.findFirst({
    where: { postId, userId, ipHash },
  });

  let delta = 0;
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    delta = -1;
  } else {
    await prisma.like.create({ data: { postId, userId, ipHash } });
    delta = 1;
  }

  // 이벤트 발행
  await eventPublisher.publishLikeToggled({ postId, delta });
}

// Blog Service
async handleLikeToggled(event: LikeToggledEvent) {
  await prisma.post.update({
    where: { id: event.postId },
    data: { likeCount: { increment: event.delta } },
  });
}
```

---

### 마이그레이션 전략

#### Phase 1: Schema 복사

```sql
-- 현재 단일 DB에서 각 서비스별 DB로 스키마 복사
CREATE DATABASE auth_db;
CREATE DATABASE blog_db;
CREATE DATABASE content_db;
CREATE DATABASE page_db;
CREATE DATABASE analytics_db;
CREATE DATABASE storage_db;

-- auth_db
CREATE TABLE "User" AS SELECT * FROM main_db."User";

-- blog_db
CREATE TABLE "Post" AS SELECT * FROM main_db."Post";
CREATE TABLE "Category" AS SELECT * FROM main_db."Category";
CREATE TABLE "Tag" AS SELECT * FROM main_db."Tag";
CREATE TABLE "PostTag" AS SELECT * FROM main_db."PostTag";
CREATE TABLE "Draft" AS SELECT * FROM main_db."Draft";

-- 나머지 동일...
```

#### Phase 2: 이중 쓰기 (Dual Write)

```typescript
// 마이그레이션 기간 동안 두 DB에 동시 쓰기
async createPost(data: PostCreateData) {
  // 1. 기존 DB에 쓰기
  await mainDb.post.create({ data });

  // 2. 새 DB에 쓰기 (실패해도 롤백 안 함)
  try {
    await blogDb.post.create({ data });
  } catch (error) {
    logger.error('Failed to write to blog_db:', error);
  }
}
```

#### Phase 3: 읽기 전환

```typescript
// 새 DB에서 읽기 시작
async getPost(slug: string) {
  return await blogDb.post.findUnique({ where: { slug } });
}
```

#### Phase 4: 기존 DB 제거

```typescript
// 이중 쓰기 제거, 새 DB만 사용
async createPost(data: PostCreateData) {
  return await blogDb.post.create({ data });
}
```

---

## API Gateway 및 인증

### API Gateway 선택: Kong

**이유**:
- 풍부한 플러그인 생태계
- JWT 플러그인 내장
- Rate Limiting, CORS 플러그인
- Declarative Configuration (YAML)
- Kubernetes Ingress Controller 지원

---

### Kong 설정 예시

```yaml
# kong.yaml
_format_version: "3.0"

services:
  - name: auth-service
    url: http://auth-service:3001
    routes:
      - name: auth-routes
        paths:
          - /api/auth
          - /api/users
    plugins:
      - name: rate-limiting
        config:
          minute: 100
          policy: local

  - name: blog-service
    url: http://blog-service:3002
    routes:
      - name: blog-routes
        paths:
          - /api/posts
          - /api/categories
          - /api/tags
          - /api/drafts
    plugins:
      - name: jwt
        config:
          secret_is_base64: false
          claims_to_verify:
            - exp
      - name: rate-limiting
        config:
          minute: 200

  - name: content-service
    url: http://content-service:3003
    routes:
      - name: content-routes
        paths:
          - /api/comments
          - /api/likes
          - /api/bookmarks
    plugins:
      - name: jwt
        config:
          anonymous: true  # 비로그인 사용자 허용

  - name: storage-service
    url: http://storage-service:3006
    routes:
      - name: storage-routes
        paths:
          - /api/upload
          - /api/images
    plugins:
      - name: jwt
      - name: request-size-limiting
        config:
          allowed_payload_size: 10  # 10MB

plugins:
  - name: cors
    config:
      origins:
        - "*"
      methods:
        - GET
        - POST
        - PUT
        - DELETE
        - PATCH
      headers:
        - Accept
        - Authorization
        - Content-Type
      exposed_headers:
        - X-Auth-Token
      credentials: true
      max_age: 3600
```

---

### JWT 인증 플로우

```
┌─────────┐                                    ┌────────────────┐
│ Client  │                                    │ Auth Service   │
└────┬────┘                                    └────────┬───────┘
     │                                                  │
     │ 1. POST /api/auth/login                         │
     │   { email, password }                           │
     ├────────────────────────────────────────────────►│
     │                                                  │
     │                                         2. 검증 및 JWT 발급
     │                                                  │
     │ 3. { token, user }                              │
     │◄────────────────────────────────────────────────┤
     │                                                  │
┌────▼────┐                                    ┌───────┴────────┐
│ Client  │                                    │  Kong Gateway  │
│(JWT저장)│                                    └────────┬───────┘
└────┬────┘                                             │
     │                                                  │
     │ 4. GET /api/posts                               │
     │    Authorization: Bearer <JWT>                  │
     ├─────────────────────────────────────────────────►│
     │                                                  │
     │                                         5. JWT 검증
     │                                         (Kong JWT Plugin)
     │                                                  │
     │                                         6. 유효하면 전달
     │                                                  │
     │                                        ┌─────────▼────────┐
     │                                        │  Blog Service    │
     │                                        │                  │
     │                                        │ 7. 요청 처리     │
     │                                        │   (User Context  │
     │                                        │    in Header)    │
     │                                        └─────────┬────────┘
     │                                                  │
     │ 8. { posts: [...] }                             │
     │◄─────────────────────────────────────────────────┤
     │                                                  │
```

---

### 서비스 간 사용자 컨텍스트 전달

```typescript
// Kong이 JWT를 검증하고 헤더에 사용자 정보 추가
// X-User-Id: <userId>
// X-User-Role: <role>

// Blog Service에서 사용자 정보 추출
app.get('/api/posts', (req, res) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (userRole === 'ADMIN') {
    // 관리자는 비공개 포스트도 조회 가능
  }

  // ...
});
```

---

## 인프라 및 배포 전략

### Kubernetes 아키텍처

```yaml
# 네임스페이스 분리
jaehyeong-tech-dev/
  ├── auth-service (Deployment + Service)
  ├── blog-service (Deployment + Service)
  ├── content-service (Deployment + Service)
  ├── page-service (Deployment + Service)
  ├── analytics-service (Deployment + Service)
  ├── storage-service (Deployment + Service)
  ├── kong-gateway (Deployment + Service)
  ├── rabbitmq (StatefulSet + Service)
  ├── redis (StatefulSet + Service)
  ├── mfe-shell (Deployment + Service)
  ├── mfe-blog (Deployment + Service)
  ├── mfe-admin (Deployment + Service)
  ├── mfe-user (Deployment + Service)
  └── traefik-ingress (Ingress Controller)

jaehyeong-tech-prod/
  └── (동일 구조)
```

---

### Helm Chart 구조

```
charts/jaehyeong-tech/
├── Chart.yaml
├── values-dev.yaml
├── values-prod.yaml
├── templates/
│   ├── auth-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── blog-service/
│   │   └── (동일 구조)
│   ├── content-service/
│   │   └── (동일 구조)
│   ├── kong/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kong-config.yaml
│   ├── rabbitmq/
│   │   ├── statefulset.yaml
│   │   └── service.yaml
│   ├── redis/
│   │   ├── statefulset.yaml
│   │   └── service.yaml
│   ├── mfe-shell/
│   │   └── (동일 구조)
│   ├── mfe-blog/
│   │   └── (동일 구조)
│   ├── mfe-admin/
│   │   └── (동일 구조)
│   └── mfe-user/
│       └── (동일 구조)
└── README.md
```

---

### Deployment 예시 (Auth Service)

```yaml
# templates/auth-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: {{ .Values.namespace }}
spec:
  replicas: {{ .Values.authService.replicas }}
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
        version: {{ .Values.authService.version }}
    spec:
      containers:
        - name: auth-service
          image: ghcr.io/jaehyeong/auth-service:{{ .Values.authService.version }}
          ports:
            - containerPort: 3001
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: auth-service-secret
                  key: database-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: auth-service-secret
                  key: jwt-secret
            - name: GOOGLE_CLIENT_ID
              valueFrom:
                configMapKeyRef:
                  name: auth-service-config
                  key: google-client-id
            - name: RABBITMQ_URL
              value: "amqp://rabbitmq:5672"
            - name: REDIS_URL
              value: "redis://redis:6379"
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
              path: /ready
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
```

---

### Service 예시

```yaml
# templates/auth-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: {{ .Values.namespace }}
spec:
  selector:
    app: auth-service
  ports:
    - protocol: TCP
      port: 3001
      targetPort: 3001
  type: ClusterIP
```

---

### Ingress 예시 (Traefik)

```yaml
# templates/ingress.yaml
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: jaehyeong-tech-ingress
  namespace: {{ .Values.namespace }}
spec:
  entryPoints:
    - websecure
  routes:
    # API Gateway로 라우팅
    - match: Host(`{{ .Values.domain }}`) && PathPrefix(`/api`)
      kind: Rule
      services:
        - name: kong-gateway
          port: 8000
      middlewares:
        - name: compress
        - name: security-headers

    # MFE Shell로 라우팅 (SPA fallback)
    - match: Host(`{{ .Values.domain }}`)
      kind: Rule
      services:
        - name: mfe-shell
          port: 80
      middlewares:
        - name: spa-fallback
  tls:
    secretName: jaehyeong-tech-tls
```

---

### ConfigMap 예시

```yaml
# templates/auth-service/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-service-config
  namespace: {{ .Values.namespace }}
data:
  GOOGLE_CLIENT_ID: "{{ .Values.googleClientId }}"
  GOOGLE_REDIRECT_URI: "https://{{ .Values.domain }}/api/auth/google/callback"
  NODE_ENV: "{{ .Values.env }}"
```

---

### Secret 예시 (Sealed Secrets 권장)

```yaml
# templates/auth-service/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-service-secret
  namespace: {{ .Values.namespace }}
type: Opaque
stringData:
  database-url: "{{ .Values.authService.databaseUrl }}"
  jwt-secret: "{{ .Values.jwtSecret }}"
  google-client-secret: "{{ .Values.googleClientSecret }}"
```

---

### values-dev.yaml

```yaml
namespace: jaehyeong-tech-dev
domain: dev.jaehyeong.tech
env: development

authService:
  replicas: 1
  version: dev-latest
  databaseUrl: "postgresql://user:pass@postgres-dev:5432/auth_db"

blogService:
  replicas: 1
  version: dev-latest
  databaseUrl: "postgresql://user:pass@postgres-dev:5432/blog_db"

contentService:
  replicas: 1
  version: dev-latest
  databaseUrl: "postgresql://user:pass@postgres-dev:5432/content_db"

pageService:
  replicas: 1
  version: dev-latest
  databaseUrl: "postgresql://user:pass@postgres-dev:5432/page_db"

analyticsService:
  replicas: 1
  version: dev-latest
  databaseUrl: "postgresql://user:pass@postgres-dev:5432/analytics_db"

storageService:
  replicas: 1
  version: dev-latest
  databaseUrl: "postgresql://user:pass@postgres-dev:5432/storage_db"
  ociAccessKey: "{{ .Values.ociAccessKey }}"
  ociSecretKey: "{{ .Values.ociSecretKey }}"

kong:
  replicas: 1
  version: "3.5"

rabbitmq:
  replicas: 1
  storage: 10Gi

redis:
  replicas: 1
  storage: 5Gi

mfeShell:
  replicas: 1
  version: dev-latest

mfeBlog:
  replicas: 1
  version: dev-latest

mfeAdmin:
  replicas: 1
  version: dev-latest

mfeUser:
  replicas: 1
  version: dev-latest
```

---

### values-prod.yaml

```yaml
namespace: jaehyeong-tech-prod
domain: jaehyeong.tech
env: production

authService:
  replicas: 2  # 프로덕션은 최소 2개 레플리카
  version: v1.0.0  # 태그 버전
  databaseUrl: "postgresql://user:pass@postgres-prod:5432/auth_db"

blogService:
  replicas: 3  # 읽기 부하가 많으므로 3개
  version: v1.0.0

contentService:
  replicas: 2
  version: v1.0.0

# ... 나머지 동일 패턴
```

---

### GitHub Actions 워크플로우 (멀티 서비스)

```yaml
# .github/workflows/build-deploy-msa.yaml
name: Build and Deploy MSA

on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        description: 'Environment'
        options:
          - dev
          - prod
      services:
        type: string
        description: 'Services to deploy (comma-separated, e.g., auth,blog,content or "all")'
        default: 'all'

env:
  REGISTRY: ghcr.io
  OWNER: ${{ github.repository_owner }}

jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.tag.outputs.tag }}
      services: ${{ steps.services.outputs.list }}
    steps:
      - name: Generate tag
        id: tag
        run: |
          if [ "${{ inputs.environment }}" == "dev" ]; then
            echo "tag=dev-$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT
          else
            echo "tag=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT
          fi

      - name: Parse services
        id: services
        run: |
          if [ "${{ inputs.services }}" == "all" ]; then
            echo "list=[\"auth\",\"blog\",\"content\",\"page\",\"analytics\",\"storage\",\"mfe-shell\",\"mfe-blog\",\"mfe-admin\",\"mfe-user\"]" >> $GITHUB_OUTPUT
          else
            # Convert comma-separated to JSON array
            services=$(echo "${{ inputs.services }}" | jq -R 'split(",") | map(select(length > 0))')
            echo "list=$services" >> $GITHUB_OUTPUT
          fi

  build-services:
    needs: prepare
    runs-on: self-hosted
    strategy:
      matrix:
        service: ${{ fromJson(needs.prepare.outputs.services) }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        run: |
          SERVICE=${{ matrix.service }}
          TAG=${{ needs.prepare.outputs.tag }}

          # Determine Dockerfile path
          if [[ $SERVICE == mfe-* ]]; then
            DOCKERFILE="apps/$SERVICE/Dockerfile"
          else
            DOCKERFILE="apps/$SERVICE-service/Dockerfile"
          fi

          docker build \
            -t ${{ env.REGISTRY }}/${{ env.OWNER }}/$SERVICE:$TAG \
            -f $DOCKERFILE \
            .

          docker push ${{ env.REGISTRY }}/${{ env.OWNER }}/$SERVICE:$TAG

  update-gitops:
    needs: [prepare, build-services]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout GitOps Repo
        run: |
          git clone https://${{ secrets.GITOPS_TOKEN }}@github.com/${{ env.OWNER }}/gitops.git
          cd gitops

      - name: Update Helm values
        run: |
          TAG=${{ needs.prepare.outputs.tag }}
          ENV=${{ inputs.environment }}

          cd gitops/charts/jaehyeong-tech

          # Update all service versions in values-{env}.yaml
          for service in $(echo '${{ needs.prepare.outputs.services }}' | jq -r '.[]'); do
            yq eval ".${service}Service.version = \"$TAG\"" -i values-$ENV.yaml
          done

      - name: Commit and Push
        run: |
          cd gitops
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "Update services to ${{ needs.prepare.outputs.tag }} [${{ inputs.environment }}]"
          git push

      - name: Deploy with Helm
        run: |
          ENV=${{ inputs.environment }}

          helm upgrade --install jaehyeong-tech-$ENV \
            ./gitops/charts/jaehyeong-tech \
            -f ./gitops/charts/jaehyeong-tech/values-$ENV.yaml \
            --namespace jaehyeong-tech-$ENV \
            --create-namespace \
            --wait
```

---

### Health Check 엔드포인트

각 서비스는 Health Check 엔드포인트를 제공해야 합니다.

```typescript
// apps/auth-service/src/routes/health.ts
import express from 'express';
import prisma from '../lib/prisma';

const router = express.Router();

// Liveness Probe: 서비스가 살아있는지
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness Probe: 서비스가 트래픽을 받을 준비가 되었는지
router.get('/ready', async (req, res) => {
  try {
    // DB 연결 확인
    await prisma.$queryRaw`SELECT 1`;

    // RabbitMQ 연결 확인
    const mqStatus = eventSubscriber.isConnected();

    if (mqStatus) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready', reason: 'RabbitMQ disconnected' });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', reason: 'Database disconnected' });
  }
});

export default router;
```

---

## 마이그레이션 로드맵

### Phase 0: 준비 단계 (2-3주)

**목표**: 인프라 준비 및 공유 컴포넌트 구축

**작업**:
- [ ] RabbitMQ 클러스터 구축
- [ ] Redis 클러스터 구축
- [ ] Kong API Gateway 설정
- [ ] Helm Chart 템플릿 작성
- [ ] `packages/shared` 패키지 구축 (타입, 이벤트 정의)
- [ ] 데이터베이스 분리 계획 수립
- [ ] 모니터링 설정 (Prometheus + Grafana)

---

### Phase 1: Auth Service 분리 (2주)

**목표**: 첫 번째 마이크로서비스 분리 및 패턴 확립

**작업**:
- [ ] `apps/auth-service` 프로젝트 생성
- [ ] User 스키마를 `auth_db`로 마이그레이션
- [ ] 인증 API 이동 (`/api/auth/*`, `/api/users/*`)
- [ ] JWT 발급/검증 로직 구현
- [ ] Kong JWT 플러그인 설정
- [ ] Health Check 엔드포인트 구현
- [ ] 통합 테스트 작성
- [ ] 배포 및 검증

**성공 기준**:
- 기존 프론트엔드에서 로그인/회원가입 정상 작동
- Kong을 통한 JWT 검증 정상 작동
- 모든 API 응답 시간 < 200ms

---

### Phase 2: Blog Service 분리 (2-3주)

**목표**: 핵심 비즈니스 로직 분리

**작업**:
- [ ] `apps/blog-service` 프로젝트 생성
- [ ] Post, Category, Tag, Draft 스키마를 `blog_db`로 마이그레이션
- [ ] 포스트 CRUD API 이동
- [ ] 이벤트 발행 구현 (`post.created`, `post.deleted`)
- [ ] Author 정보 CQRS 패턴 적용 (이름, 아바타 복제)
- [ ] Auth Service 이벤트 구독 (`user.profile.updated`)
- [ ] 배포 및 검증

**성공 기준**:
- 포스트 작성/수정/삭제 정상 작동
- Author 정보 동기화 정상 작동
- 기존 기능 100% 호환

---

### Phase 3: Content Service 분리 (2주)

**목표**: 사용자 상호작용 기능 분리

**작업**:
- [ ] `apps/content-service` 프로젝트 생성
- [ ] Comment, Like, Bookmark 스키마를 `content_db`로 마이그레이션
- [ ] 댓글/좋아요/북마크 API 이동
- [ ] Blog Service 이벤트 구독 (`post.deleted`)
- [ ] 좋아요 카운트 이벤트 발행 (`like.toggled`)
- [ ] 배포 및 검증

**성공 기준**:
- 댓글 작성/수정/삭제 정상 작동
- 좋아요 토글 정상 작동
- 포스트 삭제 시 연관 데이터 자동 삭제

---

### Phase 4: Page, Analytics, Storage Service 분리 (3주)

**목표**: 나머지 서비스 분리

**작업**:
- [ ] `apps/page-service` 생성 및 마이그레이션
- [ ] `apps/analytics-service` 생성 및 마이그레이션
- [ ] `apps/storage-service` 생성 및 마이그레이션
- [ ] 이벤트 구독 설정
- [ ] 배포 및 검증

**성공 기준**:
- 모든 기존 기능 정상 작동
- 데이터 일관성 유지

---

### Phase 5: Micro Frontends 분리 (4주)

**목표**: 프론트엔드를 독립적인 모듈로 분리

**작업**:
- [ ] `apps/mfe-shell` 생성 (Container App)
- [ ] `apps/mfe-blog` 생성 (블로그 페이지)
- [ ] `apps/mfe-admin` 생성 (관리자 페이지)
- [ ] `apps/mfe-user` 생성 (사용자 페이지)
- [ ] Module Federation 설정
- [ ] 공유 컨텍스트 구현 (Auth, Theme)
- [ ] 라우팅 통합
- [ ] 독립 배포 파이프라인 구축
- [ ] E2E 테스트 작성
- [ ] 배포 및 검증

**성공 기준**:
- 각 MFE 독립 배포 가능
- 전체 사용자 경험 동일
- 초기 로딩 시간 < 3초

---

### Phase 6: 최적화 및 안정화 (2-3주)

**목표**: 성능 최적화 및 안정성 향상

**작업**:
- [ ] Redis 캐싱 적용 (카테고리, 태그, 프로필)
- [ ] API Gateway Rate Limiting 튜닝
- [ ] 서비스별 로그 집중화 (ELK Stack)
- [ ] 분산 추적 (Jaeger / Zipkin)
- [ ] 알림 설정 (Slack, PagerDuty)
- [ ] Chaos Engineering 테스트
- [ ] 성능 테스트 (k6 / JMeter)
- [ ] 문서화

**성공 기준**:
- 모든 API 응답 시간 < 300ms (p95)
- 서비스 가용성 > 99.9%
- 장애 복구 시간 < 5분

---

### Phase 7: 프로덕션 전환 (1주)

**목표**: 프로덕션 환경으로 전환

**작업**:
- [ ] Blue-Green 배포 준비
- [ ] 프로덕션 트래픽 5% → 50% → 100% 점진적 전환
- [ ] 모니터링 집중 (에러율, 레이턴시, 처리량)
- [ ] 롤백 계획 준비
- [ ] 기존 모노리스 종료

**성공 기준**:
- 에러율 < 0.1%
- 응답 시간 회귀 없음
- 사용자 불만 없음

---

## 타임라인 요약

```
Phase 0: 준비 단계          │███████████████│ 3주
Phase 1: Auth Service       │███████████│ 2주
Phase 2: Blog Service       │████████████████│ 3주
Phase 3: Content Service    │███████████│ 2주
Phase 4: 나머지 Services    │████████████████████│ 3주
Phase 5: Micro Frontends    │███████████████████████████│ 4주
Phase 6: 최적화             │████████████████│ 3주
Phase 7: 프로덕션 전환      │██████│ 1주
                            └─────────────────────────────►
                            Total: ~21주 (약 5개월)
```

---

## 기대 효과

### 1. 확장성
- 서비스별 독립적인 수평 확장
- 트래픽이 많은 서비스(Blog Service)만 스케일 아웃 가능

### 2. 개발 속도
- 팀별로 독립적인 배포 가능
- 코드 충돌 최소화
- 기술 스택 유연성 (향후 Go, Rust 등 도입 가능)

### 3. 장애 격리
- 한 서비스 장애가 다른 서비스에 영향 없음
- 부분 기능 장애로 전체 시스템 다운 방지

### 4. 유지보수성
- 도메인별로 명확하게 분리된 코드베이스
- 작은 코드베이스로 이해하기 쉬움
- 리팩토링 리스크 감소

### 5. 비즈니스 민첩성
- 새로운 기능 빠르게 추가 가능
- A/B 테스트 용이
- 특정 서비스만 업데이트 가능

---

## 리스크 및 대응 방안

### 리스크 1: 분산 시스템 복잡도 증가

**대응**:
- 충분한 모니터링 및 로깅
- 표준화된 개발 템플릿
- 명확한 문서화

### 리스크 2: 네트워크 레이턴시 증가

**대응**:
- Redis 캐싱 적극 활용
- CQRS 패턴으로 데이터 복제
- gRPC 도입 검토 (향후)

### 리스크 3: 데이터 일관성 문제

**대응**:
- 이벤트 소싱 패턴 도입
- Saga 패턴으로 분산 트랜잭션 처리
- Eventual Consistency 수용

### 리스크 4: 배포 복잡도 증가

**대응**:
- GitOps 자동화
- Helm Chart 표준화
- CI/CD 파이프라인 최적화

### 리스크 5: 초기 투자 비용

**대응**:
- 단계적 마이그레이션
- 우선순위 높은 서비스부터 분리
- ROI 측정 및 검증

---

## 결론

이 리팩토링 계획은 현재 모노리스 아키텍처를 **Full MSA + Micro Frontends**로 전환하여:

1. **확장 가능한** 시스템 구축
2. **독립적인** 배포 및 개발
3. **장애에 강한** 아키텍처
4. **유연한** 기술 선택

을 실현합니다.

약 **5개월**의 마이그레이션 기간 동안 단계적으로 진행하여 리스크를 최소화하고, 각 Phase마다 검증하여 안정성을 확보합니다.

---

## 다음 단계

1. **이 계획서 검토 및 승인**
2. **Phase 0 시작: 인프라 준비**
3. **첫 번째 마일스톤: Auth Service 분리 완료**

---

**문서 버전**: 1.0
**작성일**: 2026-01-15
**작성자**: Claude (AI Assistant)
**검토 대상**: JaeHeong
**상태**: 초안 (Draft)
