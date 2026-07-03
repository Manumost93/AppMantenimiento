import { useState, useEffect } from 'react'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Plus, Trash2, Edit2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getFoodIncidents, upsertFoodIncident, deleteFoodIncident, getWorkers } from '@/lib/supabase'
import type { FoodIncident, TeamMember } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, formatCurrency, formatDateShort, todayIso } from '@/lib/utils'
import { PageLoading } from '@/components/Skeleton'

export default function FoodPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: incidents, setData: setIncidents, loading } = useRealtimeTable('food_incidents', getFoodIncidents)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<FoodIncident | null>(null)
  const [form, setForm] = useState<Partial<FoodIncident>>({ status: 'pending', priority: 'medium', material_cost: 0, repair_cost: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getWorkers().then(setWorkers)
  }, [])

  const filtered = incidents.filter(i =>
    (!search || i.affected_element.toLowerCase().includes(search.toLowerCase()) || i.restaurant_zone.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || i.status === filterStatus)
  )

  const totalCost = incidents.reduce((s, i) => s + (i.total_cost || 0), 0)

  const stats = {
    pending: incidents.filter(i => i.status === 'pending').length,
    inprogress: incidents.filter(i => i.status === 'inprogress').length,
    blocked: incidents.filter(i => i.status === 'blocked').length,
    done: incidents.filter(i => i.status === 'done').length,
  }

  function toggleKpi(val: string) {
    setFilterStatus(prev => prev === val ? '' : val)
  }

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
      toast.success(selected ? 'Incidencia actualizada' : 'Incidencia creada')
    } catch { toast.error('Error al guardar.') } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    const ok = await confirm({ title: 'Eliminar incidencia', message: '¿Eliminar esta incidencia de FOOD?' })
    if (!ok) return
    try {
      await deleteFoodIncident(id)
      setIncidents(prev => prev.filter(i => i.id !== id))
      toast.success('Incidencia eliminada')
    } catch { toast.error('No se pudo eliminar.') }
  }

  if (loading) return <PageLoading rows={5} />

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">🍽️ FOOD / Restaurante</h2>
          <p className="text-xs text-gray-500">{incidents.length} incidencias · Coste total: {formatCurrency(totalCost)}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={14} />Nueva incidencia</Button>
      </div>

      {/* KPIs — clickables como filtro rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: 'Pendientes', val: 'pending', value: stats.pending, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-slate-700', ring: 'ring-gray-400' },
          { label: 'En curso', val: 'inprogress', value: stats.inprogress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', ring: 'ring-blue-400' },
          { label: 'Bloqueadas', val: 'blocked', value: stats.blocked, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', ring: 'ring-amber-400' },
          { label: 'Finalizadas', val: 'done', value: stats.done, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-400' },
        ] as const).map(kpi => {
          const active = filterStatus === kpi.val
          return (
            <button key={kpi.label} onClick={() => toggleKpi(kpi.val)} className="text-left focus:outline-none">
              <div className={cn('rounded-xl border border-gray-200 dark:border-slate-700 p-3 flex items-center gap-2.5 transition-all', kpi.bg, active && `ring-2 ${kpi.ring}`)}>
                <div>
                  <div className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</div>
                  <div className="text-[11px] text-gray-500 dark:text-slate-400">{kpi.label}</div>
                </div>
                {active && <span className="ml-auto text-[10px] font-medium text-white bg-gray-500 dark:bg-slate-600 rounded-full px-1.5 py-0.5">✕</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Breadcrumb de filtro activo */}
      {filterStatus && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <span>Mostrando:</span>
          <span className="font-semibold text-gray-800 dark:text-white">{STATUS_LABELS[filterStatus as keyof typeof STATUS_LABELS] || filterStatus}</span>
          <span className="text-gray-400">({filtered.length})</span>
          <button onClick={() => setFilterStatus('')} className="ml-1 text-blue-500 hover:underline">Ver todas</button>
        </div>
      )}

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
