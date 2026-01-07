import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link, useBlocker, useNavigate } from 'react-router-dom'
import { api, type Category, type Tag } from '../services/api'
import TipTapEditor from '../components/TipTapEditor'
import { common, createLowlight } from 'lowlight'

// Initialize lowlight for syntax highlighting in preview
const lowlight = createLowlight(common)

// Helper to apply syntax highlighting to HTML content
function highlightCodeBlocks(html: string): string {
  // Create a temporary div to parse HTML
  const div = document.createElement('div')
  div.innerHTML = html

  // Find all code blocks and apply highlighting
  const codeBlocks = div.querySelectorAll('pre code')
  codeBlocks.forEach((codeElement) => {
    const code = codeElement.textContent || ''
    const language = codeElement.className.replace('language-', '') || ''

    try {
      let highlighted
      if (language && lowlight.registered(language)) {
        highlighted = lowlight.highlight(language, code)
      } else {
        highlighted = lowlight.highlightAuto(code)
      }

      // Convert hast to HTML string
      const highlightedHtml = hastToHtml(highlighted)
      codeElement.innerHTML = highlightedHtml
      codeElement.classList.add('hljs')
    } catch {
      // If highlighting fails, keep original content
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
  const isEditing = !!id

  const [formData, setFormData] = useState<PostFormData>(initialFormData)
  const [isDeleting, setIsDeleting] = useState(false)
  const [savedFormData, setSavedFormData] = useState<PostFormData>(initialFormData)
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

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
      const confirmed = window.confirm('저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠습니까?')
      if (confirmed) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker])

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
      api.getPostById(id)
        .then(({ data: post }) => {
          // Format publishedAt for datetime-local input (YYYY-MM-DDTHH:mm)
          let publishedAtValue = ''
          if (post.publishedAt) {
            const date = new Date(post.publishedAt)
            publishedAtValue = date.toISOString().slice(0, 16)
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
        })
        .catch((err) => {
          setError('게시물을 불러오는데 실패했습니다.')
          console.error(err)
        })
        .finally(() => setIsLoading(false))
    }
  }, [isEditing, id])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
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

  const handleCoverUpload = useCallback(async (file: File) => {
    setIsUploadingCover(true)
    try {
      const { url } = await api.uploadImage(file)
      setFormData((prev) => ({ ...prev, coverImage: url }))
    } catch (err) {
      console.error('Cover upload failed:', err)
      setError(err instanceof Error ? err.message : '커버 이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingCover(false)
    }
  }, [])

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

  const handleSubmit = async () => {
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
        await api.updatePost(id, data)
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
  }

  const handleDelete = async () => {
    if (!id) return
    if (!window.confirm('정말 이 게시글을 삭제하시겠습니까?\n삭제된 게시글은 복구할 수 없습니다.')) return

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
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-2xl font-bold">
            {isEditing ? '게시물 수정' : '새 글 작성'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isDeleting ? 'progress_activity' : 'delete'}
              </span>
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          )}
          <button
            onClick={() => setShowPreview(true)}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            미리보기
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                저장 중...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">edit</span>
                수정하기
                {isDirty && <span className="w-2 h-2 rounded-full bg-orange-500 ml-1" title="저장하지 않은 변경사항" />}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="px-4 py-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 shadow-lg">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span className="text-sm font-medium">{successToast}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Title */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="제목을 입력하세요"
              className="w-full text-2xl font-bold bg-transparent border-none focus:outline-none placeholder-slate-400"
            />
          </div>

          {/* TipTap Editor */}
          <TipTapEditor
            content={formData.content}
            onChange={handleContentChange}
            placeholder="내용을 작성하세요..."
          />

          {/* Excerpt */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              요약 (선택사항)
            </label>
            <textarea
              name="excerpt"
              value={formData.excerpt}
              onChange={handleInputChange}
              placeholder="게시물 목록에 표시될 요약을 입력하세요. 비워두면 본문에서 자동 생성됩니다."
              rows={3}
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Category */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              카테고리 <span className="text-red-500">*</span>
            </label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleInputChange}
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
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
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              태그
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    formData.tagIds.includes(tag.id)
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              공개 설정
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, status: 'PUBLIC' }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  formData.status === 'PUBLIC'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-2 ring-green-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">public</span>
                공개
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, status: 'PRIVATE' }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  formData.status === 'PRIVATE'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 ring-2 ring-slate-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">lock</span>
                비공개
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {formData.status === 'PUBLIC' ? '모든 방문자에게 공개됩니다.' : '관리자만 볼 수 있습니다.'}
            </p>
          </div>

          {/* Publish Date */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              발행 일시
            </label>
            <div className="flex gap-2 items-center">
              {/* Year */}
              <input
                type="number"
                min="2020"
                max="2100"
                placeholder="년"
                value={formData.publishedAt ? formData.publishedAt.split('T')[0]?.split('-')[0] || '' : ''}
                onChange={(e) => {
                  const year = e.target.value.slice(0, 4)
                  const [, month = '01', day = '01'] = (formData.publishedAt?.split('T')[0] || '').split('-')
                  const time = formData.publishedAt?.split('T')[1] || '09:00'
                  if (year.length === 4) {
                    setFormData((prev) => ({ ...prev, publishedAt: `${year}-${month}-${day}T${time}` }))
                  }
                }}
                className="w-20 bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-center"
              />
              <span className="text-slate-400">-</span>
              {/* Month */}
              <select
                value={formData.publishedAt ? formData.publishedAt.split('T')[0]?.split('-')[1] || '' : ''}
                onChange={(e) => {
                  const month = e.target.value
                  const [year = new Date().getFullYear().toString(), , day = '01'] = (formData.publishedAt?.split('T')[0] || '').split('-')
                  const time = formData.publishedAt?.split('T')[1] || '09:00'
                  setFormData((prev) => ({ ...prev, publishedAt: `${year}-${month}-${day}T${time}` }))
                }}
                className="w-16 bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-center appearance-none cursor-pointer"
              >
                <option value="">월</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}월</option>
                ))}
              </select>
              <span className="text-slate-400">-</span>
              {/* Day */}
              <select
                value={formData.publishedAt ? formData.publishedAt.split('T')[0]?.split('-')[2] || '' : ''}
                onChange={(e) => {
                  const day = e.target.value
                  const [year = new Date().getFullYear().toString(), month = '01'] = (formData.publishedAt?.split('T')[0] || '').split('-')
                  const time = formData.publishedAt?.split('T')[1] || '09:00'
                  setFormData((prev) => ({ ...prev, publishedAt: `${year}-${month}-${day}T${time}` }))
                }}
                className="w-16 bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-center appearance-none cursor-pointer"
              >
                <option value="">일</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}일</option>
                ))}
              </select>
              {/* Time */}
              <input
                type="time"
                value={formData.publishedAt ? formData.publishedAt.split('T')[1] || '' : ''}
                onChange={(e) => {
                  const time = e.target.value
                  const date = formData.publishedAt?.split('T')[0] || `${new Date().getFullYear()}-01-01`
                  setFormData((prev) => ({ ...prev, publishedAt: `${date}T${time}` }))
                }}
                className="w-24 bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              />
              {formData.publishedAt && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, publishedAt: '' }))}
                  className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="초기화"
                >
                  <span className="material-symbols-outlined text-slate-500 text-[18px]">close</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              비워두면 발행 시 현재 시간으로 설정됩니다.
            </p>
          </div>

          {/* Cover Image */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
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
              <div className="space-y-3">
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
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                      title="이미지 변경"
                    >
                      <span className="material-symbols-outlined text-white text-[20px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="p-2 bg-white/20 hover:bg-red-500/70 rounded-lg transition-colors"
                      title="이미지 삭제"
                    >
                      <span className="material-symbols-outlined text-white text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary bg-slate-50 dark:bg-slate-800/50 transition-colors flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary"
              >
                {isUploadingCover ? (
                  <>
                    <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
                    <span className="text-sm font-medium">업로드 중...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[32px]">add_photo_alternate</span>
                    <span className="text-sm font-medium">커버 이미지 선택</span>
                    <span className="text-xs">JPG, PNG, GIF, WebP (최대 10MB)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Editor Tips */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
              에디터 팁
            </h3>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <li>• 텍스트를 선택하고 툴바 버튼을 클릭하세요</li>
              <li>• Ctrl+B: 굵게, Ctrl+I: 기울임</li>
              <li>• /1, /2, /3 + 스페이스: 제목 변환</li>
              <li>• /code, /quote, /ul, /ol: 블록 요소</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Preview Styles */}
          <style>{`
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
              line-height: 1.75;
              color: #334155;
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
            .preview-content li > ul,
            .preview-content li > ol {
              margin-top: 0.5rem;
              margin-bottom: 0;
            }
            /* Horizontal Rule */
            .preview-content hr {
              border: none;
              height: 1px;
              background: linear-gradient(to right, transparent, #e2e8f0, transparent);
              margin: 2rem 0;
            }
            .dark .preview-content hr {
              background: linear-gradient(to right, transparent, #334155, transparent);
            }
            /* Links */
            .preview-content a {
              color: #3182f6;
              text-decoration: underline;
              text-underline-offset: 2px;
              transition: color 0.15s;
            }
            .preview-content a:hover {
              color: #1d4ed8;
            }
            .dark .preview-content a {
              color: #60a5fa;
            }
            .dark .preview-content a:hover {
              color: #93c5fd;
            }
            /* Code Block - Terminal Style */
            .preview-content pre {
              position: relative;
              margin: 1.5rem 0;
              border-radius: 0.75rem;
              overflow: hidden;
              border: 1px solid #e2e8f0;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
              background: linear-gradient(180deg, #f1f5f9 0%, #f1f5f9 32px, #f8fafc 32px);
              padding: 0;
            }
            .dark .preview-content pre {
              border-color: #30363d;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
              background: linear-gradient(180deg, #21262d 0%, #21262d 32px, #0d1117 32px);
            }
            .preview-content pre::before {
              content: '';
              display: block;
              height: 32px;
              background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
              border-bottom: 1px solid #e2e8f0;
              position: relative;
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
            /* Syntax highlighting - Light */
            .preview-content .hljs-keyword,
            .preview-content .hljs-selector-tag,
            .preview-content .hljs-built_in { color: #a855f7; }
            .preview-content .hljs-string,
            .preview-content .hljs-attr { color: #22c55e; }
            .preview-content .hljs-comment { color: #94a3b8; font-style: italic; }
            .preview-content .hljs-function,
            .preview-content .hljs-title { color: #3b82f6; }
            .preview-content .hljs-number { color: #f59e0b; }
            .preview-content .hljs-variable,
            .preview-content .hljs-template-variable { color: #ef4444; }
            .preview-content .hljs-property { color: #0891b2; }
            .preview-content .hljs-operator { color: #64748b; }
            /* Syntax highlighting - Dark */
            .dark .preview-content .hljs-keyword,
            .dark .preview-content .hljs-selector-tag,
            .dark .preview-content .hljs-built_in { color: #c084fc; }
            .dark .preview-content .hljs-string,
            .dark .preview-content .hljs-attr { color: #4ade80; }
            .dark .preview-content .hljs-comment { color: #64748b; }
            .dark .preview-content .hljs-function,
            .dark .preview-content .hljs-title { color: #60a5fa; }
            .dark .preview-content .hljs-number { color: #fbbf24; }
            .dark .preview-content .hljs-variable,
            .dark .preview-content .hljs-template-variable { color: #f87171; }
            .dark .preview-content .hljs-property { color: #22d3ee; }
            .dark .preview-content .hljs-operator { color: #94a3b8; }
            /* YouTube */
            .preview-content div[data-youtube-video] {
              width: 100%;
              max-width: 640px;
              margin: 1.5rem 0;
              border-radius: 0.75rem;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            .preview-content div[data-youtube-video] iframe {
              width: 100%;
              aspect-ratio: 16 / 9;
              border: none;
            }
            /* Images */
            .preview-content img {
              max-width: 100%;
              height: auto;
              border-radius: 0.5rem;
              margin: 1.5rem 0;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            /* Strong & Emphasis */
            .preview-content strong {
              font-weight: 700;
              color: #0f172a;
            }
            .dark .preview-content strong {
              color: #f1f5f9;
            }
            .preview-content em {
              font-style: italic;
            }
            /* Strikethrough */
            .preview-content s,
            .preview-content del {
              text-decoration: line-through;
              color: #94a3b8;
            }
            /* Bookmark Card */
            .preview-content .bookmark-card-static {
              margin: 1.5rem 0;
            }
            .preview-content .bookmark-link {
              display: flex;
              text-decoration: none;
              border: 1px solid #e2e8f0;
              border-radius: 0.75rem;
              overflow: hidden;
              background: #fff;
              transition: all 0.2s;
            }
            .preview-content .bookmark-link:hover {
              border-color: #cbd5e1;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            .dark .preview-content .bookmark-link {
              border-color: #334155;
              background: #1e293b;
            }
            .dark .preview-content .bookmark-link:hover {
              border-color: #475569;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
            }
            .preview-content .bookmark-content {
              flex: 1;
              padding: 1rem;
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 0.375rem;
            }
            .preview-content .bookmark-title {
              font-weight: 600;
              font-size: 0.9375rem;
              color: #0f172a;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              line-height: 1.4;
            }
            .dark .preview-content .bookmark-title {
              color: #f1f5f9;
            }
            .preview-content .bookmark-description {
              font-size: 0.8125rem;
              color: #64748b;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              line-height: 1.5;
            }
            .dark .preview-content .bookmark-description {
              color: #94a3b8;
            }
            .preview-content .bookmark-meta {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-top: auto;
              padding-top: 0.25rem;
            }
            .preview-content .bookmark-favicon {
              width: 16px;
              height: 16px;
              border-radius: 2px;
              flex-shrink: 0;
            }
            .preview-content .bookmark-site {
              font-size: 0.75rem;
              color: #94a3b8;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .preview-content .bookmark-image {
              width: 140px;
              flex-shrink: 0;
              background: #f1f5f9;
              display: flex;
              align-items: center;
            }
            .dark .preview-content .bookmark-image {
              background: #0f172a;
            }
            .preview-content .bookmark-image img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              margin: 0;
              border-radius: 0;
              box-shadow: none;
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
            .preview-content .pullquote-static-content {
              position: relative;
              z-index: 1;
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
          `}</style>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
          />
          {/* Modal */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-[90vw] lg:max-w-[50vw] max-h-[90vh] overflow-hidden flex flex-col">
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
                  <div className="aspect-video rounded-xl overflow-hidden mb-8 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center relative">
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, gray 1px, transparent 0)',
                        backgroundSize: '24px 24px',
                      }}
                    />
                    <div className="p-6 bg-card-light dark:bg-card-dark rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-xs w-full mx-6 transform rotate-2">
                      <div className="flex items-center gap-2 mb-3 border-b border-slate-100 dark:border-slate-700 pb-3">
                        <div className="size-2.5 rounded-full bg-red-500" />
                        <div className="size-2.5 rounded-full bg-amber-500" />
                        <div className="size-2.5 rounded-full bg-green-500" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-2 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-2 w-4/5 bg-slate-200 dark:bg-slate-700 rounded" />
                      </div>
                      <div className="mt-4 flex justify-between items-center">
                        <div className="flex -space-x-2">
                          <div className="size-6 rounded-full bg-primary border-2 border-white dark:border-slate-800" />
                          <div className="size-6 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-800" />
                        </div>
                        <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                          formData.status === 'PUBLIC' ? 'bg-green-500/10 text-green-600' : 'bg-slate-500/10 text-slate-600'
                        }`}>
                          {formData.status === 'PUBLIC' ? 'Public' : 'Private'}
                        </div>
                      </div>
                    </div>
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
                  dangerouslySetInnerHTML={{ __html: formData.content ? highlightCodeBlocks(formData.content) : '<p class="text-slate-400">내용이 없습니다.</p>' }}
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
