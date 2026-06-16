import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'

export interface AppNotification {
  id: string
  title: string
  body: string
  timestamp: Date
  read: boolean
}

interface NotificationsContextType {
  notifications: AppNotification[]
  unreadCount: number
  permission: NotificationPermission | 'unsupported'
  requestPermission: () => Promise<void>
  markAllRead: () => void
  clearAll: () => void
}

const NotificationsContext = createContext<NotificationsContextType>(null!)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { worker } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const unreadCount = notifications.filter(n => !n.read).length

  async function requestPermission() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function clearAll() {
    setNotifications([])
  }

  useEffect(() => {
    if (!worker?.id) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`task-notifs-worker-${worker.id}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `responsible_id=eq.${worker.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const title = '📋 Nueva tarea asignada'
          const body = String(payload.new.title ?? 'Tienes una nueva tarea')
          setNotifications(prev => [
            { id: `${Date.now()}-${Math.random()}`, title, body, timestamp: new Date(), read: false },
            ...prev,
          ].slice(0, 30))
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new window.Notification(title, { body, icon: '/icons/icon-192.png', tag: String(payload.new.id) })
            } catch { /* safari restriction */ }
          }
        }
      )
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
        },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const wasAssigned =
            payload.old.responsible_id !== worker.id &&
            payload.new.responsible_id === worker.id
          if (!wasAssigned) return
          const title = '📋 Tarea asignada a ti'
          const body = String(payload.new.title ?? 'Tienes una nueva tarea asignada')
          setNotifications(prev => [
            { id: `${Date.now()}-${Math.random()}`, title, body, timestamp: new Date(), read: false },
            ...prev,
          ].slice(0, 30))
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new window.Notification(title, { body, icon: '/icons/icon-192.png' })
            } catch { /* safari restriction */ }
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [worker?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, permission, requestPermission, markAllRead, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
