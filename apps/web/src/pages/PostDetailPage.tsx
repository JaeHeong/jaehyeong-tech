import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, type Post } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useModal } from '../contexts/ModalContext'
import Sidebar from '../components/Sidebar'
import CommentSection from '../components/CommentSection'
import MobileProfileModal from '../components/MobileProfileModal'
import { useSEO } from '../hooks/useSEO'
import { useJsonLd, createBlogPostingSchema, createBreadcrumbSchema } from '../hooks/useJsonLd'
import { sanitizeHtml } from '../utils/sanitize'
import { common, createLowlight } from 'lowlight'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// Initialize lowlight for syntax highlighting
const lowlight = createLowlight(common)

// Render LaTeX math expressions in HTML content
function renderMathExpressions(doc: Document): void {
  const mathElements = doc.querySelectorAll('[data-type="inlineMath"]')
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

interface AdjacentPost {
  slug: string
  title: string
  coverImage: string | null
}

interface RelatedPost {
  id: string
  slug: string
  title: string
  coverImage: string | null
  publishedAt: string | null
  category: { name: string; slug: string }
}

export default function PostDetailPage() {
  const { user } = useAuth()
  const { confirm } = useModal()
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [post, setPost] = useState<Post | null>(null)
  const [adjacentPosts, setAdjacentPosts] = useState<{ prev: AdjacentPost | null; next: AdjacentPost | null }>({ prev: null, next: null })
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([])
  const [relatedIndex, setRelatedIndex] = useState(0)
  const [isRelatedPaused, setIsRelatedPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isLiking, setIsLiking] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [isBookmarking, setIsBookmarking] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [tocExpanded, setTocExpanded] = useState(false)
  const [hoveredHeadingId, setHoveredHeadingId] = useState<string | null>(null)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // TOC heading type
  interface TocHeading {
    id: string
    text: string
    level: number
  }


  const handleDelete = async () => {
    if (!post) return

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
      await api.deletePost(post.id)
      navigate('/posts', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      setIsDeleting(false)
    }
  }

  const handleLike = async () => {
    if (!post || isLiking) return
    setIsLiking(true)
    try {
      const result = await api.toggleLike(post.id)
      setLiked(result.liked)
      setLikeCount(result.likeCount)
    } catch (err) {
      console.error('Like failed:', err)
    } finally {
      setIsLiking(false)
    }
  }

  const handleBookmark = async () => {
    if (!post || isBookmarking || !user || user.role === 'ADMIN') return
    setIsBookmarking(true)
    try {
      const result = await api.toggleBookmark(post.id)
      setBookmarked(result.bookmarked)
    } catch (err) {
      console.error('Bookmark failed:', err)
    } finally {
      setIsBookmarking(false)
    }
  }

  const handleShare = async () => {
    if (!post) return

    const shareUrl = window.location.href
    const shareData = {
      title: post.title,
      text: post.excerpt || post.title,
      url: shareUrl,
    }

    try {
      // Use Web Share API if available (mostly mobile)
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        // Fallback: copy URL to clipboard
        await navigator.clipboard.writeText(shareUrl)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      }
    } catch (err) {
      // User cancelled share or error occurred
      if ((err as Error).name !== 'AbortError') {
        // Fallback to clipboard copy
        try {
          await navigator.clipboard.writeText(shareUrl)
          setShareCopied(true)
          setTimeout(() => setShareCopied(false), 2000)
        } catch {
          console.error('Share failed:', err)
        }
      }
    }
  }

  // SEO meta tags
  useSEO({
    title: post?.title,
    description: post?.excerpt || undefined,
    url: post ? `/posts/${post.slug}` : undefined,
    image: post?.coverImage || undefined,
    type: 'article',
    publishedTime: post?.publishedAt || undefined,
    author: post?.author?.name,
  })

  // JSON-LD structured data
  useJsonLd(
    post
      ? [
          createBlogPostingSchema({
            title: post.title,
            excerpt: post.excerpt || undefined,
            coverImage: post.coverImage || undefined,
            publishedAt: post.publishedAt || post.createdAt,
            updatedAt: post.updatedAt,
            authorName: post.author?.name || 'Anonymous',
            slug: post.slug,
          }),
          createBreadcrumbSchema([
            { name: '홈', url: '/' },
            { name: post.category?.name || '카테고리', url: `/categories/${post.category?.slug || ''}` },
            { name: post.title, url: `/posts/${post.slug}` },
          ]),
        ]
      : null
  )

  useEffect(() => {
    if (!slug) return

    setIsLoading(true)
    setRelatedIndex(0) // Reset carousel index when post changes
    Promise.all([
      api.getPost(slug),
      api.getAdjacentPosts(slug),
      api.getRelatedPosts(slug),
    ])
      .then(([postRes, adjacentRes, relatedRes]) => {
        setPost(postRes.data)
        setAdjacentPosts(adjacentRes.data)
        setRelatedPosts(relatedRes.data)
        setLikeCount(postRes.data.likeCount)
        // Fetch like status after post is loaded
        api.checkLikeStatus(postRes.data.id)
          .then((likeRes) => {
            setLiked(likeRes.liked)
            setLikeCount(likeRes.likeCount)
          })
          .catch(() => {
            // Ignore error, just use initial likeCount from post
          })
        // Fetch bookmark status for logged-in non-admin users
        api.checkBookmarkStatus(postRes.data.id)
          .then((bookmarkRes) => {
            setBookmarked(bookmarkRes.bookmarked)
          })
          .catch(() => {
            // Ignore error
          })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '게시글을 불러오는데 실패했습니다.')
      })
      .finally(() => setIsLoading(false))
  }, [slug])

  // Auto-slide related posts carousel every 3 seconds
  useEffect(() => {
    if (relatedPosts.length <= 1 || isRelatedPaused) return

    const interval = setInterval(() => {
      setRelatedIndex((prev) => (prev + 1) % relatedPosts.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [relatedPosts.length, isRelatedPaused])


  // Extract headings from content, add IDs, apply syntax highlighting, and add copy buttons to code blocks
  const { tocHeadings, contentWithIds, shouldShowInContentAd } = useMemo(() => {
    if (!post?.content) return { tocHeadings: [] as TocHeading[], contentWithIds: '', shouldShowInContentAd: false }

    const parser = new DOMParser()
    const doc = parser.parseFromString(post.content, 'text/html')

    // Calculate content length (text only, no HTML tags)
    const contentLength = doc.body.textContent?.length || 0

    // Add IDs to headings for TOC
    const headings = doc.querySelectorAll('h1, h2, h3')
    const tocList: TocHeading[] = []
    headings.forEach((heading, index) => {
      const id = `toc-heading-${index}`
      heading.setAttribute('id', id)
      tocList.push({
        id,
        text: heading.textContent || '',
        level: parseInt(heading.tagName.charAt(1) || '1'),
      })
    })

    // In-content ad logic: insert ad before middle H2
    // Conditions: content >= 1000 chars, H2 count >= 3
    const h2Elements = doc.querySelectorAll('h2')
    const h2Count = h2Elements.length
    let showAd = false

    if (contentLength >= 1000 && h2Count >= 3) {
      // Calculate middle H2 index (e.g., 6 H2s -> 3rd, 5 H2s -> 3rd, 4 H2s -> 2nd, 3 H2s -> 2nd)
      const middleIndex = Math.floor(h2Count / 2)
      const targetH2 = h2Elements[middleIndex]

      if (targetH2) {
        // Create ad placeholder div
        const adPlaceholder = doc.createElement('div')
        adPlaceholder.id = 'in-content-ad-placeholder'
        adPlaceholder.className = 'in-content-ad-wrapper'

        // Insert before the target H2
        targetH2.parentNode?.insertBefore(adPlaceholder, targetH2)
        showAd = true
      }
    }

    // Apply syntax highlighting to code blocks and add language labels
    const codeBlocks = doc.querySelectorAll('pre code')
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

        // Convert hast to HTML string
        const highlightedHtml = hastToHtml(highlighted)
        codeElement.innerHTML = highlightedHtml
        codeElement.classList.add('hljs')

        // Store detected language for label
        if (detectedLanguage) {
          const pre = codeElement.closest('pre')
          if (pre) {
            pre.setAttribute('data-language', detectedLanguage)
          }
        }
      } catch {
        // If highlighting fails, keep original content
      }
    })

    // Add copy buttons and language labels to all pre elements
    const preElements = doc.querySelectorAll('pre')
    preElements.forEach((pre, index) => {
      pre.style.position = 'relative'

      // Add language label
      const language = pre.getAttribute('data-language')
      if (language) {
        const langLabel = doc.createElement('span')
        langLabel.className = 'code-language-label'
        langLabel.textContent = language
        pre.appendChild(langLabel)
      }

      // Add copy button
      const copyBtn = doc.createElement('button')
      copyBtn.className = 'code-copy-btn'
      copyBtn.setAttribute('data-copy-index', index.toString())
      copyBtn.setAttribute('title', '코드 복사')
      copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>'
      pre.appendChild(copyBtn)
    })

    // Render LaTeX math expressions
    renderMathExpressions(doc)

    return {
      tocHeadings: tocList,
      contentWithIds: doc.body.innerHTML,
      shouldShowInContentAd: showAd,
    }
  }, [post?.content])

  // Load in-content ad when placeholder is ready
  useEffect(() => {
    if (!shouldShowInContentAd) return

    const placeholder = document.getElementById('in-content-ad-placeholder')
    if (!placeholder || placeholder.hasChildNodes()) return

    // Create ad element
    const adElement = document.createElement('ins')
    adElement.className = 'adsbygoogle'
    adElement.style.display = 'block'
    adElement.style.width = '100%'
    adElement.style.height = '280px'
    adElement.setAttribute('data-ad-client', 'ca-pub-6534924804736684')
    adElement.setAttribute('data-ad-slot', '8272829268')
    adElement.setAttribute('data-ad-format', 'auto')
    adElement.setAttribute('data-full-width-responsive', 'true')

    placeholder.appendChild(adElement)

    // Push ad
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (error) {
      console.error('In-content ad error:', error)
    }
  }, [shouldShowInContentAd, contentWithIds])

  // Handle copy button clicks via event delegation
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const copyBtn = target.closest('.code-copy-btn') as HTMLButtonElement | null

    if (!copyBtn || copyBtn.classList.contains('copying')) return

    e.preventDefault()
    e.stopPropagation()

    const pre = copyBtn.closest('pre')
    const code = pre?.querySelector('code')
    const text = code?.textContent || ''
    const iconSpan = copyBtn.querySelector('.material-symbols-outlined')

    navigator.clipboard.writeText(text).then(() => {
      if (iconSpan) {
        // Show check icon and lock hover
        copyBtn.classList.add('copying')
        iconSpan.textContent = 'check'

        // After 1.5s, hide and reset
        setTimeout(() => {
          copyBtn.classList.add('hiding')

          setTimeout(() => {
            iconSpan.textContent = 'content_copy'
            copyBtn.classList.remove('copying', 'hiding')
          }, 200)
        }, 1500)
      }
    }).catch((err) => {
      console.error('Failed to copy:', err)
    })
  }, [])

  // Scroll to heading - position at 1/3 of viewport
  const scrollToHeading = (headingId: string) => {
    const element = document.getElementById(headingId)
    if (element) {
      const viewportThird = window.innerHeight / 3
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({
        top: elementPosition - viewportThird + 20, // +20 for slight padding
        behavior: 'smooth'
      })
    }
  }

  // Handle TOC hover - highlight corresponding heading in content
  useEffect(() => {
    if (hoveredHeadingId) {
      const element = document.getElementById(hoveredHeadingId)
      if (element) {
        element.classList.add('toc-hover-highlight')
      }
    }
    return () => {
      // Remove highlight from all headings when hover changes
      tocHeadings.forEach((heading) => {
        const element = document.getElementById(heading.id)
        if (element) {
          element.classList.remove('toc-hover-highlight')
        }
      })
    }
  }, [hoveredHeadingId, tocHeadings])

  // Track active heading based on scroll position
  useEffect(() => {
    if (tocHeadings.length === 0) return

    const updateActiveHeading = () => {
      const viewportThird = window.innerHeight / 3
      let currentActive: string | null = null

      // Find the heading that is closest to or just above the 1/3 viewport line
      for (const heading of tocHeadings) {
        const element = document.getElementById(heading.id)
        if (element) {
          const rect = element.getBoundingClientRect()
          // If heading is above or at the 1/3 line of viewport, it could be active
          if (rect.top <= viewportThird + 50) {
            currentActive = heading.id
          }
        }
      }

      // If no heading found (scrolled to top), use first heading
      if (!currentActive && tocHeadings.length > 0 && tocHeadings[0]) {
        currentActive = tocHeadings[0].id
      }

      if (currentActive) {
        setActiveHeadingId(currentActive)
      }
    }

    // Initial check
    updateActiveHeading()

    // Throttled scroll handler
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActiveHeading()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [tocHeadings])

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center py-20">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <article className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="w-full h-64 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-[64px] text-slate-300 dark:text-slate-600">
                error
              </span>
            </div>
            <div className="p-6 md:p-10">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                게시글을 찾을 수 없습니다
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                {error || '요청하신 게시글이 존재하지 않거나 삭제되었습니다.'}
              </p>
              <Link to="/posts" className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors">
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                글 목록으로 돌아가기
              </Link>
            </div>
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Post Content Styles */}
      <style>{`
        .post-content {
          max-width: 768px;
          margin-left: auto;
          margin-right: auto;
        }
        /* In-content Ad */
        .post-content .in-content-ad-wrapper {
          margin: 2rem 0;
          padding: 1rem 0;
          min-height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .post-content pre {
          position: relative;
          margin: 1.5rem 0;
          border-radius: 0.75rem;
          overflow: hidden;
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
          background: linear-gradient(180deg, #f1f5f9 0%, #f1f5f9 32px, #f8fafc 32px);
          padding: 0;
        }
        .dark .post-content pre {
          border-color: #30363d;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
          background: linear-gradient(180deg, #21262d 0%, #21262d 32px, #0d1117 32px);
          overflow-x: auto;
        }
        .post-content pre::before {
          content: '';
          display: block;
          height: 32px;
          background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
          border-bottom: 1px solid #e2e8f0;
          pointer-events: none;
        }
        .dark .post-content pre::before {
          background: linear-gradient(180deg, #21262d 0%, #161b22 100%);
          border-bottom-color: #30363d;
        }
        .post-content pre::after {
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
        .post-content pre code {
          display: block;
          padding: 1rem;
          background: transparent;
          color: #1e293b;
          white-space: pre;
          font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
        }
        .dark .post-content pre code {
          color: #e6edf3;
        }
        /* Inline code */
        .post-content code:not(pre code) {
          background: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
          color: #dc2626;
        }
        .dark .post-content code:not(pre code) {
          background: #1e293b;
          color: #f87171;
        }
        /* Syntax highlighting */
        .post-content .hljs-keyword,
        .post-content .hljs-selector-tag,
        .post-content .hljs-built_in { color: #a855f7; }
        .post-content .hljs-string,
        .post-content .hljs-attr { color: #22c55e; }
        .post-content .hljs-comment { color: #94a3b8; font-style: italic; }
        .post-content .hljs-function,
        .post-content .hljs-title { color: #3b82f6; }
        .post-content .hljs-number { color: #f59e0b; }
        .post-content .hljs-variable,
        .post-content .hljs-template-variable { color: #ef4444; }
        .post-content .hljs-property { color: #0891b2; }
        .dark .post-content .hljs-keyword,
        .dark .post-content .hljs-selector-tag,
        .dark .post-content .hljs-built_in { color: #c084fc; }
        .dark .post-content .hljs-string,
        .dark .post-content .hljs-attr { color: #4ade80; }
        .dark .post-content .hljs-comment { color: #64748b; }
        .dark .post-content .hljs-function,
        .dark .post-content .hljs-title { color: #60a5fa; }
        .dark .post-content .hljs-number { color: #fbbf24; }
        .dark .post-content .hljs-variable,
        .dark .post-content .hljs-template-variable { color: #f87171; }
        .dark .post-content .hljs-property { color: #22d3ee; }
        /* Blockquote */
        .post-content blockquote {
          border-left: 4px solid #3182f6;
          background: rgba(49, 130, 246, 0.05);
          padding: 1.5rem;
          border-radius: 0 0.5rem 0.5rem 0;
          margin: 2rem 0;
          font-style: italic;
          color: #475569;
        }
        .dark .post-content blockquote {
          background: rgba(49, 130, 246, 0.1);
          color: #94a3b8;
        }
        /* YouTube */
        .post-content div[data-youtube-video] {
          width: 100%;
          max-width: 100%;
          margin: 1.5rem 0;
          border-radius: 0.75rem;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .post-content div[data-youtube-video] iframe {
          width: 100%;
          aspect-ratio: 16 / 9;
          border: none;
        }
        /* Images */
        .post-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          margin: 1.5rem 0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        /* Links */
        .post-content a {
          color: #3182f6;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .post-content a:hover {
          color: #1d4ed8;
        }
        /* Lists */
        .post-content ul,
        .post-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }
        .post-content ul { list-style-type: disc; }
        .post-content ol { list-style-type: decimal; }
        .post-content li { margin: 0.5rem 0; }
        .post-content li::marker { color: #3182f6; }
        /* Headings */
        .post-content h1 { font-size: 2rem; font-weight: 700; margin: 2.5rem 0 1rem; color: inherit; }
        .post-content h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem; color: inherit; }
        .post-content h3 { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem; color: inherit; }
        /* TOC Hover Highlight */
        .post-content h1.toc-hover-highlight,
        .post-content h2.toc-hover-highlight,
        .post-content h3.toc-hover-highlight {
          background: linear-gradient(90deg, rgba(49, 130, 246, 0.25) 0%, rgba(49, 130, 246, 0.08) 100%);
          border-radius: 4px;
          padding-left: 8px;
          margin-left: -8px;
          transition: background 0.2s ease-out;
        }
        /* Paragraphs */
        .post-content p {
          margin-bottom: 1rem;
          line-height: 1.8;
        }
        .post-content > p:first-child { font-size: 1.125rem; }
        /* Word break and wrap */
        .post-content {
          word-break: keep-all; /* Korean: don't break in middle of words */
          overflow-wrap: break-word; /* Break long URLs/words if needed */
        }
        /* Strong */
        .post-content strong { font-weight: 600; }
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .post-content { font-size: 0.9375rem; line-height: 1.75; }
          .post-content h1 { font-size: 1.5rem; margin: 1.75rem 0 0.75rem; }
          .post-content h2 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; }
          .post-content h3 { font-size: 1.1rem; margin: 1.25rem 0 0.5rem; }
          .post-content p { margin: 0.75rem 0; }
          .post-content p:first-child { font-size: 1rem; }
          .post-content pre { margin: 1rem 0; border-radius: 0.5rem; }
          .post-content pre code { font-size: 0.75rem; padding: 0.75rem; }
          .post-content code:not(pre code) { font-size: 0.8rem; padding: 0.1rem 0.25rem; }
          .post-content blockquote { padding: 1rem; margin: 1.25rem 0; font-size: 0.9375rem; }
          .post-content ul, .post-content ol { padding-left: 1.25rem; margin: 0.75rem 0; }
          .post-content li { margin: 0.375rem 0; }
          .post-content img { margin: 1rem 0; border-radius: 0.5rem; }
          .post-content .pullquote-static { padding: 1.5rem 2rem; margin: 1.5rem 0; }
          .post-content .pullquote-static-content p { font-size: 1.25rem; }
          .post-content .pullquote-static-mark-open,
          .post-content .pullquote-static-mark-close { font-size: 3.5rem; }
          .post-content .callout-static { padding: 0.75rem; margin: 1rem 0; }
          .post-content .bookmark-card-static { margin: 1rem 0; }
          .post-content .bookmark-content { padding: 0.75rem; }
          .post-content .bookmark-title { font-size: 0.875rem; }
          .post-content .bookmark-description { font-size: 0.75rem; }
          .post-content .bookmark-image { width: 100px; }
        }
        /* Bookmark Card */
        .post-content .bookmark-card-static {
          margin: 1.5rem 0;
        }
        .post-content .bookmark-link {
          display: flex;
          text-decoration: none;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          overflow: hidden;
          background: #fff;
          transition: all 0.2s;
        }
        .post-content .bookmark-link:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .dark .post-content .bookmark-link {
          border-color: #334155;
          background: #1e293b;
        }
        .dark .post-content .bookmark-link:hover {
          border-color: #475569;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
        }
        .post-content .bookmark-content {
          flex: 1;
          padding: 1rem;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .post-content .bookmark-title {
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
        .dark .post-content .bookmark-title {
          color: #f1f5f9;
        }
        .post-content .bookmark-description {
          font-size: 0.8125rem;
          color: #64748b;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.5;
        }
        .dark .post-content .bookmark-description {
          color: #94a3b8;
        }
        .post-content .bookmark-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: auto;
          padding-top: 0.25rem;
        }
        .post-content .bookmark-favicon {
          width: 16px;
          height: 16px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .post-content .bookmark-site {
          font-size: 0.75rem;
          color: #94a3b8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .post-content .bookmark-image {
          width: 140px;
          flex-shrink: 0;
          background: #f1f5f9;
          display: flex;
          align-items: center;
        }
        .dark .post-content .bookmark-image {
          background: #0f172a;
        }
        .post-content .bookmark-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          margin: 0;
          border-radius: 0;
          box-shadow: none;
        }
        /* Callout Block */
        .post-content .callout-static {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin: 1.5rem 0;
          padding: 1rem;
          border-radius: 0.75rem;
          border-left: 4px solid var(--callout-border);
          background: var(--callout-bg-light);
        }
        .dark .post-content .callout-static {
          background: var(--callout-bg-dark);
        }
        .post-content .callout-static-icon {
          font-size: 1.25rem;
          line-height: 1.5;
          flex-shrink: 0;
        }
        .post-content .callout-static-content {
          flex: 1;
          min-width: 0;
        }
        .post-content .callout-static-content p {
          margin: 0;
        }
        /* PullQuote Block */
        .post-content .pullquote-static {
          position: relative;
          margin: 2rem 0;
          padding: 2rem 3rem;
          text-align: center;
        }
        .post-content .pullquote-static-mark-open,
        .post-content .pullquote-static-mark-close {
          position: absolute;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 5rem;
          line-height: 1;
          color: #3182f6;
          opacity: 0.3;
        }
        .post-content .pullquote-static-mark-open {
          top: 0;
          left: 0;
        }
        .post-content .pullquote-static-mark-close {
          bottom: -0.5rem;
          right: 0;
        }
        .post-content .pullquote-static-content {
          position: relative;
          z-index: 1;
        }
        .post-content .pullquote-static-content p {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 500;
          font-style: italic;
          line-height: 1.6;
          color: #334155;
        }
        .dark .post-content .pullquote-static-content p {
          color: #e2e8f0;
        }
        /* Table */
        .post-content .tableWrapper {
          overflow-x: auto;
          margin: 1.5rem 0;
        }
        .post-content table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          min-width: 100%;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .dark .post-content table {
          border-color: #334155;
        }
        .post-content td,
        .post-content th {
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
        .post-content td p,
        .post-content th p {
          margin: 0;
          line-height: 1.4;
          min-height: 1.4em;
        }
        .dark .post-content td,
        .dark .post-content th {
          border-color: #334155;
        }
        /* Header cells - bold text with default background */
        .post-content th {
          font-weight: 600;
          background-color: #f1f5f9;
        }
        .dark .post-content th {
          background-color: #334155;
        }
        /* Allow inline style to override default header background */
        .post-content th[style*="background-color"] {
          background-color: unset;
        }
        /* Highlight */
        .post-content mark {
          background-color: #fef08a;
          padding: 0.125rem 0.25rem;
          border-radius: 2px;
        }
        .dark .post-content mark {
          background-color: #854d0e;
          color: #fef9c3;
        }
        /* Nested Lists */
        .post-content ul { list-style-type: disc; }
        .post-content ul ul { list-style-type: circle; }
        .post-content ul ul ul { list-style-type: square; }
        .post-content ul ul ul ul { list-style-type: disc; }
        .post-content ul ul ul ul ul { list-style-type: circle; }
        .post-content ul ul ul ul ul ul { list-style-type: square; }
        .post-content ul ul ul ul ul ul ul { list-style-type: disc; }
        .post-content ul ul ul ul ul ul ul ul { list-style-type: circle; }
        .post-content ul ul ul ul ul ul ul ul ul { list-style-type: square; }
        .post-content ol { list-style-type: decimal; }
        .post-content ol ol { list-style-type: lower-alpha; }
        .post-content ol ol ol { list-style-type: lower-roman; }
        .post-content ol ol ol ol { list-style-type: decimal; }
        .post-content ol ol ol ol ol { list-style-type: lower-alpha; }
        .post-content ol ol ol ol ol ol { list-style-type: lower-roman; }
        .post-content ol ol ol ol ol ol ol { list-style-type: decimal; }
        .post-content ol ol ol ol ol ol ol ol { list-style-type: lower-alpha; }
        .post-content ol ol ol ol ol ol ol ol ol { list-style-type: lower-roman; }
        /* Image Alignment */
        .post-content .resizable-image-wrapper {
          display: flex;
          margin: 1rem 0;
        }
        .post-content .resizable-image-wrapper.align-left {
          justify-content: flex-start;
        }
        .post-content .resizable-image-wrapper.align-center {
          justify-content: center;
        }
        .post-content .resizable-image-wrapper.align-right {
          justify-content: flex-end;
        }
        /* Code Language Label */
        .post-content .code-language-label {
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
        .dark .post-content .code-language-label {
          color: #94a3b8;
        }
        /* Code Copy Button */
        .post-content pre > code {
          overflow: auto;
          display: block;
        }
        .post-content .code-copy-btn {
          position: absolute;
          top: 4px;
          right: 8px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(100, 116, 139, 0.3);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s, background 0.2s;
          z-index: 20;
        }
        .post-content .code-copy-btn .material-symbols-outlined {
          font-size: 14px;
          color: #64748b;
        }
        /* Show on hover (unless copying) */
        .post-content pre:hover .code-copy-btn:not(.copying):not(.hiding) {
          opacity: 1;
        }
        .post-content .code-copy-btn:hover {
          background: rgba(100, 116, 139, 0.5);
        }
        .post-content .code-copy-btn:hover .material-symbols-outlined {
          color: #334155;
        }
        /* Copying state - always visible with green bg */
        .post-content .code-copy-btn.copying {
          opacity: 1;
          background: rgba(34, 197, 94, 0.3);
        }
        .post-content .code-copy-btn.copying .material-symbols-outlined {
          color: #22c55e;
        }
        /* Hiding state */
        .post-content .code-copy-btn.hiding {
          opacity: 0;
        }
        /* Dark mode */
        .dark .post-content .code-copy-btn {
          background: rgba(148, 163, 184, 0.3);
        }
        .dark .post-content .code-copy-btn .material-symbols-outlined {
          color: #94a3b8;
        }
        .dark .post-content pre:hover .code-copy-btn:not(.copying):not(.hiding) {
          opacity: 1;
        }
        .dark .post-content .code-copy-btn:hover {
          background: rgba(148, 163, 184, 0.5);
        }
        .dark .post-content .code-copy-btn:hover .material-symbols-outlined {
          color: #e2e8f0;
        }
        .dark .post-content .code-copy-btn.copying {
          opacity: 1;
          background: rgba(34, 197, 94, 0.3);
        }
        .dark .post-content .code-copy-btn.copying .material-symbols-outlined {
          color: #22c55e;
        }
      `}</style>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <main className="lg:col-span-8 flex flex-col gap-8">
          <article className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Cover Image */}
            {post.coverImage ? (
              <div
                className="w-full h-64 md:h-96 bg-cover bg-center"
                style={{ backgroundImage: `url('${post.coverImage}')` }}
              />
            ) : (
              <div className="w-full h-64 md:h-96 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, gray 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <div className="p-6 bg-card-light dark:bg-card-dark rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-xs w-full mx-6 transform rotate-2 hover:rotate-0 transition-transform duration-500">
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
                    <div className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-xs font-bold">
                      Published
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 md:p-10">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
                <Link to="/" className="hover:text-primary transition-colors">홈</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <Link to={`/categories/${post.category.slug}`} className="hover:text-primary transition-colors">
                  {post.category.name}
                </Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-primary font-medium truncate max-w-[200px]">{post.title}</span>
              </div>

              {/* Title */}
              <div className="mb-6">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {user?.role === 'ADMIN' && post.status === 'PRIVATE' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      <span className="material-symbols-outlined text-[18px]">visibility_off</span>
                      <span className="text-sm font-medium">비공개</span>
                    </span>
                  )}
                  {user?.role === 'ADMIN' && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Link
                        to={`/admin/posts/${post.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        수정
                      </Link>
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isDeleting ? 'progress_activity' : 'delete'}
                        </span>
                        {isDeleting ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
                  {post.title}
                </h1>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-6 pb-8 border-b border-slate-100 dark:border-slate-800 mb-8">
                <div className="flex items-center gap-3">
                  {post.author.avatar ? (
                    <img
                      src={post.author.avatar}
                      alt={post.author.name}
                      loading="lazy"
                      className="size-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {post.author.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{post.author.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Author</div>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                  {new Date(post.publishedAt || post.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                  {post.readingTime}분 소요
                </div>
              </div>

              {/* Content */}
              <div
                ref={contentRef}
                className="post-content text-slate-700 dark:text-slate-300"
                onClick={handleContentClick}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentWithIds || post.content) }}
              />

              {/* Related Posts Carousel */}
              {relatedPosts.length > 0 && (
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                    관련 글
                  </h3>
                  <div
                    className="relative overflow-hidden rounded-xl"
                    onMouseEnter={() => setIsRelatedPaused(true)}
                    onMouseLeave={() => setIsRelatedPaused(false)}
                  >
                    {/* Carousel Track */}
                    <div
                      className="flex transition-transform duration-500 ease-out"
                      style={{ transform: `translateX(-${relatedIndex * 100}%)` }}
                    >
                      {relatedPosts.map((relatedPost) => (
                        <Link
                          key={relatedPost.id}
                          to={`/posts/${relatedPost.slug}`}
                          className="w-full flex-shrink-0 flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                        >
                          {/* Thumbnail */}
                          <div className="w-32 h-24 md:w-40 md:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700">
                            {relatedPost.coverImage ? (
                              <img
                                src={relatedPost.coverImage}
                                alt={relatedPost.title}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-500">
                                  article
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <span className="text-xs font-medium text-primary mb-1">
                              {relatedPost.category.name}
                            </span>
                            <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 mb-2">
                              {relatedPost.title}
                            </h4>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {relatedPost.publishedAt && new Date(relatedPost.publishedAt).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>

                    {/* Indicators with Progress Gauge */}
                    {relatedPosts.length > 1 && (
                      <div className="flex justify-center gap-2 mt-4">
                        {relatedPosts.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setRelatedIndex(idx)}
                            className={`h-2 rounded-full transition-all duration-300 relative overflow-hidden ${
                              idx === relatedIndex
                                ? 'w-8 bg-slate-300 dark:bg-slate-600'
                                : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500'
                            }`}
                            aria-label={`관련 글 ${idx + 1}번으로 이동`}
                          >
                            {idx === relatedIndex && (
                              <span
                                className="absolute inset-0 bg-primary rounded-full origin-left"
                                style={{
                                  animation: isRelatedPaused ? 'none' : 'progressFill 3s linear',
                                }}
                                key={`${relatedIndex}-${isRelatedPaused}`}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Progress Animation Style */}
                    <style>{`
                      @keyframes progressFill {
                        from { transform: scaleX(0); }
                        to { transform: scaleX(1); }
                      }
                    `}</style>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      to={`/search?tag=${encodeURIComponent(tag.slug)}`}
                      className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="material-symbols-outlined text-[20px]">visibility</span>
                    <span className="text-sm font-medium">{(post.viewCount ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="relative group">
                    <button
                      onClick={handleLike}
                      disabled={isLiking}
                      className={`flex items-center gap-2 transition-colors ${
                        liked
                          ? 'text-red-500'
                          : 'text-slate-500 hover:text-red-500'
                      } disabled:opacity-50`}
                    >
                      <span className={`material-symbols-outlined text-[20px] ${isLiking ? 'animate-pulse' : ''}`}>
                        {liked ? 'favorite' : 'favorite_border'}
                      </span>
                      <span className="text-sm font-medium">{liked ? '좋아요' : '좋아요'}</span>
                    </button>
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {(likeCount ?? 0).toLocaleString()}개
                    </span>
                  </div>
                  <button
                    onClick={handleShare}
                    className={`flex items-center gap-2 transition-colors ${
                      shareCopied
                        ? 'text-green-500'
                        : 'text-slate-500 hover:text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {shareCopied ? 'check' : 'share'}
                    </span>
                    <span className="text-sm font-medium">
                      {shareCopied ? '복사됨!' : '공유하기'}
                    </span>
                  </button>
                </div>
                {/* Bookmark button - only for logged-in non-admin users */}
                {user && user.role !== 'ADMIN' && (
                  <button
                    onClick={handleBookmark}
                    disabled={isBookmarking}
                    className={`transition-colors ${
                      bookmarked
                        ? 'text-primary'
                        : 'text-slate-500 hover:text-primary'
                    } ${isBookmarking ? 'opacity-50' : ''}`}
                    title={bookmarked ? '북마크 해제' : '북마크'}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {bookmarked ? 'bookmark' : 'bookmark_border'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </article>

          {/* Navigation */}
          <div className="grid grid-cols-3 md:gap-3 gap-2" style={{ gridTemplateColumns: '2fr 1fr 2fr' }}>
            {/* 이전 글 */}
            {adjacentPosts.prev ? (
              <Link
                to={`/posts/${adjacentPosts.prev.slug}`}
                className="group flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all"
              >
                <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-400 group-hover:text-primary transition-colors shrink-0">
                  arrow_back
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] md:text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5 md:mb-1 block">이전 글</span>
                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1 text-xs md:text-sm">
                    {adjacentPosts.prev.title}
                  </h4>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 opacity-50">
                <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-300 dark:text-slate-600 shrink-0">
                  arrow_back
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] md:text-xs font-medium text-slate-400 dark:text-slate-500 mb-0.5 md:mb-1 block">이전 글</span>
                  <h4 className="font-medium text-slate-400 dark:text-slate-500 text-xs md:text-sm">
                    없음
                  </h4>
                </div>
              </div>
            )}

            {/* 목록 */}
            <Link
              to="/posts"
              className="group flex flex-col items-center justify-center p-3 md:p-4 bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all"
            >
              <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-400 group-hover:text-primary transition-colors mb-0.5 md:mb-1">
                list
              </span>
              <span className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">
                목록
              </span>
            </Link>

            {/* 다음 글 */}
            {adjacentPosts.next ? (
              <Link
                to={`/posts/${adjacentPosts.next.slug}`}
                className="group flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all text-right"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] md:text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5 md:mb-1 block">다음 글</span>
                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1 text-xs md:text-sm">
                    {adjacentPosts.next.title}
                  </h4>
                </div>
                <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-400 group-hover:text-primary transition-colors shrink-0">
                  arrow_forward
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 opacity-50 text-right">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] md:text-xs font-medium text-slate-400 dark:text-slate-500 mb-0.5 md:mb-1 block">다음 글</span>
                  <h4 className="font-medium text-slate-400 dark:text-slate-500 text-xs md:text-sm">
                    없음
                  </h4>
                </div>
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 shrink-0">
                  arrow_forward
                </span>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <CommentSection postId={post.id} postAuthorId={post.author.id} />
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>

      {/* TOC Navigation - Notion Style */}
      {tocHeadings.length > 0 && (
        <div
          className="fixed top-[25vh] z-40 hidden lg:block"
          style={{ left: 'max(1.5rem, calc((100vw - 80rem) / 2 - 2rem))' }}
          onMouseEnter={() => setTocExpanded(true)}
          onMouseLeave={() => {
            setTocExpanded(false)
            setHoveredHeadingId(null)
          }}
        >
          {/* Indicators - always visible underneath */}
          <div className="flex flex-col items-end gap-2 py-4 pl-6 pr-2 cursor-pointer">
            {tocHeadings.map((heading) => {
              const isActive = activeHeadingId === heading.id
              const isHovered = hoveredHeadingId === heading.id
              return (
                <button
                  key={heading.id}
                  onClick={() => scrollToHeading(heading.id)}
                  onMouseEnter={() => setHoveredHeadingId(heading.id)}
                  onMouseLeave={() => setHoveredHeadingId(null)}
                  className={`
                    rounded-full cursor-pointer transition-all duration-200
                    ${heading.level === 1 ? 'w-5 h-1.5' : heading.level === 2 ? 'w-4 h-1' : 'w-3 h-1'}
                    ${isHovered
                      ? 'bg-primary scale-110'
                      : isActive
                        ? 'bg-primary/70'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }
                  `}
                  title={heading.text}
                />
              )
            })}
          </div>

          {/* Expanded Panel - overlays on top of indicators */}
          <div
            className={`
              absolute right-0 top-0
              bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
              rounded-xl shadow-lg p-4 max-h-[70vh] overflow-y-auto
              transition-all duration-200 ease-out
              ${tocExpanded
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 translate-x-2 pointer-events-none'
              }
            `}
            style={{ minWidth: '220px' }}
          >
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 block">목차</span>
            <div className="flex flex-col gap-1">
              {tocHeadings.map((heading) => {
                const isActive = activeHeadingId === heading.id
                const isHovered = hoveredHeadingId === heading.id
                return (
                  <button
                    key={heading.id}
                    onClick={() => scrollToHeading(heading.id)}
                    onMouseEnter={() => setHoveredHeadingId(heading.id)}
                    onMouseLeave={() => setHoveredHeadingId(null)}
                    className={`
                      text-left py-1.5 px-2 rounded-lg transition-colors
                      ${heading.level === 1 ? 'font-semibold text-sm' : heading.level === 2 ? 'pl-4 text-sm' : 'pl-6 text-xs'}
                      ${isHovered
                        ? 'text-primary bg-primary/10'
                        : isActive
                          ? 'text-primary font-medium'
                          : 'text-slate-600 dark:text-slate-400'
                      }
                    `}
                  >
                    {heading.text}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Profile Modal */}
      <MobileProfileModal />
    </div>
  )
}
