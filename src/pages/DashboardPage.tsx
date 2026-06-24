import { useState, useEffect, useRef } from 'react'
import { ClipboardList, AlertCircle, Clock, CheckCircle2, Euro, Calendar, Users, BarChart2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getDashboardStats, getWorkerTaskStats, getMonthlyWorkerReport, supabase } from '@/lib/supabase'
import { SkeletonKpis, SkeletonCard } from '@/components/Skeleton'
import type { DashboardStats, WorkerTaskStats, TeamMember } from '@/types'
import { cn, STATUS_CLASSES, STATUS_LABELS, PRIORITY_CLASSES, PRIORITY_LABELS, formatCurrency, todayIso, getInitials } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import WorkloadChart from '@/components/WorkloadChart'

interface MonthlyTask { responsible_id: number; status: string; date: string }

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [workerStats, setWorkerStats] = useState<WorkerTaskStats[]>([])
  const [monthlyTasks, setMonthlyTasks] = useState<MonthlyTask[]>([])
  const [monthlyWorkers, setMonthlyWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const today = todayIso()
  const todayRef = useRef(today)
  todayRef.current = today

  function loadAll() {
    return Promise.all([
      getDashboardStats(todayRef.current),
      getWorkerTaskStats(),
      getMonthlyWorkerReport(6),
    ]).then(([s, ws, monthly]) => {
      setStats(s)
      setWorkerStats(ws)
      setMonthlyTasks(monthly.tasks)
      setMonthlyWorkers(monthly.workers)
    })
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false))

    const channel = supabase
      .channel('rt-dashboard')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'tasks' }, () => { loadAll() })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'general_repairs' }, () => { loadAll() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kpis = stats ? [
    { label: 'Pendientes hoy', value: stats.pending, icon: <Clock size={18} />, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-slate-700', border: 'border-gray-200 dark:border-slate-600' },
    { label: 'En curso hoy', value: stats.inprogress, icon: <ClipboardList size={18} />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' },
    { label: 'Urgentes', value: stats.urgent, icon: <AlertCircle size={18} />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800' },
    { label: 'Finalizadas hoy', value: stats.done_today, icon: <CheckCircle2 size={18} />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800' },
    { label: 'Coste del mes', value: formatCurrency(stats.cost_month), icon: <Euro size={18} />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800' },
  ] : []

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Vista general del día</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {new Date(today).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/calendar')}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Calendar size={14} />
          Ver calendario
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonKpis count={5} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        </div>
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
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{kpi.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Carga de trabajo por persona */}
          {workerStats.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Users size={15} />
                Carga de trabajo del equipo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {workerStats.map(({ worker, pending, inprogress, blocked, done, total }) => (
                  <Card key={worker.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: worker.color }}
                        >
                          {getInitials(worker.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{worker.name}</p>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{worker.role}</p>
                        </div>
                        <span className={cn(
                          'ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
                          total >= 5 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          : total >= 3 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        )}>
                          {total} activas
                        </span>
                      </div>
                      {/* Barra de progreso */}
                      {(total + done) > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-500 mb-1">
                            <span>Progreso</span>
                            <span>{done} / {total + done} completadas</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${Math.round((done / (total + done)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Contadores de estado */}
                      <div className="grid grid-cols-4 gap-1 mt-2">
                        {[
                          { label: 'Pend.', value: pending, color: 'text-gray-500 dark:text-slate-400' },
                          { label: 'Curso', value: inprogress, color: 'text-blue-500 dark:text-blue-400' },
                          { label: 'Bloq.', value: blocked, color: 'text-amber-500 dark:text-amber-400' },
                          { label: 'Fin.', value: done, color: 'text-emerald-500 dark:text-emerald-400' },
                        ].map(s => (
                          <div key={s.label} className="text-center">
                            <div className={cn('text-sm font-bold', s.color)}>{s.value}</div>
                            <div className="text-[9px] text-gray-400 dark:text-slate-500">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Tareas de hoy */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">
              Tareas de hoy ({stats?.tasks_today.length || 0})
            </h3>
            {stats?.tasks_today.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center text-gray-400 dark:text-slate-500">
                <Calendar size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay tareas programadas para hoy.</p>
                <button onClick={() => navigate('/calendar')} className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  Ir al calendario para crear tareas
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                    <tr>
                      {['Hora', 'Tarea', 'Responsable', 'Estado', 'Prioridad'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {stats?.tasks_today.map(task => (
                      <tr
                        key={task.id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                        onClick={() => navigate('/calendar')}
                      >
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          {task.start_time ? task.start_time.substring(0, 5) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-xs font-medium text-gray-800 dark:text-white">{task.title}</div>
                          {task.notes && <div className="text-[11px] text-gray-400 dark:text-slate-500 truncate max-w-[200px]">{task.notes}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          {task.responsible ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                style={{ backgroundColor: task.responsible.color }}>
                                {getInitials(task.responsible.name)}
                              </div>
                              <span className="text-xs text-gray-700 dark:text-slate-300">{task.responsible.name.split(' ')[0]}</span>
                            </div>
                          ) : <span className="text-xs text-gray-400 dark:text-slate-500">—</span>}
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

          {/* Gráfico de rendimiento mensual */}
          {monthlyWorkers.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                  Rendimiento del equipo
                </h3>
              </div>
              <WorkloadChart tasks={monthlyTasks} workers={monthlyWorkers} months={6} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
