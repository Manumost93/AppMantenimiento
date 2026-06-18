import { NavLink, useLocation } from 'react-router-dom'
import {
  Calendar, LayoutDashboard, User, Users, Truck, FolderOpen,
  Building2, Paintbrush2, UtensilsCrossed, Wrench,
  BarChart2, Settings, ChevronRight, Shield, ClipboardCheck, ShieldAlert, BookOpen, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const navItems = [
  { path: '/calendar',  icon: Calendar,          label: 'Calendario',         section: 'main',   adminOnly: false },
  { path: '/dashboard', icon: LayoutDashboard,    label: 'Dashboard',          section: 'main',   adminOnly: false },
  { path: '/my-area',   icon: User,               label: 'Mi Área Personal',   section: 'main',   adminOnly: false },
  { path: '/repairs',   icon: Wrench,             label: 'Reparaciones',       section: 'work',   adminOnly: false },
  { path: '/rondas',    icon: ClipboardCheck,     label: 'Rondas Apertura/Cierre', section: 'work', adminOnly: false },
  { path: '/security',  icon: ShieldAlert,        label: 'Seguridad',          section: 'areas',  adminOnly: false },
  { path: '/kone',      icon: Building2,          label: 'KONE / Ascensores',  section: 'areas',  adminOnly: false },
  { path: '/comin-ion', icon: Paintbrush2,        label: 'COMIN / ION',        section: 'areas',  adminOnly: false },
  { path: '/food',      icon: UtensilsCrossed,    label: 'FOOD / Restaurante', section: 'areas',  adminOnly: false },
  { path: '/meetings',  icon: BookOpen,           label: 'Reuniones',          section: 'work',   adminOnly: false },
  { path: '/waste',     icon: Trash2,             label: 'Residuos',           section: 'work',   adminOnly: false },
  { path: '/team',      icon: Users,              label: 'Equipo',             section: 'manage', adminOnly: false },
  { path: '/providers', icon: Truck,              label: 'Proveedores/Contactos', section: 'manage', adminOnly: false },
  { path: '/documents', icon: FolderOpen,         label: 'Documentos',         section: 'manage', adminOnly: false },
  { path: '/reports',   icon: BarChart2,          label: 'Informes',           section: 'manage', adminOnly: true  },
  { path: '/settings',  icon: Settings,           label: 'Configuración',      section: 'config', adminOnly: true  },
]

const sections = [
  { key: 'main',   label: 'PRINCIPAL' },
  { key: 'work',   label: 'TRABAJO' },
  { key: 'areas',  label: 'ÁREAS' },
  { key: 'manage', label: 'GESTIÓN' },
  { key: 'config', label: 'SISTEMA' },
]

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation()
  const { isAdmin } = useAuth()

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <aside className="flex flex-col bg-slate-900 text-white shrink-0" style={{ width: 'var(--sidebar-width)', minHeight: '100vh' }}>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
            IK
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight text-white">IKEA</div>
            <div className="text-xs text-slate-400 leading-tight">Mantenimiento</div>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {sections.map(section => {
          const items = visibleItems.filter(i => i.section === section.key)
          if (items.length === 0) return null
          return (
            <div key={section.key} className="mb-3">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
                {section.label}
              </div>
              {items.map(item => {
                const Icon = item.icon
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path))
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all duration-150 my-0.5 group',
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <Icon size={16} className={cn('shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-white')} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.adminOnly && (
                      <Shield size={10} className={cn('shrink-0', isActive ? 'text-blue-200' : 'text-slate-600')} />
                    )}
                    {isActive && <ChevronRight size={12} className="text-blue-300 shrink-0" />}
                  </NavLink>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-700">
        {isAdmin && (
          <div className="flex items-center gap-1 mb-2 px-1">
            <Shield size={10} className="text-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium">Administrador</span>
          </div>
        )}
        <div className="text-[10px] text-slate-500 leading-relaxed">
          <div className="text-slate-400 font-medium text-[11px]">IKEA Mantenimiento</div>
          <div>Desarrollado por</div>
          <div className="text-slate-300 font-medium">Manuel Honrado Vega</div>
          <div className="text-slate-600 mt-0.5">v2.0.0 · 2025</div>
        </div>
      </div>
    </aside>
  )
}
