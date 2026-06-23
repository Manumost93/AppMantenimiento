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

    function pushNotif(title: string, body: string, tag?: string) {
      setNotifications(prev => [
        { id: `${Date.now()}-${Math.random()}`, title, body, timestamp: new Date(), read: false },
        ...prev,
      ].slice(0, 30))
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new window.Notification(title, { body, icon: '/icons/icon-192.png', tag }) }
        catch { /* safari restriction */ }
      }
    }

    // Client-side filtering is more reliable than Supabase server-side filter:
    // Server-side filter requires REPLICA IDENTITY FULL on each table.
    const wid = worker.id
    const isMe = (id: unknown) => Number(id) === wid

    const channel = supabase
      .channel(`notifs-worker-${wid}`)
      // ── Tareas (INSERT) ───────────────────────────────────────────────────
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'tasks' },
        (payload: { new: Record<string, unknown> }) => {
          if (!isMe(payload.new.responsible_id)) return
          pushNotif('📋 Nueva tarea asignada', String(payload.new.title ?? 'Tienes una nueva tarea'), String(payload.new.id))
        }
      )
      // ── Tareas (UPDATE — reasignación) ────────────────────────────────────
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          if (!isMe(payload.new.responsible_id) || isMe(payload.old.responsible_id)) return
          pushNotif('📋 Tarea asignada a ti', String(payload.new.title ?? 'Tienes una nueva tarea asignada'))
        }
      )
      // ── Reparaciones (INSERT) ─────────────────────────────────────────────
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'general_repairs' },
        (payload: { new: Record<string, unknown> }) => {
          if (!isMe(payload.new.responsible_id)) return
          pushNotif('🔧 Nueva reparación asignada', String(payload.new.description ?? 'Se te ha asignado una reparación'), String(payload.new.id))
        }
      )
      // ── Reparaciones (UPDATE — reasignación) ──────────────────────────────
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'general_repairs' },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          if (!isMe(payload.new.responsible_id) || isMe(payload.old.responsible_id)) return
          pushNotif('🔧 Reparación asignada a ti', String(payload.new.description ?? 'Se te ha asignado una reparación'))
        }
      )
      // ── KONE (INSERT) ─────────────────────────────────────────────────────
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'kone_incidents' },
        (payload: { new: Record<string, unknown> }) => {
          if (!isMe(payload.new.internal_responsible_id)) return
          pushNotif('🏗️ Incidencia KONE asignada', `${payload.new.elevator ?? ''} — ${payload.new.description ?? ''}`.trim())
        }
      )
      // ── KONE (UPDATE — reasignación) ──────────────────────────────────────
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'kone_incidents' },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          if (!isMe(payload.new.internal_responsible_id) || isMe(payload.old.internal_responsible_id)) return
          pushNotif('🏗️ Incidencia KONE asignada a ti', `${payload.new.elevator ?? ''} — ${payload.new.description ?? ''}`.trim())
        }
      )
      // ── Seguridad (INSERT) ────────────────────────────────────────────────
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'security_incidents' },
        (payload: { new: Record<string, unknown> }) => {
          if (!isMe(payload.new.internal_responsible_id)) return
          pushNotif('🛡️ Incidencia de Seguridad asignada', String(payload.new.description ?? 'Nueva incidencia de seguridad'))
        }
      )
      // ── COMIN/ION (INSERT) ────────────────────────────────────────────────
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'comin_ion_jobs' },
        (payload: { new: Record<string, unknown> }) => {
          if (!isMe(payload.new.internal_responsible_id)) return
          pushNotif('🎨 Trabajo COMIN asignado', String(payload.new.work_requested ?? 'Nuevo trabajo COMIN/ION'))
        }
      )
      // ── FOOD (INSERT) ─────────────────────────────────────────────────────
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'food_incidents' },
        (payload: { new: Record<string, unknown> }) => {
          if (!isMe(payload.new.internal_responsible_id)) return
          pushNotif('🍽️ Incidencia FOOD asignada', String(payload.new.affected_element ?? 'Nueva incidencia en restaurante'))
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
