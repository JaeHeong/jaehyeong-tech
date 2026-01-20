import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, type Comment, type CreateCommentData } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface CommentSectionProps {
  postId: string
  postAuthorId?: string
}

// Helper functions
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`
  return date.toLocaleDateString('ko-KR')
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Comment Form Component
interface CommentFormProps {
  postId: string
  parentId?: string
  onSubmit: (comment: Comment) => void
  onCancel?: () => void
  isReply?: boolean
}

function CommentForm({ postId, parentId, onSubmit, onCancel, isReply = false }: CommentFormProps) {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  const [content, setContent] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPassword, setGuestPassword] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!content.trim()) {
      setError('댓글 내용을 입력해주세요.')
      return
    }

    if (!isAuthenticated) {
      if (!guestName.trim()) {
        setError('이름을 입력해주세요.')
        return
      }
      if (!guestPassword || guestPassword.length < 4) {
        setError('비밀번호는 4자 이상이어야 합니다.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const data: CreateCommentData = {
        content: content.trim(),
        isPrivate,
      }

      if (parentId) {
        data.parentId = parentId
      }

      if (!isAuthenticated) {
        data.guestName = guestName.trim()
        data.guestPassword = guestPassword
      }

      const newComment = await api.createComment(postId, data)
      onSubmit(newComment)
      setContent('')
      setGuestName('')
      setGuestPassword('')
      setIsPrivate(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 작성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${isReply ? 'ml-8 md:ml-12 mt-3 md:mt-4' : ''}`}>
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 p-3 md:p-4">
        {/* Author info for logged in user */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
            <div className="size-7 md:size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs md:text-sm">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="size-7 md:size-8 rounded-full object-cover" />
              ) : (
                getInitials(user.name)
              )}
            </div>
            <span className="font-medium text-slate-900 dark:text-white text-xs md:text-sm">{user.name}</span>
          </div>
        )}

        {/* Guest info fields */}
        {!isAuthenticated && (
          <>
            {/* Login prompt */}
            <div className="flex items-center justify-between gap-2 md:gap-3 mb-3 md:mb-4 p-2 md:p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-slate-600 dark:text-slate-400">
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">account_circle</span>
                <span className="hidden sm:inline">로그인하면 더 편하게 댓글을 남길 수 있어요</span>
                <span className="sm:hidden">로그인하면 더 편해요</span>
              </div>
              <Link
                to="/login"
                state={{ from: location.pathname }}
                className="shrink-0 px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                로그인
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4">
              <input
                type="text"
                placeholder="이름 *"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                maxLength={50}
              />
              <input
                type="password"
                placeholder="비밀번호 *"
                value={guestPassword}
                onChange={(e) => setGuestPassword(e.target.value)}
                className="px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                maxLength={100}
              />
            </div>
          </>
        )}

        {/* Content textarea */}
        <textarea
          placeholder={isReply ? '답글을 입력하세요...' : '댓글을 입력하세요...'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          rows={2}
          maxLength={2000}
        />

        {/* Error message */}
        {error && (
          <p className="mt-1.5 md:mt-2 text-xs md:text-sm text-red-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] md:text-[16px]">error</span>
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-2 md:mt-3">
          {isAuthenticated ? (
            <label className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/20 size-3.5 md:size-4"
              />
              <span className="material-symbols-outlined text-[14px] md:text-[16px]">lock</span>
              <span className="hidden sm:inline">비공개 댓글</span>
              <span className="sm:hidden">비공개</span>
            </label>
          ) : (
            <div />
          )}

          <div className="flex gap-1.5 md:gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-2.5 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-2.5 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 md:gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[14px] md:text-[16px]">progress_activity</span>
                  <span className="hidden sm:inline">등록 중...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px] md:text-[16px]">send</span>
                  {isReply ? '답글' : '작성'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

// Comment Item Component
interface CommentItemProps {
  comment: Comment
  postId: string
  postAuthorId?: string
  isAdmin: boolean
  onReplyAdded: (parentId: string, reply: Comment) => void
  onCommentUpdated: (comment: Comment) => void
  onCommentDeleted: (commentId: string) => void
}

function CommentItem({
  comment,
  postId,
  postAuthorId,
  isAdmin,
  onReplyAdded,
  onCommentUpdated,
  onCommentDeleted,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [deletePassword, setDeletePassword] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEdit = isAdmin || comment.isOwner || (!comment.author && comment.guestName)
  const canDelete = isAdmin || comment.isOwner || (!comment.author && comment.guestName)
  const isGuestComment = !comment.author && comment.guestName
  const authorName = comment.author?.name || comment.guestName || '익명'
  const isPostAuthor = postAuthorId && comment.author?.id === postAuthorId

  const handleReplySubmit = (reply: Comment) => {
    // Use parent's id for replies to keep depth=1
    onReplyAdded(comment.parentId || comment.id, reply)
    setShowReplyForm(false)
  }

  const handleEdit = async () => {
    setError(null)
    if (!editContent.trim()) {
      setError('댓글 내용을 입력해주세요.')
      return
    }

    if (isGuestComment && !isAdmin && !editPassword) {
      setError('비밀번호를 입력해주세요.')
      return
    }

    setIsUpdating(true)
    try {
      const updated = await api.updateComment(comment.id, {
        content: editContent.trim(),
        guestPassword: isGuestComment && !isAdmin ? editPassword : undefined,
      })
      onCommentUpdated(updated)
      setShowEditForm(false)
      setEditPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 수정에 실패했습니다.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    setError(null)
    if (isGuestComment && !isAdmin && !deletePassword) {
      setError('비밀번호를 입력해주세요.')
      return
    }

    setIsDeleting(true)
    try {
      await api.deleteComment(comment.id, isGuestComment && !isAdmin ? deletePassword : undefined)
      onCommentDeleted(comment.id)
      setShowDeleteModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Deleted comment placeholder
  if (comment.isDeleted) {
    return (
      <div className="group">
        <div className="p-3 md:p-4 rounded-lg">
          {/* Header with anonymous profile */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="size-8 md:size-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0">
              <span className="material-symbols-outlined text-[18px] md:text-[22px]">person</span>
            </div>
            <div>
              <span className="font-medium text-slate-400 dark:text-slate-500 text-sm md:text-base">
                알 수 없음
              </span>
            </div>
          </div>
          {/* Deleted message */}
          <p className="mt-2 md:mt-3 text-slate-400 dark:text-slate-500 text-xs md:text-sm italic">
            삭제된 댓글입니다.
          </p>
        </div>
        {/* Show replies without opacity */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 md:mt-3 space-y-2 md:space-y-3">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="flex gap-1.5 md:gap-2 ml-2 md:ml-4">
                <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[16px] md:text-[20px] mt-1 shrink-0">
                  subdirectory_arrow_right
                </span>
                <div className="flex-1">
                  <CommentItem
                    comment={reply}
                    postId={postId}
                    postAuthorId={postAuthorId}
                    isAdmin={isAdmin}
                    onReplyAdded={onReplyAdded}
                    onCommentUpdated={onCommentUpdated}
                    onCommentDeleted={onCommentDeleted}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="group/comment">
      <div className="p-3 md:p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Avatar */}
            <div className="size-8 md:size-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-xs md:text-sm shrink-0">
              {comment.author?.avatar ? (
                <img
                  src={comment.author.avatar}
                  alt={authorName}
                  className="size-8 md:size-10 rounded-full object-cover"
                />
              ) : (
                getInitials(authorName)
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                <span className="font-bold text-slate-900 dark:text-white text-sm md:text-base">
                  {authorName}
                </span>
                {isPostAuthor && (
                  <span className="bg-primary/10 text-primary text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded font-bold uppercase">
                    Author
                  </span>
                )}
                {comment.isPrivate && (
                  <span className="text-slate-400 dark:text-slate-500">
                    <span className="material-symbols-outlined text-[12px] md:text-[14px]">lock</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                {formatDate(comment.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        {showEditForm ? (
          <div className="mt-2 md:mt-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              rows={2}
              maxLength={2000}
            />
            {isGuestComment && !isAdmin && (
              <input
                type="password"
                placeholder="비밀번호"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="mt-1.5 md:mt-2 w-full px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            )}
            {error && (
              <p className="mt-1.5 md:mt-2 text-xs md:text-sm text-red-500">{error}</p>
            )}
            <div className="flex gap-1.5 md:gap-2 mt-1.5 md:mt-2">
              <button
                onClick={handleEdit}
                disabled={isUpdating}
                className="px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
              >
                {isUpdating ? '수정 중...' : '수정'}
              </button>
              <button
                onClick={() => {
                  setShowEditForm(false)
                  setEditContent(comment.content)
                  setEditPassword('')
                  setError(null)
                }}
                className="px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <p className={`mt-2 md:mt-3 text-xs md:text-sm leading-relaxed whitespace-pre-wrap ${
            comment.isDeleted || (comment.isPrivate && comment.canView === false)
              ? 'text-slate-400 dark:text-slate-500 italic'
              : 'text-slate-700 dark:text-slate-300'
          }`}>
            {comment.content}
          </p>
        )}

        {/* Actions - hide for deleted comments */}
        {!showEditForm && !comment.isDeleted && (
          <div className="flex items-center gap-1.5 md:gap-2 mt-2 md:mt-3 md:opacity-0 md:group-hover/comment:opacity-100 transition-opacity">
            {/* Show reply button on all comments (replies will attach to parent, keeping depth=1) */}
            {comment.canView !== false && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] md:text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-0.5 md:gap-1"
              >
                <span className="material-symbols-outlined text-[14px] md:text-[16px]">reply</span>
                답글
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setShowEditForm(true)}
                className="px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] md:text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-0.5 md:gap-1"
              >
                <span className="material-symbols-outlined text-[14px] md:text-[16px]">edit</span>
                수정
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[11px] md:text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-0.5 md:gap-1"
              >
                <span className="material-symbols-outlined text-[14px] md:text-[16px]">delete</span>
                삭제
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reply Form - use parent's id for replies to keep depth=1 */}
      {showReplyForm && (
        <div className="ml-8 md:ml-12 mt-2">
          <CommentForm
            postId={postId}
            parentId={comment.parentId || comment.id}
            onSubmit={handleReplySubmit}
            onCancel={() => setShowReplyForm(false)}
            isReply
          />
        </div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 md:mt-3 space-y-2 md:space-y-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-1.5 md:gap-2 ml-2 md:ml-4">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[16px] md:text-[20px] mt-1 shrink-0">
                subdirectory_arrow_right
              </span>
              <div className="flex-1">
                <CommentItem
                  comment={reply}
                  postId={postId}
                  postAuthorId={postAuthorId}
                  isAdmin={isAdmin}
                  onReplyAdded={onReplyAdded}
                  onCommentUpdated={onCommentUpdated}
                  onCommentDeleted={onCommentDeleted}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowDeleteModal(false)
              setDeletePassword('')
              setError(null)
            }}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h3 className="text-lg font-bold">댓글 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              이 댓글을 삭제하시겠습니까?
            </p>
            {isGuestComment && !isAdmin && (
              <input
                type="password"
                placeholder="비밀번호"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-4"
              />
            )}
            {error && (
              <p className="text-sm text-red-500 mb-4">{error}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletePassword('')
                  setError(null)
                }}
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

// Main CommentSection Component
export default function CommentSection({ postId, postAuthorId }: CommentSectionProps) {
  const { user, isAdmin } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper to set isOwner based on current user
  const setOwnership = useCallback((comment: Comment): Comment => ({
    ...comment,
    isOwner: user?.id ? comment.author?.id === user.id : false,
    replies: comment.replies?.map(r => ({
      ...r,
      isOwner: user?.id ? r.author?.id === user.id : false,
    })),
  }), [user?.id])

  const fetchComments = useCallback(async () => {
    try {
      const data = await api.getComments(postId)
      setComments(data.comments.map(setOwnership))
      setTotalCount(data.totalCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [postId, setOwnership])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleNewComment = (comment: Comment) => {
    setComments([setOwnership(comment), ...comments])
    setTotalCount(totalCount + 1)
  }

  const handleReplyAdded = (parentId: string, reply: Comment) => {
    setComments(
      comments.map((c) => {
        if (c.id === parentId) {
          return {
            ...c,
            replies: [...(c.replies || []), setOwnership(reply)],
            replyCount: c.replyCount + 1,
          }
        }
        return c
      })
    )
    setTotalCount(totalCount + 1)
  }

  const handleCommentUpdated = (updated: Comment) => {
    setComments(
      comments.map((c) => {
        if (c.id === updated.id) {
          return { ...c, content: updated.content, isPrivate: updated.isPrivate }
        }
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === updated.id ? { ...r, content: updated.content, isPrivate: updated.isPrivate } : r
            ),
          }
        }
        return c
      })
    )
  }

  const handleCommentDeleted = (commentId: string) => {
    // Check if it's a top-level comment
    const isTopLevel = comments.some((c) => c.id === commentId)

    if (isTopLevel) {
      const comment = comments.find((c) => c.id === commentId)
      if (comment && comment.replyCount > 0) {
        // Has replies - mark as deleted
        setComments(
          comments.map((c) =>
            c.id === commentId ? { ...c, isDeleted: true, content: '삭제된 댓글입니다.' } : c
          )
        )
      } else {
        // No replies - remove completely
        setComments(comments.filter((c) => c.id !== commentId))
      }
    } else {
      // It's a reply - remove from parent's replies
      setComments(
        comments.map((c) => ({
          ...c,
          replies: c.replies?.filter((r) => r.id !== commentId),
          replyCount: c.replies?.some((r) => r.id === commentId) ? c.replyCount - 1 : c.replyCount,
        }))
      )
    }
    setTotalCount(totalCount - 1)
  }

  if (isLoading) {
    return (
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8">
        <div className="flex justify-center items-center">
          <span className="material-symbols-outlined animate-spin text-2xl md:text-3xl text-primary">
            progress_activity
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-base md:text-xl font-bold flex items-center gap-1.5 md:gap-2">
          <span className="material-symbols-outlined text-primary text-[20px] md:text-[24px]">forum</span>
          댓글
          <span className="text-sm md:text-base font-normal text-slate-500">({totalCount})</span>
        </h2>
      </div>

      {/* Comment Form */}
      <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800">
        <CommentForm postId={postId} onSubmit={handleNewComment} />
      </div>

      {/* Comments List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {error ? (
          <div className="p-6 md:p-8 text-center text-red-500">
            <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4 block">error</span>
            <p className="text-sm md:text-base">{error}</p>
          </div>
        ) : comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              postAuthorId={postAuthorId}
              isAdmin={isAdmin}
              onReplyAdded={handleReplyAdded}
              onCommentUpdated={handleCommentUpdated}
              onCommentDeleted={handleCommentDeleted}
            />
          ))
        ) : (
          <div className="p-6 md:p-8 text-center text-slate-500">
            <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4 block opacity-50">chat_bubble</span>
            <p className="text-sm md:text-base">첫 번째 댓글을 남겨보세요!</p>
          </div>
        )}
      </div>
    </div>
  )
}
