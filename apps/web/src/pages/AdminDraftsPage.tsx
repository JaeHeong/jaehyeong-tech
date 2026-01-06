import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api, { Post } from '../services/api'

export default function AdminDraftsPage() {
  const [drafts, setDrafts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; draft: Post | null }>({
    isOpen: false,
    draft: null,
  })

  useEffect(() => {
    const fetchDrafts = async () => {
      setIsLoading(true)
      try {
        const { posts } = await api.getPosts({ status: 'DRAFT', limit: 50 })
        setDrafts(posts)
      } catch (error) {
        console.error('Failed to fetch drafts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDrafts()
  }, [])

  const handleDelete = async () => {
    if (!deleteModal.draft) return

    try {
      await api.deletePost(deleteModal.draft.id)
      setDrafts(drafts.filter((d) => d.id !== deleteModal.draft?.id))
      setDeleteModal({ isOpen: false, draft: null })
    } catch (error) {
      console.error('Failed to delete draft:', error)
      alert('삭제에 실패했습니다.')
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

  const getWordCount = (content: string) => {
    const text = content.replace(/<[^>]*>/g, ' ')
    return text.split(/\s+/).filter((word) => word.length > 0).length
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold">임시 저장 글</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            작성 중인 글을 관리합니다. ({drafts.length}개)
          </p>
        </div>
        <Link
          to="/admin/posts/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          새 글 작성
        </Link>
      </div>

      {/* Drafts List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      ) : drafts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:border-primary/30 transition-colors group"
            >
              {/* Cover Preview */}
              <div className="h-32 relative overflow-hidden">
                {draft.coverImage ? (
                  <img
                    src={draft.coverImage}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
                      edit_note
                    </span>
                  </div>
                )}
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  임시저장
                </span>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <span className="font-medium text-primary">{draft.category?.name || '미분류'}</span>
                  <span>•</span>
                  <span>{formatDate(draft.updatedAt)}</span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {draft.title || '제목 없음'}
                </h3>

                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                  {draft.excerpt || '내용 없음...'}
                </p>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span>{getWordCount(draft.content)} 단어</span>
                  <span>약 {draft.readingTime}분 읽기</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t border-slate-200 dark:border-slate-800">
                <Link
                  to={`/admin/posts/${draft.id}/edit`}
                  className="flex-1 py-3 text-center text-sm font-medium text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  계속 작성
                </Link>
                <button
                  onClick={() => setDeleteModal({ isOpen: true, draft })}
                  className="flex-1 py-3 text-center text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border-l border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 mb-4 block">
            edit_note
          </span>
          <p className="text-slate-500 dark:text-slate-400 mb-4">임시 저장된 글이 없습니다.</p>
          <Link
            to="/admin/posts/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            새 글 작성하기
          </Link>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, draft: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h3 className="text-lg font-bold">임시 저장 글 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              <strong className="text-slate-900 dark:text-white">
                "{deleteModal.draft?.title || '제목 없음'}"
              </strong>
              을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, draft: null })}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
