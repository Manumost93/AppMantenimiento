import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut, WifiOff, RefreshCw, Menu, Sun, Moon, Bell, BellOff, X, Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { getInitials } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/calendar':  'Calendario compartido',
  '/dashboard': 'Dashboard · Vista general',
  '/my-area':   'Mi área personal',
  '/repairs':   'Reparaciones generales',
  '/kone':      'KONE / Ascensores',
  '/comin-ion': 'COMIN / IOM / Decoración',
  '/cbre':      'CBRE',
  '/bms':       'BMS / IndoorClima',
  '/food':      'FOOD / Restaurante',
  '/security':  'Seguridad',
  '/meetings':  'Reuniones',
  '/waste':     'Residuos / Contenedores',
  '/team':      'Gestión de equipo',
  '/providers': 'Proveedores y contactos',
  '/documents': 'Documentos y archivos',
  '/reports':   'Informes y estadísticas',
  '/settings':  'Configuración',
  '/rondas':    'Rondas de apertura y cierre',
  '/soc-lite':  'SOC Lite · Análisis defensivo',
  '/audit-log': 'Audit Log · Trazabilidad',
}

const PAGE_ICONS: Record<string, string> = {
  '/calendar':  '📅',
  '/dashboard': '📋',
  '/my-area':   '👤',
  '/repairs':   '🔧',
  '/kone':      '🏗️',
  '/comin-ion': '🎨',
  '/food':      '🍽️',
  '/security':  '🛡️',
  '/meetings':  '📒',
  '/waste':     '🗑️',
  '/team':      '👥',
  '/providers': '📞',
  '/documents': '📁',
  '/reports':   '📊',
  '/settings':  '⚙️',
  '/rondas':    '📋',
  '/soc-lite':  '🛰️',
  '/audit-log': '🕵️',
}

function getTodayString() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface HeaderProps {
  isOnline: boolean
  pendingSync: number
  onMenuClick: () => void
}

export default function Header({ isOnline, pendingSync, onMenuClick }: HeaderProps) {
  const location = useLocation()
  const { worker, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { notifications, unreadCount, permission, requestPermission, markAllRead, clearAll } = useNotifications()
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const path = '/' + location.pathname.split('/')[1]
  const title = PAGE_TITLES[path] || 'IKEA Mantenimiento'
  const icon = PAGE_ICONS[path] || '📋'

  // Cierra el panel al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false)
      }
    }
    if (showNotifPanel) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifPanel])

  async function handleBellClick() {
    if (permission === 'default') {
      await requestPermission()
    }
    setShowNotifPanel(v => !v)
    if (!showNotifPanel) markAllRead()
  }

  return (
    <header
      className="flex items-center justify-between bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-3 shrink-0 shadow-sm"
      style={{ height: 'var(--header-height)' }}
    >
      {/* Título */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-md text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shrink-0"
        >
          <Menu size={20} />
        </button>
        <span className="text-lg shrink-0">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-800 dark:text-white leading-tight truncate">{title}</h1>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-tight capitalize hidden sm:block">{getTodayString()}</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Sin conexión */}
        {!isOnline && (
          <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md">
            <WifiOff size={12} className="text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400 text-xs font-medium hidden sm:block">Sin conexión</span>
          </div>
        )}
        {isOnline && pendingSync > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
            <RefreshCw size={12} className="text-blue-500 animate-spin" />
            <span className="text-blue-600 dark:text-blue-400 text-xs hidden sm:block">Sincronizando...</span>
          </div>
        )}

        {/* Toggle modo oscuro */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Campana de notificaciones */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={handleBellClick}
            title="Notificaciones"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors relative"
          >
            {permission === 'denied' ? <BellOff size={15} /> : <Bell size={15} />}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Panel de notificaciones */}
          {showNotifPanel && (
            <div className="absolute right-0 top-10 w-80 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <span className="text-sm font-semibold text-gray-800 dark:text-white">Notificaciones</span>
                <div className="flex gap-1">
                  {notifications.length > 0 && (
                    <button onClick={clearAll} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors" title="Borrar todo">
                      <X size={13} />
                    </button>
                  )}
                  <button onClick={() => setShowNotifPanel(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded transition-colors">
                    <Check size={13} />
                  </button>
                </div>
              </div>

              {permission === 'denied' && (
                <div className="px-4 py-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                  Las notificaciones están bloqueadas en tu navegador.
                </div>
              )}
              {permission === 'default' && (
                <div className="px-4 py-3 text-xs text-blue-600 dark:text-blue-400">
                  Permite las notificaciones para recibir alertas cuando te asignen tareas.
                </div>
              )}

              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 dark:text-slate-500 text-xs">
                    <Bell size={24} className="mx-auto mb-2 opacity-30" />
                    Sin notificaciones
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="px-4 py-3 border-b border-gray-50 dark:border-slate-700 last:border-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-white">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-gray-300 dark:text-slate-600 mt-1">
                        {n.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-200 dark:bg-slate-600 hidden lg:block" />

        {/* Usuario */}
        {worker && (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: worker.color }}
            >
              {getInitials(worker.name)}
            </div>
            <span className="text-xs text-gray-700 dark:text-slate-300 font-medium hidden sm:block max-w-[100px] truncate">
              {worker.name}
            </span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
