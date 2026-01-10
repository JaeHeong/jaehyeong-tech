import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, PublicBugReport } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useSEO } from '../hooks/useSEO'

type Category = 'ui' | 'functional' | 'performance' | 'security' | 'etc'
type Priority = 'low' | 'medium' | 'high'

export default function BugReportPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recentReports, setRecentReports] = useState<PublicBugReport[]>([])
  const [formData, setFormData] = useState({
    title: '',
    category: '' as Category | '',
    priority: 'medium' as Priority,
    description: '',
    email: '',
  })

  useSEO({
    title: '버그 리포트',
    description: '블로그 이용 중 발견하신 기술적인 문제나 버그를 알려주세요.',
  })

  useEffect(() => {
    const fetchRecentReports = async () => {
      try {
        const response = await api.getPublicBugReports({ limit: 3 })
        setRecentReports(response.data)
      } catch (err) {
        console.error('Failed to fetch recent reports:', err)
      }
    }
    fetchRecentReports()
  }, [])

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
      case 'UI': return 'UI'
      case 'FUNCTIONAL': return 'Functional'
      case 'PERFORMANCE': return 'Performance'
      case 'SECURITY': return 'Security'
      case 'ETC': return '기타'
      default: return category
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      showToast({ message: '제목을 입력해주세요.', type: 'error' })
      return
    }
    if (!formData.category) {
      showToast({ message: '카테고리를 선택해주세요.', type: 'error' })
      return
    }
    if (!formData.description.trim()) {
      showToast({ message: '설명을 입력해주세요.', type: 'error' })
      return
    }

    setIsSubmitting(true)
    try {
      await api.createBugReport({
        title: formData.title.trim(),
        category: formData.category,
        priority: formData.priority,
        description: formData.description.trim(),
        email: formData.email.trim() || undefined,
      })
      showToast({ message: '버그 리포트가 제출되었습니다. 감사합니다!', type: 'success' })
      navigate('/')
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : '제출에 실패했습니다.', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const categoryOptions = [
    { value: 'ui', label: 'UI/UX (레이아웃, 스타일)' },
    { value: 'functional', label: 'Functional (기능 고장)' },
    { value: 'performance', label: 'Performance (성능, 속도)' },
    { value: 'security', label: 'Security (보안 취약점)' },
    { value: 'etc', label: '기타' },
  ]

  const priorityOptions = [
    { value: 'low', label: '낮음' },
    { value: 'medium', label: '보통' },
    { value: 'high', label: '높음 (긴급)' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar - Guidelines */}
        <aside className="lg:col-span-4 space-y-6 order-2 lg:order-1">
          <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold mb-4 text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">info</span>
              Bug Report Guidelines
            </h3>
            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              <li className="flex gap-3">
                <span className="text-primary font-bold">01.</span>
                <span>문제가 발생한 환경(OS, Browser, Device)을 상세히 기재해 주세요.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">02.</span>
                <span>버그를 재현할 수 있는 단계를 구체적으로 설명해 주세요.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">03.</span>
                <span>에러 메시지가 있다면 함께 작성해 주시면 해결 속도가 빨라집니다.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">04.</span>
                <span>보안 취약점의 경우 공개 리포트 대신 이메일로 제보 바랍니다.</span>
              </li>
            </ul>
          </div>

          {/* Recent Reports */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">최근 리포트 상태</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentReports.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  등록된 리포트가 없습니다.
                </div>
              ) : (
                recentReports.map((report) => (
                  <Link
                    key={report.id}
                    to={`/bug-reports/${report.id}`}
                    className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium truncate pr-4">{report.title}</span>
                      {getStatusBadge(report.status)}
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDate(report.createdAt)} • {getCategoryLabel(report.category)}
                    </span>
                  </Link>
                ))
              )}
            </div>
            <Link
              to="/bug-reports"
              className="block p-3 text-center text-xs font-medium text-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-800"
            >
              전체 리포트 보기
            </Link>
          </div>

          {/* Contact Info */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold mb-3 text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">mail</span>
              보안 취약점 제보
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              보안 취약점 발견 시 공개 리포트 대신<br />
              <a href="mailto:rlawogud970301@gmail.com" className="text-primary hover:underline font-medium">
                rlawogud970301@gmail.com
              </a>
              으로 연락 바랍니다.
            </p>
          </div>
        </aside>

        {/* Main Form */}
        <main className="lg:col-span-8 order-1 lg:order-2">
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                <Link to="/" className="hover:text-primary transition-colors">홈</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-primary font-medium">버그 리포트</span>
              </div>
              <h2 className="text-2xl font-bold">버그 리포트 제출</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                블로그 이용 중 발견하신 기술적인 문제나 버그를 알려주세요.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Title */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="title">
                    Issue Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="문제의 핵심 내용을 입력해 주세요"
                    className="block w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm transition-all px-4 py-2.5"
                    required
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="category">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
                    className="block w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm transition-all px-4 py-2.5"
                    required
                  >
                    <option value="">카테고리 선택</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="priority">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                    className="block w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm transition-all px-4 py-2.5"
                  >
                    {priorityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={`1. 어떤 작업을 수행하려 했나요?
2. 어떤 결과가 나타났나요?
3. 기대했던 결과는 무엇인가요?
4. 에러 로그가 있다면 함께 작성해 주세요.`}
                  className="block w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm min-h-[200px] transition-all px-4 py-2.5 resize-y"
                  required
                />
              </div>

              {/* Email (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="email">
                  Email <span className="text-slate-400 font-normal">(선택, 답변 받기 원하시면 입력)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@email.com"
                  className="block w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm transition-all px-4 py-2.5"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                      제출 중...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">send</span>
                      리포트 제출하기
                    </>
                  )}
                </button>
                <Link
                  to="/"
                  className="flex-1 sm:flex-none px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-center"
                >
                  취소
                </Link>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
