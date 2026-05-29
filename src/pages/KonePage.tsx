import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getKoneIncidents, upsertKoneIncident, deleteKoneIncident, getWorkers } from '@/lib/supabase'
import type { KoneIncident, TeamMember } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, formatCurrency, formatDateShort, todayIso } from '@/lib/utils'

export default function KonePage() {
  const [incidents, setIncidents] = useState<KoneIncident[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<KoneIncident | null>(null)
  const [form, setForm] = useState<Partial<KoneIncident>>({ status: 'pending', priority: 'medium', part_cost: 0, labor_cost: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getKoneIncidents(), getWorkers()])
      .then(([i, w]) => { setIncidents(i); setWorkers(w) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = incidents.filter(i =>
    (!search || i.elevator.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || i.status === filterStatus)
  )

  const totalCost = incidents.reduce((s, i) => s + (i.total_cost || 0), 0)

  function openCreate() {
    setSelected(null)
    setForm({ status: 'pending', priority: 'medium', part_cost: 0, labor_cost: 0, date: todayIso() })
    setShowDialog(true)
  }

  function openEdit(i: KoneIncident) {
    setSelected(i)
    setForm({ ...i })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.elevator?.trim() || !form.description?.trim()) return
    setSaving(true)
    try {
      const saved = await upsertKoneIncident(selected ? { ...form, id: selected.id } : form)
      const withRelations = { ...saved, internal_responsible: workers.find(w => w.id === saved.internal_responsible_id) }
      setIncidents(prev => selected ? prev.map(i => i.id === selected.id ? withRelations : i) : [withRelations, ...prev])
      setShowDialog(false)
    } catch { alert('Error al guardar.') } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta incidencia?')) return
    try { await deleteKoneIncident(id); setIncidents(prev => prev.filter(i => i.id !== id)) }
    catch { alert('No se pudo eliminar.') }
  }

  if (loading) return <div className="p-5 text-center text-gray-400">Cargando incidencias KONE...</div>

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">🏢 KONE / Ascensores</h2>
          <p className="text-xs text-gray-500">{incidents.length} incidencias · Coste total: {formatCurrency(totalCost)}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={14} />Nueva incidencia</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar por ascensor o descripción..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Fecha', 'Ascensor', 'Tipo', 'Descripción', 'Responsable', 'Coste', 'Estado', 'Acciones'].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(inc => (
              <tr key={inc.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatDateShort(inc.date)}</td>
                <td className="px-3 py-2.5 text-xs font-medium">{inc.elevator}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{inc.incident_type}</td>
                <td className="px-3 py-2.5 text-xs max-w-[160px]"><div className="truncate">{inc.description}</div></td>
                <td className="px-3 py-2.5 text-xs">{inc.internal_responsible?.name?.split(' ')[0] || '—'}</td>
                <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap">{formatCurrency(inc.total_cost)}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap', STATUS_CLASSES[inc.status])}>{STATUS_LABELS[inc.status]}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(inc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(inc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No hay incidencias</div>}
      </div>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar incidencia KONE' : 'Nueva incidencia KONE'}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.date || todayIso()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ascensor *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ej: A1, Escalera mecánica..." value={form.elevator || ''} onChange={e => setForm(f => ({ ...f, elevator: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de incidencia</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Avería, Revisión..." value={form.incident_type || ''} onChange={e => setForm(f => ({ ...f, incident_type: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Responsable interno</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.internal_responsible_id || ''} onChange={e => setForm(f => ({ ...f, internal_responsible_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin asignar</option>
              {workers.filter(w => w.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Empresa externa</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.external_company || ''} onChange={e => setForm(f => ({ ...f, external_company: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Pieza sustituida</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.replaced_part || ''} onChange={e => setForm(f => ({ ...f, replaced_part: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Coste piezas (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.part_cost || 0} onChange={e => setForm(f => ({ ...f, part_cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Coste mano obra (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.labor_cost || 0} onChange={e => setForm(f => ({ ...f, labor_cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.priority || 'medium'} onChange={e => setForm(f => ({ ...f, priority: e.target.value as KoneIncident['priority'] }))}>
              <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.status || 'pending'} onChange={e => setForm(f => ({ ...f, status: e.target.value as KoneIncident['status'] }))}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción *</label>
            <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" rows={3}
              value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="col-span-full flex gap-2 pt-2 border-t border-gray-100">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.elevator?.trim() || !form.description?.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
