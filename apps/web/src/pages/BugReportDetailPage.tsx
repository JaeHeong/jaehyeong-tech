import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api, BugReportDetail, AdminBugReport } from '../services/api'
import { useSEO } from '../hooks/useSEO'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useModal } from '../contexts/ModalContext'

export default function BugReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useModal()
  const [bugReport, setBugReport] = useState<BugReportDetail | AdminBugReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Admin edit states
  const [isEditing, setIsEditing] = useState(false)
  const [editStatus, setEditStatus] = useState<string>('')
  const [editPriority, setEditPriority] = useState<string>('')
  const [editAdminResponse, setEditAdminResponse] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const fetchBugReport = async () => {
      if (!id) return
      setIsLoading(true)
      try {
        // Admin gets full details, regular users get public version
        if (isAdmin) {
          const response = await api.getAdminBugReport(id)
          setBugReport(response.data)
          setEditStatus(response.data.status)
          setEditPriority(response.data.priority)
          setEditAdminResponse(response.data.adminResponse || '')
        } else {
          const response = await api.getPublicBugReport(id)
          setBugReport(response.data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '버그 리포트를 불러오는데 실패했습니다.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchBugReport()
  }, [id, isAdmin])

  useSEO({
    title: bugReport ? `${bugReport.title} - 버그 리포트` : '버그 리포트',
    description: bugReport?.description?.slice(0, 150) || '버그 리포트 상세 내용을 확인하세요.',
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">OPEN</span>
      case 'IN_PROGRESS':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">IN PROGRESS</span>
      case 'RESOLVED':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">RESOLVED</span>
      case 'CLOSED':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">CLOSED</span>
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

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">높음</span>
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">보통</span>
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">낮음</span>
      default:
        return null
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSave = async () => {
    if (!id) return
    setIsSaving(true)
    try {
      const response = await api.updateBugReport(id, {
        status: editStatus as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
        priority: editPriority as 'LOW' | 'MEDIUM' | 'HIGH',
        adminResponse: editAdminResponse,
      })
      setBugReport(response.data)
      setIsEditing(false)
      showToast({ message: '버그 리포트가 업데이트되었습니다.', type: 'success' })
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : '업데이트에 실패했습니다.', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return

    const confirmed = await confirm({
      title: '버그 리포트 삭제',
      message: '정말로 이 버그 리포트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    })

    if (!confirmed) return

    setIsDeleting(true)
    try {
      await api.deleteBugReport(id)
      showToast({ message: '버그 리포트가 삭제되었습니다.', type: 'success' })
      navigate('/bug-reports')
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : '삭제에 실패했습니다.', type: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-16">
          <span className="material-symbols-outlined text-[32px] animate-spin text-primary">progress_activity</span>
        </div>
      </div>
    )
  }

  if (error || !bugReport) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-400 mb-4">error</span>
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error || '버그 리포트를 찾을 수 없습니다.'}</p>
          <Link
            to="/bug-reports"
            className="text-primary hover:underline"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const adminReport = bugReport as AdminBugReport

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-3 sm:mb-4">
            <Link to="/" className="hover:text-primary transition-colors">홈</Link>
            <span className="material-symbols-outlined text-[12px] sm:text-[14px]">chevron_right</span>
            <Link to="/bug-reports" className="hover:text-primary transition-colors">버그 리포트</Link>
            <span className="material-symbols-outlined text-[12px] sm:text-[14px]">chevron_right</span>
            <span className="text-primary font-medium">상세</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            {getStatusBadge(bugReport.status)}
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {getCategoryLabel(bugReport.category)}
            </span>
            {getPriorityBadge(bugReport.priority)}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2">{bugReport.title}</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {formatDate(bugReport.createdAt)}
          </p>
        </div>

        {/* Admin Info Section */}
        {isAdmin && adminReport.email && (
          <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-blue-600 dark:text-blue-400">admin_panel_settings</span>
              <span className="font-medium text-blue-800 dark:text-blue-300">관리자 정보</span>
            </div>
            <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-blue-700 dark:text-blue-400">
              <span className="font-medium">제출자 이메일:</span> {adminReport.email}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6">
          <h2 className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 sm:mb-3">
            설명
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
              {bugReport.description}
            </p>
          </div>
        </div>

        {/* Admin Response Section (visible to all if exists) */}
        {bugReport.adminResponse && !isEditing && (
          <div className="p-4 sm:p-6 bg-green-50 dark:bg-green-900/20 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px] text-green-600 dark:text-green-400">verified</span>
              <h3 className="text-sm sm:text-base font-semibold text-green-800 dark:text-green-300">관리자 답변</h3>
              {bugReport.respondedAt && (
                <span className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 ml-auto">
                  {formatDate(bugReport.respondedAt)}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm sm:text-base text-green-700 dark:text-green-300 leading-relaxed">
              {bugReport.adminResponse}
            </p>
          </div>
        )}

        {/* Admin Edit Section */}
        {isAdmin && isEditing && (
          <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">edit</span>
              버그 리포트 수정
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
              {/* Status */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  상태
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  우선순위
                </label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="LOW">낮음</option>
                  <option value="MEDIUM">보통</option>
                  <option value="HIGH">높음</option>
                </select>
              </div>
            </div>

            {/* Admin Response */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                관리자 답변
              </label>
              <textarea
                value={editAdminResponse}
                onChange={(e) => setEditAdminResponse(e.target.value)}
                rows={4}
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                placeholder="버그 리포트에 대한 답변을 작성하세요..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <Link
              to="/bug-reports"
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              목록으로
            </Link>
            <Link
              to="/bug-report"
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              새 리포트 작성
            </Link>

            {isAdmin && !isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors ml-auto"
                >
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">edit</span>
                    수정
                  </span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">delete</span>
                    {isDeleting ? '삭제 중...' : '삭제'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
