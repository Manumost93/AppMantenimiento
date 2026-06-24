import { useState, useEffect } from 'react'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Plus, Edit2, Trash2, Thermometer, Wind, Zap, Droplets, Fan, AlertTriangle, CheckCircle2, PowerOff, Wrench, ChevronDown, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { getBmsEquipment, upsertBmsEquipment, deleteBmsEquipment, getBmsIncidents, upsertBmsIncident, deleteBmsIncident, updateBmsEquipmentStatus, getWorkers } from '@/lib/supabase'
import type { BmsEquipment, BmsEquipmentType, BmsEquipmentStatus, BmsIncident, BmsIncidentType, TeamMember } from '@/types'
import { cn, formatDateShort, todayIso, getInitials } from '@/lib/utils'
import { PageLoading } from '@/components/Skeleton'
import { useAuth } from '@/contexts/AuthContext'

// ─── Mapas de etiquetas e iconos ──────────────────────────────────────────────

const EQUIP_TYPE_LABELS: Record<BmsEquipmentType, string> = {
  ahu: 'UTA / Climatizador',
  fcu: 'Fan Coil',
  chiller: 'Chiller / Enfriadora',
  boiler: 'Caldera / ACS',
  split: 'Split / Mini-split',
  extract: 'Extractor',
  pump: 'Bomba',
  fan: 'Ventilador',
  sensor: 'Sonda / Sensor',
  other: 'Otro',
}

function EquipIcon({ type, size = 16 }: { type: BmsEquipmentType; size?: number }) {
  if (type === 'ahu' || type === 'fcu') return <Wind size={size} />
  if (type === 'chiller') return <Thermometer size={size} />
  if (type === 'boiler') return <Droplets size={size} />
  if (type === 'split') return <Thermometer size={size} />
  if (type === 'extract' || type === 'fan') return <Fan size={size} />
  if (type === 'pump') return <Droplets size={size} />
  if (type === 'sensor') return <Zap size={size} />
  return <Zap size={size} />
}

const STATUS_CFG: Record<BmsEquipmentStatus, { label: string; color: string; bg: string; dot: string; icon: JSX.Element }> = {
  ok:          { label: 'OK',             color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/20',  dot: 'bg-emerald-500', icon: <CheckCircle2 size={13} /> },
  stopped:     { label: 'Parado',         color: 'text-red-700 dark:text-red-300',         bg: 'bg-red-50 dark:bg-red-900/20',           dot: 'bg-red-500 animate-pulse', icon: <PowerOff size={13} /> },
  alarm:       { label: 'Alarma',         color: 'text-red-700 dark:text-red-300',         bg: 'bg-red-50 dark:bg-red-900/20',           dot: 'bg-red-500 animate-ping', icon: <AlertTriangle size={13} /> },
  repair:      { label: 'Avería',         color: 'text-amber-700 dark:text-amber-300',     bg: 'bg-amber-50 dark:bg-amber-900/20',       dot: 'bg-amber-500', icon: <Wrench size={13} /> },
  off:         { label: 'Apagado',        color: 'text-gray-600 dark:text-gray-400',       bg: 'bg-gray-50 dark:bg-slate-700',           dot: 'bg-gray-400', icon: <PowerOff size={13} /> },
  maintenance: { label: 'Mantenimiento',  color: 'text-blue-700 dark:text-blue-300',       bg: 'bg-blue-50 dark:bg-blue-900/20',         dot: 'bg-blue-500', icon: <Wrench size={13} /> },
}

const INCIDENT_TYPE_LABELS: Record<BmsIncidentType, string> = {
  stopped: 'Parada', alarm: 'Alarma', temp_issue: 'Temperatura incorrecta',
  repair: 'Avería', on: 'Encendido', off: 'Apagado', maintenance: 'Mantenimiento', other: 'Otro',
}

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: 'Abierto', in_progress: 'En curso', resolved: 'Resuelto',
}

const INCIDENT_STATUS_CLASSES: Record<string, string> = {
  open: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BmsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { worker: currentWorker } = useAuth()
  const { data: equipment, setData: setEquipment, loading: loadingEq } = useRealtimeTable('bms_equipment', getBmsEquipment)
  const { data: incidents, setData: setIncidents, loading: loadingInc } = useRealtimeTable('bms_incidents', getBmsIncidents)
  const loading = loadingEq || loadingInc
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [activeTab, setActiveTab] = useState<'equipment' | 'incidents'>('equipment')
  const [filterStatus, setFilterStatus] = useState<BmsEquipmentStatus | ''>('')
  const [filterZone, setFilterZone] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showEquipDialog, setShowEquipDialog] = useState(false)
  const [showIncidentDialog, setShowIncidentDialog] = useState(false)
  const [selectedEquip, setSelectedEquip] = useState<BmsEquipment | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<BmsIncident | null>(null)
  const [savingEquip, setSavingEquip] = useState(false)
  const [savingIncident, setSavingIncident] = useState(false)
  const [equipForm, setEquipForm] = useState<Partial<BmsEquipment>>({ equipment_type: 'ahu', status: 'ok', active: true })
  const [incidentForm, setIncidentForm] = useState<Partial<BmsIncident>>({ incident_type: 'alarm', priority: 'medium', status: 'open' })

  useEffect(() => {
    getWorkers().then(w => setWorkers(w.filter(w => w.active)))
  }, [])

  const zones = [...new Set(equipment.map(e => e.zone).filter(Boolean))] as string[]

  const alarmEquip = equipment.filter(e => e.status === 'alarm' || e.status === 'stopped')

  const filteredEquip = equipment.filter(e =>
    (!filterStatus || e.status === filterStatus) &&
    (!filterZone || e.zone === filterZone)
  )

  const openIncidents = incidents.filter(i => i.status !== 'resolved')

  // ── Equipo CRUD ──

  function openCreateEquip() {
    setSelectedEquip(null)
    setEquipForm({ equipment_type: 'ahu', status: 'ok', active: true })
    setShowEquipDialog(true)
  }

  function openEditEquip(e: BmsEquipment) {
    setSelectedEquip(e); setEquipForm({ ...e }); setShowEquipDialog(true)
  }

  async function handleSaveEquip() {
    setSavingEquip(true)
    try {
      const saved = await upsertBmsEquipment({ ...equipForm, id: selectedEquip?.id })
      setEquipment(prev => selectedEquip ? prev.map(e => e.id === selectedEquip.id ? saved : e) : [...prev, saved])
      setShowEquipDialog(false)
      toast.success(selectedEquip ? 'Equipo actualizado' : 'Equipo añadido')
    } catch { toast.error('Error al guardar equipo.') }
    finally { setSavingEquip(false) }
  }

  async function handleDeleteEquip(id: number) {
    const ok = await confirm({ title: 'Dar de baja equipo', message: '¿Dar de baja este equipo BMS? Se eliminarán sus incidencias asociadas.', confirmLabel: 'Dar de baja' })
    if (!ok) return
    try {
      await deleteBmsEquipment(id)
      setEquipment(prev => prev.filter(e => e.id !== id))
      toast.success('Equipo eliminado')
    } catch { toast.error('No se pudo eliminar el equipo.') }
  }

  async function quickStatusChange(id: number, status: BmsEquipmentStatus) {
    await updateBmsEquipmentStatus(id, status)
    setEquipment(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  // ── Incidencia CRUD ──

  function openCreateIncident(equipId?: number) {
    setSelectedIncident(null)
    setIncidentForm({
      incident_type: 'alarm', priority: 'medium', status: 'open',
      equipment_id: equipId,
      reported_by_id: currentWorker?.id,
    })
    setShowIncidentDialog(true)
  }

  function openEditIncident(inc: BmsIncident) {
    setSelectedIncident(inc); setIncidentForm({ ...inc }); setShowIncidentDialog(true)
  }

  async function handleSaveIncident() {
    if (!incidentForm.description?.trim() || !incidentForm.equipment_id) return
    setSavingIncident(true)
    try {
      const saved = await upsertBmsIncident({ ...incidentForm, id: selectedIncident?.id })
      setIncidents(prev => selectedIncident ? prev.map(i => i.id === selectedIncident.id ? saved : i) : [saved, ...prev])
      // Si la incidencia es de parada/alarma → actualizar status del equipo
      if (!selectedIncident && (incidentForm.incident_type === 'stopped' || incidentForm.incident_type === 'alarm')) {
        await quickStatusChange(incidentForm.equipment_id, incidentForm.incident_type === 'stopped' ? 'stopped' : 'alarm')
      }
      if (!selectedIncident && incidentForm.incident_type === 'on') {
        await quickStatusChange(incidentForm.equipment_id, 'ok')
      }
      if (!selectedIncident && incidentForm.incident_type === 'off') {
        await quickStatusChange(incidentForm.equipment_id, 'off')
      }
      if (!selectedIncident && incidentForm.incident_type === 'repair') {
        await quickStatusChange(incidentForm.equipment_id, 'repair')
      }
      setShowIncidentDialog(false)
      toast.success(selectedIncident ? 'Incidencia actualizada' : 'Incidencia registrada')
    } catch { toast.error('Error al guardar incidencia.') }
    finally { setSavingIncident(false) }
  }

  async function handleDeleteIncident(id: number) {
    const ok = await confirm({ title: 'Eliminar incidencia', message: '¿Eliminar esta incidencia BMS?' })
    if (!ok) return
    try {
      await deleteBmsIncident(id)
      setIncidents(prev => prev.filter(i => i.id !== id))
      toast.success('Incidencia eliminada')
    } catch { toast.error('No se pudo eliminar.') }
  }

  async function resolveIncident(inc: BmsIncident) {
    try {
      const saved = await upsertBmsIncident({ ...inc, status: 'resolved', resolved_at: new Date().toISOString() })
      setIncidents(prev => prev.map(i => i.id === inc.id ? saved : i))
      toast.success('Incidencia resuelta')
    } catch { toast.error('Error al resolver la incidencia.') }
  }

  if (loading) return <PageLoading rows={5} />

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Thermometer size={20} className="text-cyan-600" />
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">BMS / IndoorClima</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">{equipment.length} equipos · {openIncidents.length} incidencias abiertas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openCreateIncident()}>
            <Plus size={14} /> Incidencia
          </Button>
          <Button size="sm" onClick={openCreateEquip}>
            <Plus size={14} /> Equipo
          </Button>
        </div>
      </div>

      {/* Alertas activas */}
      {alarmEquip.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {alarmEquip.filter(e => e.status === 'alarm').length > 0 && `${alarmEquip.filter(e => e.status === 'alarm').length} equipo(s) en ALARMA`}
              {alarmEquip.filter(e => e.status === 'alarm').length > 0 && alarmEquip.filter(e => e.status === 'stopped').length > 0 && ' · '}
              {alarmEquip.filter(e => e.status === 'stopped').length > 0 && `${alarmEquip.filter(e => e.status === 'stopped').length} equipo(s) PARADO(S)`}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{alarmEquip.map(e => e.name).join(' · ')}</p>
          </div>
        </div>
      )}

      {/* KPIs de estado */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(Object.entries(STATUS_CFG) as [BmsEquipmentStatus, typeof STATUS_CFG[BmsEquipmentStatus]][]).map(([status, cfg]) => {
          const count = equipment.filter(e => e.status === status).length
          const active = filterStatus === status
          return (
            <button key={status} onClick={() => setFilterStatus(prev => prev === status ? '' : status)}
              className={cn('flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-center',
                active ? `ring-2 ring-offset-1 ${cfg.bg} ${cfg.color} border-transparent shadow-sm` : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
                count === 0 && 'opacity-40'
              )}>
              <div className={cn('flex items-center gap-1', cfg.color)}>{cfg.icon}</div>
              <div className={cn('text-lg font-bold', cfg.color)}>{count}</div>
              <div className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight">{cfg.label}</div>
            </button>
          )
        })}
      </div>

      {/* Tabs + filtro zona */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5">
          {[{ key: 'equipment', label: `Equipos (${equipment.length})` }, { key: 'incidents', label: `Incidencias (${openIncidents.length} abiertas)` }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as 'equipment' | 'incidents')}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeTab === t.key ? 'bg-white dark:bg-slate-600 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400')}>
              {t.label}
            </button>
          ))}
        </div>
        {activeTab === 'equipment' && zones.length > 0 && (
          <select className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
            value={filterZone} onChange={e => setFilterZone(e.target.value)}>
            <option value="">Todas las zonas</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        )}
      </div>

      {/* Vista equipos */}
      {activeTab === 'equipment' && (
        <div className="space-y-2">
          {filteredEquip.map(eq => {
            const cfg = STATUS_CFG[eq.status]
            const eqIncidents = incidents.filter(i => i.equipment_id === eq.id && i.status !== 'resolved')
            const isExpanded = expandedId === eq.id
            return (
              <div key={eq.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : eq.id)}>
                  {/* Status dot */}
                  <div className="relative shrink-0">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', cfg.bg, cfg.color)}>
                      <EquipIcon type={eq.equipment_type} size={18} />
                    </div>
                    <span className={cn('absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800', cfg.dot)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">{eq.name}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                      {eqIncidents.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 font-medium">
                          {eqIncidents.length} inc.
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      {EQUIP_TYPE_LABELS[eq.equipment_type]}
                      {eq.zone && ` · ${eq.zone}`}
                      {eq.floor && ` · ${eq.floor}`}
                      {eq.brand && ` · ${eq.brand}`}
                    </div>
                    {(eq.temperature_setpoint || eq.temperature_actual) && (
                      <div className="flex items-center gap-3 mt-0.5 text-[11px]">
                        {eq.temperature_setpoint && <span className="text-blue-600 dark:text-blue-400">Consigna: {eq.temperature_setpoint}°C</span>}
                        {eq.temperature_actual && <span className={cn('font-medium', Math.abs((eq.temperature_actual ?? 0) - (eq.temperature_setpoint ?? eq.temperature_actual ?? 0)) > 3 ? 'text-amber-600' : 'text-gray-600 dark:text-slate-400')}>Real: {eq.temperature_actual}°C</span>}
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); openCreateIncident(eq.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Registrar incidencia">
                      <AlertTriangle size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); openEditEquip(eq) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">
                      <Edit2 size={13} />
                    </button>
                    {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded: quick status + recent incidents */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-3 space-y-3 bg-gray-50 dark:bg-slate-700/40">
                    {/* Quick status buttons */}
                    <div>
                      <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 mb-1.5">Cambiar estado rápido:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.entries(STATUS_CFG) as [BmsEquipmentStatus, typeof STATUS_CFG[BmsEquipmentStatus]][]).map(([s, c]) => (
                          <button key={s} onClick={() => quickStatusChange(eq.id, s)}
                            className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                              eq.status === s ? `${c.bg} ${c.color} border-transparent shadow-sm` : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                            )}>
                            {c.icon} {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recent incidents for this equipment */}
                    {eqIncidents.length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 mb-1.5">Incidencias abiertas:</p>
                        <div className="space-y-1.5">
                          {eqIncidents.slice(0, 3).map(inc => (
                            <div key={inc.id} className="flex items-center gap-2 bg-white dark:bg-slate-700 rounded-lg p-2">
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', INCIDENT_STATUS_CLASSES[inc.status])}>
                                {INCIDENT_STATUS_LABELS[inc.status]}
                              </span>
                              <span className="text-xs text-gray-700 dark:text-slate-200 flex-1 truncate">{inc.description}</span>
                              <span className="text-[10px] text-gray-400">{formatDateShort(inc.created_at?.split('T')[0])}</span>
                              <button onClick={() => resolveIncident(inc)} title="Marcar resuelto"
                                className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                                <CheckCircle2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {eq.observations && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 italic">{eq.observations}</p>
                    )}
                    <button onClick={() => handleDeleteEquip(eq.id)}
                      className="text-[11px] text-red-500 hover:text-red-700 dark:text-red-400 flex items-center gap-1">
                      <Trash2 size={11} /> Dar de baja equipo
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {filteredEquip.length === 0 && <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">No hay equipos</div>}
        </div>
      )}

      {/* Vista incidencias */}
      {activeTab === 'incidents' && (
        <div className="space-y-2">
          {/* Filtro estado incidencia */}
          <div className="flex gap-2 flex-wrap">
            {(['open', 'in_progress', 'resolved'] as const).map(s => (
              <button key={s} onClick={() => {}}
                className={cn('text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
                  INCIDENT_STATUS_CLASSES[s], 'border-transparent')}>
                {INCIDENT_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                <tr>
                  {['Fecha', 'Equipo', 'Tipo', 'Descripción', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {incidents.map(inc => (
                  <tr key={inc.id} className={cn('hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors', inc.status === 'resolved' && 'opacity-60')}>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDateShort(inc.created_at?.split('T')[0])}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-slate-300 whitespace-nowrap">{inc.equipment?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-medium">
                        {INCIDENT_TYPE_LABELS[inc.incident_type]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-slate-200 max-w-[200px]">
                      <div className="truncate">{inc.description}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', INCIDENT_STATUS_CLASSES[inc.status])}>
                        {INCIDENT_STATUS_LABELS[inc.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {inc.status !== 'resolved' && (
                          <button onClick={() => resolveIncident(inc)} title="Resolver"
                            className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors">
                            <CheckCircle2 size={13} />
                          </button>
                        )}
                        <button onClick={() => openEditIncident(inc)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDeleteIncident(inc.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {incidents.length === 0 && <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">No hay incidencias</div>}
          </div>
        </div>
      )}

      {/* Dialog equipo */}
      <Dialog open={showEquipDialog} onClose={() => setShowEquipDialog(false)} title={selectedEquip ? 'Editar equipo' : 'Nuevo equipo'}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto">
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Nombre del equipo *</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Ej: UTA-01, Chiller planta baja..." value={equipForm.name || ''} onChange={e => setEquipForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={equipForm.equipment_type || 'ahu'} onChange={e => setEquipForm(f => ({ ...f, equipment_type: e.target.value as BmsEquipmentType }))}>
              {(Object.entries(EQUIP_TYPE_LABELS) as [BmsEquipmentType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Estado inicial</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={equipForm.status || 'ok'} onChange={e => setEquipForm(f => ({ ...f, status: e.target.value as BmsEquipmentStatus }))}>
              {(Object.entries(STATUS_CFG) as [BmsEquipmentStatus, typeof STATUS_CFG[BmsEquipmentStatus]][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Zona</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Ej: Planta baja, Sala técnica..." value={equipForm.zone || ''} onChange={e => setEquipForm(f => ({ ...f, zone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Planta / Ubicación</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Ej: P0, Cubierta..." value={equipForm.floor || ''} onChange={e => setEquipForm(f => ({ ...f, floor: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Marca</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Ej: Daikin, Trane..." value={equipForm.brand || ''} onChange={e => setEquipForm(f => ({ ...f, brand: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Modelo</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={equipForm.model || ''} onChange={e => setEquipForm(f => ({ ...f, model: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Temperatura consigna (°C)</label>
            <input type="number" step="0.5" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={equipForm.temperature_setpoint ?? ''} onChange={e => setEquipForm(f => ({ ...f, temperature_setpoint: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Temperatura real (°C)</label>
            <input type="number" step="0.1" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={equipForm.temperature_actual ?? ''} onChange={e => setEquipForm(f => ({ ...f, temperature_actual: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Observaciones</label>
            <textarea className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none dark:bg-slate-700 dark:text-white" rows={2}
              value={equipForm.observations || ''} onChange={e => setEquipForm(f => ({ ...f, observations: e.target.value }))} />
          </div>
          <div className="col-span-full flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button variant="outline" className="flex-1" onClick={() => setShowEquipDialog(false)} disabled={savingEquip}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSaveEquip} disabled={savingEquip || !equipForm.name?.trim()}>
              {savingEquip ? 'Guardando...' : 'Guardar equipo'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog incidencia */}
      <Dialog open={showIncidentDialog} onClose={() => setShowIncidentDialog(false)} title={selectedIncident ? 'Editar incidencia' : 'Nueva incidencia'}>
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Equipo afectado *</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={incidentForm.equipment_id || ''} onChange={e => setIncidentForm(f => ({ ...f, equipment_id: Number(e.target.value) }))}>
              <option value="">Seleccionar equipo...</option>
              {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}{eq.zone ? ` (${eq.zone})` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo</label>
              <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                value={incidentForm.incident_type || 'alarm'} onChange={e => setIncidentForm(f => ({ ...f, incident_type: e.target.value as BmsIncidentType }))}>
                {(Object.entries(INCIDENT_TYPE_LABELS) as [BmsIncidentType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
              <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                value={incidentForm.priority || 'medium'} onChange={e => setIncidentForm(f => ({ ...f, priority: e.target.value as BmsIncident['priority'] }))}>
                <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción *</label>
            <textarea className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none dark:bg-slate-700 dark:text-white" rows={3}
              placeholder="Describe la incidencia..." value={incidentForm.description || ''} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Temperatura (°C)</label>
              <input type="number" step="0.1" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                placeholder="Si aplica..." value={incidentForm.temperature_value ?? ''} onChange={e => setIncidentForm(f => ({ ...f, temperature_value: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Código de alarma</label>
              <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                placeholder="Ej: E01, F23..." value={incidentForm.alarm_code || ''} onChange={e => setIncidentForm(f => ({ ...f, alarm_code: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={incidentForm.status || 'open'} onChange={e => setIncidentForm(f => ({ ...f, status: e.target.value as BmsIncident['status'] }))}>
              <option value="open">Abierto</option><option value="in_progress">En curso</option><option value="resolved">Resuelto</option>
            </select>
          </div>
          {incidentForm.status === 'resolved' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Notas de resolución</label>
              <textarea className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none dark:bg-slate-700 dark:text-white" rows={2}
                value={incidentForm.resolution_notes || ''} onChange={e => setIncidentForm(f => ({ ...f, resolution_notes: e.target.value }))} />
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button variant="outline" className="flex-1" onClick={() => setShowIncidentDialog(false)} disabled={savingIncident}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSaveIncident} disabled={savingIncident || !incidentForm.description?.trim() || !incidentForm.equipment_id}>
              {savingIncident ? 'Guardando...' : 'Guardar incidencia'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
