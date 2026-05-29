import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getTasks, getRepairs, getKoneIncidents } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { Task, GeneralRepair, KoneIncident } from '@/types'

export default function ReportsPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [repairs, setRepairs] = useState<GeneralRepair[]>([])
  const [kone, setKone] = useState<KoneIncident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getTasks({ is_personal: false }), getRepairs(), getKoneIncidents()])
      .then(([t, r, k]) => { setTasks(t); setRepairs(r); setKone(k) })
      .finally(() => setLoading(false))
  }, [])

  const currentMonth = new Date().toISOString().substring(0, 7)
  const tasksMonth = tasks.filter(t => t.date.startsWith(currentMonth))

  const stats = {
    totalTasks: tasks.length,
    tasksDone: tasks.filter(t => t.status === 'done').length,
    tasksUrgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length,
    tasksBlocked: tasks.filter(t => t.status === 'blocked').length,
    tasksMonth: tasksMonth.length,
    tasksDoneMonth: tasksMonth.filter(t => t.status === 'done').length,
    costRepairs: repairs.reduce((s, r) => s + (r.total_cost || 0), 0),
    costKone: kone.reduce((s, k) => s + (k.total_cost || 0), 0),
    repairsDone: repairs.filter(r => r.status === 'done').length,
    repairsBlocked: repairs.filter(r => r.blocked_by_material).length,
  }

  const statusCounts = ['pending', 'inprogress', 'blocked', 'done', 'cancelled'].map(s => ({
    label: { pending: 'Pendiente', inprogress: 'En curso', blocked: 'Bloqueada', done: 'Finalizada', cancelled: 'Cancelada' }[s] || s,
    count: tasks.filter(t => t.status === s).length,
    color: { pending: 'bg-gray-400', inprogress: 'bg-blue-500', blocked: 'bg-amber-500', done: 'bg-emerald-500', cancelled: 'bg-red-400' }[s] || 'bg-gray-400',
  }))

  if (loading) return <div className="p-5 text-center text-gray-400">Generando informe...</div>

  return (
    <div className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">Informes y estadísticas</h2>
        <p className="text-xs text-gray-500">Datos globales de la aplicación</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tareas totales', value: stats.totalTasks, icon: <BarChart2 size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Finalizadas', value: stats.tasksDone, icon: <CheckCircle2 size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Urgentes activas', value: stats.tasksUrgent, icon: <AlertCircle size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Bloqueadas', value: stats.tasksBlocked, icon: <TrendingUp size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${kpi.bg} ${kpi.color}`}>{kpi.icon}</div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-gray-500">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tareas por estado</h3>
            <div className="space-y-2">
              {statusCounts.map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="w-20 text-xs text-gray-600">{s.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${s.color}`}
                      style={{ width: stats.totalTasks ? `${(s.count / stats.totalTasks) * 100}%` : '0%' }} />
                  </div>
                  <div className="w-6 text-right text-xs font-medium text-gray-600">{s.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Costes por módulo</h3>
            <div className="space-y-3">
              {[
                { label: 'Reparaciones generales', value: stats.costRepairs, color: 'text-orange-600' },
                { label: 'KONE / Ascensores', value: stats.costKone, color: 'text-blue-600' },
                { label: 'Total acumulado', value: stats.costRepairs + stats.costKone, color: 'text-purple-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{item.label}</span>
                  <span className={`text-sm font-bold ${item.color}`}>{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Este mes ({new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })})
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Tareas del mes', value: stats.tasksMonth, color: 'text-blue-600' },
                { label: 'Finalizadas', value: stats.tasksDoneMonth, color: 'text-emerald-600' },
                { label: 'Reparaciones', value: repairs.filter(r => r.request_date?.startsWith(currentMonth)).length, color: 'text-orange-600' },
                { label: 'Incidencias KONE', value: kone.filter(k => k.date?.startsWith(currentMonth)).length, color: 'text-blue-600' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-gray-500">{item.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Reparaciones</h3>
            <div className="space-y-2">
              {[
                { label: 'Total reparaciones', value: repairs.length },
                { label: 'Finalizadas', value: stats.repairsDone },
                { label: 'Bloqueadas por material', value: stats.repairsBlocked },
                { label: 'Coste total', value: formatCurrency(stats.costRepairs) },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-600">{item.label}</span>
                  <span className="text-xs font-medium text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
