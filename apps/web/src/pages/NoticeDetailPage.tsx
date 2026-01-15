import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileProfileModal from '../components/MobileProfileModal'
import api, { type Page } from '../services/api'
import { useModal } from '../contexts/ModalContext'
import { useSEO } from '../hooks/useSEO'

interface AdjacentNotice {
  slug: string
  title: string
}

export default function NoticeDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { alert } = useModal()
  const [notice, setNotice] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adjacentNotices, setAdjacentNotices] = useState<{ prev: AdjacentNotice | null; next: AdjacentNotice | null }>({ prev: null, next: null })

  useSEO({
    title: notice?.title || '공지사항',
    description: notice?.excerpt || '공지사항 상세 내용입니다.',
    url: notice ? `/notices/${notice.slug}` : '/notices',
    type: 'article',
    publishedTime: notice?.publishedAt || notice?.createdAt,
  })

  useEffect(() => {
    if (slug) {
      loadNotice(slug)
    }
  }, [slug])

  const loadNotice = async (slug: string) => {
    try {
      setLoading(true)
      setError(null)
      const [noticeResponse, adjacentResponse] = await Promise.all([
        api.getPageBySlug(slug),
        api.getAdjacentNotices(slug).catch(() => ({ prev: null, next: null })),
      ])
      if (noticeResponse.page.type !== 'NOTICE') {
        throw new Error('페이지를 찾을 수 없습니다.')
      }
      setNotice(noticeResponse.page)
      setAdjacentNotices(adjacentResponse)
    } catch (err) {
      console.error('Failed to load notice:', err)
      setError('공지사항을 찾을 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getBadgeStyle = (badge?: string, badgeColor?: string) => {
    if (badgeColor === 'primary' || badge === '필독') {
      return 'bg-primary/10 text-primary border border-primary/20'
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: notice?.title,
          url: window.location.href,
        })
      } catch {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(window.location.href)
      await alert({ message: '링크가 복사되었습니다.', type: 'success' })
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error || !notice) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-10 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">
            error_outline
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {error || '공지사항을 찾을 수 없습니다.'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            요청하신 공지사항이 존재하지 않거나 삭제되었습니다.
          </p>
          <button
            onClick={() => navigate('/notices')}
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            공지사항 목록으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Post Content Styles */}
      <style>{`
        .notice-content pre {
          position: relative;
          margin: 1.5rem 0;
          border-radius: 0.75rem;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
          background: linear-gradient(180deg, #f1f5f9 0%, #f1f5f9 32px, #f8fafc 32px);
          padding: 0;
        }
        .dark .notice-content pre {
          border-color: #30363d;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
          background: linear-gradient(180deg, #21262d 0%, #21262d 32px, #0d1117 32px);
        }
        .notice-content pre::before {
          content: '';
          display: block;
          height: 32px;
          background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
          border-bottom: 1px solid #e2e8f0;
          position: relative;
        }
        .dark .notice-content pre::before {
          background: linear-gradient(180deg, #21262d 0%, #161b22 100%);
          border-bottom-color: #30363d;
        }
        .notice-content pre::after {
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
        .notice-content pre code {
          display: block;
          padding: 1rem;
          background: transparent;
          color: #1e293b;
          overflow-x: auto;
          font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
        }
        .dark .notice-content pre code {
          color: #e6edf3;
        }
        /* Inline code */
        .notice-content code:not(pre code) {
          background: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
          color: #dc2626;
        }
        .dark .notice-content code:not(pre code) {
          background: #1e293b;
          color: #f87171;
        }
        /* Syntax highlighting */
        .notice-content .hljs-keyword,
        .notice-content .hljs-selector-tag,
        .notice-content .hljs-built_in { color: #a855f7; }
        .notice-content .hljs-string,
        .notice-content .hljs-attr { color: #22c55e; }
        .notice-content .hljs-comment { color: #94a3b8; font-style: italic; }
        .notice-content .hljs-function,
        .notice-content .hljs-title { color: #3b82f6; }
        .notice-content .hljs-number { color: #f59e0b; }
        .notice-content .hljs-variable,
        .notice-content .hljs-template-variable { color: #ef4444; }
        .notice-content .hljs-property { color: #0891b2; }
        .dark .notice-content .hljs-keyword,
        .dark .notice-content .hljs-selector-tag,
        .dark .notice-content .hljs-built_in { color: #c084fc; }
        .dark .notice-content .hljs-string,
        .dark .notice-content .hljs-attr { color: #4ade80; }
        .dark .notice-content .hljs-comment { color: #64748b; }
        .dark .notice-content .hljs-function,
        .dark .notice-content .hljs-title { color: #60a5fa; }
        .dark .notice-content .hljs-number { color: #fbbf24; }
        .dark .notice-content .hljs-variable,
        .dark .notice-content .hljs-template-variable { color: #f87171; }
        .dark .notice-content .hljs-property { color: #22d3ee; }
        /* Blockquote */
        .notice-content blockquote {
          border-left: 4px solid #3182f6;
          background: rgba(49, 130, 246, 0.05);
          padding: 1.5rem;
          border-radius: 0 0.5rem 0.5rem 0;
          margin: 2rem 0;
          font-style: italic;
          color: #475569;
        }
        .dark .notice-content blockquote {
          background: rgba(49, 130, 246, 0.1);
          color: #94a3b8;
        }
        /* Images */
        .notice-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          margin: 1.5rem 0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        /* Links */
        .notice-content a {
          color: #3182f6;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .notice-content a:hover {
          color: #1d4ed8;
        }
        /* Lists */
        .notice-content ul,
        .notice-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }
        .notice-content ul { list-style-type: disc; }
        .notice-content ol { list-style-type: decimal; }
        .notice-content li { margin: 0.5rem 0; }
        .notice-content li::marker { color: #3182f6; }
        /* Headings */
        .notice-content h1 { font-size: 2rem; font-weight: 700; margin: 2.5rem 0 1rem; color: inherit; }
        .notice-content h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem; color: inherit; }
        .notice-content h3 { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem; color: inherit; }
        /* Paragraphs */
        .notice-content p { margin: 1rem 0; line-height: 1.8; }
        .notice-content p:first-child { font-size: 1.125rem; }
        /* Word break and wrap */
        .notice-content {
          word-break: keep-all;
          overflow-wrap: break-word;
        }
        /* Strong */
        .notice-content strong { font-weight: 600; }
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .notice-content { font-size: 0.9375rem; line-height: 1.75; }
          .notice-content h1 { font-size: 1.5rem; margin: 1.75rem 0 0.75rem; }
          .notice-content h2 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; }
          .notice-content h3 { font-size: 1.1rem; margin: 1.25rem 0 0.5rem; }
          .notice-content p { margin: 0.75rem 0; }
          .notice-content p:first-child { font-size: 1rem; }
          .notice-content pre { margin: 1rem 0; border-radius: 0.5rem; }
          .notice-content pre code { font-size: 0.75rem; padding: 0.75rem; }
          .notice-content code:not(pre code) { font-size: 0.8rem; padding: 0.1rem 0.25rem; }
          .notice-content blockquote { padding: 1rem; margin: 1.25rem 0; font-size: 0.9375rem; }
          .notice-content ul, .notice-content ol { padding-left: 1.25rem; margin: 0.75rem 0; }
          .notice-content li { margin: 0.375rem 0; }
          .notice-content img { margin: 1rem 0; border-radius: 0.5rem; }
        }
      `}</style>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main className="lg:col-span-8">
          <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-10 min-h-[600px]">
            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <Link
                to="/notices"
                className="inline-flex items-center gap-1 md:gap-2 text-xs md:text-sm text-slate-500 hover:text-primary transition-colors group"
              >
                <span className="material-symbols-outlined text-[16px] md:text-[18px] group-hover:-translate-x-1 transition-transform">
                  arrow_back
                </span>
                목록으로
              </Link>
              <div className="flex gap-1.5 md:gap-2">
                {notice.badge && (
                  <span className={`px-2 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold ${getBadgeStyle(notice.badge, notice.badgeColor)}`}>
                    {notice.badge}
                  </span>
                )}
                <span className="px-2 md:px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] md:text-xs font-bold border border-slate-200 dark:border-slate-700">
                  공지
                </span>
              </div>
            </div>

            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-800 pb-6 md:pb-8 mb-6 md:mb-8">
              <h1 className="text-xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 md:mb-6 leading-tight">
                {notice.title}
              </h1>
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 md:gap-x-6 text-xs md:text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">calendar_today</span>
                  <span>{formatDate(notice.publishedAt || notice.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">visibility</span>
                  <span>{notice.viewCount.toLocaleString()} 읽음</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2 ml-auto md:ml-0">
                  <button
                    onClick={handleShare}
                    className="hover:text-primary transition-colors"
                    title="공유하기"
                  >
                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">share</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div
              className="notice-content text-slate-700 dark:text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: notice.content }}
            />

            {/* Previous / Next Navigation */}
            {(adjacentNotices.prev || adjacentNotices.next) && (
              <div className="mt-8 md:mt-10 pt-6 md:pt-8 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between gap-3 md:gap-4">
                  {adjacentNotices.prev ? (
                    <Link
                      to={`/notices/${adjacentNotices.prev.slug}`}
                      className="group flex-1 flex flex-col items-start p-3 md:p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                    >
                      <span className="flex items-center gap-1 text-[10px] md:text-xs font-medium text-slate-500 mb-1 md:mb-2 group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[14px] md:text-[16px]">arrow_back</span> 이전 글
                      </span>
                      <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
                        {adjacentNotices.prev.title}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex-1" />
                  )}
                  {adjacentNotices.next ? (
                    <Link
                      to={`/notices/${adjacentNotices.next.slug}`}
                      className="group flex-1 flex flex-col items-end p-3 md:p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-right"
                    >
                      <span className="flex items-center gap-1 text-[10px] md:text-xs font-medium text-slate-500 mb-1 md:mb-2 group-hover:text-primary transition-colors">
                        다음 글 <span className="material-symbols-outlined text-[14px] md:text-[16px]">arrow_forward</span>
                      </span>
                      <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
                        {adjacentNotices.next.title}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>

      {/* Mobile Profile Modal */}
      <MobileProfileModal />
    </div>
  )
}
