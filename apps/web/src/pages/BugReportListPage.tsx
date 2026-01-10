import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, PublicBugReport } from '../services/api'
import { useSEO } from '../hooks/useSEO'

type StatusFilter = '' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type CategoryFilter = '' | 'UI' | 'FUNCTIONAL' | 'PERFORMANCE' | 'SECURITY' | 'ETC'

export default function BugReportListPage() {
  const [bugReports, setBugReports] = useState<PublicBugReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('')

  useSEO({
    title: '버그 리포트 목록',
    description: '블로그에서 보고된 버그 및 이슈 목록을 확인하세요.',
  })

  useEffect(() => {
    const fetchBugReports = async () => {
      setIsLoading(true)
      try {
        const response = await api.getPublicBugReports({
          page,
          limit: 20,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
        })
        setBugReports(response.data)
        setTotalPages(response.meta.totalPages)
        setTotal(response.meta.total)
      } catch (err) {
        console.error('Failed to fetch bug reports:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchBugReports()
  }, [page, statusFilter, categoryFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">OPEN</span>
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">IN PROGRESS</span>
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">RESOLVED</span>
      case 'CLOSED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">CLOSED</span>
      default:
        return null
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'UI': return 'UI/UX'
      case 'FUNCTIONAL': return 'Functional'
      case 'PERFORMANCE': return 'Performance'
      case 'SECURITY': return 'Security'
      case 'ETC': return '기타'
      default: return category
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
            <Link to="/" className="hover:text-primary transition-colors">홈</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-medium">버그 리포트</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">버그 리포트 목록</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                총 {total}개의 리포트
              </p>
            </div>
            <Link
              to="/bug-report"
              className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2 text-sm w-fit"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              새 리포트 작성
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1) }}
              className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm px-3 py-1.5"
            >
              <option value="">전체 상태</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value as CategoryFilter); setPage(1) }}
              className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm px-3 py-1.5"
            >
              <option value="">전체 카테고리</option>
              <option value="UI">UI/UX</option>
              <option value="FUNCTIONAL">Functional</option>
              <option value="PERFORMANCE">Performance</option>
              <option value="SECURITY">Security</option>
              <option value="ETC">기타</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">
              <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
              <p className="mt-2">불러오는 중...</p>
            </div>
          ) : bugReports.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <span className="material-symbols-outlined text-[48px] mb-2">inbox</span>
              <p>등록된 버그 리포트가 없습니다.</p>
            </div>
          ) : (
            bugReports.map((report) => (
              <Link
                key={report.id}
                to={`/bug-reports/${report.id}`}
                className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(report.status)}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {getCategoryLabel(report.category)}
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-900 dark:text-white truncate">
                      {report.title}
                    </h3>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1">
                    {formatDate(report.createdAt)}
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              이전
            </button>
            <span className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
