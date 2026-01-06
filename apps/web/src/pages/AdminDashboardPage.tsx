import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api, { type DashboardStats } from '../services/api'

const categoryColorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`
  return date.toLocaleDateString('ko-KR')
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const stats = await api.getDashboardStats()
        setData(stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
              총 조회수
            </p>
            <h3 className="text-3xl font-bold">{data.stats.totalViews.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
            <span className="material-symbols-outlined text-[28px]">trending_up</span>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
              게시글
            </p>
            <h3 className="text-3xl font-bold">{data.stats.publishedPosts}</h3>
            <p className="text-xs text-slate-400 mt-1">
              임시저장 {data.stats.draftPosts}개
            </p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
            <span className="material-symbols-outlined text-[28px]">article</span>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">댓글</p>
            <h3 className="text-3xl font-bold">{data.stats.totalComments}</h3>
            <p className="text-xs text-slate-400 mt-1">
              최근 7일 +{data.stats.recentComments}개
            </p>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
            <span className="material-symbols-outlined text-[28px]">forum</span>
          </div>
        </div>
      </div>

      {/* Posts Management Table */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold">최근 게시글</h2>
          <Link
            to="/admin/posts/new"
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            새 글 작성
          </Link>
        </div>
        {data.recentPosts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">제목</th>
                  <th className="px-6 py-4 w-32">카테고리</th>
                  <th className="px-6 py-4 w-40">작성일</th>
                  <th className="px-6 py-4 w-32 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.recentPosts.map((post) => (
                  <tr
                    key={post.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white mb-0.5">
                        {post.title}
                      </div>
                      <div className="text-slate-500 text-xs">
                        조회수: {post.viewCount.toLocaleString()} • 댓글: {post.commentCount}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColorMap[post.category?.color || 'blue'] || categoryColorMap.blue}`}
                      >
                        {post.category?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {formatDate(post.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/posts/${post.slug}`}
                          target="_blank"
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                          title="미리보기"
                        >
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </Link>
                        <Link
                          to={`/admin/posts/${post.id}/edit`}
                          className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                          title="수정"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <span className="material-symbols-outlined text-[48px] mb-4 block">article</span>
            <p>게시글이 없습니다.</p>
          </div>
        )}
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
            {data.recentComments.length > 0 ? (
              data.recentComments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {comment.authorAvatar ? (
                      <img
                        src={comment.authorAvatar}
                        alt={comment.authorName}
                        className="size-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="size-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-primary/10 text-primary">
                        {getInitials(comment.authorName)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">{comment.authorName}</span>
                        <span className="text-xs text-slate-500">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                        {comment.content}
                      </p>
                      <Link
                        to={`/posts/${comment.post.slug}`}
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        {comment.post.title}
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">
                <span className="material-symbols-outlined text-[32px] mb-2 block">chat</span>
                <p className="text-sm">댓글이 없습니다.</p>
              </div>
            )}
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
              {data.recentDrafts.length > 0 ? (
                data.recentDrafts.map((draft) => (
                  <Link
                    key={draft.id}
                    to={`/admin/posts/${draft.id}/edit`}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group block"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                        {draft.title}
                      </h4>
                      <span className="text-xs text-slate-400">{formatDate(draft.updatedAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{draft.excerpt}</p>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <span className="material-symbols-outlined text-[32px] mb-2 block">edit_note</span>
                  <p className="text-sm">임시 저장 글이 없습니다.</p>
                </div>
              )}
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
              {data.categories.slice(0, 4).map((category) => (
                <div
                  key={category.id}
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
