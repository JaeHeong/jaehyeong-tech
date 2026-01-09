import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api, { type DashboardStats, type WeeklyVisitorsResponse } from '../services/api'
import { useModal } from '../contexts/ModalContext'

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

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function AdminDashboardPage() {
  const { alert, confirm } = useModal()
  const [data, setData] = useState<DashboardStats | null>(null)
  const [visitors, setVisitors] = useState<WeeklyVisitorsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCleaningImages, setIsCleaningImages] = useState(false)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true)
    try {
      const [stats, visitorsData] = await Promise.all([
        api.getDashboardStats(),
        api.getWeeklyVisitors().catch(() => null),
      ])
      setData(stats)
      setVisitors(visitorsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
      if (isRefresh) setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCleanOrphanImages = async () => {
    const confirmed = await confirm({
      title: '고아 이미지 정리',
      message: '고아 이미지를 정리하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
      confirmText: '정리',
      cancelText: '취소',
      type: 'warning',
    })
    if (!confirmed) return
    setIsCleaningImages(true)
    try {
      const result = await api.deleteOrphanImages()
      await alert({
        title: '정리 완료',
        message: `${result.deleted}개 이미지 삭제 완료\n(${formatBytes(result.freedSpace)} 확보)`,
        type: 'success',
      })
      fetchData()
    } catch (err) {
      await alert({
        message: err instanceof Error ? err.message : '이미지 정리에 실패했습니다.',
        type: 'error',
      })
    } finally {
      setIsCleaningImages(false)
    }
  }

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true)
    try {
      await api.createBackup()
      await alert({
        title: '백업 완료',
        message: '백업이 생성되었습니다.',
        type: 'success',
      })
      fetchData()
    } catch (err) {
      await alert({
        message: err instanceof Error ? err.message : '백업 생성에 실패했습니다.',
        type: 'error',
      })
    } finally {
      setIsCreatingBackup(false)
    }
  }

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
      {/* Stats Cards - 핵심 지표 */}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl p-3 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
          <div>
            <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-medium mb-0.5 md:mb-1">
              총 조회수
            </p>
            <h3 className="text-lg md:text-3xl font-bold">{data.stats.totalViews.toLocaleString()}</h3>
          </div>
          <div className="p-1.5 md:p-3 bg-blue-500/10 rounded-lg text-blue-500 hidden md:block">
            <span className="material-symbols-outlined text-[28px]">trending_up</span>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl p-3 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
          <div>
            <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-medium mb-0.5 md:mb-1">
              총 좋아요
            </p>
            <h3 className="text-lg md:text-3xl font-bold">{data.stats.totalLikes.toLocaleString()}</h3>
          </div>
          <div className="p-1.5 md:p-3 bg-red-500/10 rounded-lg text-red-500 hidden md:block">
            <span className="material-symbols-outlined text-[28px]">favorite</span>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl p-3 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
          <div>
            <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-medium mb-0.5 md:mb-1">댓글</p>
            <h3 className="text-lg md:text-3xl font-bold">{data.stats.totalComments}</h3>
            <p className="text-[9px] md:text-xs text-slate-400 mt-0.5 md:mt-1">
              +{data.stats.recentComments}
            </p>
          </div>
          <div className="p-1.5 md:p-3 bg-purple-500/10 rounded-lg text-purple-500 hidden md:block">
            <span className="material-symbols-outlined text-[28px]">forum</span>
          </div>
        </div>
      </div>

      {/* Weekly Visitors Card */}
      {visitors && visitors.configured && visitors.daily.length > 0 && (
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-3 md:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined text-[18px] md:text-[24px]">analytics</span>
              </div>
              <div>
                <h3 className="font-bold text-sm md:text-base">주간 방문자</h3>
                <p className="text-[10px] md:text-xs text-slate-400">최근 7일 • 총 {visitors.total.toLocaleString()}명</p>
              </div>
            </div>
            <Link to="/admin/analytics" className="text-[10px] md:text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1">
              전체보기
              <span className="material-symbols-outlined text-[14px] md:text-[16px]">arrow_forward</span>
            </Link>
          </div>
          <div className="p-3 md:p-6">
            <div className="flex items-end justify-between gap-1 h-20 md:h-24">
              {visitors.daily.map((day, index) => {
                const maxVisitors = Math.max(...visitors.daily.map((d) => d.visitors), 1)
                const heightPercent = (day.visitors / maxVisitors) * 100
                const opacity = 0.3 + (index / (visitors.daily.length - 1)) * 0.7
                const isToday = index === visitors.daily.length - 1
                const dayLabel = new Date(day.date).toLocaleDateString('ko-KR', { weekday: 'short' }).charAt(0)

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[8px] md:text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {day.visitors}
                    </span>
                    <div className="w-full flex items-end justify-center h-12 md:h-16">
                      <div
                        className="w-full max-w-[20px] md:max-w-[28px] rounded-t transition-all"
                        style={{
                          height: `${Math.max(heightPercent, 4)}%`,
                          backgroundColor: `rgba(49, 130, 246, ${opacity})`,
                        }}
                        title={`${day.date}: ${day.visitors}명`}
                      />
                    </div>
                    <span className={`text-[9px] md:text-[10px] ${isToday ? 'text-primary font-bold' : 'text-slate-400'}`}>
                      {dayLabel}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between text-xs md:text-sm border-t border-slate-100 dark:border-slate-800 mt-3 md:mt-4 pt-3 md:pt-4">
              <span className="text-slate-500">오늘 {visitors.daily[visitors.daily.length - 1]?.visitors || 0}명 방문</span>
              {visitors.updatedAt && (
                <span className="text-[10px] text-slate-400">
                  {visitors.stale && '⚠️ '}
                  {new Date(visitors.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Posts Management Table - 최근 게시글 */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:h-[360px]">
        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <h2 className="text-base md:text-xl font-bold">최근 게시글</h2>
            <span className="text-[10px] md:text-xs text-slate-400">최근 5개</span>
            <span className="text-[10px] md:text-sm text-slate-500">
              공개 {data.stats.publishedPosts} / 임시 {data.stats.draftPosts}
            </span>
          </div>
          <Link
            to="/admin/posts/new"
            className="bg-primary hover:bg-primary/90 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1.5 md:gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">add</span>
            새 글
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          {data.recentPosts.length > 0 ? (
            <>
              {/* Mobile: Card List */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {data.recentPosts.map((post) => (
                  <div key={post.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{post.title}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                          <span className={`px-1.5 py-0.5 rounded-full ${categoryColorMap[post.category?.color || 'blue'] || categoryColorMap.blue}`}>{post.category?.name}</span>
                          <span>조회 {post.viewCount}</span>
                          <span>{formatDate(post.createdAt)}</span>
                        </div>
                      </div>
                      <Link to={`/admin/posts/${post.id}/edit`} className="p-1 text-slate-400 hover:text-primary">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: Table */}
              <table className="hidden md:table w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs sticky top-0">
                  <tr>
                    <th className="px-6 py-4">제목</th>
                    <th className="px-6 py-4 w-32">카테고리</th>
                    <th className="px-6 py-4 w-40">작성일</th>
                    <th className="px-6 py-4 w-32 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {data.recentPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white mb-0.5">{post.title}</div>
                        <div className="text-slate-500 text-xs">조회수: {post.viewCount.toLocaleString()} • 댓글: {post.commentCount}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColorMap[post.category?.color || 'blue'] || categoryColorMap.blue}`}>{post.category?.name}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatDate(post.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/posts/${post.slug}`} target="_blank" className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="미리보기">
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </Link>
                          <Link to={`/admin/posts/${post.id}/edit`} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors" title="수정">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="text-center py-8 md:py-12 text-slate-500">
              <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4 block">article</span>
              <p className="text-sm md:text-base">게시글이 없습니다.</p>
            </div>
          )}
        </div>
        <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 flex justify-center flex-shrink-0">
          <Link to="/admin/posts" className="text-xs md:text-sm font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            전체 게시글 보기
            <span className="material-symbols-outlined text-[14px] md:text-[16px]">arrow_forward</span>
          </Link>
        </div>
      </div>

      {/* 2-Column Grid: Comments + Drafts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent Comments */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:h-[320px]">
          <div className="p-3 md:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <h3 className="font-bold text-sm md:text-base">최근 댓글</h3>
              <span className="text-[10px] md:text-xs text-slate-400">최근 5개</span>
            </div>
            <Link to="/admin/comments" className="text-[10px] md:text-xs font-bold text-primary hover:text-primary/80">전체보기</Link>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {data.recentComments.length > 0 ? (
              data.recentComments.map((comment) => (
                <div key={comment.id} className="p-3 md:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-2 md:gap-3">
                    {comment.authorAvatar ? (
                      <img src={comment.authorAvatar} alt={comment.authorName} className="size-6 md:size-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="size-6 md:size-8 rounded-full flex items-center justify-center font-bold text-[10px] md:text-xs shrink-0 bg-primary/10 text-primary">{getInitials(comment.authorName)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5 md:mb-1">
                        <span className="font-bold text-xs md:text-sm">{comment.authorName}</span>
                        <span className="text-[10px] md:text-xs text-slate-500">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{comment.content}</p>
                      <Link to={`/posts/${comment.post.slug}`} className="text-[10px] md:text-xs text-primary hover:underline mt-0.5 md:mt-1 inline-block line-clamp-1">{comment.post.title}</Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 md:p-8 text-center text-slate-500">
                <span className="material-symbols-outlined text-[28px] md:text-[32px] mb-2 block">chat</span>
                <p className="text-xs md:text-sm">댓글이 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Draft Posts */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:h-[320px]">
          <div className="p-3 md:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <h3 className="font-bold text-sm md:text-base">임시 저장</h3>
              <span className="text-[10px] md:text-xs text-slate-400">최근 5개</span>
            </div>
            <Link to="/admin/drafts" className="text-[10px] md:text-xs font-bold text-primary hover:text-primary/80">모두 보기</Link>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {data.recentDrafts.length > 0 ? (
              data.recentDrafts.map((draft) => (
                <Link key={draft.id} to={`/admin/drafts/${draft.id}/edit`} className="p-3 md:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group block">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors line-clamp-1">{draft.title}</h4>
                    <span className="text-[10px] md:text-xs text-slate-400 shrink-0 ml-2">{formatDate(draft.updatedAt)}</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 md:mt-1 line-clamp-1">{draft.excerpt}</p>
                </Link>
              ))
            ) : (
              <div className="p-6 md:p-8 text-center text-slate-500">
                <span className="material-symbols-outlined text-[28px] md:text-[32px] mb-2 block">edit_note</span>
                <p className="text-xs md:text-sm">임시 저장 글이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3-Column Grid: Categories + Tags + Pages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Categories */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:h-[280px]">
          <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="material-symbols-outlined text-[18px] md:text-[20px] text-slate-500">folder</span>
              <h3 className="font-bold text-sm md:text-base">카테고리</h3>
            </div>
            <Link to="/admin/categories" className="text-[10px] md:text-xs font-bold text-primary hover:text-primary/80">관리</Link>
          </div>
          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            {data.categories.length > 0 ? (
              <div className="space-y-1.5 md:space-y-2">
                {data.categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-1.5 md:p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className={`inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${categoryColorMap[category.color || 'blue'] || categoryColorMap.blue}`}>{category.name}</span>
                    <span className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-400">{category.postCount}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 md:py-8 text-slate-500">
                <p className="text-xs md:text-sm">카테고리가 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:h-[280px]">
          <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="material-symbols-outlined text-[18px] md:text-[20px] text-slate-500">label</span>
              <h3 className="font-bold text-sm md:text-base">태그</h3>
              <span className="text-[10px] md:text-xs text-slate-400">({data.tags.length})</span>
            </div>
            <Link to="/admin/tags" className="text-[10px] md:text-xs font-bold text-primary hover:text-primary/80">관리</Link>
          </div>
          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            {data.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {data.tags.sort((a, b) => b.postCount - a.postCount).map((tag) => (
                  <span key={tag.id} className="inline-flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2.5 py-0.5 md:py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] md:text-xs">
                    <span className="text-slate-700 dark:text-slate-300">{tag.name}</span>
                    <span className="text-slate-400 dark:text-slate-500">{tag.postCount}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 md:py-8 text-slate-500">
                <p className="text-xs md:text-sm">태그가 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Pages */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:h-[280px]">
          <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="material-symbols-outlined text-[18px] md:text-[20px] text-slate-500">description</span>
              <h3 className="font-bold text-sm md:text-base">페이지</h3>
            </div>
            <Link to="/admin/pages" className="text-[10px] md:text-xs font-bold text-primary hover:text-primary/80">관리</Link>
          </div>
          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            <div className="space-y-2 md:space-y-4">
              <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-1 md:mb-2">
                  <span className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400">정적 페이지</span>
                  <span className="text-xl md:text-2xl font-bold">{data.pages.static}</span>
                </div>
                <p className="text-[10px] md:text-xs text-slate-500">소개, 개인정보처리방침 등</p>
              </div>
              <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-1 md:mb-2">
                  <span className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400">공지사항</span>
                  <span className="text-xl md:text-2xl font-bold">{data.pages.notice}</span>
                </div>
                <p className="text-[10px] md:text-xs text-slate-500">블로그 공지사항</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Management - 2 Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Images */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:h-[280px]">
          <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="material-symbols-outlined text-[18px] md:text-[20px] text-slate-500">image</span>
              <h3 className="font-bold text-sm md:text-base">이미지 저장소</h3>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between p-2 md:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">총 이미지</span>
                <div className="text-right">
                  <span className="font-bold text-sm md:text-base">{data.images.total}개</span>
                  <span className="text-[10px] md:text-xs text-slate-500 ml-1 md:ml-2">({formatBytes(data.images.totalSize)})</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 md:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">연결된 이미지</span>
                <span className="font-bold text-sm md:text-base text-green-600 dark:text-green-400">{data.images.linked}개</span>
              </div>
              <div className="flex items-center justify-between p-2 md:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">고아 이미지</span>
                  {data.images.orphaned > 0 && (
                    <span className="material-symbols-outlined text-[14px] md:text-[16px] text-amber-500">warning</span>
                  )}
                </div>
                <div className="text-right">
                  <span className={`font-bold text-sm md:text-base ${data.images.orphaned > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                    {data.images.orphaned}개
                  </span>
                  {data.images.orphaned > 0 && (
                    <span className="text-[10px] md:text-xs text-slate-500 ml-1 md:ml-2">({formatBytes(data.images.orphanSize)})</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <button
              onClick={handleCleanOrphanImages}
              disabled={isCleaningImages || data.images.orphaned === 0}
              className="w-full px-3 md:px-4 py-1.5 md:py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white disabled:text-slate-500 rounded-lg text-xs md:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 md:gap-2"
            >
              {isCleaningImages ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px] md:text-[18px]">progress_activity</span>
                  정리 중...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">delete_sweep</span>
                  고아 이미지 정리
                </>
              )}
            </button>
          </div>
        </div>

        {/* Backups */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:h-[280px]">
          <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="material-symbols-outlined text-[18px] md:text-[20px] text-slate-500">backup</span>
              <h3 className="font-bold text-sm md:text-base">백업</h3>
              <span className="text-[10px] md:text-xs text-slate-400">({data.backups.length})</span>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="text-[10px] md:text-xs text-primary hover:text-primary/80 disabled:opacity-50 flex items-center gap-1"
            >
              <span className={`material-symbols-outlined text-[14px] md:text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}>
                {isRefreshing ? 'progress_activity' : 'refresh'}
              </span>
              {isRefreshing ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            {data.backups.length > 0 ? (
              <div className="space-y-1.5 md:space-y-2">
                {data.backups.map((backup) => (
                  <div
                    key={backup.name}
                    className="flex items-center justify-between p-2 md:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="material-symbols-outlined text-[16px] md:text-[18px] text-slate-400">folder_zip</span>
                      <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400 truncate max-w-[120px] md:max-w-[180px]">
                        {backup.name}
                      </span>
                    </div>
                    <span className="text-[10px] md:text-xs text-slate-500">
                      {backup.createdAt ? formatDate(backup.createdAt) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 md:py-8 text-slate-500">
                <span className="material-symbols-outlined text-[28px] md:text-[32px] mb-2 block">cloud_off</span>
                <p className="text-xs md:text-sm">백업이 없습니다.</p>
              </div>
            )}
          </div>
          <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="w-full px-3 md:px-4 py-1.5 md:py-2 bg-primary hover:bg-primary/90 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white disabled:text-slate-500 rounded-lg text-xs md:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 md:gap-2"
            >
              {isCreatingBackup ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px] md:text-[18px]">progress_activity</span>
                  백업 생성 중...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">add</span>
                  백업 생성
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
