import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, Clock, CheckCircle2, AlertCircle, HardHat, Wrench, CalendarClock, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { getCbreJobs, upsertCbreJob, deleteCbreJob, getWorkers, patchCbreJobPhotos } from '@/lib/supabase'
import type { CbreJob, CbreJobType, TeamMember } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, PRIORITY_LABELS, PRIORITY_CLASSES, formatCurrency, formatDateShort, todayIso, getInitials } from '@/lib/utils'
import PhotoUpload from '@/components/PhotoUpload'

// ─── Countdown helpers ────────────────────────────────────────────────────────

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

function countdownBadge(days: number | null, status: string) {
  if (status === 'done' || status === 'cancelled') return null
  if (days === null) return null
  if (days < 0)  return { label: `Vencido hace ${Math.abs(days)}d`, cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse font-bold' }
  if (days === 0) return { label: 'Vence HOY', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-bold' }
  if (days <= 3)  return { label: `${days}d`, cls: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-bold' }
  if (days <= 7)  return { label: `${days}d`, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' }
  if (days <= 14) return { label: `${days}d`, cls: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' }
  return { label: `${days}d`, cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' }
}

const JOB_TYPE_LABELS: Record<CbreJobType, string> = {
  task: 'Tarea',
  repair: 'Reparación',
  pm: 'PM / Mantenimiento',
}

const JOB_TYPE_ICONS: Record<CbreJobType, JSX.Element> = {
  task: <CheckCircle2 size={13} />,
  repair: <Wrench size={13} />,
  pm: <CalendarClock size={13} />,
}

const JOB_TYPE_COLORS: Record<CbreJobType, string> = {
  task: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  repair: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  pm: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CBREPage() {
  const [jobs, setJobs] = useState<CbreJob[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<CbreJobType | ''>('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selected, setSelected] = useState<CbreJob | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<CbreJob>>({
    job_type: 'task', priority: 'medium', status: 'pending', estimated_cost: 0, real_cost: 0,
  })

  useEffect(() => {
    Promise.all([getCbreJobs(), getWorkers()])
      .then(([j, w]) => { setJobs(j); setWorkers(w.filter(w => w.active)) })
      .finally(() => setLoading(false))
  }, [])

  // Alarmas visuales: jobs con due_date ≤ 7 días y no terminados
  const urgentJobs = jobs.filter(j => {
    if (j.status === 'done' || j.status === 'cancelled') return false
    const d = daysUntil(j.due_date)
    return d !== null && d <= 7
  })

  const stats = {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    inprogress: jobs.filter(j => j.status === 'inprogress').length,
    done: jobs.filter(j => j.status === 'done').length,
    overdue: jobs.filter(j => {
      if (j.status === 'done' || j.status === 'cancelled') return false
      const d = daysUntil(j.due_date)
      return d !== null && d < 0
    }).length,
    totalCost: jobs.reduce((s, j) => s + (j.real_cost || 0), 0),
  }

  const filtered = jobs.filter(j =>
    (!search || j.title.toLowerCase().includes(search.toLowerCase()) || j.zone?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterType || j.job_type === filterType) &&
    (!filterStatus || j.status === filterStatus)
  )

  function openCreate() {
    setSelected(null)
    setForm({ job_type: 'task', priority: 'medium', status: 'pending', estimated_cost: 0, real_cost: 0, start_date: todayIso(), photos: [] })
    setShowDialog(true)
  }

  function openEdit(j: CbreJob, e?: React.MouseEvent) {
    e?.stopPropagation()
    setSelected(j); setForm({ ...j, photos: j.photos ?? [] }); setShowDetail(false); setShowDialog(true)
  }

  function openDetail(j: CbreJob) {
    setSelected(j); setShowDetail(true)
  }

  async function handleSave() {
    if (!form.title?.trim()) return
    setSaving(true)
    try {
      const saved = await upsertCbreJob({ ...form, id: selected?.id })
      // Save photos separately (requires photos column — see SQL in supabase.ts)
      const photos = form.photos ?? []
      patchCbreJobPhotos(saved.id, photos).catch(() => {})
      const withWorker = { ...saved, responsible: workers.find(w => w.id === saved.responsible_id), photos }
      setJobs(prev => selected ? prev.map(j => j.id === selected.id ? withWorker : j) : [withWorker, ...prev])
      setShowDialog(false)
    } catch { alert('Error al guardar.') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!confirm('¿Eliminar este trabajo CBRE?')) return
    await deleteCbreJob(id)
    setJobs(prev => prev.filter(j => j.id !== id))
    setShowDetail(false)
  }

  if (loading) return <div className="p-5 text-center text-gray-400">Cargando trabajos CBRE...</div>

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <HardHat size={20} className="text-yellow-600" />
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">CBRE</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">{jobs.length} trabajos · {formatCurrency(stats.totalCost)} coste real</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Nuevo trabajo</Button>
      </div>

      {/* Alerta de vencimientos próximos */}
      {urgentJobs.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {urgentJobs.filter(j => (daysUntil(j.due_date) ?? 999) < 0).length > 0
                ? `${urgentJobs.filter(j => (daysUntil(j.due_date) ?? 999) < 0).length} trabajo(s) vencido(s)`
                : `${urgentJobs.length} trabajo(s) con vencimiento en ≤7 días`}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              {urgentJobs.slice(0, 3).map(j => j.title).join(' · ')}
              {urgentJobs.length > 3 && ` y ${urgentJobs.length - 3} más`}
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', val: 'pending', value: stats.pending, icon: <Clock size={15} />, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-slate-700', ring: 'ring-gray-400' },
          { label: 'En curso', val: 'inprogress', value: stats.inprogress, icon: <Clock size={15} />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', ring: 'ring-blue-400' },
          { label: 'Vencidos', val: '_overdue', value: stats.overdue, icon: <AlertCircle size={15} />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', ring: 'ring-red-400' },
          { label: 'Finalizados', val: 'done', value: stats.done, icon: <CheckCircle2 size={15} />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-400' },
        ].map(kpi => {
          const active = filterStatus === kpi.val
          return (
            <button key={kpi.val} onClick={() => setFilterStatus(prev => prev === kpi.val ? '' : kpi.val)} className="text-left focus:outline-none">
              <Card className={cn('transition-all', active && `ring-2 ${kpi.ring}`)}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('p-2 rounded-lg', kpi.bg, kpi.color)}>{kpi.icon}</div>
                    <div>
                      <div className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</div>
                      <div className="text-[11px] text-gray-500 dark:text-slate-400">{kpi.label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar por título o zona..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
          value={filterType} onChange={e => setFilterType(e.target.value as CbreJobType | '')}>
          <option value="">Todos los tipos</option>
          {(Object.entries(JOB_TYPE_LABELS) as [CbreJobType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
            <tr>
              {['Plazo', 'Tipo', 'Título / Zona', 'Responsable', 'Coste', 'Estado', ''].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.map(job => {
              const days = daysUntil(job.due_date)
              const badge = countdownBadge(days, job.status)
              return (
                <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer" onClick={() => openDetail(job)}>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {badge ? (
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]', badge.cls)}>
                        <Clock size={10} /> {badge.label}
                      </span>
                    ) : job.due_date ? (
                      <span className="text-xs text-gray-400">{formatDateShort(job.due_date)}</span>
                    ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit', JOB_TYPE_COLORS[job.job_type])}>
                      {JOB_TYPE_ICONS[job.job_type]} {JOB_TYPE_LABELS[job.job_type]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <div className="truncate text-xs font-medium text-gray-800 dark:text-slate-200">{job.title}</div>
                    {job.zone && <div className="text-[10px] text-gray-400 truncate">{job.zone}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    {job.responsible ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ backgroundColor: job.responsible.color }}>
                          {job.responsible.name[0]}
                        </div>
                        <span className="text-xs text-gray-700 dark:text-slate-300">{job.responsible.name.split(' ')[0]}</span>
                      </div>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-700 dark:text-slate-200 whitespace-nowrap">{formatCurrency(job.real_cost || 0)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_CLASSES[job.status])}>
                      {STATUS_LABELS[job.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={e => openEdit(job, e)} className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={e => handleDelete(job.id, e)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">No hay trabajos</div>}
      </div>

      {/* Dialog detalle */}
      {selected && (
        <Dialog open={showDetail} onClose={() => setShowDetail(false)} title="Detalle CBRE" size="md">
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', JOB_TYPE_COLORS[selected.job_type])}>
                {JOB_TYPE_ICONS[selected.job_type]} {JOB_TYPE_LABELS[selected.job_type]}
              </span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_CLASSES[selected.status])}>
                {STATUS_LABELS[selected.status]}
              </span>
              <span className={cn('px-2 py-0.5 rounded text-xs font-medium', PRIORITY_CLASSES[selected.priority])}>
                {PRIORITY_LABELS[selected.priority]}
              </span>
            </div>

            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{selected.title}</h3>
            {selected.zone && <p className="text-xs text-gray-500 dark:text-slate-400">Zona: {selected.zone}</p>}
            {selected.description && (
              <p className="text-sm text-gray-700 dark:text-slate-200 bg-gray-50 dark:bg-slate-700 rounded-lg p-3">{selected.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {selected.start_date && <div><p className="text-xs text-gray-500">Inicio</p><p className="font-medium dark:text-slate-200">{formatDateShort(selected.start_date)}</p></div>}
              {selected.due_date && (
                <div>
                  <p className="text-xs text-gray-500">Fecha límite</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="font-medium dark:text-slate-200">{formatDateShort(selected.due_date)}</p>
                    {(() => { const badge = countdownBadge(daysUntil(selected.due_date), selected.status); return badge ? <span className={cn('text-[11px] px-1.5 py-0.5 rounded-full', badge.cls)}>{badge.label}</span> : null })()}
                  </div>
                </div>
              )}
              {selected.completion_date && <div><p className="text-xs text-gray-500">Finalizado</p><p className="font-medium dark:text-slate-200">{formatDateShort(selected.completion_date)}</p></div>}
              {selected.responsible && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Responsable interno</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: selected.responsible.color }}>
                      {getInitials(selected.responsible.name)}
                    </div>
                    <span className="text-sm font-medium dark:text-slate-200">{selected.responsible.name}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
              <div className="text-center"><p className="text-xs text-gray-500">Est.</p><p className="text-sm font-bold dark:text-white">{formatCurrency(selected.estimated_cost)}</p></div>
              <div className="text-center"><p className="text-xs text-gray-500">Real</p><p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(selected.real_cost)}</p></div>
            </div>

            {selected.observations && <p className="text-sm text-gray-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">{selected.observations}</p>}

            {/* Fotos adjuntas */}
            {(selected.photos?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                  <Camera size={11} /> Fotos adjuntas ({selected.photos!.length})
                </p>
                <PhotoUpload
                  photos={selected.photos!}
                  onChange={() => {}}
                  readOnly
                />
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
              <Button variant="outline" className="flex-1" onClick={() => openEdit(selected)}><Edit2 size={13} /> Editar</Button>
              <button onClick={() => handleDelete(selected.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar trabajo CBRE' : 'Nuevo trabajo CBRE'}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto">
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Título *</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Describe el trabajo..." value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.job_type || 'task'} onChange={e => setForm(f => ({ ...f, job_type: e.target.value as CbreJobType }))}>
              {(Object.entries(JOB_TYPE_LABELS) as [CbreJobType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Zona</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Ej: Planta baja, Almacén..." value={form.zone || ''} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Responsable interno</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.responsible_id || ''} onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin asignar</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.priority || 'medium'} onChange={e => setForm(f => ({ ...f, priority: e.target.value as CbreJob['priority'] }))}>
              <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.status || 'pending'} onChange={e => setForm(f => ({ ...f, status: e.target.value as CbreJob['status'] }))}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha inicio</label>
            <input type="date" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value || undefined }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Clock size={11} className="text-amber-500" /> Fecha límite (cuenta atrás)
            </label>
            <input type="date" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:bg-slate-700 dark:text-white"
              value={form.due_date || ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value || undefined }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Coste estimado (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.estimated_cost || 0} onChange={e => setForm(f => ({ ...f, estimated_cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Coste real (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.real_cost || 0} onChange={e => setForm(f => ({ ...f, real_cost: Number(e.target.value) }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción</label>
            <textarea className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none dark:bg-slate-700 dark:text-white" rows={3}
              value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Observaciones</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.observations || ''} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Camera size={11} /> Fotos ({form.photos?.length ?? 0}/8)
            </label>
            <PhotoUpload
              photos={form.photos ?? []}
              onChange={urls => setForm(f => ({ ...f, photos: urls }))}
              prefix={`cbre-${selected?.id ?? 'new'}-`}
            />
          </div>
          <div className="col-span-full flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.title?.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
