import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, type Post } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useModal } from '../contexts/ModalContext'
import Sidebar from '../components/Sidebar'
import CommentSection from '../components/CommentSection'
import { useSEO } from '../hooks/useSEO'

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
  const [shareCopied, setShareCopied] = useState(false)
  const [tocExpanded, setTocExpanded] = useState(false)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // TOC heading type
  interface TocHeading {
    id: string
    text: string
    level: number
  }

  // Add copy buttons to code blocks
  const addCopyButtons = useCallback(() => {
    if (!contentRef.current) return

    const preElements = contentRef.current.querySelectorAll('pre')
    preElements.forEach((pre) => {
      // Skip if already has copy button
      if (pre.querySelector('.code-copy-btn')) return

      const copyBtn = document.createElement('button')
      copyBtn.className = 'code-copy-btn'
      copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>'
      copyBtn.title = '코드 복사'

      copyBtn.addEventListener('click', async () => {
        const code = pre.querySelector('code')
        const text = code?.textContent || ''

        try {
          await navigator.clipboard.writeText(text)
          copyBtn.innerHTML = '<span class="material-symbols-outlined">check</span>'
          copyBtn.classList.add('copied')
          setTimeout(() => {
            copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>'
            copyBtn.classList.remove('copied')
          }, 2000)
        } catch (err) {
          console.error('Failed to copy:', err)
        }
      })

      pre.appendChild(copyBtn)
    })
  }, [])

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

  // Add copy buttons after post content is rendered
  useEffect(() => {
    if (post && !isLoading) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(addCopyButtons, 100)
      return () => clearTimeout(timer)
    }
  }, [post, isLoading, addCopyButtons])

  // Extract headings from content for TOC and add IDs to content HTML
  const { tocHeadings, contentWithIds } = useMemo(() => {
    if (!post?.content) return { tocHeadings: [] as TocHeading[], contentWithIds: '' }

    const parser = new DOMParser()
    const doc = parser.parseFromString(post.content, 'text/html')
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

    return {
      tocHeadings: tocList,
      contentWithIds: doc.body.innerHTML,
    }
  }, [post?.content])

  // Track scroll position for active heading
  useEffect(() => {
    if (tocHeadings.length === 0) return

    // Set initial active heading
    const firstHeading = tocHeadings[0]
    if (firstHeading) {
      setActiveHeadingId(firstHeading.id)
    }

    // Scroll tracking
    const handleScroll = () => {
      let currentActive = tocHeadings[0]?.id || null

      for (const heading of tocHeadings) {
        const element = document.getElementById(heading.id)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.top < window.innerHeight / 3) {
            currentActive = heading.id
          }
        }
      }

      setActiveHeadingId(currentActive)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check

    return () => window.removeEventListener('scroll', handleScroll)
  }, [tocHeadings])

  // Scroll to heading - position at 1/3 of viewport (matching highlight calculation)
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
        .post-content pre {
          position: relative;
          margin: 1.5rem 0;
          border-radius: 0.75rem;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
          background: linear-gradient(180deg, #f1f5f9 0%, #f1f5f9 32px, #f8fafc 32px);
          padding: 0;
        }
        .dark .post-content pre {
          border-color: #30363d;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
          background: linear-gradient(180deg, #21262d 0%, #21262d 32px, #0d1117 32px);
        }
        .post-content pre::before {
          content: '';
          display: block;
          height: 32px;
          background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
          border-bottom: 1px solid #e2e8f0;
          position: relative;
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
          overflow-x: auto;
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
        /* Paragraphs */
        .post-content p { margin: 1rem 0; line-height: 1.8; }
        .post-content p:first-child { font-size: 1.125rem; }
        /* Word break and wrap */
        .post-content {
          word-break: keep-all; /* Korean: don't break in middle of words */
          overflow-wrap: break-word; /* Break long URLs/words if needed */
        }
        /* Strong */
        .post-content strong { font-weight: 600; }
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
        /* Code Copy Button */
        .post-content pre {
          position: relative;
        }
        .post-content .code-copy-btn {
          position: absolute;
          top: 4px;
          right: 8px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s;
          z-index: 10;
        }
        .post-content .code-copy-btn .material-symbols-outlined {
          font-size: 16px;
          color: #94a3b8;
        }
        .post-content pre:hover .code-copy-btn {
          opacity: 1;
        }
        .post-content .code-copy-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .post-content .code-copy-btn:hover .material-symbols-outlined {
          color: #e2e8f0;
        }
        .post-content .code-copy-btn.copied {
          opacity: 1;
        }
        .post-content .code-copy-btn.copied .material-symbols-outlined {
          color: #22c55e;
        }
        .dark .post-content .code-copy-btn {
          background: rgba(0, 0, 0, 0.3);
        }
        .dark .post-content .code-copy-btn:hover {
          background: rgba(0, 0, 0, 0.5);
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
                className="post-content text-slate-700 dark:text-slate-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: contentWithIds || post.content }}
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
                      to={`/tags/${tag.slug}`}
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
                    <span className="text-sm font-medium">{likeCount > 0 ? likeCount : '좋아요'}</span>
                  </button>
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
                <button className="text-slate-500 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">bookmark</span>
                </button>
              </div>
            </div>
          </article>

          {/* Navigation */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '3fr 1fr 3fr' }}>
            {/* 이전 글 */}
            {adjacentPosts.prev ? (
              <Link
                to={`/posts/${adjacentPosts.prev.slug}`}
                className="group flex items-center gap-3 p-4 bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all"
              >
                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors shrink-0">
                  arrow_back
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">이전 글</span>
                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1 text-sm">
                    {adjacentPosts.prev.title}
                  </h4>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 opacity-50">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 shrink-0">
                  arrow_back
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1 block">이전 글</span>
                  <h4 className="font-medium text-slate-400 dark:text-slate-500 text-sm">
                    없음
                  </h4>
                </div>
              </div>
            )}

            {/* 목록으로 */}
            <Link
              to="/posts"
              className="group flex flex-col items-center justify-center p-4 bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all"
            >
              <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors mb-1">
                list
              </span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">
                목록으로
              </span>
            </Link>

            {/* 다음 글 */}
            {adjacentPosts.next ? (
              <Link
                to={`/posts/${adjacentPosts.next.slug}`}
                className="group flex items-center gap-3 p-4 bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all text-right"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">다음 글</span>
                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1 text-sm">
                    {adjacentPosts.next.title}
                  </h4>
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors shrink-0">
                  arrow_forward
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 opacity-50 text-right">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1 block">다음 글</span>
                  <h4 className="font-medium text-slate-400 dark:text-slate-500 text-sm">
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
          <CommentSection postId={post.id} />
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>

      {/* TOC Navigation - Notion Style */}
      {tocHeadings.length > 0 && (
        <div
          className="fixed right-6 top-1/4 -translate-y-1/2 z-40 hidden lg:block"
          onMouseEnter={() => setTocExpanded(true)}
          onMouseLeave={() => setTocExpanded(false)}
        >
          {/* Indicators - always visible underneath */}
          <div className="flex flex-col items-end gap-2 py-4 pl-6 pr-2 cursor-pointer">
            {tocHeadings.map((heading) => (
              <button
                key={heading.id}
                onClick={() => scrollToHeading(heading.id)}
                className={`
                  rounded-full cursor-pointer transition-all duration-200
                  ${heading.level === 1 ? 'w-5 h-1.5' : heading.level === 2 ? 'w-4 h-1' : 'w-3 h-1'}
                  ${activeHeadingId === heading.id
                    ? 'bg-primary'
                    : 'bg-slate-300 dark:bg-slate-600 hover:bg-primary/60'
                  }
                `}
                title={heading.text}
              />
            ))}
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
              {tocHeadings.map((heading) => (
                <button
                  key={heading.id}
                  onClick={() => {
                    scrollToHeading(heading.id)
                    setTocExpanded(false)
                  }}
                  className={`
                    text-left py-1.5 px-2 rounded-lg transition-colors
                    ${heading.level === 1 ? 'font-semibold text-sm' : heading.level === 2 ? 'pl-4 text-sm' : 'pl-6 text-xs'}
                    ${activeHeadingId === heading.id
                      ? 'text-primary bg-primary/10'
                      : 'text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  {heading.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
