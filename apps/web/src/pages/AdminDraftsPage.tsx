import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api, { Draft } from '../services/api'
import { useModal } from '../contexts/ModalContext'
import LimitSelector from '../components/LimitSelector'
import { getPageLimit } from '../utils/paginationSettings'

export default function AdminDraftsPage() {
  const { alert } = useModal()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; draft: Draft | null }>({
    isOpen: false,
    draft: null,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const defaultLimit = getPageLimit('drafts')
  const [isAllMode, setIsAllMode] = useState(false)
  const limit = isAllMode ? 0 : defaultLimit

  // Client-side pagination
  const totalPages = limit === 0 ? 1 : Math.ceil(drafts.length / limit)
  const paginatedDrafts = useMemo(() => {
    if (limit === 0) return drafts
    const start = (currentPage - 1) * limit
    return drafts.slice(start, start + limit)
  }, [drafts, currentPage, limit])

  const handleToggleAll = () => {
    setIsAllMode(!isAllMode)
    setCurrentPage(1)
  }

  useEffect(() => {
    const fetchDrafts = async () => {
      setIsLoading(true)
      try {
        const { drafts: fetchedDrafts } = await api.getDrafts()
        setDrafts(fetchedDrafts)
      } catch (error) {
        console.error('Failed to fetch drafts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDrafts()
  }, [])

  const [isDeleting, setIsDeleting] = useState(false)

  // ESC/Enter key handler for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (deleteModal.isOpen) {
        if (e.key === 'Escape') {
          setDeleteModal({ isOpen: false, draft: null })
        } else if (e.key === 'Enter' && !isDeleting) {
          e.preventDefault()
          handleDelete()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [deleteModal.isOpen, isDeleting])

  const handleDelete = async () => {
    if (!deleteModal.draft || isDeleting) return

    setIsDeleting(true)
    try {
      await api.deleteDraft(deleteModal.draft.id)
      setDrafts(drafts.filter((d) => d.id !== deleteModal.draft?.id))
      setDeleteModal({ isOpen: false, draft: null })
    } catch (error) {
      console.error('Failed to delete draft:', error)
      await alert({ message: '삭제에 실패했습니다.', type: 'error' })
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

  const getWordCount = (content: string) => {
    const text = content.replace(/<[^>]*>/g, ' ')
    return text.split(/\s+/).filter((word) => word.length > 0).length
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-4 md:pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">임시 저장 글</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-0.5 md:mt-1">
            작성 중인 글을 관리합니다. ({drafts.length}개)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LimitSelector defaultLimit={defaultLimit} isAll={isAllMode} onToggle={handleToggleAll} />
          <Link
            to="/admin/posts/new"
            className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs md:text-sm font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">add</span>
            새 글 작성
          </Link>
        </div>
      </div>

      {/* Drafts List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12 md:py-20">
          <span className="material-symbols-outlined animate-spin text-2xl md:text-4xl text-primary">
            progress_activity
          </span>
        </div>
      ) : drafts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {paginatedDrafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:border-primary/30 transition-colors group"
            >
              {/* Cover Preview */}
              <div className="h-24 md:h-32 relative overflow-hidden">
                {draft.coverImage ? (
                  <img
                    src={draft.coverImage}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl md:text-4xl text-slate-300 dark:text-slate-600">
                      edit_note
                    </span>
                  </div>
                )}
                <span className="absolute top-1.5 md:top-2 right-1.5 md:right-2 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  임시저장
                </span>
              </div>

              {/* Content */}
              <div className="p-3 md:p-4">
                <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500 mb-1.5 md:mb-2">
                  <span>{formatDate(draft.updatedAt)}</span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base mb-1.5 md:mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {draft.title || '제목 없음'}
                </h3>

                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 md:mb-4">
                  {draft.excerpt || '내용 없음...'}
                </p>

                {/* Meta */}
                <div className="flex items-center justify-between text-[10px] md:text-xs text-slate-400 pt-2 md:pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span>{getWordCount(draft.content)} 단어</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t border-slate-200 dark:border-slate-800">
                <Link
                  to={`/admin/drafts/${draft.id}/edit`}
                  className="flex-1 py-2 md:py-3 text-center text-xs md:text-sm font-medium text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">edit</span>
                  계속 작성
                </Link>
                <button
                  onClick={() => setDeleteModal({ isOpen: true, draft })}
                  className="flex-1 py-2 md:py-3 text-center text-xs md:text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border-l border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">delete</span>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 md:p-12 text-center">
          <span className="material-symbols-outlined text-[36px] md:text-[48px] text-slate-300 dark:text-slate-600 mb-3 md:mb-4 block">
            edit_note
          </span>
          <p className="text-slate-500 dark:text-slate-400 mb-3 md:mb-4 text-sm md:text-base">임시 저장된 글이 없습니다.</p>
          <Link
            to="/admin/posts/new"
            className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs md:text-sm font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">add</span>
            새 글 작성하기
          </Link>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px] md:text-[20px]">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number
              if (totalPages <= 5) {
                page = i + 1
              } else if (currentPage <= 3) {
                page = i + 1
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i
              } else {
                page = currentPage - 2 + i
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-primary text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px] md:text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, draft: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">warning</span>
              </div>
              <h3 className="text-base md:text-lg font-bold">임시 저장 글 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 md:mb-6 text-sm md:text-base">
              <strong className="text-slate-900 dark:text-white">
                "{deleteModal.draft?.title || '제목 없음'}"
              </strong>
              을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2 md:gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, draft: null })}
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
    </>
  )
}
