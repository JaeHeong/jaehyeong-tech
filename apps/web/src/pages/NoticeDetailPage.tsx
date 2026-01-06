import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import api, { type Page } from '../services/api'

export default function NoticeDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [notice, setNotice] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (slug) {
      loadNotice(slug)
    }
  }, [slug])

  const loadNotice = async (slug: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getPageBySlug(slug)
      if (response.page.type !== 'NOTICE') {
        throw new Error('페이지를 찾을 수 없습니다.')
      }
      setNotice(response.page)
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
      return 'bg-primary text-white shadow-sm shadow-primary/30'
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
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
          <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-6 md:p-10 border-b border-slate-200 dark:border-slate-800">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
                <Link to="/" className="hover:text-primary transition-colors">홈</Link>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                <Link to="/notices" className="hover:text-primary transition-colors">공지사항</Link>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                <span className="text-slate-900 dark:text-white truncate max-w-[200px]">{notice.title}</span>
              </nav>

              {/* Badge & Date */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {notice.badge && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBadgeStyle(notice.badge, notice.badgeColor)}`}>
                    {notice.badge}
                  </span>
                )}
                {notice.isPinned && (
                  <span className="flex items-center gap-1 text-primary text-sm font-medium">
                    <span className="material-symbols-outlined text-[16px]">push_pin</span>
                    고정됨
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
                {notice.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                  {formatDate(notice.publishedAt || notice.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                  {notice.viewCount.toLocaleString()} 조회
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 md:p-10">
              <article className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
                {/* Render content as HTML or plain text */}
                <div dangerouslySetInnerHTML={{ __html: notice.content.replace(/\n/g, '<br />') }} />
              </article>
            </div>

            {/* Footer Actions */}
            <div className="px-6 md:px-10 py-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <Link
                  to="/notices"
                  className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  목록으로 돌아가기
                </Link>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href)
                      alert('링크가 복사되었습니다.')
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                  >
                    <span className="material-symbols-outlined text-[18px]">link</span>
                    링크 복사
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>
    </div>
  )
}
