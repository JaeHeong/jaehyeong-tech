import { useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
          }) => void
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              logo_alignment?: 'left' | 'center'
              width?: number
              locale?: string
            }
          ) => void
          prompt: () => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function AdminLoginPage() {
  const { googleLogin, error, clearError, isAuthenticated, isAdmin, isLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect if already logged in as admin
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate('/admin', { replace: true })
    }
  }, [isAuthenticated, isAdmin, navigate])

  const handleGoogleCallback = useCallback(
    async (response: { credential: string }) => {
      clearError()
      try {
        await googleLogin(response.credential)
        navigate('/admin', { replace: true })
      } catch {
        // Error is handled in the context
      }
    },
    [googleLogin, navigate, clearError]
  )

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    script.onload = () => {
      if (window.google && GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        })

        const buttonDiv = document.getElementById('google-signin-button')
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320,
          })
        }
      }
    }

    return () => {
      document.head.removeChild(script)
    }
  }, [handleGoogleCallback])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
          <p className="text-slate-500 dark:text-slate-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[28px]">terminal</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">
              jaehyeong<span className="text-primary"> tech</span>
            </span>
          </Link>
        </div>

        {/* Login Card */}
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">관리자 로그인</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Google 계정으로 로그인하세요
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <span className="material-symbols-outlined text-[20px]">error</span>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {!GOOGLE_CLIENT_ID ? (
            <div className="mb-6 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <span className="text-sm font-medium">
                  Google OAuth가 설정되지 않았습니다. 환경 변수를 확인하세요.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              {/* Google Sign-In Button */}
              <div id="google-signin-button" className="flex justify-center"></div>

              <div className="flex items-center gap-4 w-full">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
                <span className="text-sm text-slate-500 dark:text-slate-400">또는</span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
              </div>

              {/* Info */}
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[16px] align-middle mr-1">
                    info
                  </span>
                  관리자 권한은 등록된 이메일에만 부여됩니다.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">
                arrow_back
              </span>
              블로그로 돌아가기
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 dark:text-slate-400 text-xs mt-6">
          &copy; {new Date().getFullYear()} jaehyeong tech. All rights reserved.
        </p>
      </div>
    </div>
  )
}
