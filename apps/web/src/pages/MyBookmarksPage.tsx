import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { BookmarkedPost } from '../services/api'
import { useModal } from '../contexts/ModalContext'
import { useAuth } from '../contexts/AuthContext'
import LimitSelector from '../components/LimitSelector'

const FIXED_LIMIT = 5

export default function MyBookmarksPage() {
  const { confirm, alert } = useModal()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState<BookmarkedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAllMode, setIsAllMode] = useState(false)

  const currentPage = parseInt(searchParams.get('page') || '1', 10)

  const fetchBookmarks = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await api.getMyBookmarks({
        page: currentPage,
        limit: isAllMode ? 9999 : FIXED_LIMIT,
      })
      setPosts(result.posts)
      setTotalPages(result.pagination.totalPages)
      setTotal(result.pagination.total)
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, isAllMode])

  const handleToggleAll = () => {
    setIsAllMode((prev) => !prev)
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('page', '1')
      return params
    })
  }

  useEffect(() => {
    if (user) {
      fetchBookmarks()
    }
  }, [user, fetchBookmarks])

  // 페이지 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds([])
  }, [currentPage])

  // ESC 키로 선택 초기화
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handlePageChange = (page: number) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('page', String(page))
      return params
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRemoveBookmark = async (postId: string) => {
    const confirmed = await confirm({
      title: '북마크 삭제',
      message: '이 게시글을 북마크에서 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    })

    if (!confirmed) return

    try {
      await api.removeBookmark(postId)
      setSelectedIds((prev) => prev.filter((id) => id !== postId))
      // 삭제 후 현재 페이지 다시 불러오기
      fetchBookmarks()
    } catch {
      await alert({
        title: '오류',
        message: '북마크 삭제에 실패했습니다.',
        type: 'error',
      })
    }
  }

  const handleBulkRemove = async () => {
    if (selectedIds.length === 0) return

    const confirmed = await confirm({
      title: '북마크 일괄 삭제',
      message: `선택한 ${selectedIds.length}개의 북마크를 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    })

    if (!confirmed) return

    try {
      await Promise.all(selectedIds.map((id) => api.removeBookmark(id)))
      setSelectedIds([])
      // 삭제 후 현재 페이지 다시 불러오기
      fetchBookmarks()
    } catch {
      await alert({
        title: '오류',
        message: '일부 북마크 삭제에 실패했습니다.',
        type: 'error',
      })
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.length === posts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(posts.map((p) => p.id))
    }
  }

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '')
  }

  // Get last bookmark date
  const firstPost = posts[0]
  const lastBookmarkDate = firstPost
    ? formatDate(firstPost.bookmarkedAt)
    : '-'

  // Pagination logic
  const renderPagination = () => {
    if (totalPages <= 1) return null

    const pagesDesktop: (number | 'ellipsis-left' | 'ellipsis-right')[] = []
    const pagesMobile: (number | 'ellipsis-left' | 'ellipsis-right')[] = []

    // Desktop logic
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pagesDesktop.push(i)
    } else if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pagesDesktop.push(i)
      pagesDesktop.push('ellipsis-right')
      pagesDesktop.push(totalPages)
    } else if (currentPage >= totalPages - 3) {
      pagesDesktop.push(1)
      pagesDesktop.push('ellipsis-left')
      for (let i = totalPages - 4; i <= totalPages; i++) pagesDesktop.push(i)
    } else {
      pagesDesktop.push(1)
      pagesDesktop.push('ellipsis-left')
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pagesDesktop.push(i)
      pagesDesktop.push('ellipsis-right')
      pagesDesktop.push(totalPages)
    }

    // Mobile logic
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pagesMobile.push(i)
    } else if (currentPage <= 2) {
      for (let i = 1; i <= 3; i++) pagesMobile.push(i)
      pagesMobile.push('ellipsis-right')
      pagesMobile.push(totalPages)
    } else if (currentPage >= totalPages - 1) {
      pagesMobile.push(1)
      pagesMobile.push('ellipsis-left')
      for (let i = totalPages - 2; i <= totalPages; i++) pagesMobile.push(i)
    } else {
      pagesMobile.push(1)
      pagesMobile.push('ellipsis-left')
      pagesMobile.push(currentPage)
      pagesMobile.push('ellipsis-right')
      pagesMobile.push(totalPages)
    }

    const renderPages = (pages: (number | 'ellipsis-left' | 'ellipsis-right')[], isMobile: boolean) =>
      pages.map((page, idx) => {
        if (page === 'ellipsis-left' || page === 'ellipsis-right') {
          return <span key={`${isMobile ? 'm' : 'd'}-${page}`} className="text-slate-400 px-1 md:px-2">...</span>
        }
        return (
          <button
            type="button"
            key={`${isMobile ? 'm' : 'd'}-${idx}`}
            onClick={() => handlePageChange(page)}
            className={`min-w-[32px] h-8 px-2 md:px-3 rounded-lg text-sm font-medium transition-colors ${
              currentPage === page
                ? 'bg-primary text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {page}
          </button>
        )
      })

    return (
      <div className="flex justify-center items-center gap-1 pt-6">
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {renderPages(pagesDesktop, false)}
        </div>
        {/* Mobile */}
        <div className="flex md:hidden items-center gap-1">
          {renderPages(pagesMobile, true)}
        </div>
        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container-wrapper py-12 text-center">
        <p className="text-slate-500">로그인이 필요합니다.</p>
        <Link to="/login" className="text-primary hover:underline mt-2 inline-block">
          로그인하기
        </Link>
      </div>
    )
  }

  return (
    <div className="container-wrapper py-4 md:py-8">
      {/* Header */}
      <div className="flex flex-col gap-2 md:gap-4 mb-4 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl md:text-2xl">bookmark</span>
          내 북마크
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm">
          저장한 게시글을 관리할 수 있습니다.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
        {/* Activity Summary - Mobile Only (Top) */}
        <aside className="lg:hidden space-y-4">
          <div className="bg-card-light dark:bg-card-dark rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                내 북마크 요약
              </h2>
            </div>
            <div className="p-3 flex gap-6">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">bookmark</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500">총 북마크</span>
                  <span className="font-bold text-sm">{total}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">history</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500">최근 저장</span>
                  <span className="font-bold text-xs">{lastBookmarkDate}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-8 space-y-4 md:space-y-6">
          {/* Filter Bar */}
          <div className="flex items-center justify-between bg-card-light dark:bg-card-dark p-3 md:p-4 rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="text-xs md:text-sm font-medium">
                전체 <span className="text-primary">{total}</span>개
              </div>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkRemove}
                  className="px-2 py-1 text-[10px] md:text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  선택 삭제 ({selectedIds.length})
                </button>
              )}
            </div>
            <LimitSelector
              defaultLimit={FIXED_LIMIT}
              isAll={isAllMode}
              onToggle={handleToggleAll}
            />
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8">
              <div className="flex justify-center items-center">
                <span className="material-symbols-outlined animate-spin text-2xl md:text-3xl text-primary">
                  progress_activity
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {posts.length > 0 ? (
                <>
                  {/* Select All - Desktop */}
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === posts.length && posts.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 dark:border-slate-600"
                    />
                    <span>전체 선택</span>
                  </div>

                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className={`bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:border-primary/30 transition-all ${
                        selectedIds.includes(post.id) ? 'border-primary/50 bg-primary/5' : ''
                      }`}
                    >
                      <div className="p-3 md:p-5">
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(post.id)}
                            onChange={() => handleSelect(post.id)}
                            className="rounded border-slate-300 dark:border-slate-600 mt-0.5"
                          />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-1 md:mb-2">
                              <div className="flex flex-col gap-0.5 md:gap-1 flex-1 min-w-0">
                                <Link
                                  to={`/posts/${post.slug}`}
                                  className="text-sm md:text-base font-bold text-slate-900 dark:text-white hover:text-primary line-clamp-1"
                                >
                                  {post.title}
                                </Link>
                                <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {post.excerpt}
                                </p>
                              </div>
                              <div className="flex gap-0.5 md:gap-1 shrink-0 ml-2">
                                <Link
                                  to={`/posts/${post.slug}`}
                                  className="p-1.5 md:p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                  title="보기"
                                >
                                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">visibility</span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBookmark(post.id)}
                                  className="p-1.5 md:p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="북마크 삭제"
                                >
                                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">bookmark_remove</span>
                                </button>
                              </div>
                            </div>
                            {/* Meta */}
                            <div className="flex items-center gap-2 text-[10px] md:text-[11px] text-slate-400">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {post.category.name}
                              </span>
                              <span>·</span>
                              <span>{formatDate(post.bookmarkedAt)} 저장</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {renderPagination()}
                </>
              ) : (
                <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-center py-10 md:py-16 text-slate-500">
                    <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4 block">bookmark_border</span>
                    <p className="text-sm md:text-base">아직 북마크한 게시글이 없습니다.</p>
                    <Link
                      to="/posts"
                      className="inline-flex items-center gap-1 mt-3 md:mt-4 text-primary hover:underline text-xs md:text-sm"
                    >
                      게시글 둘러보기
                      <span className="material-symbols-outlined text-[14px] md:text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Sidebar - Desktop Only */}
        <aside className="hidden lg:block lg:col-span-4 space-y-4 md:space-y-6">
          {/* Activity Summary */}
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                내 북마크 요약
              </h2>
            </div>
            <div className="p-3 md:p-5 space-y-3 md:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="size-7 md:size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">bookmark</span>
                  </div>
                  <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">저장한 게시글</span>
                </div>
                <span className="font-bold text-base md:text-lg">{total}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="size-7 md:size-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">history</span>
                  </div>
                  <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">최근 저장일</span>
                </div>
                <span className="font-bold text-xs md:text-sm">{lastBookmarkDate}</span>
              </div>
            </div>
          </div>

          {/* Help Box */}
          <div className="p-3 md:p-5 rounded-lg md:rounded-xl bg-blue-500/5 border border-blue-500/20">
            <div className="flex gap-2 md:gap-3">
              <span className="material-symbols-outlined text-primary text-[18px] md:text-[20px] shrink-0">info</span>
              <div className="flex flex-col gap-0.5 md:gap-1">
                <span className="text-xs md:text-sm font-bold text-primary">도움말</span>
                <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  게시글 상세 페이지에서 북마크 버튼을 눌러 저장할 수 있습니다. ESC 키로 선택을 해제할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
