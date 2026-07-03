import { useState } from 'react'
import { History, Info, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { getAuditLogs } from '@/lib/supabase'
import { PageLoading } from '@/components/Skeleton'
import type { AuditSeverity } from '@/types'

const SEVERITY_META: Record<AuditSeverity, { label: string; className: string }> = {
  info: { label: 'Info', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  warning: { label: 'Aviso', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  critical: { label: 'Crítico', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const TABS: { key: 'all' | AuditSeverity; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'info', label: 'Info' },
  { key: 'warning', label: 'Avisos' },
  { key: 'critical', label: 'Críticos' },
]

export default function AuditLogPage() {
  const { data: logs, loading } = useRealtimeTable('audit_logs', getAuditLogs)
  const [activeTab, setActiveTab] = useState<'all' | AuditSeverity>('all')

  const filtered = activeTab === 'all' ? logs : logs.filter(l => l.severity === activeTab)

  if (loading) return <PageLoading rows={8} />

  return (
    <div className="p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <History size={18} className="text-blue-600 dark:text-blue-400" />
          Audit Log
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Trazabilidad de acciones importantes — visible solo para administradores
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map(tab => {
          const count = tab.key === 'all' ? logs.length : logs.filter(l => l.severity === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                activeTab === tab.key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
              )}
            >
              {tab.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Fecha</th>
                <th className="px-4 py-2.5 font-semibold">Usuario</th>
                <th className="px-4 py-2.5 font-semibold">Acción</th>
                <th className="px-4 py-2.5 font-semibold">Módulo</th>
                <th className="px-4 py-2.5 font-semibold">Descripción</th>
                <th className="px-4 py-2.5 font-semibold">Severidad</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-t border-gray-100 dark:border-slate-700">
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">{log.user_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{log.module}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 max-w-md truncate">{log.description}</td>
                  <td className="px-4 py-3">
                    <Badge className={SEVERITY_META[log.severity].className}>
                      <span className="inline-flex items-center gap-1">
                        {log.severity === 'info' && <Info size={11} />}
                        {log.severity === 'warning' && <AlertTriangle size={11} />}
                        {log.severity === 'critical' && <ShieldAlert size={11} />}
                        {SEVERITY_META[log.severity].label}
                      </span>
                    </Badge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 dark:text-slate-500">
                    <CheckCircle2 size={22} className="mx-auto mb-2 opacity-40" />
                    {logs.length === 0 ? 'Todavía no hay eventos registrados' : 'Sin eventos en esta categoría'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
