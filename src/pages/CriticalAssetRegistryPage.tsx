import { useState, useEffect, useMemo } from 'react'
import {
  Boxes, Search, Lock, ShieldOff, FileDown, FileSpreadsheet,
  Wrench, AlertTriangle, Euro, Layers, CalendarClock, Clock,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import {
  getCriticalAssets, upsertCriticalAsset, getCriticalAssetRepairs, createCriticalAssetRepair,
  getCriticalAssetRepairsSummary, getCriticalRegistryPassphraseHash, setCriticalRegistryPassphrase,
  verifyCriticalRegistryPassphrase,
} from '@/lib/supabase'
import type { CriticalAsset, CriticalAssetRepair } from '@/types'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import { PageLoading } from '@/components/Skeleton'

const UNLOCK_KEY = 'critical_registry_unlocked'
const inputClass = 'w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Vida útil próxima a acabar (umbral: 2 años) ──────────────────────────────

const END_OF_LIFE_HORIZON_DAYS = 730

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

function isEndOfLifeSoon(dateStr?: string): boolean {
  const d = daysUntil(dateStr)
  return d !== null && d <= END_OF_LIFE_HORIZON_DAYS
}

function endOfLifeBadge(days: number | null) {
  if (days === null || days > END_OF_LIFE_HORIZON_DAYS) return null
  if (days < 0) return { label: `Vencido hace ${Math.abs(days)}d`, cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-bold' }
  if (days <= 180) return { label: `${days}d`, cls: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-bold' }
  if (days <= 365) return { label: `${days}d`, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' }
  return { label: `${days}d`, cls: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' }
}

// ─── Gate de acceso: permiso + contraseña adicional ───────────────────────────

function PassphraseGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [hash, setHash] = useState<string | null | undefined>(undefined)
  const [value, setValue] = useState('')
  const [confirmValue, setConfirmValue] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getCriticalRegistryPassphraseHash().then(setHash).catch(() => setHash(null))
  }, [])

  async function handleSetup() {
    setError('')
    if (value.length < 6) { setError('Usa al menos 6 caracteres.'); return }
    if (value !== confirmValue) { setError('Las dos contraseñas no coinciden.'); return }
    setSubmitting(true)
    try {
      await setCriticalRegistryPassphrase(value)
      sessionStorage.setItem(UNLOCK_KEY, '1')
      onUnlocked()
    } catch {
      setError('No se pudo guardar la contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnlock() {
    setError('')
    if (!hash) return
    setSubmitting(true)
    try {
      const ok = await verifyCriticalRegistryPassphrase(value, hash)
      if (ok) {
        sessionStorage.setItem(UNLOCK_KEY, '1')
        onUnlocked()
      } else {
        setError('Contraseña incorrecta.')
      }
    } catch {
      setError('Error al comprobar la contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  if (hash === undefined) return <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">Cargando...</div>

  const isSetup = hash === null

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-5">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          <Lock size={26} />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {isSetup ? 'Configura la contraseña de acceso' : 'Sección restringida'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {isSetup
              ? 'Es la primera vez que se abre el Registro de Activos. Elige una contraseña — solo tú y quien la conozca podréis entrar.'
              : 'Introduce la contraseña adicional de esta sección.'}
          </p>
        </div>
        <div className="space-y-2 text-left">
          <input
            type="password"
            className={inputClass}
            placeholder={isSetup ? 'Nueva contraseña (mín. 6 caracteres)' : 'Contraseña'}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (isSetup ? handleSetup() : handleUnlock())}
          />
          {isSetup && (
            <input
              type="password"
              className={inputClass}
              placeholder="Repite la contraseña"
              value={confirmValue}
              onChange={e => setConfirmValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetup()}
            />
          )}
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <Button className="w-full" onClick={isSetup ? handleSetup : handleUnlock} disabled={submitting || !value.trim()}>
          {submitting ? 'Comprobando...' : isSetup ? 'Guardar y entrar' : 'Entrar'}
        </Button>
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────

export default function CriticalAssetRegistryPage() {
  const { canViewAssetRegistry, worker } = useAuth()
  const toast = useToast()
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === '1')

  if (!canViewAssetRegistry) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-5 text-center gap-3">
        <ShieldOff size={32} className="text-gray-300 dark:text-slate-600" />
        <h2 className="text-base font-bold text-gray-900 dark:text-white">No autorizado</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs">
          No tienes permiso para ver esta sección.
        </p>
      </div>
    )
  }

  if (!unlocked) {
    return <PassphraseGate onUnlocked={() => setUnlocked(true)} />
  }

  return <RegistryContent workerId={worker?.id} />
}

// ─── Contenido (una vez desbloqueado) ─────────────────────────────────────────

function RegistryContent({ workerId }: { workerId?: number }) {
  const toast = useToast()
  const { data: assets, setData: setAssets, loading } = useRealtimeTable('critical_assets', getCriticalAssets)
  const [repairTotals, setRepairTotals] = useState<Map<number, number>>(new Map())

  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterCriticality, setFilterCriticality] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [kpiFilter, setKpiFilter] = useState('')

  const [selected, setSelected] = useState<CriticalAsset | null>(null)
  const [form, setForm] = useState<Partial<CriticalAsset>>({})
  const [saving, setSaving] = useState(false)
  const [repairs, setRepairs] = useState<CriticalAssetRepair[]>([])
  const [loadingRepairs, setLoadingRepairs] = useState(false)
  const [newRepair, setNewRepair] = useState({ date: todayIso(), description: '', material_cost: 0, labor_cost: 0 })
  const [savingRepair, setSavingRepair] = useState(false)

  useEffect(() => {
    getCriticalAssetRepairsSummary().then(rows => {
      const m = new Map<number, number>()
      for (const r of rows) m.set(r.asset_id, (m.get(r.asset_id) ?? 0) + Number(r.total_cost))
      setRepairTotals(m)
    })
  }, [])

  const classifications = useMemo(
    () => [...new Set(assets.map(a => a.classification_name).filter(Boolean))].sort() as string[],
    [assets]
  )
  const locations = useMemo(
    () => [...new Set(assets.map(a => a.location_description).filter(Boolean))].sort() as string[],
    [assets]
  )

  const totalReplacement = assets.reduce((s, a) => s + Number(a.replacement_cost || 0), 0)
  const totalRepairs = [...repairTotals.values()].reduce((s, v) => s + v, 0)
  const criticalCount = assets.filter(a => a.criticality === 1).length
  const endOfLifeCount = assets.filter(a => isEndOfLifeSoon(a.end_date)).length

  function toggleKpi(val: string) {
    setKpiFilter(prev => prev === val ? '' : val)
  }

  const filtered = assets.filter(a =>
    (!search ||
      a.asset_code.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
      a.location_description?.toLowerCase().includes(search.toLowerCase())
    ) &&
    (!filterClass || a.classification_name === filterClass) &&
    (!filterCriticality || String(a.criticality) === filterCriticality) &&
    (!filterLocation || a.location_description === filterLocation) &&
    (!kpiFilter || (
      kpiFilter === '_critical' ? a.criticality === 1 :
      kpiFilter === '_eol' ? isEndOfLifeSoon(a.end_date) :
      true
    ))
  )

  function openDetail(asset: CriticalAsset) {
    setSelected(asset)
    setForm({ ...asset })
    setNewRepair({ date: todayIso(), description: '', material_cost: 0, labor_cost: 0 })
    setLoadingRepairs(true)
    getCriticalAssetRepairs(asset.id).then(setRepairs).finally(() => setLoadingRepairs(false))
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      const saved = await upsertCriticalAsset({ ...form, id: selected.id })
      setAssets(prev => prev.map(a => a.id === saved.id ? saved : a))
      setSelected(saved)
      toast.success('Activo actualizado')
    } catch {
      toast.error('No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddRepair() {
    if (!selected || !newRepair.description.trim()) return
    setSavingRepair(true)
    try {
      const saved = await createCriticalAssetRepair({
        asset_id: selected.id,
        date: newRepair.date,
        description: newRepair.description,
        material_cost: newRepair.material_cost,
        labor_cost: newRepair.labor_cost,
        created_by_id: workerId,
      })
      setRepairs(prev => [saved, ...prev])
      setRepairTotals(prev => new Map(prev).set(selected.id, (prev.get(selected.id) ?? 0) + saved.total_cost))
      setNewRepair({ date: todayIso(), description: '', material_cost: 0, labor_cost: 0 })
      toast.success('Reparación registrada')
    } catch {
      toast.error('No se pudo guardar la reparación.')
    } finally {
      setSavingRepair(false)
    }
  }

  function exportCsv() {
    const header = ['Código', 'Descripción', 'Categoría', 'Ubicación', 'Criticidad', 'Coste reposición', 'Coste reparaciones', 'Fin vida útil', 'Estado', 'Fabricante', 'Modelo']
    const rows = filtered.map(a => [
      a.asset_code, a.description, a.classification_name ?? '', a.location_description ?? '',
      String(a.criticality ?? ''), String(a.replacement_cost), String(repairTotals.get(a.id) ?? 0),
      a.end_date ?? '', a.status ?? '', a.manufacturer ?? '', a.model ?? '',
    ])
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `registro-activos-${todayIso()}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFontSize(13)
    doc.text('Registro de Activos Críticos', 10, 12)
    doc.setFontSize(8)
    doc.text(`${filtered.length} activos · generado ${todayIso()}`, 10, 17)
    autoTable(doc, {
      startY: 22,
      head: [['Código', 'Descripción', 'Categoría', 'Ubicación', 'Crit.', 'Coste reposición', 'Coste reparaciones', 'Fin vida útil']],
      body: filtered.map(a => [
        a.asset_code, a.description, a.classification_name ?? '—', a.location_description ?? '—',
        a.criticality != null ? String(a.criticality) : '—',
        formatCurrency(a.replacement_cost), formatCurrency(repairTotals.get(a.id) ?? 0), formatDate(a.end_date),
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    })
    doc.save(`registro-activos-${todayIso()}.pdf`)
  }

  if (loading) return <PageLoading kpis={5} rows={6} />

  const selectedRepairTotal = selected ? (repairTotals.get(selected.id) ?? 0) : 0
  const repairRatio = selected && selected.replacement_cost > 0 ? selectedRepairTotal / selected.replacement_cost : null

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Boxes size={18} className="text-blue-600 dark:text-blue-400" />
            Registro de Activos
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Inventario real de la tienda (CAFM) · {assets.length} activos · acceso restringido
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}><FileSpreadsheet size={14} /> CSV</Button>
          <Button size="sm" variant="outline" onClick={exportPdf}><FileDown size={14} /> PDF</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Activos totales', value: assets.length, val: '', icon: Layers, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', ring: 'ring-blue-400' },
          { label: 'Críticos (nivel 1)', value: criticalCount, val: '_critical', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', ring: 'ring-red-400' },
          { label: 'Vida útil próxima (2 años)', value: endOfLifeCount, val: '_eol', icon: CalendarClock, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', ring: 'ring-orange-400' },
          { label: 'Coste de reposición', value: formatCurrency(totalReplacement), val: '', icon: Euro, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-400' },
          { label: 'Coste reparaciones', value: formatCurrency(totalRepairs), val: '', icon: Wrench, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', ring: 'ring-amber-400' },
        ].map(kpi => {
          const active = kpi.val && kpiFilter === kpi.val
          const clickable = !!kpi.val
          const Icon = kpi.icon
          const content = (
            <Card className={cn('transition-all', active && `ring-2 ${kpi.ring}`)}>
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <div className={cn('p-2 rounded-lg', kpi.bg, kpi.color)}><Icon size={16} /></div>
                  <div>
                    <div className={cn('text-lg font-bold', kpi.color)}>{kpi.value}</div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400">{kpi.label}</div>
                  </div>
                  {active && <span className="ml-auto text-[10px] font-medium text-white bg-gray-500 dark:bg-slate-600 rounded-full px-1.5 py-0.5">✕</span>}
                </div>
              </CardContent>
            </Card>
          )
          return clickable
            ? <button key={kpi.label} onClick={() => toggleKpi(kpi.val)} className="text-left focus:outline-none">{content}</button>
            : <div key={kpi.label}>{content}</div>
        })}
      </div>
      {kpiFilter && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <span>Mostrando:</span>
          <span className="font-semibold text-gray-800 dark:text-white">
            {kpiFilter === '_critical' ? 'Críticos (nivel 1)' : kpiFilter === '_eol' ? 'Vida útil próxima (2 años)' : ''}
          </span>
          <span className="text-gray-400">({filtered.length})</span>
          <button onClick={() => setKpiFilter('')} className="ml-1 text-blue-500 hover:underline">Ver todos</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar por código, descripción, fabricante o ubicación..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2">
          <select className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none sm:w-48" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
            <option value="">Todas las categorías</option>
            {classifications.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none sm:w-32" value={filterCriticality} onChange={e => setFilterCriticality(e.target.value)}>
            <option value="">Toda criticidad</option>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Nivel {n}</option>)}
          </select>
          <select className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none sm:w-48" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
            <option value="">Toda ubicación</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
            <tr>
              {['Código', 'Descripción', 'Categoría', 'Ubicación', 'Crit.', 'Coste reposición', 'Coste reparaciones', 'Fin vida útil'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.map(a => (
              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer" onClick={() => openDetail(a)}>
                <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap dark:text-slate-200">{a.asset_code}</td>
                <td className="px-3 py-2.5 text-xs max-w-[260px] truncate dark:text-slate-200">{a.description}</td>
                <td className="px-3 py-2.5 text-xs dark:text-slate-300">{a.classification_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs max-w-[220px] truncate dark:text-slate-300">{a.location_description ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs dark:text-slate-300">
                  {a.criticality != null && (
                    <span className={cn('px-1.5 py-0.5 rounded-full text-[11px] font-medium',
                      a.criticality === 1 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300')}>
                      {a.criticality}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap dark:text-slate-200">{formatCurrency(a.replacement_cost)}</td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap dark:text-slate-300">{formatCurrency(repairTotals.get(a.id) ?? 0)}</td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                  {(() => {
                    const days = daysUntil(a.end_date)
                    const badge = endOfLifeBadge(days)
                    return badge ? (
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] w-fit', badge.cls)}>
                        <Clock size={10} /> {badge.label}
                      </span>
                    ) : a.end_date ? (
                      <span className="text-xs text-gray-400 dark:text-slate-500">{formatDate(a.end_date)}</span>
                    ) : '—'
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">Sin resultados para estos filtros.</div>}
      </div>

      {/* Dialog de detalle */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.asset_code} · ${selected.description}` : ''} size="xl">
        {selected && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Descripción</label>
                <input className={inputClass} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Categoría</label>
                <input className={inputClass} value={form.classification_name || ''} onChange={e => setForm(f => ({ ...f, classification_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Coste reposición (€)</label>
                <input type="number" min="0" step="0.01" className={inputClass} value={form.replacement_cost ?? 0} onChange={e => setForm(f => ({ ...f, replacement_cost: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={labelClass}>Criticidad (1-5)</label>
                <input type="number" min="1" max="5" className={inputClass} value={form.criticality ?? ''} onChange={e => setForm(f => ({ ...f, criticality: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div>
                <label className={labelClass}>Condición (1-5)</label>
                <input type="number" min="1" max="5" className={inputClass} value={form.condition ?? ''} onChange={e => setForm(f => ({ ...f, condition: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                <input className={inputClass} value={form.status || ''} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Fabricante</label>
                <input className={inputClass} value={form.manufacturer || ''} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Modelo</label>
                <input className={inputClass} value={form.model || ''} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Fecha instalación</label>
                <input type="date" className={inputClass} value={form.installation_date || ''} onChange={e => setForm(f => ({ ...f, installation_date: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Fecha fin de vida (CAFM)</label>
                <input type="date" className={inputClass} value={form.end_date || ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Información adicional 1</label>
                <input className={inputClass} value={form.additional_info_1 || ''} onChange={e => setForm(f => ({ ...f, additional_info_1: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Información adicional 2</label>
                <input className={inputClass} value={form.additional_info_2 || ''} onChange={e => setForm(f => ({ ...f, additional_info_2: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Información adicional 3</label>
                <input className={inputClass} value={form.additional_info_3 || ''} onChange={e => setForm(f => ({ ...f, additional_info_3: e.target.value }))} />
              </div>
            </div>
            <div className="text-xs text-gray-400 dark:text-slate-500 border-t border-gray-100 dark:border-slate-700 pt-2">
              Ubicación: {selected.location_description ?? '—'} ({selected.location_code ?? '—'})
              {selected.parent_asset_code && ` · Activo padre: ${selected.parent_asset_code}`}
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>

            {/* Reparar vs cambiar */}
            {repairRatio !== null && (
              <div className={cn('rounded-lg px-3 py-2.5 text-xs border',
                repairRatio >= 0.5
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                  : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300')}>
                Reparaciones acumuladas: {formatCurrency(selectedRepairTotal)} ({Math.round(repairRatio * 100)}% del coste de reposición)
                {repairRatio >= 0.5 && ' — valora si compensa más cambiarlo que seguir reparándolo.'}
              </div>
            )}

            {/* Historial de reparaciones */}
            <div className="border-t border-gray-100 dark:border-slate-700 pt-4 space-y-3">
              <p className={labelClass}>Historial de reparaciones</p>
              {loadingRepairs ? (
                <p className="text-xs text-gray-400 dark:text-slate-500">Cargando...</p>
              ) : repairs.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-slate-500">Todavía no hay reparaciones registradas.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {repairs.map(r => (
                    <div key={r.id} className="border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{formatDate(r.date)}</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-slate-100">{formatCurrency(r.total_cost)}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">{r.description}</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                        Material: {formatCurrency(r.material_cost)} · Mano de obra: {formatCurrency(r.labor_cost)}
                        {r.created_by && ` · ${r.created_by.name}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Fecha</label>
                  <input type="date" className={inputClass} value={newRepair.date} max={todayIso()} onChange={e => setNewRepair(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Descripción *</label>
                  <input className={inputClass} placeholder="Ej: sustitución de motor" value={newRepair.description} onChange={e => setNewRepair(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Coste material (€)</label>
                  <input type="number" min="0" step="0.01" className={inputClass} value={newRepair.material_cost} onChange={e => setNewRepair(f => ({ ...f, material_cost: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelClass}>Coste mano de obra (€)</label>
                  <input type="number" min="0" step="0.01" className={inputClass} value={newRepair.labor_cost} onChange={e => setNewRepair(f => ({ ...f, labor_cost: Number(e.target.value) }))} />
                </div>
              </div>
              <Button size="sm" onClick={handleAddRepair} disabled={savingRepair || !newRepair.description.trim()}>
                {savingRepair ? 'Guardando...' : 'Añadir reparación'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
