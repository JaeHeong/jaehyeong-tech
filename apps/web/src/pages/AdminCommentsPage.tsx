import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, type AdminComment } from '../services/api'

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<AdminComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; comment: AdminComment | null }>({
    isOpen: false,
    comment: null,
  })
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchComments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.getAdminComments({ page, limit: 7, includeDeleted })
      setComments(response.data)
      setTotalPages(response.meta.totalPages)
      setTotal(response.meta.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [page, includeDeleted])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleDelete = async () => {
    if (!deleteModal.comment) return

    setIsDeleting(true)
    try {
      await api.adminDeleteComment(deleteModal.comment.id)
      setComments(comments.filter((c) => c.id !== deleteModal.comment?.id))
      setTotal(total - 1)
      setDeleteModal({ isOpen: false, comment: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getAuthorName = (comment: AdminComment) => {
    return comment.author?.name || comment.guestName || '익명'
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold">댓글 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            블로그 댓글을 관리합니다. 총 {total}개의 댓글
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => {
              setIncludeDeleted(e.target.checked)
              setPage(1)
            }}
            className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/20"
          />
          삭제된 댓글 포함
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

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
        <>
          {/* Comments List */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {comments.length > 0 ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                      comment.isDeleted ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Avatar */}
                      <div className="shrink-0">
                        {comment.author?.avatar ? (
                          <img
                            src={comment.author.avatar}
                            alt={getAuthorName(comment)}
                            className="size-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {getInitials(getAuthorName(comment))}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {getAuthorName(comment)}
                          </span>
                          {!comment.author && comment.guestName && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              익명
                            </span>
                          )}
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500">{formatDate(comment.createdAt)}</span>
                          {comment.isPrivate && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">lock</span>
                              비공개
                            </span>
                          )}
                          {comment.isDeleted && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                              삭제됨
                            </span>
                          )}
                          {comment.parentId && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">reply</span>
                              답글
                            </span>
                          )}
                        </div>

                        <p className="text-slate-600 dark:text-slate-300 mb-3 text-sm leading-relaxed">
                          {comment.isDeleted ? (
                            <span className="italic text-slate-400">삭제된 댓글입니다.</span>
                          ) : (
                            comment.content
                          )}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <Link
                            to={`/posts/${comment.post.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">article</span>
                            {comment.post.title}
                          </Link>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setDeleteModal({ isOpen: true, comment })}
                              className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                              {comment.isDeleted ? '완전 삭제' : '삭제'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500">
                <span className="material-symbols-outlined text-[48px] mb-4 block">chat</span>
                <p>댓글이 없습니다.</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-primary disabled:opacity-50 transition-colors"
                >
                  이전
                </button>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  페이지 {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-primary disabled:opacity-50 transition-colors"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, comment: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h3 className="text-lg font-bold">댓글 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {deleteModal.comment?.isDeleted ? (
                <>이미 삭제 처리된 댓글을 완전히 삭제하시겠습니까? 답글이 있다면 함께 삭제됩니다.</>
              ) : (
                <>
                  <strong className="text-slate-900 dark:text-white">
                    {deleteModal.comment && getAuthorName(deleteModal.comment)}
                  </strong>
                  님의 댓글을 완전히 삭제하시겠습니까? 답글이 있다면 함께 삭제됩니다.
                </>
              )}
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
    </>
  )
}
