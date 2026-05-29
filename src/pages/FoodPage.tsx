import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getFoodIncidents, upsertFoodIncident, deleteFoodIncident, getWorkers } from '@/lib/supabase'
import type { FoodIncident, TeamMember } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, formatCurrency, formatDateShort, todayIso } from '@/lib/utils'

export default function FoodPage() {
  const [incidents, setIncidents] = useState<FoodIncident[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<FoodIncident | null>(null)
  const [form, setForm] = useState<Partial<FoodIncident>>({ status: 'pending', priority: 'medium', material_cost: 0, repair_cost: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getFoodIncidents(), getWorkers()])
      .then(([i, w]) => { setIncidents(i); setWorkers(w) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = incidents.filter(i =>
    (!search || i.affected_element.toLowerCase().includes(search.toLowerCase()) || i.restaurant_zone.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || i.status === filterStatus)
  )

  const totalCost = incidents.reduce((s, i) => s + (i.total_cost || 0), 0)

  function openCreate() {
    setSelected(null)
    setForm({ status: 'pending', priority: 'medium', material_cost: 0, repair_cost: 0, date: todayIso() })
    setShowDialog(true)
  }

  function openEdit(i: FoodIncident) {
    setSelected(i)
    setForm({ ...i })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.affected_element?.trim() || !form.restaurant_zone?.trim() || !form.breakdown_type?.trim()) return
    setSaving(true)
    try {
      const saved = await upsertFoodIncident(selected ? { ...form, id: selected.id } : form)
      const withR = { ...saved, internal_responsible: workers.find(w => w.id === saved.internal_responsible_id) }
      setIncidents(prev => selected ? prev.map(i => i.id === selected.id ? withR : i) : [withR, ...prev])
      setShowDialog(false)
    } catch { alert('Error al guardar.') } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta incidencia?')) return
    try { await deleteFoodIncident(id); setIncidents(prev => prev.filter(i => i.id !== id)) }
    catch { alert('No se pudo eliminar.') }
  }

  if (loading) return <div className="p-5 text-center text-gray-400">Cargando incidencias FOOD...</div>

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">🍽️ FOOD / Restaurante</h2>
          <p className="text-xs text-gray-500">{incidents.length} incidencias · Coste total: {formatCurrency(totalCost)}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={14} />Nueva incidencia</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar por elemento o zona..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[580px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Fecha', 'Zona', 'Elemento', 'Tipo avería', 'Responsable', 'Coste', 'Estado', ''].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(inc => (
              <tr key={inc.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatDateShort(inc.date)}</td>
                <td className="px-3 py-2.5 text-xs">{inc.restaurant_zone}</td>
                <td className="px-3 py-2.5 text-xs max-w-[140px]"><div className="truncate">{inc.affected_element}</div></td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{inc.breakdown_type}</td>
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

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar incidencia' : 'Nueva incidencia FOOD'}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.date || todayIso()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Zona del restaurante *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ej: Cocina, Barra, Terraza..." value={form.restaurant_zone || ''} onChange={e => setForm(f => ({ ...f, restaurant_zone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Elemento afectado *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ej: Horno, Freidora..." value={form.affected_element || ''} onChange={e => setForm(f => ({ ...f, affected_element: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de avería *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Eléctrica, Mecánica, Fuga..." value={form.breakdown_type || ''} onChange={e => setForm(f => ({ ...f, breakdown_type: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Responsable</label>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Coste material (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.material_cost || 0} onChange={e => setForm(f => ({ ...f, material_cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Coste reparación (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.repair_cost || 0} onChange={e => setForm(f => ({ ...f, repair_cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.priority || 'medium'} onChange={e => setForm(f => ({ ...f, priority: e.target.value as FoodIncident['priority'] }))}>
              <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.status || 'pending'} onChange={e => setForm(f => ({ ...f, status: e.target.value as FoodIncident['status'] }))}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-full flex gap-2 pt-2 border-t border-gray-100">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.affected_element?.trim() || !form.restaurant_zone?.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
