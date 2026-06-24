import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration: number
}

interface ToastCtx {
  success: (msg: string, duration?: number) => void
  error: (msg: string, duration?: number) => void
  warning: (msg: string, duration?: number) => void
  info: (msg: string, duration?: number) => void
}

const ToastContext = createContext<ToastCtx | null>(null)

const STYLES: Record<ToastType, { bg: string; border: string; icon: string; Icon: LucideIcon }> = {
  success: { bg: 'bg-emerald-50 dark:bg-emerald-900/40', border: 'border-emerald-200 dark:border-emerald-700', icon: 'text-emerald-600 dark:text-emerald-400', Icon: CheckCircle2 },
  error:   { bg: 'bg-red-50 dark:bg-red-900/40',     border: 'border-red-200 dark:border-red-700',     icon: 'text-red-600 dark:text-red-400',     Icon: AlertCircle },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/40', border: 'border-amber-200 dark:border-amber-700', icon: 'text-amber-600 dark:text-amber-400', Icon: AlertTriangle },
  info:    { bg: 'bg-blue-50 dark:bg-blue-900/40',   border: 'border-blue-200 dark:border-blue-700',   icon: 'text-blue-600 dark:text-blue-400',   Icon: Info },
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const { bg, border, icon, Icon } = STYLES[toast.type]

  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), toast.duration)
    return () => clearTimeout(t)
  }, [toast.id, toast.duration, onRemove])

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full',
        'animate-[slideInRight_0.25s_ease-out]',
        bg, border
      )}
      style={{ animation: 'slideInRight 0.25s ease-out' }}
    >
      <Icon size={16} className={cn('mt-0.5 shrink-0', icon)} />
      <p className="text-sm text-gray-800 dark:text-slate-100 flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const add = useCallback((type: ToastType, message: string, duration = type === 'error' ? 6000 : 4000) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }])
  }, [])

  const ctx: ToastCtx = {
    success: (msg, d) => add('success', msg, d),
    error:   (msg, d) => add('error', msg, d),
    warning: (msg, d) => add('warning', msg, d),
    info:    (msg, d) => add('info', msg, d),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Portal-like fixed container */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none sm:top-4 sm:right-4 top-safe-4 left-4 sm:left-auto">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onRemove={remove} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
