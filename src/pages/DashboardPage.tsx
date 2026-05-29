import { useState, useEffect } from 'react'
import { ClipboardList, AlertCircle, Clock, CheckCircle2, Euro, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getDashboardStats } from '@/lib/supabase'
import type { DashboardStats } from '@/types'
import { cn, STATUS_CLASSES, STATUS_LABELS, PRIORITY_CLASSES, PRIORITY_LABELS, formatCurrency, todayIso, getInitials } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const today = todayIso()

  useEffect(() => {
    getDashboardStats(today)
      .then(setStats)
      .finally(() => setLoading(false))
  }, [today])

  const kpis = stats ? [
    { label: 'Pendientes hoy', value: stats.pending, icon: <Clock size={18} />, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
    { label: 'En curso hoy', value: stats.inprogress, icon: <ClipboardList size={18} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Urgentes', value: stats.urgent, icon: <AlertCircle size={18} />, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    { label: 'Finalizadas hoy', value: stats.done_today, icon: <CheckCircle2 size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Coste del mes', value: formatCurrency(stats.cost_month), icon: <Euro size={18} />, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  ] : []

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Vista general del día</h2>
          <p className="text-xs text-gray-500">{new Date(today).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button
          onClick={() => navigate('/calendar')}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Calendar size={14} />
          Ver calendario
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando datos...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.map(kpi => (
              <Card key={kpi.label} className={cn('border', kpi.border)}>
                <CardContent className="pt-4 pb-3">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', kpi.bg, kpi.color)}>
                    {kpi.icon}
                  </div>
                  <div className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tareas de hoy */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tareas de hoy ({stats?.tasks_today.length || 0})</h3>
            {stats?.tasks_today.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                <Calendar size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay tareas programadas para hoy.</p>
                <button onClick={() => navigate('/calendar')} className="mt-3 text-xs text-blue-600 hover:underline">
                  Ir al calendario para crear tareas
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Hora', 'Tarea', 'Responsable', 'Estado', 'Prioridad'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stats?.tasks_today.map(task => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                          {task.start_time ? task.start_time.substring(0, 5) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-xs font-medium text-gray-800">{task.title}</div>
                          {task.notes && <div className="text-[11px] text-gray-400 truncate max-w-[200px]">{task.notes}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          {task.responsible ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                style={{ backgroundColor: task.responsible.color }}>
                                {getInitials(task.responsible.name)}
                              </div>
                              <span className="text-xs text-gray-700">{task.responsible.name.split(' ')[0]}</span>
                            </div>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_CLASSES[task.status])}>
                            {STATUS_LABELS[task.status]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium', PRIORITY_CLASSES[task.priority])}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
