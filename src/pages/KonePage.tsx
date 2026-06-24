import { useState, useEffect, useCallback } from 'react'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Plus, Trash2, Edit2, Search, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import {
  getKoneIncidents, upsertKoneIncident, deleteKoneIncident,
  getWorkers, getKoneMonthlyChecks, upsertKoneMonthlyCheck, deleteKoneMonthlyCheck,
} from '@/lib/supabase'
import type { KoneIncident, KoneMonthlyCheck, TeamMember } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, formatCurrency, formatDateShort, todayIso } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

// ─── Equipment catalog ────────────────────────────────────────────────────────

const EQUIPMENT_GROUPS = [
  {
    type: 'elevator' as const,
    label: 'Ascensores',
    headerCls: 'bg-blue-600',
    items: ['ASC1','ASC2','ASC3','ASC4','ASC5','ASC6','ASC7','ASC8','ASC9','ASC10'],
  },
  {
    type: 'travelator' as const,
    label: 'Travelators',
    headerCls: 'bg-purple-600',
    items: ['T1','T2','T3','T4'],
  },
  {
    type: 'escalator' as const,
    label: 'Escaleras Mecánicas',
    headerCls: 'bg-orange-500',
    items: ['ESCM1','ESCM2','ESCM3'],
  },
  {
    type: 'montacargas' as const,
    label: 'Montacargas',
    headerCls: 'bg-emerald-600',
    items: ['M01','M02','M03','M04','M05','M06'],
  },
]

const ALL_EQUIPMENT_IDS = EQUIPMENT_GROUPS.flatMap(g => g.items)
const TOTAL = ALL_EQUIPMENT_IDS.length // 23

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type Tab = 'revisiones' | 'incidencias'

// ─── Equipment card ───────────────────────────────────────────────────────────

function EquipCard({
  equipId, check, saving, onCycle,
}: {
  equipId: string
  check?: KoneMonthlyCheck
  saving: boolean
  onCycle: () => void
}) {
  const status = check?.status

  const cardCls = status === 'ok'
    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
    : status === 'averia'
    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600'

  return (
    <button
      onClick={onCycle}
      disabled={saving}
      title={status === 'ok' ? 'OK → marcar avería' : status === 'averia' ? 'Avería → limpiar' : 'Sin revisar → marcar OK'}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 transition-all',
        'min-h-[52px] p-1.5 sm:p-2',
        'hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-wait',
        cardCls,
      )}
    >
      {saving && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70 rounded-xl">
          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <span className="text-[10px] sm:text-xs font-bold text-gray-800 dark:text-white leading-none text-center">{equipId}</span>
      {status === 'ok' && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
      {status === 'averia' && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
      {!status && <div className="w-3 h-0.5 bg-gray-300 dark:bg-slate-500 rounded-full" />}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KonePage() {
  const { worker } = useAuth()
  const [tab, setTab] = useState<Tab>('revisiones')

  // ── Monthly checks state ────────────────────────────────────────────────
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [monthlyChecks, setMonthlyChecks] = useState<KoneMonthlyCheck[]>([])
  const [checksLoading, setChecksLoading] = useState(true)
  const [savingEquip, setSavingEquip] = useState<string | null>(null)

  // ── Incidents state ──────────────────────────────────────────────────────
  const toast = useToast()
  const confirm = useConfirm()
  const { data: incidents, setData: setIncidents, loading } = useRealtimeTable('kone_incidents', getKoneIncidents)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<KoneIncident | null>(null)
  const [form, setForm] = useState<Partial<KoneIncident>>({ status: 'pending', priority: 'medium', part_cost: 0, labor_cost: 0 })
  const [saving, setSaving] = useState(false)

  // Initial loads
  useEffect(() => {
    getWorkers().then(setWorkers)
  }, [])

  const loadMonthlyChecks = useCallback(async () => {
    setChecksLoading(true)
    try {
      const checks = await getKoneMonthlyChecks(year, month)
      setMonthlyChecks(checks)
    } catch { /* ignore */ } finally {
      setChecksLoading(false)
    }
  }, [year, month])

  useEffect(() => { loadMonthlyChecks() }, [loadMonthlyChecks])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  function getCheck(equipId: string) {
    return monthlyChecks.find(c => c.equipment_id === equipId)
  }

  async function cycleStatus(equipId: string, equipType: string) {
    if (savingEquip) return
    setSavingEquip(equipId)
    const current = getCheck(equipId)
    try {
      if (!current) {
        const saved = await upsertKoneMonthlyCheck(year, month, equipId, equipType, 'ok', undefined, worker?.id)
        setMonthlyChecks(prev => [...prev.filter(c => c.equipment_id !== equipId), saved])
      } else if (current.status === 'ok') {
        const saved = await upsertKoneMonthlyCheck(year, month, equipId, equipType, 'averia', current.notes, worker?.id)
        setMonthlyChecks(prev => prev.map(c => c.equipment_id === equipId ? saved : c))
      } else {
        await deleteKoneMonthlyCheck(current.id)
        setMonthlyChecks(prev => prev.filter(c => c.equipment_id !== equipId))
      }
    } catch { toast.error('Error al guardar el estado.') } finally {
      setSavingEquip(null)
    }
  }

  // Stats
  const okCount = monthlyChecks.filter(c => c.status === 'ok').length
  const averiaCount = monthlyChecks.filter(c => c.status === 'averia').length
  const pendingCount = TOTAL - monthlyChecks.length

  // Incidents CRUD
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
  function openEdit(i: KoneIncident) { setSelected(i); setForm({ ...i }); setShowDialog(true) }

  async function handleSave() {
    if (!form.elevator?.trim() || !form.description?.trim()) return
    setSaving(true)
    try {
      const saved = await upsertKoneIncident(selected ? { ...form, id: selected.id } : form)
      const withRelations = { ...saved, internal_responsible: workers.find(w => w.id === saved.internal_responsible_id) }
      setIncidents(prev => selected ? prev.map(i => i.id === selected.id ? withRelations : i) : [withRelations, ...prev])
      setShowDialog(false)
      toast.success(selected ? 'Incidencia actualizada' : 'Incidencia creada')
    } catch { toast.error('Error al guardar.') } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    const ok = await confirm({ title: 'Eliminar incidencia', message: '¿Eliminar esta incidencia KONE?' })
    if (!ok) return
    try {
      await deleteKoneIncident(id)
      setIncidents(prev => prev.filter(i => i.id !== id))
      toast.success('Incidencia eliminada')
    } catch { toast.error('No se pudo eliminar.') }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">🏗️ KONE / Ascensores</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {incidents.length} incidencias · Coste total: {formatCurrency(totalCost)}
          </p>
        </div>
        {tab === 'incidencias' && (
          <Button size="sm" onClick={openCreate}><Plus size={14} />Nueva incidencia</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
        {([
          ['revisiones', '📋', 'Revisiones', 'Revisiones mensuales'],
          ['incidencias', '⚠️', 'Incidencias', 'Incidencias'],
        ] as [Tab, string, string, string][]).map(([t, icon, shortLabel, fullLabel]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium rounded-lg transition-all truncate',
              tab === t
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            )}
          >
            <span className="sm:hidden">{icon} {shortLabel}</span>
            <span className="hidden sm:inline">{icon} {fullLabel}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: REVISIONES MENSUALES ─────────────────────────────────────── */}
      {tab === 'revisiones' && (
        <div className="space-y-4">
          {/* Month navigator */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3 shadow-sm">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              <ChevronLeft size={18} className="text-gray-500 dark:text-slate-400" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-800 dark:text-white">{MONTH_NAMES[month - 1]} {year}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">Revisiones y averías</p>
            </div>
            <button
              onClick={nextMonth}
              disabled={year === now.getFullYear() && month === now.getMonth() + 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30"
            >
              <ChevronRight size={18} className="text-gray-500 dark:text-slate-400" />
            </button>
          </div>

          {/* KPI bar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{okCount}</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Revisados OK</p>
            </div>
            <div className={cn('border rounded-xl p-3 text-center', averiaCount > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700')}>
              <p className={cn('text-2xl font-bold', averiaCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-slate-500')}>{averiaCount}</p>
              <p className={cn('text-[11px] font-medium', averiaCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-400 dark:text-slate-500')}>Con avería</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-400 dark:text-slate-500">{pendingCount}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">Sin revisar</p>
            </div>
          </div>

          {/* Instructions */}
          <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
            Toca un equipo para marcar: <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ OK</span> → <span className="text-red-600 dark:text-red-400 font-medium">⚠ Avería</span> → Sin revisar
          </p>

          {/* Equipment grid by group */}
          {checksLoading ? (
            <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">Cargando...</div>
          ) : (
            EQUIPMENT_GROUPS.map(group => (
              <div key={group.type} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className={cn('px-4 py-2 flex items-center justify-between', group.headerCls)}>
                  <p className="text-sm font-bold text-white">{group.label}</p>
                  <div className="flex gap-2 text-xs text-white/80">
                    <span>✓ {group.items.filter(id => getCheck(id)?.status === 'ok').length}</span>
                    {group.items.some(id => getCheck(id)?.status === 'averia') && (
                      <span className="text-red-200">⚠ {group.items.filter(id => getCheck(id)?.status === 'averia').length}</span>
                    )}
                  </div>
                </div>
                <div className={cn(
                  'p-3 grid gap-2',
                  group.items.length >= 8 ? 'grid-cols-5'
                  : group.items.length === 6 ? 'grid-cols-3 sm:grid-cols-6'
                  : group.items.length >= 4 ? 'grid-cols-4'
                  : 'grid-cols-3'
                )}>
                  {group.items.map(equipId => (
                    <EquipCard
                      key={equipId}
                      equipId={equipId}
                      check={getCheck(equipId)}
                      saving={savingEquip === equipId}
                      onCycle={() => cycleStatus(equipId, group.type)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: INCIDENCIAS ─────────────────────────────────────────────────── */}
      {tab === 'incidencias' && (
        <div className="space-y-4">
          {/* Search & filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Buscar por equipo o descripción..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 dark:text-white focus:outline-none sm:w-44"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">Cargando incidencias...</div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                  <tr>
                    {['Fecha','Equipo','Tipo','Descripción','Responsable','Coste','Estado','Acciones'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {filtered.map(inc => (
                    <tr key={inc.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap text-gray-600 dark:text-slate-300">{formatDateShort(inc.date)}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-800 dark:text-white">{inc.elevator}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-slate-400">{inc.incident_type}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[160px]"><div className="truncate text-gray-700 dark:text-slate-300">{inc.description}</div></td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-slate-300">{inc.internal_responsible?.name?.split(' ')[0] || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap text-gray-800 dark:text-white">{formatCurrency(inc.total_cost)}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap', STATUS_CLASSES[inc.status])}>{STATUS_LABELS[inc.status]}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(inc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"><Edit2 size={13} /></button>
                          <button onClick={() => handleDelete(inc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">No hay incidencias</div>}
            </div>
          )}
        </div>
      )}

      {/* ── Dialog: Nueva / Editar incidencia ───────────────────────────────── */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar incidencia KONE' : 'Nueva incidencia KONE'}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha</label>
            <input type="date" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.date || todayIso()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Equipo *</label>
            <select
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.elevator || ''}
              onChange={e => setForm(f => ({ ...f, elevator: e.target.value }))}
            >
              <option value="">Selecciona equipo...</option>
              {EQUIPMENT_GROUPS.map(g => (
                <optgroup key={g.type} label={g.label}>
                  {g.items.map(id => <option key={id} value={id}>{id}</option>)}
                </optgroup>
              ))}
              <optgroup label="Otro">
                <option value="Otro">Otro (escribir abajo)</option>
              </optgroup>
            </select>
            {form.elevator === 'Otro' && (
              <input
                className="w-full mt-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                placeholder="Especificar equipo..."
                onChange={e => setForm(f => ({ ...f, elevator: e.target.value }))}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo de incidencia</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Avería, Revisión, Parada..." value={form.incident_type || ''} onChange={e => setForm(f => ({ ...f, incident_type: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Responsable interno</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.internal_responsible_id || ''} onChange={e => setForm(f => ({ ...f, internal_responsible_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin asignar</option>
              {workers.filter(w => w.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Empresa externa (KONE)</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.external_company || ''} onChange={e => setForm(f => ({ ...f, external_company: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Pieza sustituida</label>
            <input className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.replaced_part || ''} onChange={e => setForm(f => ({ ...f, replaced_part: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Coste piezas (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.part_cost || 0} onChange={e => setForm(f => { const p = Number(e.target.value); return { ...f, part_cost: p, total_cost: p + (f.labor_cost || 0) } })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Coste mano obra (€)</label>
            <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.labor_cost || 0} onChange={e => setForm(f => { const l = Number(e.target.value); return { ...f, labor_cost: l, total_cost: (f.part_cost || 0) + l } })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.priority || 'medium'} onChange={e => setForm(f => ({ ...f, priority: e.target.value as KoneIncident['priority'] }))}>
              <option value="low">Baja</option><option value="medium">Media</option>
              <option value="high">Alta</option><option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.status || 'pending'} onChange={e => setForm(f => ({ ...f, status: e.target.value as KoneIncident['status'] }))}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción *</label>
            <textarea className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none dark:bg-slate-700 dark:text-white" rows={3}
              value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="col-span-full flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
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

