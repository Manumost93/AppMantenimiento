import { type ReactNode, useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { processSyncQueue, getPendingSyncCount } from '@/lib/db'
import { useLocation } from 'react-router-dom'

export default function Layout({ children }: { children: ReactNode }) {
  const [pendingSync, setPendingSync] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Cierra el sidebar al cambiar de página en móvil
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
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Overlay oscuro en móvil cuando el sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: fijo en desktop, slide-over en móvil */}
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
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
