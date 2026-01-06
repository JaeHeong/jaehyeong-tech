import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="container-wrapper py-16 flex flex-col items-center justify-center min-h-[60vh]">
      <span className="material-symbols-outlined text-[80px] text-slate-300 dark:text-slate-600 mb-6">
        search_off
      </span>
      <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">404</h1>
      <p className="text-xl text-slate-600 dark:text-slate-400 mb-8 text-center">
        페이지를 찾을 수 없습니다.
      </p>
      <Link to="/" className="btn-primary inline-flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px]">home</span>
        홈으로 돌아가기
      </Link>
    </div>
  )
}
