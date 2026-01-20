import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams, Link, useBlocker } from 'react-router-dom'
import { api, type Category, type Tag } from '../services/api'
import { useModal } from '../contexts/ModalContext'
import { useToast } from '../contexts/ToastContext'
import TipTapEditor from '../components/TipTapEditor'
import { convertToSmartQuotes } from '../utils/smartQuotes'
import { sanitizeHtml } from '../utils/sanitize'
import { common, createLowlight } from 'lowlight'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// Initialize lowlight for syntax highlighting in preview
const lowlight = createLowlight(common)

// Helper to apply syntax highlighting to HTML content
function highlightCodeBlocks(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html

  // Find all code blocks and apply highlighting with language labels
  const codeBlocks = div.querySelectorAll('pre code')
  codeBlocks.forEach((codeElement) => {
    const code = codeElement.textContent || ''
    const languageClass = Array.from(codeElement.classList).find(c => c.startsWith('language-'))
    const language = languageClass?.replace('language-', '') || ''

    try {
      let highlighted
      let detectedLanguage = language
      if (language && lowlight.registered(language)) {
        highlighted = lowlight.highlight(language, code)
      } else {
        highlighted = lowlight.highlightAuto(code)
        // Only use auto-detected language if confidence is high enough (relevance > 5)
        const relevance = highlighted.data?.relevance || 0
        detectedLanguage = relevance > 5 ? (highlighted.data?.language || '') : ''
      }

      const highlightedHtml = hastToHtml(highlighted)
      codeElement.innerHTML = highlightedHtml
      codeElement.classList.add('hljs')

      // Add language label to pre element
      if (detectedLanguage) {
        const pre = codeElement.closest('pre')
        if (pre) {
          pre.setAttribute('data-language', detectedLanguage)
          const langLabel = document.createElement('span')
          langLabel.className = 'code-language-label'
          langLabel.textContent = detectedLanguage
          pre.style.position = 'relative'
          pre.appendChild(langLabel)
        }
      }
    } catch {
      // If highlighting fails, keep original content
    }
  })

  // Render LaTeX math expressions
  const mathElements = div.querySelectorAll('[data-type="inlineMath"]')
  mathElements.forEach((element) => {
    const latex = element.getAttribute('data-latex')
    if (latex) {
      try {
        const displayMode = element.getAttribute('data-display') === 'yes'
        const rendered = katex.renderToString(latex, {
          throwOnError: false,
          displayMode,
        })
        element.innerHTML = rendered
      } catch {
        // Keep original content if rendering fails
      }
    }
  })

  return div.innerHTML
}

// Simple hast to HTML converter
function hastToHtml(tree: ReturnType<typeof lowlight.highlight>): string {
  function nodeToHtml(node: unknown): string {
    if (!node || typeof node !== 'object') return ''

    const n = node as { type?: string; value?: string; tagName?: string; properties?: { className?: string[] }; children?: unknown[] }

    if (n.type === 'text') {
      return n.value || ''
    }
    if (n.type === 'element' && n.tagName) {
      const className = n.properties?.className?.join(' ') || ''
      const children = (n.children || []).map(nodeToHtml).join('')
      if (className) {
        return `<span class="${className}">${children}</span>`
      }
      return children
    }
    return ''
  }

  return (tree.children || []).map(nodeToHtml).join('')
}

interface DraftFormData {
  title: string
  content: string
  excerpt: string
  categoryId: string
  tagIds: string[]
  coverImage: string
  publishedAt: string
  status: 'PUBLIC' | 'PRIVATE'
}

// Helper to compare form data for dirty checking
function isFormDirty(current: DraftFormData, initial: DraftFormData): boolean {
  return (
    current.title !== initial.title ||
    current.content !== initial.content ||
    current.excerpt !== initial.excerpt ||
    current.categoryId !== initial.categoryId ||
    current.coverImage !== initial.coverImage ||
    JSON.stringify(current.tagIds.sort()) !== JSON.stringify(initial.tagIds.sort())
  )
}

const initialFormData: DraftFormData = {
  title: '',
  content: '',
  excerpt: '',
  categoryId: '',
  tagIds: [],
  coverImage: '',
  publishedAt: '',
  status: 'PUBLIC',
}

export default function AdminDraftEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { confirm, alert } = useModal()
  const { showToast } = useToast()
  const isEditing = !!id

  const [formData, setFormData] = useState<DraftFormData>(initialFormData)
  const [savedFormData, setSavedFormData] = useState<DraftFormData>(initialFormData)
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(id || null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
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
      (async () => {
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

  // Fetch existing draft if editing
  useEffect(() => {
    if (isEditing && id) {
      setIsLoading(true)
      api.getDraftById(id)
        .then(({ draft }) => {
          const loadedData: DraftFormData = {
            title: draft.title || '',
            content: draft.content || '',
            excerpt: draft.excerpt || '',
            categoryId: draft.categoryId || '',
            tagIds: draft.tagIds || [],
            coverImage: draft.coverImage || '',
            publishedAt: '',
            status: 'PUBLIC',
          }
          setFormData(loadedData)
          setSavedFormData(loadedData)
          setDraftId(draft.id)
        })
        .catch((err) => {
          setError('임시 저장글을 불러오는데 실패했습니다.')
          console.error(err)
        })
        .finally(() => setIsLoading(false))
    }
  }, [isEditing, id])

  // Auto-save functionality
  useEffect(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Don't auto-save if not dirty or currently saving
    if (!isDirty || isSaving || isAutoSaving || isPublishing) {
      return
    }

    // Set timer to auto-save after 15 seconds of inactivity
    autoSaveTimerRef.current = setTimeout(async () => {
      setIsAutoSaving(true)
      try {
        const draftData = {
          title: formData.title || undefined,
          content: formData.content,
          excerpt: formData.excerpt || undefined,
          coverImage: formData.coverImage || undefined,
          categoryId: formData.categoryId || undefined,
          tagIds: formData.tagIds,
        }

        if (draftId) {
          await api.updateDraft(draftId, draftData)
        } else {
          const { draft } = await api.createDraft(draftData)
          setDraftId(draft.id)
          window.history.replaceState(null, '', `/admin/drafts/${draft.id}/edit`)
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
  }, [formData, isDirty, isSaving, isAutoSaving, isPublishing, draftId])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    // Apply smart quotes to excerpt field
    const processedValue = name === 'excerpt' ? convertToSmartQuotes(value) : value
    setFormData((prev) => ({ ...prev, [name]: processedValue }))
  }

  const handleContentChange = (content: string) => {
    setFormData((prev) => ({ ...prev, content }))
  }

  const handleTagToggle = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }))
  }

  const [newTagName, setNewTagName] = useState('')
  const [isCreatingTag, setIsCreatingTag] = useState(false)

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    setIsCreatingTag(true)
    try {
      const newTag = await api.createTag({ name: newTagName.trim() })
      setTags((prev) => [...prev, newTag])
      setNewTagName('')
    } catch (err: unknown) {
      console.error('Tag creation failed:', err)
      const errorMessage = err instanceof Error ? err.message :
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '태그 생성에 실패했습니다.'
      await alert({ message: errorMessage, type: 'error' })
    } finally {
      setIsCreatingTag(false)
    }
  }

  const handleDeleteTag = async (tagId: string, tagName: string) => {
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
  }

  const handleCoverUpload = useCallback(async (file: File) => {
    // Check file size before upload (50MB limit)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1)
      await alert({
        title: '파일 크기 초과',
        message: `파일 크기가 너무 큽니다. (${fileSizeMB}MB)\n최대 50MB까지 업로드 가능합니다.`,
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
      const savedPercent = (((result.originalSize - result.size) / result.originalSize) * 100).toFixed(1)

      showToast({
        type: 'success',
        title: '이미지 최적화 완료',
        message: `${originalKB}KB → ${optimizedKB}KB (${savedPercent}% 절감)\n${result.width} × ${result.height}px`,
      })
    } catch (err) {
      console.error('Cover upload failed:', err)
      const errorMessage = err instanceof Error ? err.message : '커버 이미지 업로드에 실패했습니다.'
      await alert({
        title: '업로드 실패',
        message: errorMessage,
        type: 'error',
      })
    } finally {
      setIsUploadingCover(false)
    }
  }, [showToast, alert])

  const handleCoverSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleCoverUpload(file)
    }
    e.target.value = ''
  }, [handleCoverUpload])

  const handleRemoveCover = useCallback(() => {
    setFormData((prev) => ({ ...prev, coverImage: '' }))
  }, [])

  // Save draft
  const handleSaveDraft = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const draftData = {
        title: formData.title || undefined,
        content: formData.content,
        excerpt: formData.excerpt || undefined,
        coverImage: formData.coverImage || undefined,
        categoryId: formData.categoryId || undefined,
        tagIds: formData.tagIds,
      }

      if (draftId) {
        // Update existing draft
        await api.updateDraft(draftId, draftData)
      } else {
        // Create new draft
        const { draft } = await api.createDraft(draftData)
        setDraftId(draft.id)
        // Update URL without navigation
        window.history.replaceState(null, '', `/admin/drafts/${draft.id}/edit`)
      }

      setSavedFormData(formData)
      setSuccessToast('임시저장되었습니다.')
      setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장에 실패했습니다.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  // Publish draft
  const handlePublish = async () => {
    // Validate required fields
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

    setIsPublishing(true)
    setError(null)

    try {
      // Extract text from HTML for excerpt if not provided
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = formData.content
      const textContent = tempDiv.textContent || tempDiv.innerText || ''

      // First, save the draft if needed
      let currentDraftId = draftId
      if (!currentDraftId) {
        const { draft } = await api.createDraft({
          title: formData.title,
          content: formData.content,
          excerpt: formData.excerpt || textContent.slice(0, 200),
          coverImage: formData.coverImage || undefined,
          categoryId: formData.categoryId,
          tagIds: formData.tagIds,
        })
        currentDraftId = draft.id
      } else {
        // Update draft before publishing
        await api.updateDraft(currentDraftId, {
          title: formData.title,
          content: formData.content,
          excerpt: formData.excerpt || textContent.slice(0, 200),
          coverImage: formData.coverImage || undefined,
          categoryId: formData.categoryId,
          tagIds: formData.tagIds,
        })
      }

      // Publish the draft
      await api.publishDraft(currentDraftId, {
        status: formData.status,
        publishedAt: formData.publishedAt || undefined,
      })

      // Mark as saved to prevent navigation warning
      setSavedFormData(formData)

      setSuccessToast('발행되었습니다.')
      setTimeout(() => {
        navigate('/admin/posts')
      }, 1000)
    } catch (err) {
      const message = err instanceof Error ? err.message : '발행에 실패했습니다.'
      setError(message)
    } finally {
      setIsPublishing(false)
    }
  }

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Link
            to="/admin/drafts"
            className="p-1.5 md:p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] md:text-[24px]">arrow_back</span>
          </Link>
          <h1 className="text-lg md:text-2xl font-bold">
            {isEditing ? '초안 수정' : '새 글 작성'}
          </h1>
          {draftId && (
            <span className="px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
              임시저장
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          {/* Auto-save status indicator */}
          {(isAutoSaving || lastAutoSave) && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              {isAutoSaving ? (
                <>
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  <span>자동 저장 중...</span>
                </>
              ) : lastAutoSave ? (
                <>
                  <span className="material-symbols-outlined text-[14px] text-green-500">check_circle</span>
                  <span>자동 저장됨 {lastAutoSave.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </>
              ) : null}
            </div>
          )}
          <button
            onClick={() => setShowPreview(true)}
            className="px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs md:text-sm font-medium transition-colors flex items-center gap-1 md:gap-2"
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">visibility</span>
            <span className="hidden md:inline">미리보기</span>
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={isSaving || isPublishing}
            className="px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs md:text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1 md:gap-2"
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">save</span>
            <span className="hidden md:inline">{isSaving ? '저장 중...' : '임시저장'}</span>
            {isDirty && !isAutoSaving && <span className="w-2 h-2 rounded-full bg-orange-500" title="저장하지 않은 변경사항" />}
          </button>
          <button
            onClick={handlePublish}
            disabled={isSaving || isPublishing}
            className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs md:text-sm font-bold transition-colors flex items-center gap-1 md:gap-2 disabled:opacity-50"
          >
            {isPublishing ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[16px] md:text-[18px]">
                  progress_activity
                </span>
                <span className="hidden md:inline">발행 중...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">publish</span>
                발행하기
              </>
            )}
          </button>
        </div>
      </div>

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
              <span className="material-symbols-outlined text-[18px] md:text-[20px]">check_circle</span>
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
        <div className="flex flex-col gap-4 md:gap-6">
          {/* Category */}
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
            <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3">
              카테고리 <span className="text-red-500">*</span>
            </label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleInputChange}
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-2.5 md:p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs md:text-sm"
            >
              <option value="">카테고리 선택</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
            <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3">
              태그
            </label>
            <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className={`group relative flex items-center gap-1 pl-2.5 md:pl-3 pr-1.5 md:pr-2 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-medium transition-colors cursor-pointer ${
                    formData.tagIds.includes(tag.id)
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  onClick={() => handleTagToggle(tag.id)}
                >
                  <span>{tag.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteTag(tag.id, tag.name)
                    }}
                    className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                    title="태그 삭제"
                  >
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </div>
              ))}
            </div>
            {/* Add new tag */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateTag()
                  }
                }}
                placeholder="새 태그 입력..."
                className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs border border-transparent focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isCreatingTag}
                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isCreatingTag ? (
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">add</span>
                )}
                추가
              </button>
            </div>
          </div>

          {/* Visibility */}
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
            <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3">
              발행 시 공개 설정
            </label>
            <div className="flex gap-1.5 md:gap-2">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, status: 'PUBLIC' }))}
                className={`flex-1 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-1 md:gap-2 ${
                  formData.status === 'PUBLIC'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-2 ring-green-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">public</span>
                공개
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, status: 'PRIVATE' }))}
                className={`flex-1 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-1 md:gap-2 ${
                  formData.status === 'PRIVATE'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 ring-2 ring-slate-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">lock</span>
                비공개
              </button>
            </div>
            <p className="text-[10px] md:text-xs text-slate-500 mt-1.5 md:mt-2">
              {formData.status === 'PUBLIC' ? '모든 방문자에게 공개됩니다.' : '관리자만 볼 수 있습니다.'}
            </p>
          </div>

          {/* Cover Image */}
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
            <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3">
              커버 이미지
            </label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleCoverSelect}
              className="hidden"
            />
            {formData.coverImage ? (
              <div className="space-y-2 md:space-y-3">
                <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative group">
                  <img
                    src={formData.coverImage}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="p-1.5 md:p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                      title="이미지 변경"
                    >
                      <span className="material-symbols-outlined text-white text-[18px] md:text-[20px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="p-1.5 md:p-2 bg-white/20 hover:bg-red-500/70 rounded-lg transition-colors"
                      title="이미지 삭제"
                    >
                      <span className="material-symbols-outlined text-white text-[18px] md:text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary bg-slate-50 dark:bg-slate-800/50 transition-colors flex flex-col items-center justify-center gap-1.5 md:gap-2 text-slate-500 dark:text-slate-400 hover:text-primary"
              >
                {isUploadingCover ? (
                  <>
                    <span className="material-symbols-outlined text-[28px] md:text-[32px] animate-spin">progress_activity</span>
                    <span className="text-xs md:text-sm font-medium">업로드 중...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[28px] md:text-[32px]">add_photo_alternate</span>
                    <span className="text-xs md:text-sm font-medium">커버 이미지 선택</span>
                    <span className="text-[10px] md:text-xs">JPG, PNG, GIF, WebP (최대 50MB)</span>
                  </>
                )}
              </button>
            )}
            <p className="text-[10px] md:text-xs text-slate-500 mt-1.5 md:mt-2">
              권장 크기: 1200×675px (16:9 비율)
            </p>
          </div>

          {/* Editor Tips */}
          <div className="hidden md:block bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
            <h3 className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3 flex items-center gap-1.5 md:gap-2">
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">lightbulb</span>
              에디터 팁
            </h3>
            <ul className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 space-y-1.5 md:space-y-2">
              <li className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">/</kbd>
                <span>슬래시 메뉴로 블록 추가</span>
              </li>
              <li className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">```</kbd>
                <span>코드블록 (```js 언어지정)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Ctrl+B</kbd>
                <span>굵게</span>
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Ctrl+I</kbd>
                <span>기울임</span>
              </li>
              <li className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Ctrl+Shift+S</kbd>
                <span>취소선</span>
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Ctrl+Shift+H</kbd>
                <span>형광펜</span>
              </li>
              <li className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Ctrl+Shift+L</kbd>
                <span>좌측</span>
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Ctrl+Shift+E</kbd>
                <span>가운데</span>
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Ctrl+Shift+R</kbd>
                <span>우측</span>
              </li>
              <li className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Ctrl+Z</kbd>
                <span>실행취소</span>
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Ctrl+Shift+Z</kbd>
                <span>다시실행</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Preview Styles */}
          <style>{`
            .preview-content {
              max-width: 718px;
              margin-left: auto;
              margin-right: auto;
            }
            /* Headings */
            .preview-content h1 {
              font-size: 2rem;
              font-weight: 700;
              margin-top: 2rem;
              margin-bottom: 1rem;
              line-height: 1.3;
              color: #0f172a;
            }
            .preview-content h2 {
              font-size: 1.5rem;
              font-weight: 700;
              margin-top: 1.75rem;
              margin-bottom: 0.75rem;
              line-height: 1.4;
              color: #0f172a;
            }
            .preview-content h3 {
              font-size: 1.25rem;
              font-weight: 600;
              margin-top: 1.5rem;
              margin-bottom: 0.5rem;
              line-height: 1.5;
              color: #0f172a;
            }
            .dark .preview-content h1,
            .dark .preview-content h2,
            .dark .preview-content h3 {
              color: #f1f5f9;
            }
            /* Paragraphs */
            .preview-content p {
              margin-bottom: 1rem;
              line-height: 1.8;
              color: #334155;
            }
            .preview-content > p:first-child {
              font-size: 1.125rem;
            }
            .dark .preview-content p {
              color: #cbd5e1;
            }
            /* Blockquote */
            .preview-content blockquote {
              border-left: 4px solid #3182f6;
              padding-left: 1rem;
              margin: 1.5rem 0;
              font-style: italic;
              color: #64748b;
              background: #f8fafc;
              padding: 1rem 1rem 1rem 1.5rem;
              border-radius: 0 0.5rem 0.5rem 0;
            }
            .dark .preview-content blockquote {
              background: #1e293b;
              color: #94a3b8;
              border-left-color: #60a5fa;
            }
            .preview-content blockquote p {
              margin-bottom: 0;
            }
            /* Lists */
            .preview-content ul,
            .preview-content ol {
              padding-left: 1.5rem;
              margin-bottom: 1rem;
              color: #334155;
            }
            .dark .preview-content ul,
            .dark .preview-content ol {
              color: #cbd5e1;
            }
            .preview-content ul {
              list-style-type: disc;
            }
            .preview-content ol {
              list-style-type: decimal;
            }
            .preview-content li {
              margin-bottom: 0.5rem;
              line-height: 1.75;
            }
            /* Code Block */
            .preview-content pre {
              position: relative;
              margin: 1.5rem 0;
              border-radius: 0.75rem;
              overflow: hidden;
              border: 1px solid #e2e8f0;
              background: linear-gradient(180deg, #f1f5f9 0%, #f1f5f9 32px, #f8fafc 32px);
              padding: 0;
            }
            .dark .preview-content pre {
              border-color: #30363d;
              background: linear-gradient(180deg, #21262d 0%, #21262d 32px, #0d1117 32px);
            }
            .preview-content pre::before {
              content: '';
              display: block;
              height: 32px;
              background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
              border-bottom: 1px solid #e2e8f0;
            }
            .dark .preview-content pre::before {
              background: linear-gradient(180deg, #21262d 0%, #161b22 100%);
              border-bottom-color: #30363d;
            }
            .preview-content pre::after {
              content: '';
              position: absolute;
              top: 10px;
              left: 12px;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: #ff5f57;
              box-shadow: 18px 0 0 #ffbd2e, 36px 0 0 #28c840;
            }
            .preview-content pre code {
              display: block;
              padding: 1rem;
              background: transparent;
              color: #1e293b;
              overflow-x: auto;
              font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
              font-size: 0.875rem;
              line-height: 1.6;
            }
            .dark .preview-content pre code {
              color: #e6edf3;
            }
            /* Code Language Label */
            .preview-content .code-language-label {
              position: absolute;
              top: 7px;
              left: 72px;
              font-size: 11px;
              font-weight: 500;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              pointer-events: none;
            }
            .dark .preview-content .code-language-label {
              color: #94a3b8;
            }
            /* Inline code */
            .preview-content code:not(pre code) {
              background: #f1f5f9;
              padding: 0.125rem 0.375rem;
              border-radius: 0.375rem;
              font-size: 0.875rem;
              font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
              color: #dc2626;
            }
            .dark .preview-content code:not(pre code) {
              background: #1e293b;
              color: #f87171;
            }
            /* Syntax highlighting */
            .preview-content .hljs-keyword { color: #a855f7; }
            .preview-content .hljs-string { color: #22c55e; }
            .preview-content .hljs-comment { color: #94a3b8; font-style: italic; }
            .preview-content .hljs-function { color: #3b82f6; }
            .preview-content .hljs-number { color: #f59e0b; }
            .dark .preview-content .hljs-keyword { color: #c084fc; }
            .dark .preview-content .hljs-string { color: #4ade80; }
            .dark .preview-content .hljs-comment { color: #64748b; }
            .dark .preview-content .hljs-function { color: #60a5fa; }
            .dark .preview-content .hljs-number { color: #fbbf24; }
            /* Images */
            .preview-content img {
              max-width: 100%;
              height: auto;
              border-radius: 0.5rem;
              margin: 1.5rem 0;
            }
            /* Callout Block */
            .preview-content .callout-static {
              display: flex;
              align-items: flex-start;
              gap: 0.75rem;
              margin: 1.5rem 0;
              padding: 1rem;
              border-radius: 0.75rem;
              border-left: 4px solid var(--callout-border);
              background: var(--callout-bg-light);
            }
            .dark .preview-content .callout-static {
              background: var(--callout-bg-dark);
            }
            .preview-content .callout-static-icon {
              font-size: 1.25rem;
              line-height: 1.5;
              flex-shrink: 0;
            }
            .preview-content .callout-static-content {
              flex: 1;
              min-width: 0;
            }
            .preview-content .callout-static-content p {
              margin: 0;
            }
            /* PullQuote Block */
            .preview-content .pullquote-static {
              position: relative;
              margin: 2rem 0;
              padding: 2rem 3rem;
              text-align: center;
            }
            .preview-content .pullquote-static-mark-open,
            .preview-content .pullquote-static-mark-close {
              position: absolute;
              font-family: Georgia, 'Times New Roman', serif;
              font-size: 5rem;
              line-height: 1;
              color: #3182f6;
              opacity: 0.3;
            }
            .preview-content .pullquote-static-mark-open {
              top: 0;
              left: 0;
            }
            .preview-content .pullquote-static-mark-close {
              bottom: -0.5rem;
              right: 0;
            }
            .preview-content .pullquote-static-content p {
              margin: 0;
              font-size: 1.5rem;
              font-weight: 500;
              font-style: italic;
              line-height: 1.6;
              color: #334155;
            }
            .dark .preview-content .pullquote-static-content p {
              color: #e2e8f0;
            }
            /* Highlight */
            .preview-content mark {
              background-color: #fef08a;
              padding: 0.125rem 0.25rem;
              border-radius: 0.25rem;
            }
            .dark .preview-content mark {
              background-color: #854d0e;
              color: #fef9c3;
            }
            /* Table */
            .preview-content .tableWrapper {
              overflow-x: auto;
              margin: 1.5rem 0;
            }
            .preview-content table {
              border-collapse: collapse;
              table-layout: fixed;
              width: 100%;
              min-width: 100%;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .dark .preview-content table {
              border-color: #334155;
            }
            .preview-content td,
            .preview-content th {
              border: 1px solid #e2e8f0;
              padding: 0.5rem 0.75rem;
              text-align: left;
              vertical-align: middle;
              min-width: 80px;
              max-width: 300px;
              word-wrap: break-word;
              word-break: break-word;
              overflow-wrap: break-word;
              line-height: 1.4;
              font-size: 0.9375rem;
              min-height: 36px;
              height: auto;
            }
            .preview-content td p,
            .preview-content th p {
              margin: 0;
              line-height: 1.4;
              min-height: 1.4em;
            }
            .dark .preview-content td,
            .dark .preview-content th {
              border-color: #334155;
            }
            .preview-content th {
              font-weight: 600;
              background-color: #f1f5f9;
            }
            .dark .preview-content th {
              background-color: #334155;
            }
            /* Allow inline style to override default header background */
            .preview-content th[style*="background-color"] {
              background-color: unset;
            }
            /* Nested List Styles */
            .preview-content ul { list-style-type: disc; }
            .preview-content ul ul { list-style-type: circle; }
            .preview-content ul ul ul { list-style-type: square; }
            .preview-content ul ul ul ul { list-style-type: disc; }
            .preview-content ul ul ul ul ul { list-style-type: circle; }
            .preview-content ul ul ul ul ul ul { list-style-type: square; }
            .preview-content ul ul ul ul ul ul ul { list-style-type: disc; }
            .preview-content ul ul ul ul ul ul ul ul { list-style-type: circle; }
            .preview-content ul ul ul ul ul ul ul ul ul { list-style-type: square; }
            .preview-content ol { list-style-type: decimal; }
            .preview-content ol ol { list-style-type: lower-alpha; }
            .preview-content ol ol ol { list-style-type: lower-roman; }
            .preview-content ol ol ol ol { list-style-type: decimal; }
            .preview-content ol ol ol ol ol { list-style-type: lower-alpha; }
            .preview-content ol ol ol ol ol ol { list-style-type: lower-roman; }
            .preview-content ol ol ol ol ol ol ol { list-style-type: decimal; }
            .preview-content ol ol ol ol ol ol ol ol { list-style-type: lower-alpha; }
            .preview-content ol ol ol ol ol ol ol ol ol { list-style-type: lower-roman; }
            /* Image alignment */
            .preview-content img[data-align="left"] { display: block; margin-left: 0; margin-right: auto; }
            .preview-content img[data-align="center"] { display: block; margin-left: auto; margin-right: auto; }
            .preview-content img[data-align="right"] { display: block; margin-left: auto; margin-right: 0; }
          `}</style>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
          />
          {/* Modal */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-[90vw] lg:max-w-[846px] max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">visibility</span>
                미리보기
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              <article className="mx-auto px-6 py-8 lg:px-12">
                {/* Cover Image */}
                {formData.coverImage ? (
                  <div className="aspect-video rounded-xl overflow-hidden mb-8">
                    <img
                      src={formData.coverImage}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video rounded-xl overflow-hidden mb-8 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[64px] text-slate-300 dark:text-slate-600">
                      edit_note
                    </span>
                  </div>
                )}
                {/* Category & Tags */}
                <div className="flex items-center gap-3 mb-4">
                  {formData.categoryId && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {categories.find((c) => c.id === formData.categoryId)?.name || '카테고리'}
                    </span>
                  )}
                  {formData.tagIds.map((tagId) => {
                    const tag = tags.find((t) => t.id === tagId)
                    return tag ? (
                      <span
                        key={tagId}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-xs"
                      >
                        #{tag.name}
                      </span>
                    ) : null
                  })}
                </div>
                {/* Title */}
                <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                  {formData.title || '제목 없음'}
                </h1>
                {/* Meta */}
                <div className="flex items-center gap-4 text-sm text-slate-500 mb-8 pb-8 border-b border-slate-200 dark:border-slate-800">
                  <span>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                {/* Content */}
                <div
                  className="preview-content"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(formData.content ? highlightCodeBlocks(formData.content) : '<p class="text-slate-400">내용이 없습니다.</p>') }}
                />
              </article>
            </div>
            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
