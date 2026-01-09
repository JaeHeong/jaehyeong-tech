import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, type MyComment } from '../services/api'

export default function MyCommentsPage() {
  const [comments, setComments] = useState<MyComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest')

  // Edit modal state
  const [editModal, setEditModal] = useState<{ isOpen: boolean; comment: MyComment | null }>({
    isOpen: false,
    comment: null,
  })
  const [editContent, setEditContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; comment: MyComment | null }>({
    isOpen: false,
    comment: null,
  })
  const [isDeleting, setIsDeleting] = useState(false)

  // ESC key handler to close modals
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editModal.isOpen) {
          setEditModal({ isOpen: false, comment: null })
          setEditContent('')
        }
        if (deleteModal.isOpen) {
          setDeleteModal({ isOpen: false, comment: null })
        }
      }
    }
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [editModal.isOpen, deleteModal.isOpen])

  const fetchComments = useCallback(async (pageNum: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.getMyComments({
        page: pageNum,
        limit: 5,
        order: sortOrder === 'latest' ? 'desc' : 'asc'
      })
      setComments(response.data)
      setTotalPages(response.meta.totalPages)
      setTotal(response.meta.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [sortOrder])

  useEffect(() => {
    fetchComments(currentPage)
  }, [currentPage, fetchComments])

  // Reset to page 1 when sort order changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sortOrder])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEdit = async () => {
    if (!editModal.comment || !editContent.trim()) return

    setIsEditing(true)
    try {
      await api.updateComment(editModal.comment.id, { content: editContent.trim() })
      setComments(comments.map((c) =>
        c.id === editModal.comment?.id ? { ...c, content: editContent.trim() } : c
      ))
      setEditModal({ isOpen: false, comment: null })
      setEditContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 수정에 실패했습니다.')
    } finally {
      setIsEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.comment) return

    setIsDeleting(true)
    try {
      await api.deleteComment(deleteModal.comment.id)
      // 삭제 후 현재 페이지 다시 불러오기
      fetchComments(currentPage)
      setDeleteModal({ isOpen: false, comment: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const openEditModal = (comment: MyComment) => {
    setEditContent(comment.content)
    setEditModal({ isOpen: true, comment })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '.').replace('.', '')
  }

  // Get last activity date
  const firstComment = comments[0]
  const lastActivityDate = firstComment
    ? formatDate(firstComment.createdAt)
    : '-'

  // Pagination logic (same as PostListPage)
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

    // Mobile logic (중간 1개)
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
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>
    )
  }

  return (
    <div className="container-wrapper py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8">
        <h1 className="text-2xl font-bold">
          내 댓글 관리 <span className="text-sm font-normal text-slate-500 ml-2">(게스트)</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          작성하신 댓글을 수정하거나 삭제할 수 있습니다.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <main className="lg:col-span-8 space-y-6">
          {/* Filter Bar */}
          <div className="flex items-center justify-between bg-card-light dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-sm font-medium">
              전체 <span className="text-primary">{total}</span>건
            </div>
            <div className="flex gap-2">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'latest' | 'oldest')}
                className="text-xs bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-1 focus:ring-primary/20 cursor-pointer"
              >
                <option value="latest">최신순</option>
                <option value="oldest">오래된순</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-8">
              <div className="flex justify-center items-center">
                <span className="material-symbols-outlined animate-spin text-3xl text-primary">
                  progress_activity
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.length > 0 ? (
                <>
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:border-primary/30 transition-all"
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex flex-col gap-1">
                            <Link
                              to={`/posts/${comment.post.slug}`}
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">article</span>
                              {comment.post.title}
                            </Link>
                            <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                              {formatDate(comment.createdAt)}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditModal(comment)}
                              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="수정"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteModal({ isOpen: true, comment })}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="삭제"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                          {comment.content}
                        </p>
                        {/* Meta badges */}
                        {(comment.isPrivate || comment.parentId || comment.replyCount > 0) && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {comment.isPrivate && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">lock</span>
                                비공개
                              </span>
                            )}
                            {comment.parentId && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">reply</span>
                                답글
                              </span>
                            )}
                            {comment.replyCount > 0 && (
                              <span className="text-[11px] text-slate-400">
                                답글 {comment.replyCount}개
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {renderPagination()}
                </>
              ) : (
                <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-center py-16 text-slate-500">
                    <span className="material-symbols-outlined text-[48px] mb-4 block">chat</span>
                    <p className="text-base">아직 작성한 댓글이 없습니다.</p>
                    <Link
                      to="/posts"
                      className="inline-flex items-center gap-1 mt-4 text-primary hover:underline text-sm"
                    >
                      글 목록 보러가기
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Activity Summary */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                내 활동 요약
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">forum</span>
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">총 작성 댓글</span>
                </div>
                <span className="font-bold text-lg">{total}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">history</span>
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">최근 활동일</span>
                </div>
                <span className="font-bold text-sm">{lastActivityDate}</span>
              </div>
            </div>
          </div>

          {/* Help Box */}
          <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <div className="flex gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">info</span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-primary">도움말</span>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Google 계정으로 로그인하면 어떤 기기에서든 본인의 댓글을 관리할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditModal({ isOpen: false, comment: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined text-[24px]">edit</span>
              </div>
              <h3 className="text-lg font-bold">댓글 수정</h3>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-32 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="댓글 내용을 입력하세요..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setEditModal({ isOpen: false, comment: null })}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleEdit}
                disabled={isEditing || !editContent.trim()}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isEditing ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, comment: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <h3 className="text-lg font-bold">댓글 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-base">
              이 댓글을 삭제하시겠습니까? {deleteModal.comment?.replyCount ? '답글이 있는 댓글은 내용만 삭제됩니다.' : '삭제된 댓글은 복구할 수 없습니다.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, comment: null })}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
