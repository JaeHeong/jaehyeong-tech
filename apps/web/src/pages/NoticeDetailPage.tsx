import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import api, { type Page } from '../services/api'

interface AdjacentNotice {
  slug: string
  title: string
}

export default function NoticeDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [notice, setNotice] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adjacentNotices, setAdjacentNotices] = useState<{ prev: AdjacentNotice | null; next: AdjacentNotice | null }>({ prev: null, next: null })

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
      alert('링크가 복사되었습니다.')
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main className="lg:col-span-8">
          <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-10 min-h-[600px]">
            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-8">
              <Link
                to="/notices"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors group"
              >
                <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">
                  arrow_back
                </span>
                목록으로 돌아가기
              </Link>
              <div className="flex gap-2">
                {notice.badge && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getBadgeStyle(notice.badge, notice.badgeColor)}`}>
                    {notice.badge}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold border border-slate-200 dark:border-slate-700">
                  공지
                </span>
              </div>
            </div>

            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-800 pb-8 mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
                {notice.title}
              </h1>
              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                  <span>{formatDate(notice.publishedAt || notice.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                  <span>{notice.viewCount.toLocaleString()} 읽음</span>
                </div>
                <div className="flex items-center gap-2 ml-auto md:ml-0">
                  <button
                    onClick={handleShare}
                    className="hover:text-primary transition-colors"
                    title="공유하기"
                  >
                    <span className="material-symbols-outlined text-[18px]">share</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:underline">
              <div
                className="text-slate-700 dark:text-slate-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: notice.content.replace(/\n/g, '<br />') }}
              />
            </div>

            {/* Previous / Next Navigation */}
            {(adjacentNotices.prev || adjacentNotices.next) && (
              <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  {adjacentNotices.prev ? (
                    <Link
                      to={`/notices/${adjacentNotices.prev.slug}`}
                      className="group flex-1 flex flex-col items-start p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                    >
                      <span className="flex items-center gap-1 text-xs font-medium text-slate-500 mb-2 group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span> 이전 글
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
                        {adjacentNotices.prev.title}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex-1" />
                  )}
                  {adjacentNotices.next ? (
                    <Link
                      to={`/notices/${adjacentNotices.next.slug}`}
                      className="group flex-1 flex flex-col items-end p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-right"
                    >
                      <span className="flex items-center gap-1 text-xs font-medium text-slate-500 mb-2 group-hover:text-primary transition-colors">
                        다음 글 <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
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
    </div>
  )
}
