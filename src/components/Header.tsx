import { useLocation } from 'react-router-dom'
import { LogOut, WifiOff, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/calendar':  'Calendario compartido',
  '/dashboard': 'Dashboard · Vista general',
  '/my-area':   'Mi área personal',
  '/repairs':   'Reparaciones generales',
  '/kone':      'KONE / Ascensores',
  '/comin-ion': 'COMIN / ION / Decoración',
  '/food':      'FOOD / Restaurante',
  '/team':      'Gestión de equipo',
  '/providers': 'Proveedores y empresas externas',
  '/documents': 'Documentos y adjuntos',
  '/reports':   'Informes y estadísticas',
  '/settings':  'Configuración',
}

const PAGE_ICONS: Record<string, string> = {
  '/calendar':  '📅',
  '/dashboard': '📋',
  '/my-area':   '👤',
  '/repairs':   '🔧',
  '/kone':      '🏢',
  '/comin-ion': '🎨',
  '/food':      '🍽️',
  '/team':      '👥',
  '/providers': '🚛',
  '/documents': '📁',
  '/reports':   '📊',
  '/settings':  '⚙️',
}

function getTodayString() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface HeaderProps {
  isOnline: boolean
  pendingSync: number
}

export default function Header({ isOnline, pendingSync }: HeaderProps) {
  const location = useLocation()
  const { worker, logout } = useAuth()
  const path = '/' + location.pathname.split('/')[1]
  const title = PAGE_TITLES[path] || 'IKEA Mantenimiento'
  const icon = PAGE_ICONS[path] || '📋'

  return (
    <header
      className="flex items-center justify-between bg-white border-b border-gray-200 px-4 shrink-0 shadow-sm"
      style={{ height: 'var(--header-height)' }}
    >
      {/* Título de página */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg shrink-0">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-800 leading-tight truncate">{title}</h1>
          <p className="text-[11px] text-gray-400 leading-tight capitalize hidden sm:block">{getTodayString()}</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Indicador offline */}
        {!isOnline && (
          <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-md">
            <WifiOff size={12} className="text-amber-500" />
            <span className="text-amber-600 text-xs font-medium hidden sm:block">Sin conexión</span>
          </div>
        )}
        {isOnline && pendingSync > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-md">
            <RefreshCw size={12} className="text-blue-500 animate-spin" />
            <span className="text-blue-600 text-xs hidden sm:block">Sincronizando...</span>
          </div>
        )}

        {/* Crédito */}
        <span className="text-[10px] text-gray-300 font-medium hidden lg:block">
          por Manuel Honrado Vega
        </span>
        <div className="h-4 w-px bg-gray-200 hidden lg:block" />

        {/* Usuario actual */}
        {worker && (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: worker.color }}
            >
              {getInitials(worker.name)}
            </div>
            <span className="text-xs text-gray-700 font-medium hidden sm:block max-w-[100px] truncate">
              {worker.name}
            </span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
