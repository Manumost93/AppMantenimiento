import { NavLink } from 'react-router-dom'
import { Calendar, LayoutDashboard, User, ClipboardCheck, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { path: '/calendar',  icon: Calendar,         label: 'Calendario' },
  { path: '/dashboard', icon: LayoutDashboard,   label: 'Dashboard'  },
  { path: '/my-area',   icon: User,              label: 'Mi Área'    },
  { path: '/rondas',    icon: ClipboardCheck,    label: 'Rondas'     },
]

export default function BottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 lg:hidden bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex items-stretch shadow-lg safe-bottom">
      {items.map(item => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors min-h-[52px]',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-slate-400'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
      <button
        onClick={onMenuClick}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-gray-500 dark:text-slate-400 min-h-[52px] transition-colors active:text-blue-600"
      >
        <Menu size={20} strokeWidth={1.8} />
        <span>Menú</span>
      </button>
    </nav>
  )
}
