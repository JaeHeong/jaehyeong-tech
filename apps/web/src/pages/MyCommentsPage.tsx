import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, type MyComment } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function MyCommentsPage() {
  const { user } = useAuth()
  const [comments, setComments] = useState<MyComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

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

  const fetchComments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.getMyComments({ page, limit: 10 })
      setComments(response.data)
      setTotalPages(response.meta.totalPages)
      setTotal(response.meta.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

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
      setComments(comments.filter((c) => c.id !== deleteModal.comment?.id))
      setTotal(total - 1)
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-4 md:pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || 'User'}
              className="size-12 rounded-full object-cover"
            />
          ) : (
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-bold">내 댓글 관리</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-0.5">
              총 {total}개의 댓글을 작성했습니다
            </p>
          </div>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          홈으로 돌아가기
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 md:p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">error</span>
            <span className="text-xs md:text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="mt-6 bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8">
          <div className="flex justify-center items-center">
            <span className="material-symbols-outlined animate-spin text-2xl md:text-3xl text-primary">
              progress_activity
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Comments List */}
          <div className="mt-6 bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {comments.length > 0 ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-4 md:p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex flex-col gap-3">
                      {/* Comment Content */}
                      <p className="text-slate-700 dark:text-slate-300 text-sm md:text-base leading-relaxed">
                        {comment.content}
                      </p>

                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{formatDate(comment.createdAt)}</span>
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
                          <span className="text-slate-400">
                            답글 {comment.replyCount}개
                          </span>
                        )}
                      </div>

                      {/* Post Link & Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Link
                          to={`/posts/${comment.post.slug}`}
                          className="text-xs md:text-sm text-primary hover:underline flex items-center gap-1 line-clamp-1"
                        >
                          <span className="material-symbols-outlined text-[14px] md:text-[16px]">article</span>
                          <span className="line-clamp-1">{comment.post.title}</span>
                        </Link>

                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditModal(comment)}
                            className="px-2 md:px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px] md:text-[16px]">edit</span>
                            수정
                          </button>
                          <button
                            onClick={() => setDeleteModal({ isOpen: true, comment })}
                            className="px-2 md:px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px] md:text-[16px]">delete</span>
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 md:py-20 text-slate-500">
                <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4 block">chat</span>
                <p className="text-sm md:text-base">아직 작성한 댓글이 없습니다.</p>
                <Link
                  to="/posts"
                  className="inline-flex items-center gap-1 mt-4 text-primary hover:underline text-sm"
                >
                  글 목록 보러가기
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm text-slate-500 hover:text-primary disabled:opacity-50 transition-colors"
                >
                  이전
                </button>
                <span className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400">
                  페이지 {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm text-slate-500 hover:text-primary disabled:opacity-50 transition-colors"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditModal({ isOpen: false, comment: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">edit</span>
              </div>
              <h3 className="text-base md:text-lg font-bold">댓글 수정</h3>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-32 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="댓글 내용을 입력하세요..."
            />
            <div className="flex gap-2 md:gap-3 justify-end mt-4">
              <button
                onClick={() => setEditModal({ isOpen: false, comment: null })}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleEdit}
                disabled={isEditing || !editContent.trim()}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
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
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">warning</span>
              </div>
              <h3 className="text-base md:text-lg font-bold">댓글 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 md:mb-6 text-sm md:text-base">
              이 댓글을 삭제하시겠습니까? {deleteModal.comment?.replyCount ? '답글이 있는 댓글은 내용만 삭제됩니다.' : '삭제된 댓글은 복구할 수 없습니다.'}
            </p>
            <div className="flex gap-2 md:gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, comment: null })}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
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
