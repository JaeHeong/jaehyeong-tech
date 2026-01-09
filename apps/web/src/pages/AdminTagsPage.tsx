import { useState, useEffect, useRef, useMemo } from 'react'
import api, { Tag, CreateTagData } from '../services/api'
import LimitSelector from '../components/LimitSelector'
import { getPageLimit } from '../utils/paginationSettings'

interface ApiError {
  message: string
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [editingTag, setEditingTag] = useState<{ id: string; name: string } | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; tag: Tag | null }>({
    isOpen: false,
    tag: null,
  })
  const [isDeleting, setIsDeleting] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const defaultLimit = getPageLimit('tags')
  const [isAllMode, setIsAllMode] = useState(false)
  const limit = isAllMode ? 0 : defaultLimit

  // Client-side pagination
  const totalPages = limit === 0 ? 1 : Math.ceil(tags.length / limit)
  const paginatedTags = useMemo(() => {
    if (limit === 0) return tags
    const start = (currentPage - 1) * limit
    return tags.slice(start, start + limit)
  }, [tags, currentPage, limit])

  const handleToggleAll = () => {
    setIsAllMode(!isAllMode)
    setCurrentPage(1)
  }

  useEffect(() => {
    fetchTags()
  }, [])

  useEffect(() => {
    if (editingTag && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingTag])

  // ESC/Enter key handler for delete modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (deleteModal.isOpen) {
        if (e.key === 'Escape') {
          setDeleteModal({ isOpen: false, tag: null })
        } else if (e.key === 'Enter' && !isDeleting) {
          e.preventDefault()
          handleDelete()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [deleteModal.isOpen, isDeleting])

  const fetchTags = async () => {
    setIsLoading(true)
    try {
      const { tags } = await api.getTags()
      setTags(tags)
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagName.trim()) return

    setError(null)
    setIsSaving(true)

    try {
      const data: CreateTagData = { name: newTagName.trim() }
      const created = await api.createTag(data)
      setTags([...tags, created])
      setNewTagName('')
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || '태그 생성에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartEdit = (tag: Tag) => {
    setEditingTag({ id: tag.id, name: tag.name })
  }

  const handleCancelEdit = () => {
    setEditingTag(null)
  }

  const handleSaveEdit = async () => {
    if (!editingTag || !editingTag.name.trim()) {
      setEditingTag(null)
      return
    }

    const originalTag = tags.find((t) => t.id === editingTag.id)
    if (!originalTag || originalTag.name === editingTag.name.trim()) {
      setEditingTag(null)
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const updated = await api.updateTag(editingTag.id, { name: editingTag.name.trim() })
      setTags(tags.map((t) => (t.id === editingTag.id ? { ...updated, postCount: t.postCount } : t)))
      setEditingTag(null)
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || '태그 수정에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.tag) return
    setError(null)
    setIsDeleting(true)

    try {
      await api.deleteTag(deleteModal.tag.id)
      setTags(tags.filter((t) => t.id !== deleteModal.tag?.id))
      setDeleteModal({ isOpen: false, tag: null })
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || '태그 삭제에 실패했습니다.')
      setDeleteModal({ isOpen: false, tag: null })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-4 md:pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">태그 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-0.5 md:mt-1">
            게시물에 사용되는 태그를 생성, 수정 및 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LimitSelector defaultLimit={defaultLimit} isAll={isAllMode} onToggle={handleToggleAll} />
          <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
            총 <span className="font-bold text-primary">{tags.length}</span>개의 태그
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 md:p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">error</span>
            <span className="text-xs md:text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Add New Tag */}
        <div className="p-3 md:p-6 bg-slate-50/80 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
          <label className="block text-xs md:text-sm font-bold mb-2 md:mb-3 text-slate-700 dark:text-slate-300">
            새 태그 추가하기
          </label>
          <form onSubmit={handleAddTag} className="flex flex-col sm:flex-row gap-2 md:gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-2.5 md:pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-[18px] md:text-[20px]">sell</span>
              </div>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="block w-full py-2 md:py-2.5 pl-8 md:pl-10 pr-3 md:pr-4 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs md:text-sm transition-colors shadow-sm"
                placeholder="태그 이름을 입력하세요"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving || !newTagName.trim()}
              className="px-4 md:px-6 py-2 md:py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-lg font-bold transition-all text-xs md:text-sm shadow-md whitespace-nowrap disabled:opacity-50"
            >
              {isSaving ? '추가 중...' : '추가하기'}
            </button>
          </form>
        </div>

        {/* Table Header */}
        <div className="px-3 md:px-6 py-2 md:py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div className="pl-1 md:pl-2">태그 명</div>
          <div className="pr-8 md:pr-12">게시물 / 관리</div>
        </div>

        {/* Tags List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12 md:py-20">
            <span className="material-symbols-outlined animate-spin text-3xl md:text-4xl text-primary">
              progress_activity
            </span>
          </div>
        ) : tags.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {paginatedTags.map((tag) => (
              <div
                key={tag.id}
                className="p-3 md:p-4 flex items-center gap-2 md:gap-4 group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="size-8 md:size-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-[16px] md:text-[20px]">tag</span>
                </div>
                <div className="flex-1 min-w-0">
                  {editingTag?.id === tag.id ? (
                    <div className="relative">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingTag.name}
                        onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                        onKeyDown={handleEditKeyDown}
                        onBlur={handleSaveEdit}
                        className="w-full bg-transparent border border-primary rounded px-2 py-1 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all pl-5 md:pl-7 text-sm"
                      />
                      <span className="absolute left-1.5 md:left-2 top-1.5 text-slate-400 text-xs md:text-sm font-semibold">
                        #
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-full bg-transparent border border-transparent rounded px-2 py-1 text-slate-900 dark:text-white font-semibold pl-5 md:pl-7 text-sm truncate">
                        {tag.name}
                      </div>
                      <span className="absolute left-1.5 md:left-2 top-1.5 text-slate-400 text-xs md:text-sm font-semibold">
                        #
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 md:gap-6">
                  <span className="text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 min-w-[50px] md:min-w-[80px] text-center">
                    {tag.postCount} Posts
                  </span>
                  <div className="flex items-center gap-0.5 md:gap-1">
                    <button
                      onClick={() => handleStartEdit(tag)}
                      className="size-7 md:size-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="수정"
                    >
                      <span className="material-symbols-outlined text-[16px] md:text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, tag })}
                      className="size-7 md:size-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <span className="material-symbols-outlined text-[16px] md:text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 md:p-12 text-center">
            <span className="material-symbols-outlined text-[36px] md:text-[48px] text-slate-300 dark:text-slate-600 mb-3 md:mb-4 block">
              sell
            </span>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base">태그가 없습니다.</p>
            <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 mt-1">
              위의 입력란에서 첫 번째 태그를 추가해보세요.
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 md:px-6 py-3 md:py-4 border-t border-slate-200 dark:border-slate-800 flex justify-center">
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
      </div>

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, tag: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">warning</span>
              </div>
              <h3 className="text-base md:text-lg font-bold">태그 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 md:mb-6 text-sm md:text-base">
              <strong className="text-slate-900 dark:text-white">
                &quot;#{deleteModal.tag?.name}&quot;
              </strong>
              을(를) 삭제하시겠습니까?
              {deleteModal.tag && deleteModal.tag.postCount > 0 && (
                <span className="block mt-2 text-xs md:text-sm text-amber-600 dark:text-amber-400">
                  이 태그는 {deleteModal.tag.postCount}개의 게시물에서 사용 중입니다.
                </span>
              )}
            </p>
            <div className="flex gap-2 md:gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, tag: null })}
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
