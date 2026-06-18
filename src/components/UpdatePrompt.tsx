import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-slate-900 dark:bg-slate-700 text-white rounded-2xl shadow-2xl flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
          <RefreshCw size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Nueva versión disponible</p>
          <p className="text-xs text-slate-400 leading-tight mt-0.5">Pulsa para actualizar la app</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Actualizar
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="shrink-0 p-1 text-slate-400 hover:text-white rounded transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
