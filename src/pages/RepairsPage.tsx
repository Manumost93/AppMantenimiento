import { useState, useEffect } from 'react'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Plus, Search, Wrench, CheckCircle2, Clock, AlertCircle, Edit2, Trash2, Eye, Camera } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getRepairs, upsertRepair, deleteRepair, getWorkers, getAreas, patchRepairPhotos } from '@/lib/supabase'
import type { GeneralRepair, TeamMember, Area } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, PRIORITY_LABELS, PRIORITY_CLASSES, formatCurrency, formatDateShort, todayIso, getInitials } from '@/lib/utils'
import PhotoUpload from '@/components/PhotoUpload'
import { PageLoading } from '@/components/Skeleton'

export default function RepairsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: repairs, setData: setRepairs, loading } = useRealtimeTable('general_repairs', getRepairs)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMember, setFilterMember] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selected, setSelected] = useState<GeneralRepair | null>(null)
  const [form, setForm] = useState<Partial<GeneralRepair>>({
    status: 'pending', priority: 'medium', material_cost: 0, labor_cost: 0, total_cost: 0, blocked_by_material: false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getWorkers(), getAreas()]).then(([w, a]) => { setWorkers(w); setAreas(a) })
  }, [])

  const filtered = repairs.filter(r =>
    (!search || r.description.toLowerCase().includes(search.toLowerCase()) || r.area?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || (filterStatus === '_blocked' ? r.blocked_by_material : r.status === filterStatus)) &&
    (!filterMember || String(r.responsible_id) === filterMember)
  )

  function toggleKpi(val: string) {
    setFilterStatus(prev => prev === val ? '' : val)
  }

  const stats = {
    pending: repairs.filter(r => r.status === 'pending').length,
    inprogress: repairs.filter(r => r.status === 'inprogress').length,
    blocked: repairs.filter(r => r.blocked_by_material).length,
    done: repairs.filter(r => r.status === 'done').length,
    totalCost: repairs.reduce((s, r) => s + (r.total_cost || 0), 0),
  }

  function openCreate() {
    setSelected(null)
    setForm({ status: 'pending', priority: 'medium', material_cost: 0, labor_cost: 0, total_cost: 0, blocked_by_material: false, request_date: todayIso(), photos: [] })
    setShowDialog(true)
  }

  function openEdit(r: GeneralRepair, e?: React.MouseEvent) {
    e?.stopPropagation()
    setSelected(r)
    setForm({ ...r, photos: r.photos ?? [] })
    setShowDetail(false)
    setShowDialog(true)
  }

  function openDetail(r: GeneralRepair) {
    setSelected(r)
    setShowDetail(true)
  }

  async function handleSave() {
    if (!form.description?.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        id: selected?.id,
        request_date: form.request_date || todayIso(),
      }
      const saved = await upsertRepair(payload)
      // Save photos separately (requires photos column — see SQL in supabase.ts)
      const photos = form.photos ?? []
      patchRepairPhotos(saved.id, photos).catch(() => {})
      const withRelations = {
        ...saved,
        responsible: workers.find(w => w.id === saved.responsible_id),
        area: areas.find(a => a.id === saved.area_id)?.name || saved.area,
        photos,
      }
      setRepairs(prev => selected ? prev.map(r => r.id === selected.id ? withRelations : r) : [withRelations, ...prev])
      setShowDialog(false)
      toast.success(selected ? 'Reparación actualizada' : 'Reparación creada')
    } catch (e) {
      console.error('Error guardando reparación:', e)
      const msg = e instanceof Error ? e.message : ''
      toast.error(msg ? `Error al guardar la reparación: ${msg}` : 'Error al guardar la reparación.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number, e?: React.MouseEvent) {
    e?.stopPropagation()
    const ok = await confirm({ title: 'Eliminar reparación', message: '¿Eliminar esta reparación? Esta acción no se puede deshacer.' })
    if (!ok) return
    try {
      await deleteRepair(id)
      setRepairs(prev => prev.filter(r => r.id !== id))
      setShowDetail(false)
      toast.success('Reparación eliminada')
    } catch {
      toast.error('No se pudo eliminar.')
    }
  }

  if (loading) return <PageLoading kpis={4} rows={5} />

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wrench size={20} className="text-orange-600" />
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Reparaciones generales</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">{repairs.length} reparaciones · {formatCurrency(stats.totalCost)}</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} /> Nueva reparación
        </Button>
      </div>

      {/* KPIs — clickables como filtro rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: 'Pendientes', val: 'pending', value: stats.pending, icon: <Clock size={16} />, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-slate-700', ring: 'ring-gray-400' },
          { label: 'En curso', val: 'inprogress', value: stats.inprogress, icon: <Clock size={16} />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', ring: 'ring-blue-400' },
          { label: 'Bloqueadas', val: '_blocked', value: stats.blocked, icon: <AlertCircle size={16} />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', ring: 'ring-amber-400' },
          { label: 'Finalizadas', val: 'done', value: stats.done, icon: <CheckCircle2 size={16} />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-400' },
        ] as const).map(kpi => {
          const active = filterStatus === kpi.val
          return (
            <button key={kpi.label} onClick={() => toggleKpi(kpi.val)} className="text-left focus:outline-none">
              <Card className={cn('transition-all', active && `ring-2 ${kpi.ring}`)}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('p-2 rounded-lg', kpi.bg, kpi.color)}>{kpi.icon}</div>
                    <div>
                      <div className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</div>
                      <div className="text-[11px] text-gray-500 dark:text-slate-400">{kpi.label}</div>
                    </div>
                    {active && <span className="ml-auto text-[10px] font-medium text-white bg-gray-500 dark:bg-slate-600 rounded-full px-1.5 py-0.5">✕</span>}
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Breadcrumb de filtro activo */}
      {filterStatus && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <span>Mostrando:</span>
          <span className="font-semibold text-gray-800 dark:text-white">
            {filterStatus === '_blocked' ? 'Bloqueadas por material' : ({ pending: 'Pendientes', inprogress: 'En curso', done: 'Finalizadas' } as Record<string,string>)[filterStatus]}
          </span>
          <span className="text-gray-400">({filtered.length})</span>
          <button onClick={() => setFilterStatus('')} className="ml-1 text-blue-500 hover:underline">Ver todas</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar reparaciones..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
          value={filterMember}
          onChange={e => setFilterMember(e.target.value)}
        >
          <option value="">Todos los compañeros</option>
          {workers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
            <tr>
              {['Fecha', 'Área', 'Descripción', 'Responsable', 'Coste', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.map(repair => (
              <tr
                key={repair.id}
                className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                onClick={() => openDetail(repair)}
              >
                <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">{formatDateShort(repair.request_date)}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">{repair.area || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-slate-200 max-w-[200px]">
                  <div className="truncate">{repair.description}</div>
                  {repair.blocked_by_material && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">⏸ Esperando material</span>}
                </td>
                <td className="px-4 py-2.5">
                  {repair.responsible ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ backgroundColor: repair.responsible.color }}>
                        {repair.responsible.name[0]}
                      </div>
                      <span className="text-xs text-gray-700 dark:text-slate-300">{repair.responsible.name.split(' ')[0]}</span>
                    </div>
                  ) : <span className="text-xs text-gray-400 dark:text-slate-500">—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs font-medium text-gray-700 dark:text-slate-200 whitespace-nowrap">{formatCurrency(repair.total_cost)}</td>
                <td className="px-4 py-2.5">
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap', STATUS_CLASSES[repair.status])}>
                    {STATUS_LABELS[repair.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); openDetail(repair) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Ver detalles"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={e => openEdit(repair, e)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={e => handleDelete(repair.id, e)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">No hay reparaciones</div>
        )}
      </div>

      {/* Dialog detalle */}
      {selected && (
        <Dialog open={showDetail} onClose={() => setShowDetail(false)} title="Detalle de reparación" size="md">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Fecha solicitud</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDateShort(selected.request_date)}</p>
              </div>
              {selected.planned_date && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Fecha prevista</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDateShort(selected.planned_date)}</p>
                </div>
              )}
              {selected.completion_date && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Fecha finalización</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDateShort(selected.completion_date)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Área</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">{selected.area || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Estado</p>
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_CLASSES[selected.status])}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Prioridad</p>
                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', PRIORITY_CLASSES[selected.priority])}>
                  {PRIORITY_LABELS[selected.priority]}
                </span>
              </div>
            </div>

            {selected.responsible && (
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5">Responsable</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: selected.responsible.color }}>
                    {getInitials(selected.responsible.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{selected.responsible.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{selected.responsible.role}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Descripción</p>
              <p className="text-sm text-gray-700 dark:text-slate-200 bg-gray-50 dark:bg-slate-700 rounded-lg p-3">{selected.description}</p>
            </div>

            {selected.materials_needed && (
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Materiales</p>
                <p className="text-sm text-gray-700 dark:text-slate-200">{selected.materials_needed}</p>
              </div>
            )}

            {selected.external_company && (
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Empresa externa</p>
                <p className="text-sm text-gray-700 dark:text-slate-200">{selected.external_company}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-slate-400">Material</p>
                <p className="text-sm font-bold text-gray-800 dark:text-white">{formatCurrency(selected.material_cost)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-slate-400">Mano de obra</p>
                <p className="text-sm font-bold text-gray-800 dark:text-white">{formatCurrency(selected.labor_cost)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-slate-400">Total</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(selected.total_cost)}</p>
              </div>
            </div>

            {selected.blocked_by_material && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <AlertCircle size={14} />
                <span className="text-xs font-medium">Bloqueada por falta de material</span>
              </div>
            )}

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

            <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-slate-700">
              <Button variant="outline" className="flex-1" onClick={() => openEdit(selected)}>
                <Edit2 size={13} /> Editar
              </Button>
              <button
                onClick={() => handleDelete(selected.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar reparación' : 'Nueva reparación'}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha solicitud</label>
            <input type="date" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.request_date || todayIso()}
              onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha prevista</label>
            <input type="date" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.planned_date || ''}
              onChange={e => setForm(f => ({ ...f, planned_date: e.target.value || undefined }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Sección</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.area_id || ''}
              onChange={e => setForm(f => ({ ...f, area_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin sección</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Responsable</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.responsible_id || ''}
              onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin asignar</option>
              {workers.filter(w => w.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.priority || 'medium'}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as GeneralRepair['priority'] }))}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.status || 'pending'}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as GeneralRepair['status'] }))}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Coste material (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.material_cost || 0}
              onChange={e => setForm(f => { const mat = Number(e.target.value); return { ...f, material_cost: mat, total_cost: mat + (f.labor_cost || 0) } })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Coste mano de obra (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.labor_cost || 0}
              onChange={e => setForm(f => { const lab = Number(e.target.value); return { ...f, labor_cost: lab, total_cost: (f.material_cost || 0) + lab } })} />
          </div>
          {((form.material_cost || 0) + (form.labor_cost || 0)) > 0 && (
            <div className="col-span-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-blue-700 dark:text-blue-300">Coste total estimado</span>
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{formatCurrency((form.material_cost || 0) + (form.labor_cost || 0))}</span>
            </div>
          )}
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción del trabajo *</label>
            <textarea className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none dark:bg-slate-700 dark:text-white" rows={3}
              value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Materiales necesarios</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Lista de materiales..."
              value={form.materials_needed || ''}
              onChange={e => setForm(f => ({ ...f, materials_needed: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="blocked" checked={form.blocked_by_material || false}
              onChange={e => setForm(f => ({ ...f, blocked_by_material: e.target.checked }))} className="rounded" />
            <label htmlFor="blocked" className="text-sm text-gray-700 dark:text-slate-300">Bloqueado por falta de material</label>
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Camera size={11} /> Fotos ({form.photos?.length ?? 0}/8)
            </label>
            <PhotoUpload
              photos={form.photos ?? []}
              onChange={urls => setForm(f => ({ ...f, photos: urls }))}
              prefix={`repair-${selected?.id ?? 'new'}-`}
            />
          </div>
          <div className="col-span-full flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.description?.trim()}>
              {saving ? 'Guardando...' : 'Guardar reparación'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
