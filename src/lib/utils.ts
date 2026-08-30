import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { TaskPriority, TaskStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  inprogress: 'En curso',
  blocked: 'Bloqueado',
  done: 'Finalizado',
  cancelled: 'Cancelado'
}

export const STATUS_CLASSES: Record<TaskStatus, string> = {
  pending: 'status-pending',
  inprogress: 'status-inprogress',
  blocked: 'status-blocked',
  done: 'status-done',
  cancelled: 'status-cancelled'
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#6B7280',
  inprogress: '#3B82F6',
  blocked: '#F59E0B',
  done: '#10B981',
  cancelled: '#EF4444'
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente'
}

export const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  low: 'priority-low',
  medium: 'priority-medium',
  high: 'priority-high',
  urgent: 'priority-urgent'
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#F97316',
  urgent: '#DC2626'
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function isOverdue(dateStr: string, status: TaskStatus): boolean {
  if (status === 'done' || status === 'cancelled') return false
  return dateStr < todayIso()
}

// Supabase Storage rechaza claves con espacios, acentos o símbolos ("Invalid
// key") — esto deja el nombre en algo seguro para usarlo como ruta de subida.
export function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  const clean = base
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return (clean || 'archivo') + ext.toLowerCase()
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}
