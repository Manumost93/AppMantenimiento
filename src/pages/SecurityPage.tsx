import { useState, useEffect } from 'react'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Plus, Search, Edit2, Trash2, Shield, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getSecurityIncidents, upsertSecurityIncident, deleteSecurityIncident, getWorkers } from '@/lib/supabase'
import type { SecurityIncident, SecurityIncidentType, TeamMember } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, PRIORITY_LABELS, PRIORITY_CLASSES, formatDateShort, todayIso } from '@/lib/utils'
import { PageLoading } from '@/components/Skeleton'

const INCIDENT_TYPES: Record<SecurityIncidentType, string> = {
  antiintrusion: 'Antiintrusión / Alarma',
  pci: 'PCI / Contra incendios',
  cctv: 'CCTV / Videovigilancia',
  access: 'Control de accesos',
  emergency: 'Emergencias / Evacuación',
  locksmith: 'Cerrajería',
  rf_doors: 'Puertas RF / Cortafuego',
  other: 'Otro',
}

const TYPE_ICONS: Record<SecurityIncidentType, string> = {
  antiintrusion: '🔔',
  pci: '🔥',
  cctv: '📹',
  access: '🔑',
  emergency: '🚨',
  locksmith: '🔒',
  rf_doors: '🚪',
  other: '⚙️',
}

export default function SecurityPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: incidents, setData: setIncidents, loading } = useRealtimeTable('security_incidents', getSecurityIncidents)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<SecurityIncident | null>(null)
  const [form, setForm] = useState<Partial<SecurityIncident>>({
    status: 'pending', priority: 'medium', incident_type: 'other',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getWorkers().then(setWorkers)
  }, [])

  const filtered = incidents.filter(i =>
    (!search || i.description.toLowerCase().includes(search.toLowerCase()) || i.zone.toLowerCase().includes(search.toLowerCase()) || i.external_company?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || (filterStatus === '_urgent' ? (i.priority === 'urgent' && i.status !== 'done') : i.status === filterStatus)) &&
    (!filterType || i.incident_type === filterType)
  )

  const stats = {
    pending: incidents.filter(i => i.status === 'pending').length,
    inprogress: incidents.filter(i => i.status === 'inprogress').length,
    urgent: incidents.filter(i => i.priority === 'urgent' && i.status !== 'done').length,
    done: incidents.filter(i => i.status === 'done').length,
  }

  function toggleKpi(val: string) {
    setFilterStatus(prev => prev === val ? '' : val)
  }

  const KPI_FILTER_LABELS: Record<string, string> = {
    pending: 'Pendientes', inprogress: 'En curso', _urgent: 'Urgentes', done: 'Resueltas',
  }

  function openCreate() {
    setSelected(null)
    setForm({ status: 'pending', priority: 'medium', incident_type: 'other', date: todayIso() })
    setShowDialog(true)
  }

  function openEdit(i: SecurityIncident) {
    setSelected(i)
    setForm({ ...i })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.description?.trim() || !form.zone?.trim()) return
    setSaving(true)
    try {
      const saved = await upsertSecurityIncident(selected ? { ...form, id: selected.id } : form)
      const withR = { ...saved, internal_responsible: workers.find(w => w.id === saved.internal_responsible_id) }
      setIncidents(prev => selected ? prev.map(i => i.id === selected.id ? withR : i) : [withR, ...prev])
      setShowDialog(false)
      toast.success(selected ? 'Incidencia actualizada' : 'Incidencia creada')
    } catch { toast.error('Error al guardar.') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    const ok = await confirm({ title: 'Eliminar incidencia', message: '¿Eliminar esta incidencia de seguridad?' })
    if (!ok) return
    try {
      await deleteSecurityIncident(id)
      setIncidents(prev => prev.filter(i => i.id !== id))
      toast.success('Incidencia eliminada')
    } catch { toast.error('No se pudo eliminar.') }
  }

  async function handleQuickDone(incident: SecurityIncident) {
    try {
      const saved = await upsertSecurityIncident({ ...incident, status: 'done' })
      setIncidents(prev => prev.map(i => i.id === incident.id
        ? { ...saved, internal_responsible: workers.find(w => w.id === saved.internal_responsible_id) }
        : i
      ))
      toast.success('Incidencia completada')
    } catch { toast.error('Error al completar.') }
  }

  if (loading) return <PageLoading kpis={4} rows={5} />

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield size={18} className="text-blue-500" />
            Seguridad
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {incidents.length} incidencias · {stats.pending} pendientes
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Nueva incidencia
        </Button>
      </div>

      {/* KPIs — clickables como filtro rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', val: 'pending', value: stats.pending, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-slate-700', ring: 'ring-gray-400', icon: Clock },
          { label: 'En curso', val: 'inprogress', value: stats.inprogress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', ring: 'ring-blue-400', icon: AlertTriangle },
          { label: 'Urgentes', val: '_urgent', value: stats.urgent, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', ring: 'ring-red-400', icon: AlertTriangle },
          { label: 'Resueltas', val: 'done', value: stats.done, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-400', icon: CheckCircle2 },
        ].map(kpi => {
          const Icon = kpi.icon
          const active = filterStatus === kpi.val
          return (
            <button key={kpi.label} onClick={() => toggleKpi(kpi.val)} className="text-left focus:outline-none">
              <div className={cn('rounded-xl border border-gray-200 dark:border-slate-700 p-3 flex items-center gap-3 transition-all', kpi.bg, active && `ring-2 ${kpi.ring}`)}>
                <Icon size={20} className={kpi.color} />
                <div>
                  <p className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">{kpi.label}</p>
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
          <span className="font-semibold text-gray-800 dark:text-white">{KPI_FILTER_LABELS[filterStatus] || filterStatus}</span>
          <span className="text-gray-400">({filtered.length})</span>
          <button onClick={() => setFilterStatus('')} className="ml-1 text-blue-500 hover:underline">Ver todas</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar incidencia o zona..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <select
            className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none sm:w-44"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {Object.entries(INCIDENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none sm:w-40"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
            <tr>
              {['Fecha', 'Tipo', 'Zona', 'Descripción', 'Empresa', 'Responsable', 'Prioridad', 'Estado', ''].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.map(inc => (
              <tr key={inc.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                <td className="px-3 py-2.5 text-xs whitespace-nowrap text-gray-500 dark:text-slate-400">{formatDateShort(inc.date)}</td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                  <span title={INCIDENT_TYPES[inc.incident_type]} className="text-base">{TYPE_ICONS[inc.incident_type]}</span>
                  <span className="ml-1 text-gray-600 dark:text-slate-300 hidden sm:inline">{INCIDENT_TYPES[inc.incident_type]}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-slate-300 max-w-[100px] truncate">{inc.zone}</td>
                <td className="px-3 py-2.5 text-xs max-w-[180px]">
                  <div className="truncate text-gray-800 dark:text-slate-200">{inc.description}</div>
                  {inc.resolution && <div className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate mt-0.5">✓ {inc.resolution}</div>}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{inc.external_company || '—'}</td>
                <td className="px-3 py-2.5 text-xs">
                  {inc.internal_responsible ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ backgroundColor: inc.internal_responsible.color }}>
                        {inc.internal_responsible.name[0]}
                      </div>
                      <span className="text-gray-700 dark:text-slate-300 truncate">{inc.internal_responsible.name.split(' ')[0]}</span>
                    </div>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', PRIORITY_CLASSES[inc.priority])}>
                    {PRIORITY_LABELS[inc.priority]}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap', STATUS_CLASSES[inc.status])}>
                    {STATUS_LABELS[inc.status]}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    {inc.status !== 'done' && (
                      <button
                        onClick={() => handleQuickDone(inc)}
                        title="Marcar como resuelta"
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"
                      >
                        <CheckCircle2 size={13} />
                      </button>
                    )}
                    <button onClick={() => openEdit(inc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(inc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
            {search || filterStatus || filterType ? 'No hay incidencias con ese filtro.' : 'No hay incidencias de seguridad registradas.'}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar incidencia' : 'Nueva incidencia de seguridad'}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha</label>
            <input type="date" className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              value={form.date || todayIso()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo de incidencia *</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              value={form.incident_type || 'other'} onChange={e => setForm(f => ({ ...f, incident_type: e.target.value as SecurityIncidentType }))}>
              {Object.entries(INCIDENT_TYPES).map(([k, v]) => <option key={k} value={k}>{TYPE_ICONS[k as SecurityIncidentType]} {v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Zona afectada *</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Ej: Entrada principal, Almacén..."
              value={form.zone || ''} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Empresa externa</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Ej: ISSEI, PEPRESA, SENSORNOR..."
              value={form.external_company || ''} onChange={e => setForm(f => ({ ...f, external_company: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Responsable interno</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              value={form.internal_responsible_id || ''} onChange={e => setForm(f => ({ ...f, internal_responsible_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin asignar</option>
              {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              value={form.priority || 'medium'} onChange={e => setForm(f => ({ ...f, priority: e.target.value as SecurityIncident['priority'] }))}>
              <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              value={form.status || 'pending'} onChange={e => setForm(f => ({ ...f, status: e.target.value as SecurityIncident['status'] }))}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción *</label>
            <textarea className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200 resize-none" rows={3}
              placeholder="Describe la incidencia o trabajo de seguridad..."
              value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Resolución / Solución aplicada</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Cómo se resolvió..."
              value={form.resolution || ''} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Observaciones</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Notas adicionales..."
              value={form.observations || ''} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} />
          </div>
          <div className="col-span-full flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.description?.trim() || !form.zone?.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
