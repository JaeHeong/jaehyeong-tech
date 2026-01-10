import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'notice_modal_dismissed_at'
const HOURS_24 = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export default function NoticeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [dontShowFor24Hours, setDontShowFor24Hours] = useState(false)

  useEffect(() => {
    const dismissedAt = localStorage.getItem(STORAGE_KEY)
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10)
      const now = Date.now()
      // If 24 hours haven't passed, don't show
      if (now - dismissedTime < HOURS_24) {
        return
      }
    }
    // Show modal after a short delay for better UX
    const timer = setTimeout(() => setIsOpen(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = useCallback(() => {
    if (dontShowFor24Hours) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
    }
    setIsOpen(false)
  }, [dontShowFor24Hours])

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-[calc(100vw-24px)] sm:max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="p-4 sm:p-6">
          {/* Icon */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#3182f6]/10 flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <span className="material-symbols-outlined text-[20px] sm:text-[24px] text-[#3182f6]">
              info
            </span>
          </div>

          {/* Title */}
          <h3 className="text-base sm:text-lg font-bold text-center text-slate-900 dark:text-white mb-2 sm:mb-3">
            안내
          </h3>

          {/* Message */}
          <div className="text-center text-slate-600 dark:text-slate-400 text-xs sm:text-sm space-y-1.5 sm:space-y-2">
            <p>
              사이트 이용 중 버그나 문제가 발생하면
            </p>
            <p>
              페이지 하단의{' '}
              <Link
                to="/bug-report"
                onClick={handleClose}
                className="text-primary font-medium hover:underline"
              >
                버그 리포트
              </Link>
              {' '}기능을 이용해주세요.
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 mt-2 sm:mt-3">
              여러분의 피드백이 서비스 개선에 큰 도움이 됩니다.
            </p>
          </div>
        </div>

        {/* Checkbox & Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
          {/* 24시간 안보기 체크박스 */}
          <label className="flex items-center gap-2 mb-2.5 sm:mb-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowFor24Hours}
              onChange={(e) => setDontShowFor24Hours(e.target.checked)}
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary focus:ring-offset-0"
            />
            <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              24시간 동안 보지 않기
            </span>
          </label>

          {/* 닫기 버튼 */}
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 sm:py-2.5 rounded-lg bg-[#3182f6] hover:bg-[#2563eb] text-white text-sm sm:text-base font-medium transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
