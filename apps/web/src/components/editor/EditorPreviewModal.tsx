import { memo, useMemo } from 'react'
import { common, createLowlight } from 'lowlight'
import katex from 'katex'
import type { Category, Tag } from '../../services/api'
import { sanitizeHtml } from '../../utils/sanitize'
import '../../styles/editorPreview.css'

// Initialize lowlight for syntax highlighting in preview
const lowlight = createLowlight(common)

// Simple hast to HTML converter
function hastToHtml(tree: ReturnType<typeof lowlight.highlight>): string {
  function nodeToHtml(node: unknown): string {
    if (!node || typeof node !== 'object') return ''

    const n = node as {
      type?: string
      value?: string
      tagName?: string
      properties?: { className?: string[] }
      children?: unknown[]
    }

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

// Reusable div for HTML parsing (avoids creating new elements each render)
let parserDiv: HTMLDivElement | null = null
function getParserDiv(): HTMLDivElement {
  if (!parserDiv) {
    parserDiv = document.createElement('div')
  }
  return parserDiv
}

// Helper to apply syntax highlighting to HTML content
function highlightCodeBlocks(html: string): string {
  // Reuse the same div to avoid repeated DOM element creation
  const div = getParserDiv()
  div.innerHTML = html

  // Find all code blocks and apply highlighting with language labels
  const codeBlocks = div.querySelectorAll('pre code')
  codeBlocks.forEach((codeElement) => {
    const code = codeElement.textContent || ''
    const languageClass = Array.from(codeElement.classList).find((c) =>
      c.startsWith('language-')
    )
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

      // Convert hast to HTML string
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

interface EditorPreviewModalProps {
  formData: PostFormData
  categories: Category[]
  tags: Tag[]
  onClose: () => void
}

function EditorPreviewModal({
  formData,
  categories,
  tags,
  onClose,
}: EditorPreviewModalProps) {
  const highlightedContent = useMemo(
    () => (formData.content ? highlightCodeBlocks(formData.content) : ''),
    [formData.content]
  )

  const categoryName = useMemo(
    () => categories.find((c) => c.id === formData.categoryId)?.name || '',
    [categories, formData.categoryId]
  )

  const selectedTags = useMemo(
    () => tags.filter((t) => formData.tagIds.includes(t.id)),
    [tags, formData.tagIds]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
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
            onClick={onClose}
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
                    backgroundImage:
                      'radial-gradient(circle at 2px 2px, gray 1px, transparent 0)',
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
                    <div
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        formData.status === 'PUBLIC'
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-slate-500/10 text-slate-600'
                      }`}
                    >
                      {formData.status === 'PUBLIC' ? 'Public' : 'Private'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Category & Tags */}
            <div className="flex items-center gap-3 mb-4">
              {categoryName && (
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  {categoryName}
                </span>
              )}
              {selectedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-xs"
                >
                  #{tag.name}
                </span>
              ))}
            </div>
            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
              {formData.title || '제목 없음'}
            </h1>
            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-slate-500 mb-8 pb-8 border-b border-slate-200 dark:border-slate-800">
              <span>
                {new Date().toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            {/* Content */}
            <div
              className="preview-content"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(highlightedContent || '<p class="text-slate-400">내용이 없습니다.</p>'),
              }}
            />
          </article>
        </div>
        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(EditorPreviewModal)
