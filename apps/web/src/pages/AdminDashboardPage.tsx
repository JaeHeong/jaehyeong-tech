import { Link } from 'react-router-dom'

// Mock data - will be replaced with API calls
const mockStats = {
  todayVisitors: 1234,
  weeklyViews: '8.5k',
  newComments: 12,
}

const mockPosts = [
  {
    id: '1',
    title: 'Docker Compose V2 마이그레이션 가이드',
    category: 'DevOps',
    categoryColor: 'blue',
    status: 'published',
    viewCount: 1204,
    commentCount: 5,
    createdAt: '2023.10.24',
  },
  {
    id: '2',
    title: 'Kubernetes 서비스 메쉬 Istio 도입기 (2)',
    category: 'Kubernetes',
    categoryColor: 'indigo',
    status: 'published',
    viewCount: 856,
    commentCount: 2,
    createdAt: '2023.10.20',
  },
  {
    id: '3',
    title: 'MLOps 파이프라인 구축을 위한 오픈소스 도구 비교',
    category: 'MLOps',
    categoryColor: 'purple',
    status: 'draft',
    viewCount: 0,
    commentCount: 0,
    createdAt: '2023.10.18',
  },
  {
    id: '4',
    title: 'Terraform 상태 관리 Best Practice',
    category: 'IaC',
    categoryColor: 'pink',
    status: 'published',
    viewCount: 2103,
    commentCount: 8,
    createdAt: '2023.10.15',
  },
]

const mockComments = [
  {
    id: '1',
    author: 'John Doe',
    initials: 'JD',
    color: 'orange',
    content:
      'Terraform 상태 관리 글 정말 도움이 많이 되었습니다. 혹시 S3 백엔드 설정 관련해서 더 자세한...',
    createdAt: '2시간 전',
  },
  {
    id: '2',
    author: 'Alice Lee',
    initials: 'AL',
    color: 'teal',
    content: 'MLOps 파이프라인 구축 글 기대됩니다! 작성 완료되면 알림 받고 싶네요.',
    createdAt: '5시간 전',
  },
  {
    id: '3',
    author: 'Minsoo Kim',
    initials: 'MS',
    color: 'indigo',
    content:
      'Docker Compose V2 관련해서 호환성 문제가 조금 있던데 이 부분도 다뤄주실 수 있나요?',
    createdAt: '1일 전',
  },
]

const mockDrafts = [
  {
    id: '1',
    title: 'GitOps와 ArgoCD 실전 가이드',
    excerpt: 'GitOps의 개념부터 ArgoCD를 활용한 실제 배포 파이프라인 구축까지...',
    createdAt: '2023.10.26',
  },
  {
    id: '2',
    title: 'Python 3.12 새로운 기능 분석',
    excerpt: '이번 릴리즈에서 추가된 F-string 개선 사항과 성능 향상 부분을 중점적으로...',
    createdAt: '2023.10.25',
  },
  {
    id: '3',
    title: 'AWS EKS 비용 최적화 전략',
    excerpt: 'Spot Instance와 Karpenter를 활용한 비용 절감 사례 공유',
    createdAt: '2023.10.22',
  },
]

const mockCategories = [
  { name: 'DevOps', postCount: 42 },
  { name: 'Kubernetes', postCount: 28 },
  { name: 'MLOps', postCount: 15 },
  { name: 'IaC', postCount: 12 },
]

const categoryColorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

const commentColorMap: Record<string, string> = {
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
}

export default function AdminDashboardPage() {
  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
              오늘 방문자 수
            </p>
            <h3 className="text-3xl font-bold">{mockStats.todayVisitors.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
            <span className="material-symbols-outlined text-[28px]">trending_up</span>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
              이번 주 조회수
            </p>
            <h3 className="text-3xl font-bold">{mockStats.weeklyViews}</h3>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
            <span className="material-symbols-outlined text-[28px]">visibility</span>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">신규 댓글</p>
            <h3 className="text-3xl font-bold">{mockStats.newComments}</h3>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
            <span className="material-symbols-outlined text-[28px]">forum</span>
          </div>
        </div>
      </div>

      {/* Posts Management Table */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold">최근 게시글 관리</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
              </span>
              <input
                className="pl-9 pr-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/20 w-48 sm:w-64"
                placeholder="제목 검색..."
                type="text"
              />
            </div>
            <Link
              to="/admin/posts/new"
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              새 글 작성
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs">
              <tr>
                <th className="px-6 py-4">제목</th>
                <th className="px-6 py-4 w-32">카테고리</th>
                <th className="px-6 py-4 w-32">상태</th>
                <th className="px-6 py-4 w-40">작성일</th>
                <th className="px-6 py-4 w-32 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {mockPosts.map((post) => (
                <tr
                  key={post.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white mb-0.5">
                      {post.title}
                    </div>
                    <div className="text-slate-500 text-xs">
                      {post.status === 'draft'
                        ? '작성중 • 자동 저장됨'
                        : `조회수: ${post.viewCount.toLocaleString()} • 댓글: ${post.commentCount}`}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColorMap[post.categoryColor]}`}
                    >
                      {post.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {post.status === 'published' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        <span className="size-1.5 rounded-full bg-green-500"></span>
                        공개됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        <span className="size-1.5 rounded-full bg-yellow-500"></span>
                        임시저장
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{post.createdAt}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                        title="미리보기"
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                      <Link
                        to={`/admin/posts/${post.id}/edit`}
                        className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                        title="수정"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </Link>
                      <button
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-center">
          <Link
            to="/admin/posts"
            className="text-sm font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            전체 게시글 보기
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      </div>

      {/* Bottom Grid: Comments and Drafts/Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Comments */}
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold">최근 댓글</h3>
            <Link
              to="/admin/comments"
              className="text-xs font-bold text-primary hover:text-primary/80"
            >
              전체보기
            </Link>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 flex-1">
            {mockComments.map((comment) => (
              <div
                key={comment.id}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`size-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${commentColorMap[comment.color]}`}
                  >
                    {comment.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{comment.author}</span>
                      <span className="text-xs text-slate-500">{comment.createdAt}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                      {comment.content}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button className="text-xs font-bold text-primary hover:underline">답글</button>
                      <button className="text-xs font-bold text-red-500 hover:underline">삭제</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Drafts and Categories */}
        <div className="flex flex-col gap-6">
          {/* Draft Posts */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold">임시 저장 글</h3>
              <Link
                to="/admin/drafts"
                className="text-xs font-bold text-primary hover:text-primary/80"
              >
                모두 보기
              </Link>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 flex-1">
              {mockDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                      {draft.title}
                    </h4>
                    <span className="text-xs text-slate-400">{draft.createdAt}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{draft.excerpt}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Category Stats */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold">카테고리 현황</h3>
              <Link
                to="/admin/categories"
                className="text-xs font-bold text-primary hover:text-primary/80"
              >
                관리
              </Link>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {mockCategories.map((category) => (
                <div
                  key={category.name}
                  className="flex flex-col p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <span className="text-xs text-slate-500 mb-1">{category.name}</span>
                  <span className="text-lg font-bold">
                    {category.postCount}{' '}
                    <span className="text-xs font-normal text-slate-400">posts</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
