import { useState, useEffect } from 'react'
import {
  Server,
  Plus, Search, Edit2, Trash2, Layers, AlertTriangle, WifiOff, Wrench, CalendarClock, Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { getEdgeAssets, upsertEdgeAsset, deleteEdgeAsset, getProviders } from '@/lib/supabase'
import type { EdgeAsset, EdgeAssetType, EdgeAssetCriticality, EdgeAssetStatus, Provider } from '@/types'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import { PageLoading } from '@/components/Skeleton'
import { ASSET_TYPE_META, CRITICALITY_META, STATUS_META, isUpcomingCheck } from '@/lib/edgeAssets'

const inputClass = 'w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'

function daysFromToday(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

// Datos de ejemplo realistas — se crean vía upsertEdgeAsset(), como un alta manual normal
// (misma validación, RLS y audit log), no son un INSERT SQL directo.
const SEED_ASSETS: Partial<EdgeAsset>[] = [
  { name: 'Rack Sala Técnica 1', asset_type: 'rack', location: 'Sala técnica planta -1', rack: 'R1', criticality: 'critical', status: 'operational', last_check_date: daysFromToday(-30), next_check_date: daysFromToday(60), repair_cost: 0 },
  { name: 'Servidor Edge Principal', asset_type: 'edge_server', location: 'Sala técnica planta -1', rack: 'R1', rack_unit: 'U10-U12', criticality: 'critical', status: 'operational', ip_address: '10.0.1.10', last_check_date: daysFromToday(-15), next_check_date: daysFromToday(45), repair_cost: 0 },
  { name: 'Switch Core Planta -1', asset_type: 'switch', location: 'Sala técnica planta -1', rack: 'R1', rack_unit: 'U5', criticality: 'high', status: 'operational', ip_address: '10.0.1.1', last_check_date: daysFromToday(-15), next_check_date: daysFromToday(45), repair_cost: 0 },
  { name: 'Firewall Perimetral', asset_type: 'firewall', location: 'Sala técnica planta -1', rack: 'R2', criticality: 'critical', status: 'operational', ip_address: '10.0.0.1', last_check_date: daysFromToday(-10), next_check_date: daysFromToday(50), repair_cost: 0 },
  { name: 'SAI Sala Técnica', asset_type: 'ups', location: 'Sala técnica planta -1', rack: 'R2', criticality: 'critical', status: 'warning', last_check_date: daysFromToday(-45), next_check_date: daysFromToday(3), notes: 'Batería con más de 3 años, valorar sustitución preventiva.', repair_cost: 0 },
  { name: 'PDU Rack R1', asset_type: 'pdu', location: 'Sala técnica planta -1', rack: 'R1', criticality: 'medium', status: 'operational', last_check_date: daysFromToday(-30), next_check_date: daysFromToday(60), repair_cost: 0 },
  { name: 'Climatización Sala Servidores', asset_type: 'hvac', location: 'Sala técnica planta -1', criticality: 'high', status: 'maintenance', last_check_date: daysFromToday(-2), next_check_date: daysFromToday(5), notes: 'Revisión de filtros y gas refrigerante en curso.', repair_cost: 180 },
  { name: 'Sensor Temperatura Sala Técnica', asset_type: 'temperature_sensor', location: 'Sala técnica planta -1', criticality: 'medium', status: 'operational', last_check_date: daysFromToday(-10), next_check_date: daysFromToday(80), repair_cost: 0 },
  { name: 'CCTV Zona de Carga', asset_type: 'cctv', location: 'Zona de carga', criticality: 'medium', status: 'offline', last_check_date: daysFromToday(-20), next_check_date: daysFromToday(1), notes: 'Sin señal desde ayer, pendiente de revisión.', repair_cost: 0 },
  { name: 'Control de Accesos Sala Técnica', asset_type: 'access_control', location: 'Sala técnica planta -1', criticality: 'high', status: 'operational', last_check_date: daysFromToday(-30), next_check_date: daysFromToday(90), repair_cost: 0 },
  { name: 'Cuadro Eléctrico General', asset_type: 'electrical_panel', location: 'Cuarto eléctrico', criticality: 'critical', status: 'operational', last_check_date: daysFromToday(-60), next_check_date: daysFromToday(30), repair_cost: 0 },
  { name: 'Generador Diésel', asset_type: 'generator', location: 'Exterior / Parking', criticality: 'critical', status: 'operational', last_check_date: daysFromToday(-90), next_check_date: daysFromToday(15), repair_cost: 0 },
]

export default function EdgeAssetsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: assets, setData: setAssets, loading } = useRealtimeTable('edge_assets', getEdgeAssets)
  const [providers, setProviders] = useState<Provider[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCriticality, setFilterCriticality] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<EdgeAsset | null>(null)
  const [form, setForm] = useState<Partial<EdgeAsset>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProviders().then(setProviders)
  }, [])

  const filtered = assets.filter(a =>
    (!search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.location?.toLowerCase().includes(search.toLowerCase()) ||
      a.rack?.toLowerCase().includes(search.toLowerCase()) ||
      a.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
      a.ip_address?.toLowerCase().includes(search.toLowerCase())
    ) &&
    (!filterType || a.asset_type === filterType) &&
    (!filterStatus || a.status === filterStatus) &&
    (!filterCriticality || a.criticality === filterCriticality)
  )

  const kpis = [
    { label: 'Activos totales', value: assets.length, icon: Layers, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Activos críticos', value: assets.filter(a => a.criticality === 'critical').length, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' },
    { label: 'Offline', value: assets.filter(a => a.status === 'offline').length, icon: WifiOff, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' },
    { label: 'En mantenimiento', value: assets.filter(a => a.status === 'maintenance').length, icon: Wrench, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' },
    { label: 'Próximas revisiones', value: assets.filter(a => isUpcomingCheck(a.next_check_date)).length, icon: CalendarClock, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30' },
  ]

  function openCreate() {
    setSelected(null)
    setForm({ asset_type: 'edge_server', criticality: 'medium', status: 'operational', repair_cost: 0 })
    setShowDialog(true)
  }

  function openEdit(asset: EdgeAsset) {
    setSelected(asset)
    setForm({ ...asset })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.name?.trim()) return
    setSaving(true)
    try {
      const saved = await upsertEdgeAsset(selected ? { ...form, id: selected.id } : form)
      setAssets(prev => selected ? prev.map(a => a.id === selected.id ? saved : a) : [...prev, saved])
      setShowDialog(false)
      toast.success(selected ? 'Activo actualizado' : 'Activo creado')
    } catch {
      toast.error('Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(asset: EdgeAsset) {
    const ok = await confirm({ title: 'Eliminar activo', message: `¿Eliminar "${asset.name}"? Esta acción no se puede deshacer.` })
    if (!ok) return
    try {
      await deleteEdgeAsset(asset.id, asset.name)
      setAssets(prev => prev.filter(a => a.id !== asset.id))
      toast.success('Activo eliminado')
    } catch {
      toast.error('No se pudo eliminar.')
    }
  }

  async function handleSeedExamples() {
    const ok = await confirm({
      title: 'Cargar activos de ejemplo',
      message: `Se crearán ${SEED_ASSETS.length} activos de ejemplo (rack, servidor, switch, firewall, SAI, PDU, HVAC, sensores, CCTV, control de accesos, cuadro eléctrico y generador). Podrás editarlos o eliminarlos después.`,
      confirmLabel: 'Cargar ejemplos',
      danger: false,
    })
    if (!ok) return
    setSaving(true)
    try {
      const created: EdgeAsset[] = []
      for (const seed of SEED_ASSETS) {
        created.push(await upsertEdgeAsset(seed))
      }
      setAssets(prev => [...prev, ...created])
      toast.success(`${created.length} activos de ejemplo creados`)
    } catch {
      toast.error('Error al cargar los ejemplos. Puede que se hayan creado algunos.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading kpis={5} rows={5} />

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Server size={18} className="text-blue-600 dark:text-blue-400" />
            Edge / Data Center Lite
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Inventario de activos técnicos críticos — racks, edge computing, infraestructura IT/OT
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Nuevo activo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(kpi => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border border-gray-200 dark:border-slate-700">
              <CardContent className="pt-4 pb-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', kpi.bg, kpi.color)}>
                  <Icon size={18} />
                </div>
                <div className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{kpi.label}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar por nombre, ubicación, rack, serie o IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2">
          <select className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none sm:w-48" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(ASSET_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none sm:w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none sm:w-36" value={filterCriticality} onChange={e => setFilterCriticality(e.target.value)}>
            <option value="">Toda criticidad</option>
            {Object.entries(CRITICALITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Listado */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>{assets.length === 0 ? 'No hay activos registrados todavía.' : 'Sin resultados para estos filtros.'}</p>
          {assets.length === 0 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button size="sm" onClick={openCreate}>Añadir el primero</Button>
              <Button size="sm" variant="outline" onClick={handleSeedExamples} disabled={saving}>
                <Sparkles size={14} />
                {saving ? 'Cargando...' : 'Cargar ejemplos'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(asset => {
            const TypeIcon = ASSET_TYPE_META[asset.asset_type].icon
            const upcoming = isUpcomingCheck(asset.next_check_date)
            return (
              <Card key={asset.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <TypeIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{asset.name}</h3>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">{ASSET_TYPE_META[asset.asset_type].label}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(asset)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(asset)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <Badge className={CRITICALITY_META[asset.criticality].className}>{CRITICALITY_META[asset.criticality].label}</Badge>
                    <Badge className={STATUS_META[asset.status].className}>{STATUS_META[asset.status].label}</Badge>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-2 space-y-0.5">
                    {(asset.location || asset.rack) && (
                      <p>📍 {[asset.location, asset.rack && `Rack ${asset.rack}`, asset.rack_unit].filter(Boolean).join(' · ')}</p>
                    )}
                    {asset.ip_address && <p>🌐 {asset.ip_address}</p>}
                    {asset.provider && <p>🔧 {asset.provider.name}</p>}
                    {asset.next_check_date && (
                      <p className={cn(upcoming && 'text-amber-600 dark:text-amber-400 font-medium')}>
                        📅 Próxima revisión: {new Date(asset.next_check_date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  {asset.repair_cost > 0 && (
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mt-2 border-t border-gray-100 dark:border-slate-700 pt-2">
                      Coste de reparación: {formatCurrency(asset.repair_cost)}
                    </p>
                  )}

                  {asset.notes && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 line-clamp-2">{asset.notes}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar activo' : 'Nuevo activo'} size="lg">
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input className={inputClass} placeholder="Ej: Rack Sala Técnica 1" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Tipo de activo *</label>
              <select className={inputClass} value={form.asset_type || 'edge_server'} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value as EdgeAssetType }))}>
                {Object.entries(ASSET_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Ubicación</label>
              <input className={inputClass} placeholder="Ej: Sala técnica planta -1" value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Rack</label>
              <input className={inputClass} placeholder="Ej: R3" value={form.rack || ''} onChange={e => setForm(f => ({ ...f, rack: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Posición (U)</label>
              <input className={inputClass} placeholder="Ej: U12-U14" value={form.rack_unit || ''} onChange={e => setForm(f => ({ ...f, rack_unit: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Criticidad</label>
              <select className={inputClass} value={form.criticality || 'medium'} onChange={e => setForm(f => ({ ...f, criticality: e.target.value as EdgeAssetCriticality }))}>
                {Object.entries(CRITICALITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select className={inputClass} value={form.status || 'operational'} onChange={e => setForm(f => ({ ...f, status: e.target.value as EdgeAssetStatus }))}>
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Dirección IP</label>
              <input className={inputClass} placeholder="Ej: 10.0.1.20" value={form.ip_address || ''} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Número de serie</label>
              <input className={inputClass} value={form.serial_number || ''} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Proveedor</label>
            <select className={inputClass} value={form.provider_id ?? ''} onChange={e => setForm(f => ({ ...f, provider_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin asignar</option>
              {providers.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Última revisión</label>
              <input type="date" className={inputClass} value={form.last_check_date || ''} onChange={e => setForm(f => ({ ...f, last_check_date: e.target.value }))} max={todayIso()} />
            </div>
            <div>
              <label className={labelClass}>Próxima revisión</label>
              <input type="date" className={inputClass} value={form.next_check_date || ''} onChange={e => setForm(f => ({ ...f, next_check_date: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Coste de reparación (€)</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={form.repair_cost ?? 0} onChange={e => setForm(f => ({ ...f, repair_cost: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={cn(inputClass, 'resize-none')} rows={3} placeholder="Observaciones, historial de incidencias..." value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name?.trim()}>
              {saving ? 'Guardando...' : selected ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
