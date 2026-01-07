import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'danger' | 'info'
}

interface ModalContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ModalContext = createContext<ModalContextType | null>(null)

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

interface ModalState extends ConfirmOptions {
  isOpen: boolean
  resolve: ((value: boolean) => void) | null
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    message: '',
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        ...options,
        resolve,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    modalState.resolve?.(true)
    setModalState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [modalState.resolve])

  const handleCancel = useCallback(() => {
    modalState.resolve?.(false)
    setModalState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [modalState.resolve])

  const getTypeStyles = () => {
    switch (modalState.type) {
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

  const styles = getTypeStyles()

  return (
    <ModalContext.Provider value={{ confirm }}>
      {children}

      {/* Confirm Modal */}
      {modalState.isOpen && (
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
              <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mx-auto mb-4`}>
                <span className={`material-symbols-outlined text-[24px] ${styles.iconColor}`}>
                  {styles.icon}
                </span>
              </div>

              {/* Title */}
              {modalState.title && (
                <h3 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">
                  {modalState.title}
                </h3>
              )}

              {/* Message */}
              <p className="text-center text-slate-600 dark:text-slate-400 whitespace-pre-line">
                {modalState.message}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 font-medium transition-colors"
              >
                {modalState.cancelText || '취소'}
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 px-4 py-2.5 rounded-lg ${styles.confirmBg} text-white font-medium transition-colors`}
              >
                {modalState.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}
