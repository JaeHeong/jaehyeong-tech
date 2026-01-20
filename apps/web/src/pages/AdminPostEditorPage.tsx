import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useBlocker, useNavigate } from 'react-router-dom'
import { api, type Category, type Tag } from '../services/api'
import { useModal } from '../contexts/ModalContext'
import { useToast } from '../contexts/ToastContext'
import TipTapEditor from '../components/TipTapEditor'
import { EditorHeader, EditorSidebar, EditorPreviewModal } from '../components/editor'
import { convertToSmartQuotes } from '../utils/smartQuotes'

// Helper to compare form data for dirty checking
function isFormDirty(current: PostFormData, initial: PostFormData): boolean {
  return (
    current.title !== initial.title ||
    current.content !== initial.content ||
    current.excerpt !== initial.excerpt ||
    current.categoryId !== initial.categoryId ||
    current.coverImage !== initial.coverImage ||
    current.publishedAt !== initial.publishedAt ||
    current.status !== initial.status ||
    JSON.stringify(current.tagIds.sort()) !== JSON.stringify(initial.tagIds.sort())
  )
}

interface PostFormData {
  title: string
  content: string
  excerpt: string
  categoryId: string
  tagIds: string[]
  status: 'PUBLIC' | 'PRIVATE'
  coverImage: string
  publishedAt: string
}

const initialFormData: PostFormData = {
  title: '',
  content: '',
  excerpt: '',
  categoryId: '',
  tagIds: [],
  status: 'PUBLIC',
  coverImage: '',
  publishedAt: '',
}

export default function AdminPostEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { confirm, alert } = useModal()
  const { showToast } = useToast()
  const isEditing = !!id

  const [formData, setFormData] = useState<PostFormData>(initialFormData)
  const [isDeleting, setIsDeleting] = useState(false)
  const [savedFormData, setSavedFormData] = useState<PostFormData>(initialFormData)
  const [postSlug, setPostSlug] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close preview modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPreview) {
        setShowPreview(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showPreview])

  // Check if form has unsaved changes
  const isDirty = useMemo(() => isFormDirty(formData, savedFormData), [formData, savedFormData])

  // Block navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  )

  // Show confirmation dialog when navigation is blocked
  useEffect(() => {
    if (blocker.state === 'blocked') {
      ;(async () => {
        const confirmed = await confirm({
          title: '저장되지 않은 변경사항',
          message: '저장하지 않은 변경사항이 있습니다.\n페이지를 떠나시겠습니까?',
          confirmText: '나가기',
          cancelText: '취소',
          type: 'warning',
        })
        if (confirmed) {
          blocker.proceed()
        } else {
          blocker.reset()
        }
      })()
    }
  }, [blocker, confirm])

  // Warn user before browser refresh/close with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = '저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠습니까?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // Fetch categories and tags
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          api.getCategories(),
          api.getTags(),
        ])
        setCategories(categoriesRes.categories)
        setTags(tagsRes.tags)
      } catch (err) {
        console.error('Failed to fetch data:', err)
      }
    }
    fetchData()
  }, [])

  // Fetch existing post if editing
  useEffect(() => {
    if (isEditing && id) {
      setIsLoading(true)
      api
        .getPostById(id)
        .then(({ data: post }) => {
          // Format publishedAt for datetime-local input (YYYY-MM-DDTHH:mm) in LOCAL timezone
          let publishedAtValue = ''
          if (post.publishedAt) {
            const date = new Date(post.publishedAt)
            // Convert to local timezone format for datetime-local input
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            publishedAtValue = `${year}-${month}-${day}T${hours}:${minutes}`
          }
          const loadedData: PostFormData = {
            title: post.title,
            content: post.content,
            excerpt: post.excerpt,
            categoryId: post.category.id,
            tagIds: post.tags.map((t) => t.id),
            status: post.status as 'PUBLIC' | 'PRIVATE',
            coverImage: post.coverImage || '',
            publishedAt: publishedAtValue,
          }
          setFormData(loadedData)
          setSavedFormData(loadedData)
          setPostSlug(post.slug)
        })
        .catch((err) => {
          setError('게시물을 불러오는데 실패했습니다.')
          console.error(err)
        })
        .finally(() => setIsLoading(false))
    }
  }, [isEditing, id])

  // Auto-save functionality (only for editing existing posts)
  useEffect(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Don't auto-save if not editing, not dirty, or currently saving
    if (!isEditing || !id || !isDirty || isSaving || isAutoSaving) {
      return
    }

    // Set timer to auto-save after 15 seconds of inactivity
    autoSaveTimerRef.current = setTimeout(async () => {
      setIsAutoSaving(true)
      try {
        // Extract text from HTML for excerpt if not provided
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = formData.content
        const textContent = tempDiv.textContent || tempDiv.innerText || ''

        const result = await api.updatePost(id, {
          ...formData,
          excerpt: formData.excerpt || textContent.slice(0, 200),
        })

        // Update postSlug with the new slug from the response
        if (result.data.slug) {
          setPostSlug(result.data.slug)
        }

        setSavedFormData(formData)
        setLastAutoSave(new Date())
      } catch (err) {
        console.error('Auto-save failed:', err)
      } finally {
        setIsAutoSaving(false)
      }
    }, 15000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [formData, isDirty, isSaving, isAutoSaving, isEditing, id])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target
      // Apply smart quotes to excerpt field
      const processedValue = name === 'excerpt' ? convertToSmartQuotes(value) : value
      setFormData((prev) => ({ ...prev, [name]: processedValue }))
    },
    []
  )

  const handleContentChange = useCallback((content: string) => {
    setFormData((prev) => ({ ...prev, content }))
  }, [])

  const handleTagToggle = useCallback((tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }))
  }, [])

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return
    setIsCreatingTag(true)
    try {
      const newTag = await api.createTag({ name: newTagName.trim() })
      setTags((prev) => [...prev, newTag])
      setNewTagName('')
    } catch (err: unknown) {
      console.error('Tag creation failed:', err)
      const errorMessage =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            '태그 생성에 실패했습니다.'
      await alert({ message: errorMessage, type: 'error' })
    } finally {
      setIsCreatingTag(false)
    }
  }, [newTagName, alert])

  const handleDeleteTag = useCallback(
    async (tagId: string, tagName: string) => {
      const confirmed = await confirm({
        title: '태그 삭제',
        message: `"${tagName}" 태그를 삭제하시겠습니까? 모든 게시물에서 이 태그가 제거됩니다.`,
        confirmText: '삭제',
        cancelText: '취소',
      })
      if (!confirmed) return
      try {
        await api.deleteTag(tagId)
        setTags((prev) => prev.filter((t) => t.id !== tagId))
        setFormData((prev) => ({ ...prev, tagIds: prev.tagIds.filter((id) => id !== tagId) }))
      } catch (err) {
        console.error('Tag deletion failed:', err)
        await alert({ message: '태그 삭제에 실패했습니다.', type: 'error' })
      }
    },
    [confirm, alert]
  )

  const handleCoverUpload = useCallback(
    async (file: File) => {
      // Check file size before upload (20MB limit)
      const maxSize = 20 * 1024 * 1024
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(1)
        await alert({
          title: '파일 크기 초과',
          message: `파일 크기가 너무 큽니다. (${fileSizeMB}MB)\n최대 20MB까지 업로드 가능합니다.`,
          type: 'error',
        })
        return
      }

      setIsUploadingCover(true)
      try {
        const result = await api.uploadImage(file, 'cover')
        setFormData((prev) => ({ ...prev, coverImage: result.url }))

        // Show optimization toast
        const originalKB = (result.originalSize / 1024).toFixed(1)
        const optimizedKB = (result.size / 1024).toFixed(1)
        const savedPercent = (
          ((result.originalSize - result.size) / result.originalSize) *
          100
        ).toFixed(1)

        showToast({
          type: 'success',
          title: '이미지 최적화 완료',
          message: `${originalKB}KB → ${optimizedKB}KB (${savedPercent}% 절감)\n${result.width} × ${result.height}px`,
        })
      } catch (err) {
        console.error('Cover upload failed:', err)
        const errorMessage =
          err instanceof Error ? err.message : '커버 이미지 업로드에 실패했습니다.'
        await alert({
          title: '업로드 실패',
          message: errorMessage,
          type: 'error',
        })
      } finally {
        setIsUploadingCover(false)
      }
    },
    [showToast, alert]
  )

  const handleCoverSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleCoverUpload(file)
      }
      e.target.value = ''
    },
    [handleCoverUpload]
  )

  const handleRemoveCover = useCallback(() => {
    setFormData((prev) => ({ ...prev, coverImage: '' }))
  }, [])

  const handleStatusChange = useCallback((status: 'PUBLIC' | 'PRIVATE') => {
    setFormData((prev) => ({ ...prev, status }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formData.title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }
    if (!formData.content.trim() || formData.content === '<p></p>') {
      setError('내용을 입력해주세요.')
      return
    }
    if (!formData.categoryId) {
      setError('카테고리를 선택해주세요.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Extract text from HTML for excerpt if not provided
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = formData.content
      const textContent = tempDiv.textContent || tempDiv.innerText || ''

      const data = {
        ...formData,
        excerpt: formData.excerpt || textContent.slice(0, 200),
      }

      if (isEditing && id) {
        const result = await api.updatePost(id, data)
        // Update postSlug with the new slug from the response
        if (result.data.slug) {
          setPostSlug(result.data.slug)
        }
      }

      // Update form state to prevent navigation warning
      setFormData(formData)
      setSavedFormData(formData)

      // Show success toast
      setSuccessToast('수정되었습니다.')
      setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장에 실패했습니다.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }, [formData, isEditing, id])

  const handleDelete = useCallback(async () => {
    if (!id) return

    const confirmed = await confirm({
      title: '게시글 삭제',
      message: '정말 이 게시글을 삭제하시겠습니까?\n삭제된 게시글은 복구할 수 없습니다.',
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    })

    if (!confirmed) return

    setIsDeleting(true)
    try {
      await api.deletePost(id)
      // Clear dirty state to prevent navigation warning
      setSavedFormData(formData)
      navigate('/admin/posts', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      setIsDeleting(false)
    }
  }, [id, confirm, formData, navigate])

  const handlePreview = useCallback(() => {
    setShowPreview(true)
  }, [])

  const handleClosePreview = useCallback(() => {
    setShowPreview(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8 md:py-12">
        <span className="material-symbols-outlined animate-spin text-3xl md:text-4xl text-primary">
          progress_activity
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Header */}
      <EditorHeader
        isEditing={isEditing}
        postSlug={postSlug}
        isDirty={isDirty}
        isSaving={isSaving}
        isDeleting={isDeleting}
        isAutoSaving={isAutoSaving}
        lastAutoSave={lastAutoSave}
        onDelete={handleDelete}
        onPreview={handlePreview}
        onSubmit={handleSubmit}
      />

      {error && (
        <div className="p-3 md:p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-1.5 md:gap-2 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">error</span>
            <span className="text-xs md:text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="fixed top-3 right-3 md:top-4 md:right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="px-3 md:px-4 py-2 md:py-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 shadow-lg">
            <div className="flex items-center gap-1.5 md:gap-2 text-green-600 dark:text-green-400">
              <span className="material-symbols-outlined text-[18px] md:text-[20px]">
                check_circle
              </span>
              <span className="text-xs md:text-sm font-medium">{successToast}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
          {/* Title */}
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="제목을 입력하세요"
              className="w-full text-lg md:text-2xl font-bold bg-transparent border-none focus:outline-none placeholder-slate-400"
            />
          </div>

          {/* TipTap Editor */}
          <TipTapEditor
            content={formData.content}
            onChange={handleContentChange}
            placeholder="내용을 작성하세요..."
          />

          {/* Excerpt */}
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
            <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
              요약 (선택사항)
            </label>
            <textarea
              name="excerpt"
              value={formData.excerpt}
              onChange={handleInputChange}
              placeholder="게시물 목록에 표시될 요약을 입력하세요. 비워두면 본문에서 자동 생성됩니다."
              rows={3}
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-2.5 md:p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-xs md:text-sm"
            />
          </div>
        </div>

        {/* Sidebar */}
        <EditorSidebar
          formData={formData}
          categories={categories}
          tags={tags}
          isUploadingCover={isUploadingCover}
          newTagName={newTagName}
          isCreatingTag={isCreatingTag}
          onInputChange={handleInputChange}
          onTagToggle={handleTagToggle}
          onCreateTag={handleCreateTag}
          onDeleteTag={handleDeleteTag}
          onNewTagNameChange={setNewTagName}
          onCoverSelect={handleCoverSelect}
          onRemoveCover={handleRemoveCover}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <EditorPreviewModal
          formData={formData}
          categories={categories}
          tags={tags}
          onClose={handleClosePreview}
        />
      )}
    </div>
  )
}
