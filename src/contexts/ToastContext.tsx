import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ToastContextValue {
  toast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)

  const toast = useCallback((msg: string) => {
    setMessage(msg)
    setVisible(true)
    window.setTimeout(() => setVisible(false), 2400)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {visible && (
        <div
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[5000] toast-enter max-w-[90vw] pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div className="px-4 py-2.5 rounded-full bg-[#1e1e1e]/90 dark:bg-white/95 text-white dark:text-gray-900 text-sm font-medium shadow-lg backdrop-blur-sm">
            {message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
