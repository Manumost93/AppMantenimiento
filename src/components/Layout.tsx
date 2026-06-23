import { type ReactNode, useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import { processSyncQueue, getPendingSyncCount } from '@/lib/db'
import { useLocation } from 'react-router-dom'

export default function Layout({ children }: { children: ReactNode }) {
  const [pendingSync, setPendingSync] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      processSyncQueue().then(() => getPendingSyncCount().then(setPendingSync))
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    getPendingSyncCount().then(setPendingSync)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-900 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed lg:static inset-y-0 left-0 z-30
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header
          isOnline={isOnline}
          pendingSync={pendingSync}
          onMenuClick={() => setSidebarOpen(true)}
        />
        {!isOnline && (
          <div className="bg-amber-500 dark:bg-amber-600 text-white text-xs font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 shrink-0">
            <span>⚠️</span>
            Sin conexión — los cambios se guardarán cuando vuelva el internet
          </div>
        )}
        <main className="flex-1 overflow-y-scroll pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      <BottomNav onMenuClick={() => setSidebarOpen(true)} />
    </div>
  )
}
