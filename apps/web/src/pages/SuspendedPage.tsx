import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function SuspendedPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center justify-center size-8 rounded bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[24px]">terminal</span>
              </div>
              <Link to="/" className="text-xl font-bold tracking-tight">
                jaehyeong<span className="text-primary"> tech</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="max-w-md w-full">
          <div className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-8 text-center">
              {/* Icon */}
              <div className="inline-flex items-center justify-center size-20 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 mb-6">
                <span className="material-symbols-outlined text-[48px]">gpp_maybe</span>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">
                계정이 정지되었습니다
              </h1>

              {/* Description */}
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-8">
                회원님의 계정은 서비스 이용 약관 위반 또는 보안상의 사유로 인해
                이용이 일시적으로 제한되었습니다.
              </p>

              {/* Reason Box */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-8 text-left">
                <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-2">
                  정지 사유
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  관리자에 의해 계정 이용이 제한되었습니다.
                </p>
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                <a
                  href="mailto:admin@jaehyeong.tech"
                  className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                  이의 제기하기
                </a>
                <button
                  onClick={handleLogout}
                  className="block w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all text-sm"
                >
                  로그아웃
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-500">
                도움이 필요하신가요?{' '}
                <a href="mailto:admin@jaehyeong.tech" className="text-primary hover:underline">
                  관리자에게 문의하세요
                </a>
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
            DevOps & MLOps Tech Blog — jaehyeong tech
          </p>
        </div>
      </main>
    </div>
  )
}
