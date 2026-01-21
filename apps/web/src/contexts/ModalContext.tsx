import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'danger' | 'info'
}

interface AlertOptions {
  title?: string
  message: string
  buttonText?: string
  type?: 'success' | 'error' | 'info' | 'warning'
}

interface ModalContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (options: AlertOptions) => Promise<void>
}

const ModalContext = createContext<ModalContextType | null>(null)

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

interface ConfirmModalState extends ConfirmOptions {
  isOpen: boolean
  resolve: ((value: boolean) => void) | null
}

interface AlertModalState extends AlertOptions {
  isOpen: boolean
  resolve: (() => void) | null
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmModalState>({
    isOpen: false,
    message: '',
    resolve: null,
  })

  const [alertState, setAlertState] = useState<AlertModalState>({
    isOpen: false,
    message: '',
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        ...options,
        resolve,
      })
    })
  }, [])

  const alert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        ...options,
        resolve,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    confirmState.resolve?.(true)
    setConfirmState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [confirmState.resolve])

  const handleCancel = useCallback(() => {
    confirmState.resolve?.(false)
    setConfirmState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [confirmState.resolve])

  const handleAlertClose = useCallback(() => {
    alertState.resolve?.()
    setAlertState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [alertState.resolve])

  // ESC/Enter key handler for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmState.isOpen) {
          handleCancel()
        }
        if (alertState.isOpen) {
          handleAlertClose()
        }
      } else if (e.key === 'Enter') {
        if (confirmState.isOpen) {
          e.preventDefault()
          handleConfirm()
        }
        if (alertState.isOpen) {
          e.preventDefault()
          handleAlertClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [confirmState.isOpen, alertState.isOpen, handleCancel, handleAlertClose, handleConfirm])

  const getConfirmTypeStyles = () => {
    switch (confirmState.type) {
      case 'danger':
        return {
          icon: 'warning',
          iconBg: 'bg-red-100 dark:bg-red-900/30',
          iconColor: 'text-red-600 dark:text-red-400',
          confirmBg: 'bg-red-500 hover:bg-red-600',
        }
      case 'warning':
        return {
          icon: 'error',
          iconBg: 'bg-[#3182f6]/10',
          iconColor: 'text-[#3182f6]',
          confirmBg: 'bg-[#3182f6] hover:bg-[#2563eb]',
        }
      case 'info':
      default:
        return {
          icon: 'info',
          iconBg: 'bg-[#3182f6]/10',
          iconColor: 'text-[#3182f6]',
          confirmBg: 'bg-[#3182f6] hover:bg-[#2563eb]',
        }
    }
  }

  const getAlertTypeStyles = () => {
    switch (alertState.type) {
      case 'success':
        return {
          icon: 'check_circle',
          iconBg: 'bg-green-100 dark:bg-green-900/30',
          iconColor: 'text-green-600 dark:text-green-400',
          buttonBg: 'bg-green-500 hover:bg-green-600',
        }
      case 'error':
        return {
          icon: 'error',
          iconBg: 'bg-red-100 dark:bg-red-900/30',
          iconColor: 'text-red-600 dark:text-red-400',
          buttonBg: 'bg-red-500 hover:bg-red-600',
        }
      case 'warning':
        return {
          icon: 'warning',
          iconBg: 'bg-amber-100 dark:bg-amber-900/30',
          iconColor: 'text-amber-600 dark:text-amber-400',
          buttonBg: 'bg-amber-500 hover:bg-amber-600',
        }
      case 'info':
      default:
        return {
          icon: 'info',
          iconBg: 'bg-[#3182f6]/10',
          iconColor: 'text-[#3182f6]',
          buttonBg: 'bg-[#3182f6] hover:bg-[#2563eb]',
        }
    }
  }

  const confirmStyles = getConfirmTypeStyles()
  const alertStyles = getAlertTypeStyles()

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({ confirm, alert }),
    [confirm, alert]
  )

  return (
    <ModalContext.Provider value={value}>
      {children}

      {/* Confirm Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleCancel}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="p-6">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-full ${confirmStyles.iconBg} flex items-center justify-center mx-auto mb-4`}>
                <span className={`material-symbols-outlined text-[24px] ${confirmStyles.iconColor}`}>
                  {confirmStyles.icon}
                </span>
              </div>

              {/* Title */}
              {confirmState.title && (
                <h3 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">
                  {confirmState.title}
                </h3>
              )}

              {/* Message */}
              <p className="text-center text-slate-600 dark:text-slate-400 whitespace-pre-line">
                {confirmState.message}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 font-medium transition-colors"
              >
                {confirmState.cancelText || '취소'}
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 px-4 py-2.5 rounded-lg ${confirmStyles.confirmBg} text-white font-medium transition-colors`}
              >
                {confirmState.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleAlertClose}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="p-6">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-full ${alertStyles.iconBg} flex items-center justify-center mx-auto mb-4`}>
                <span className={`material-symbols-outlined text-[24px] ${alertStyles.iconColor}`}>
                  {alertStyles.icon}
                </span>
              </div>

              {/* Title */}
              {alertState.title && (
                <h3 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">
                  {alertState.title}
                </h3>
              )}

              {/* Message */}
              <p className="text-center text-slate-600 dark:text-slate-400 whitespace-pre-line">
                {alertState.message}
              </p>
            </div>

            {/* Action */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleAlertClose}
                className={`w-full px-4 py-2.5 rounded-lg ${alertStyles.buttonBg} text-white font-medium transition-colors`}
              >
                {alertState.buttonText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}
