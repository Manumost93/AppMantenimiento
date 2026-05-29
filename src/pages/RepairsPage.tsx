import { useState, useEffect } from 'react'
import { Plus, Search, Wrench, CheckCircle2, Clock, AlertCircle, Edit2, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getRepairs, upsertRepair, deleteRepair, getWorkers, getAreas } from '@/lib/supabase'
import type { GeneralRepair, TeamMember, Area } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, PRIORITY_LABELS, PRIORITY_CLASSES, formatCurrency, formatDateShort, todayIso } from '@/lib/utils'

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<GeneralRepair[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMember, setFilterMember] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<GeneralRepair | null>(null)
  const [form, setForm] = useState<Partial<GeneralRepair>>({
    status: 'pending', priority: 'medium', material_cost: 0, labor_cost: 0, total_cost: 0, blocked_by_material: false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getRepairs(), getWorkers(), getAreas()])
      .then(([r, w, a]) => { setRepairs(r); setWorkers(w); setAreas(a) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = repairs.filter(r =>
    (!search || r.description.toLowerCase().includes(search.toLowerCase()) || r.area?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || r.status === filterStatus) &&
    (!filterMember || String(r.responsible_id) === filterMember)
  )

  const stats = {
    pending: repairs.filter(r => r.status === 'pending').length,
    inprogress: repairs.filter(r => r.status === 'inprogress').length,
    blocked: repairs.filter(r => r.blocked_by_material).length,
    done: repairs.filter(r => r.status === 'done').length,
    totalCost: repairs.reduce((s, r) => s + (r.total_cost || 0), 0),
  }

  function openCreate() {
    setSelected(null)
    setForm({ status: 'pending', priority: 'medium', material_cost: 0, labor_cost: 0, total_cost: 0, blocked_by_material: false, request_date: todayIso() })
    setShowDialog(true)
  }

  function openEdit(r: GeneralRepair) {
    setSelected(r)
    setForm({ ...r })
    setShowDialog(true)
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
      const withRelations = { ...saved, responsible: workers.find(w => w.id === saved.responsible_id), area: areas.find(a => a.id === saved.area_id)?.name || saved.area }
      setRepairs(prev => selected ? prev.map(r => r.id === selected.id ? withRelations : r) : [withRelations, ...prev])
      setShowDialog(false)
    } catch {
      alert('Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta reparación?')) return
    try {
      await deleteRepair(id)
      setRepairs(prev => prev.filter(r => r.id !== id))
    } catch {
      alert('No se pudo eliminar.')
    }
  }

  if (loading) return <div className="p-5 text-center text-gray-400">Cargando reparaciones...</div>

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wrench size={20} className="text-orange-600" />
          <div>
            <h2 className="text-base font-bold text-gray-900">Reparaciones generales</h2>
            <p className="text-xs text-gray-500">{repairs.length} reparaciones · {formatCurrency(stats.totalCost)}</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Nueva reparación
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', value: stats.pending, icon: <Clock size={16} />, color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'En curso', value: stats.inprogress, icon: <Clock size={16} />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Bloqueadas', value: stats.blocked, icon: <AlertCircle size={16} />, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Finalizadas', value: stats.done, icon: <CheckCircle2 size={16} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg', kpi.bg, kpi.color)}>{kpi.icon}</div>
                <div>
                  <div className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</div>
                  <div className="text-[11px] text-gray-500">{kpi.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar reparaciones..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          value={filterMember} onChange={e => setFilterMember(e.target.value)}>
          <option value="">Todos los compañeros</option>
          {workers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Fecha', 'Área', 'Descripción', 'Responsable', 'Coste', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(repair => (
              <tr key={repair.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{formatDateShort(repair.request_date)}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{repair.area || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-800 max-w-[200px]">
                  <div className="truncate">{repair.description}</div>
                  {repair.blocked_by_material && <span className="text-[10px] text-amber-600 font-medium">⏸ Esperando material</span>}
                </td>
                <td className="px-4 py-2.5">
                  {repair.responsible ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ backgroundColor: repair.responsible.color }}>
                        {repair.responsible.name[0]}
                      </div>
                      <span className="text-xs text-gray-700">{repair.responsible.name.split(' ')[0]}</span>
                    </div>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs font-medium text-gray-700 whitespace-nowrap">{formatCurrency(repair.total_cost)}</td>
                <td className="px-4 py-2.5">
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap', STATUS_CLASSES[repair.status])}>
                    {STATUS_LABELS[repair.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(repair)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(repair.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No hay reparaciones</div>}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar reparación' : 'Nueva reparación'}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha solicitud</label>
            <input type="date" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.request_date || todayIso()}
              onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha prevista</label>
            <input type="date" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.planned_date || ''}
              onChange={e => setForm(f => ({ ...f, planned_date: e.target.value || undefined }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sección</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.area_id || ''}
              onChange={e => setForm(f => ({ ...f, area_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin sección</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Responsable</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.responsible_id || ''}
              onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin asignar</option>
              {workers.filter(w => w.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.priority || 'medium'}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as GeneralRepair['priority'] }))}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.status || 'pending'}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as GeneralRepair['status'] }))}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Coste material (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.material_cost || 0}
              onChange={e => setForm(f => ({ ...f, material_cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Coste mano de obra (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.labor_cost || 0}
              onChange={e => setForm(f => ({ ...f, labor_cost: Number(e.target.value) }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción del trabajo *</label>
            <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" rows={3}
              value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 mb-1">Materiales necesarios</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Lista de materiales..."
              value={form.materials_needed || ''}
              onChange={e => setForm(f => ({ ...f, materials_needed: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="blocked" checked={form.blocked_by_material || false}
              onChange={e => setForm(f => ({ ...f, blocked_by_material: e.target.checked }))} className="rounded" />
            <label htmlFor="blocked" className="text-sm text-gray-700">Bloqueado por falta de material</label>
          </div>
          <div className="col-span-full flex gap-2 pt-2 border-t border-gray-100">
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
