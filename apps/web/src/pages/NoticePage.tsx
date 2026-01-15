import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileProfileModal from '../components/MobileProfileModal'
import api, { type Page } from '../services/api'
import { useSEO } from '../hooks/useSEO'

export default function NoticePage() {
  const [notices, setNotices] = useState<Page[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  useSEO({
    title: '공지사항',
    description: 'Jaehyeong Tech 블로그의 주요 소식과 업데이트, 서비스 관련 안내사항을 확인하세요.',
    url: '/notices',
    type: 'website',
  })

  useEffect(() => {
    loadNotices(currentPage)
  }, [currentPage])

  const loadNotices = async (page: number) => {
    try {
      setLoading(true)
      const response = await api.getNotices({ page, limit: 10 })
      setNotices(response.notices)
      setMeta(response.meta)
    } catch (error) {
      console.error('Failed to load notices:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '')
  }

  const getBadgeStyle = (badge?: string, badgeColor?: string) => {
    if (badgeColor === 'primary' || badge === '필독') {
      return 'bg-primary text-white shadow-sm shadow-primary/30'
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
  }

  // Separate pinned and regular notices
  const pinnedNotices = notices.filter(n => n.isPinned)
  const regularNotices = notices.filter(n => !n.isPinned)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main className="lg:col-span-8">
          <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-10 min-h-[600px]">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-800 pb-6 md:pb-8 mb-6 md:mb-8">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="p-2 md:p-2.5 bg-primary/10 rounded-xl text-primary">
                  <span className="material-symbols-outlined text-xl md:text-2xl">campaign</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">공지사항</h1>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base leading-relaxed">
                jaehyeong tech 블로그의 주요 소식과 업데이트, 그리고 서비스 관련 안내사항을 확인하실 수 있습니다.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              </div>
            ) : notices.length === 0 ? (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">
                  notifications_off
                </span>
                <p className="text-slate-500 dark:text-slate-400">등록된 공지사항이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Pinned Notices */}
                {pinnedNotices.map((notice) => (
                  <Link
                    key={notice.id}
                    to={`/notices/${notice.slug}`}
                    className="block p-4 md:p-6 rounded-xl bg-primary/5 border border-primary/10 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-4xl md:text-6xl text-primary">bookmark_star</span>
                    </div>
                    <div className="relative z-10">
                      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2 md:mb-3">
                        {notice.badge && (
                          <span className={`px-2 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold ${getBadgeStyle(notice.badge, notice.badgeColor)}`}>
                            {notice.badge}
                          </span>
                        )}
                        <span className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                          {formatDate(notice.publishedAt || notice.createdAt)}
                        </span>
                      </div>
                      <h2 className="text-base md:text-xl font-bold text-slate-900 dark:text-white mb-2 md:mb-3 group-hover:text-primary transition-colors line-clamp-2">
                        {notice.title}
                      </h2>
                      {notice.excerpt && (
                        <p className="hidden md:block text-slate-600 dark:text-slate-300 text-sm leading-relaxed line-clamp-3">
                          {notice.excerpt}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}

                {/* Regular Notices */}
                {regularNotices.map((notice) => (
                  <Link
                    key={notice.id}
                    to={`/notices/${notice.slug}`}
                    className="group block border-b border-slate-100 dark:border-slate-800 pb-6 md:pb-8 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 md:gap-2 mb-2 md:mb-3">
                      <div className="flex items-center gap-2 md:gap-3">
                        {notice.badge && (
                          <span className={`px-2 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold ${getBadgeStyle(notice.badge, notice.badgeColor)}`}>
                            {notice.badge}
                          </span>
                        )}
                        <h3 className="text-sm md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                          {notice.title}
                        </h3>
                      </div>
                      <span className="text-xs md:text-sm text-slate-400 shrink-0">
                        {formatDate(notice.publishedAt || notice.createdAt)}
                      </span>
                    </div>
                    {notice.excerpt && (
                      <p className="hidden md:block text-slate-600 dark:text-slate-400 text-sm line-clamp-2 leading-relaxed">
                        {notice.excerpt}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                <nav className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="size-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`size-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        page === currentPage
                          ? 'bg-primary text-white shadow-sm shadow-primary/30'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(meta.totalPages, currentPage + 1))}
                    disabled={currentPage === meta.totalPages}
                    className="size-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </nav>
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
