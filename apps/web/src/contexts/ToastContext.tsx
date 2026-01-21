import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title?: string
  message: string
  duration?: number
}

interface ToastContextType {
  showToast: (options: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Track timeouts for cleanup to prevent memory leaks
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      timeoutsRef.current.clear()
    }
  }, [])

  const showToast = useCallback((options: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const duration = options.duration ?? 4000

    setToasts((prev) => [...prev, { ...options, id }])

    // Auto remove after duration with cleanup tracking
    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      timeoutsRef.current.delete(id)
    }, duration)
    timeoutsRef.current.set(id, timeout)
  }, [])

  const removeToast = useCallback((id: string) => {
    // Clear timeout when manually removed
    const timeout = timeoutsRef.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutsRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ showToast }), [showToast])

  const getToastStyles = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return {
          icon: 'check_circle',
          bg: 'bg-green-50 dark:bg-green-900/30',
          border: 'border-green-200 dark:border-green-800',
          iconColor: 'text-green-500',
          titleColor: 'text-green-800 dark:text-green-200',
        }
      case 'error':
        return {
          icon: 'error',
          bg: 'bg-red-50 dark:bg-red-900/30',
          border: 'border-red-200 dark:border-red-800',
          iconColor: 'text-red-500',
          titleColor: 'text-red-800 dark:text-red-200',
        }
      case 'warning':
        return {
          icon: 'warning',
          bg: 'bg-amber-50 dark:bg-amber-900/30',
          border: 'border-amber-200 dark:border-amber-800',
          iconColor: 'text-amber-500',
          titleColor: 'text-amber-800 dark:text-amber-200',
        }
      case 'info':
      default:
        return {
          icon: 'info',
          bg: 'bg-blue-50 dark:bg-blue-900/30',
          border: 'border-blue-200 dark:border-blue-800',
          iconColor: 'text-blue-500',
          titleColor: 'text-blue-800 dark:text-blue-200',
        }
    }
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.type)
          return (
            <div
              key={toast.id}
              className={`${styles.bg} ${styles.border} border rounded-xl shadow-lg p-4 animate-in slide-in-from-right-full fade-in duration-300`}
            >
              <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined ${styles.iconColor} text-[20px] mt-0.5`}>
                  {styles.icon}
                </span>
                <div className="flex-1 min-w-0">
                  {toast.title && (
                    <p className={`font-semibold text-sm ${styles.titleColor}`}>
                      {toast.title}
                    </p>
                  )}
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                    {toast.message}
                  </p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
