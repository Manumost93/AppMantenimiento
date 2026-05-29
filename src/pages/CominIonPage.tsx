import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getCominIonJobs, upsertCominIonJob, deleteCominIonJob, getWorkers } from '@/lib/supabase'
import type { CominIonJob, TeamMember } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, formatCurrency, formatDateShort, todayIso } from '@/lib/utils'

export default function CominIonPage() {
  const [jobs, setJobs] = useState<CominIonJob[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<CominIonJob | null>(null)
  const [form, setForm] = useState<Partial<CominIonJob>>({ status: 'pending', priority: 'medium', estimated_cost: 0, real_cost: 0, involves_ion: false, blocked_by_material: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getCominIonJobs(), getWorkers()])
      .then(([j, w]) => { setJobs(j); setWorkers(w) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = jobs.filter(j =>
    (!search || j.work_requested.toLowerCase().includes(search.toLowerCase()) || j.affected_zone.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || j.status === filterStatus)
  )

  const totalCost = jobs.reduce((s, j) => s + (j.real_cost || 0), 0)

  function openCreate() {
    setSelected(null)
    setForm({ status: 'pending', priority: 'medium', estimated_cost: 0, real_cost: 0, involves_ion: false, blocked_by_material: false, date: todayIso() })
    setShowDialog(true)
  }

  function openEdit(j: CominIonJob) {
    setSelected(j)
    setForm({ ...j })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.work_requested?.trim() || !form.affected_zone?.trim()) return
    setSaving(true)
    try {
      const saved = await upsertCominIonJob(selected ? { ...form, id: selected.id } : form)
      const withR = { ...saved, internal_responsible: workers.find(w => w.id === saved.internal_responsible_id) }
      setJobs(prev => selected ? prev.map(j => j.id === selected.id ? withR : j) : [withR, ...prev])
      setShowDialog(false)
    } catch { alert('Error al guardar.') } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este trabajo?')) return
    try { await deleteCominIonJob(id); setJobs(prev => prev.filter(j => j.id !== id)) }
    catch { alert('No se pudo eliminar.') }
  }

  if (loading) return <div className="p-5 text-center text-gray-400">Cargando trabajos COMIN/ION...</div>

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">🎨 COMIN / ION / Decoración</h2>
          <p className="text-xs text-gray-500">{jobs.length} trabajos · Coste real: {formatCurrency(totalCost)}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={14} />Nuevo trabajo</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar por trabajo o zona..." value={search} onChange={e => setSearch(e.target.value)} />
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
            <tr>{['Fecha', 'Zona', 'Trabajo', 'Responsable', 'Coste est.', 'Coste real', 'ION', 'Estado', ''].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(job => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatDateShort(job.date)}</td>
                <td className="px-3 py-2.5 text-xs">{job.affected_zone}</td>
                <td className="px-3 py-2.5 text-xs max-w-[160px]">
                  <div className="truncate">{job.work_requested}</div>
                  {job.blocked_by_material && <span className="text-[10px] text-amber-600">⏸ Esperando material</span>}
                </td>
                <td className="px-3 py-2.5 text-xs">{job.internal_responsible?.name?.split(' ')[0] || '—'}</td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatCurrency(job.estimated_cost)}</td>
                <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap">{formatCurrency(job.real_cost)}</td>
                <td className="px-3 py-2.5 text-xs">{job.involves_ion ? '✓' : '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap', STATUS_CLASSES[job.status])}>{STATUS_LABELS[job.status]}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(job)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(job.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No hay trabajos</div>}
      </div>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar trabajo' : 'Nuevo trabajo COMIN/ION'}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.date || todayIso()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Zona afectada *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ej: Entrada principal, Pasillo A..." value={form.affected_zone || ''} onChange={e => setForm(f => ({ ...f, affected_zone: e.target.value }))} />
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Coste estimado (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.estimated_cost || 0} onChange={e => setForm(f => ({ ...f, estimated_cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Coste real (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.real_cost || 0} onChange={e => setForm(f => ({ ...f, real_cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.priority || 'medium'} onChange={e => setForm(f => ({ ...f, priority: e.target.value as CominIonJob['priority'] }))}>
              <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.status || 'pending'} onChange={e => setForm(f => ({ ...f, status: e.target.value as CominIonJob['status'] }))}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 mb-1">Trabajo solicitado *</label>
            <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" rows={3}
              value={form.work_requested || ''} onChange={e => setForm(f => ({ ...f, work_requested: e.target.value }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 mb-1">Material solicitado</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.material_requested || ''} onChange={e => setForm(f => ({ ...f, material_requested: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.involves_ion || false} onChange={e => setForm(f => ({ ...f, involves_ion: e.target.checked }))} className="rounded" />
              Involucra ION
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.blocked_by_material || false} onChange={e => setForm(f => ({ ...f, blocked_by_material: e.target.checked }))} className="rounded" />
              Bloqueado por material
            </label>
          </div>
          <div className="col-span-full flex gap-2 pt-2 border-t border-gray-100">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.work_requested?.trim() || !form.affected_zone?.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
