import { useState, useEffect } from 'react'
import { Lock, Plus, Trash2, FileDown, FileSpreadsheet, Boxes, Euro, Wrench, ListChecks } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import {
  getAreas, getTasks, upsertTask, getRepairs,
  getLogisticaConfig, upsertLogisticaConfig,
  getLogisticaAssets, addLogisticaAsset, removeLogisticaAsset,
  getLinkedRecordsForAsset,
} from '@/lib/supabase'
import type { LinkedAssetRecord } from '@/lib/supabase'
import type { Area, Task, TaskStatus, LogisticaAsset } from '@/types'
import { PageLoading } from '@/components/Skeleton'
import CriticalAssetPicker from '@/components/CriticalAssetPicker'
import { cn, formatCurrency, formatDateShort, todayIso, sanitizeFileName, STATUS_LABELS, STATUS_CLASSES } from '@/lib/utils'

const inputClass = 'w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'
const STATUS_ORDER: TaskStatus[] = ['pending', 'inprogress', 'blocked', 'done', 'cancelled']

export default function LogisticaPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { worker } = useAuth()

  // Privacidad solo de interfaz: la RLS de Supabase sigue abierta (igual que
  // el resto de la app), esto solo bloquea la vista si no eres tú.
  const isManuel = (worker?.name ?? '').toLowerCase().includes('manuel honrado')

  const [areas, setAreas] = useState<Area[]>([])
  const [trackedAreaIds, setTrackedAreaIds] = useState<number[]>([])
  const [savingConfig, setSavingConfig] = useState(false)
  const { data: allTasks, setData: setAllTasks, loading: loadingTasks } = useRealtimeTable('tasks', () => getTasks())
  const { data: allRepairs, loading: loadingRepairs } = useRealtimeTable('general_repairs', getRepairs)
  const [logisticaAssets, setLogisticaAssets] = useState<LogisticaAsset[]>([])
  const [pickerAssetId, setPickerAssetId] = useState<number | undefined>()
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [assetHistory, setAssetHistory] = useState<Record<number, LinkedAssetRecord[]>>({})

  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [taskForm, setTaskForm] = useState<Partial<Task>>({})
  const [savingTask, setSavingTask] = useState(false)

  useEffect(() => {
    if (!isManuel) return
    Promise.all([getAreas(), getLogisticaConfig(), getLogisticaAssets()]).then(([a, cfg, assets]) => {
      setAreas(a)
      setTrackedAreaIds(cfg.tracked_area_ids)
      setLogisticaAssets(assets)
      setLoadingInitial(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManuel])

  useEffect(() => {
    logisticaAssets.forEach(la => {
      if (assetHistory[la.critical_asset_id] !== undefined) return
      getLinkedRecordsForAsset(la.critical_asset_id).then(records => {
        setAssetHistory(prev => ({ ...prev, [la.critical_asset_id]: records }))
      }).catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logisticaAssets])

  if (!isManuel) {
    return (
      <div className="p-5">
        <Card>
          <CardContent className="text-center py-14">
            <Lock size={28} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-slate-400">Este apartado es privado.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const watchedAssetIds = new Set(logisticaAssets.map(a => a.critical_asset_id))
  const trackedTasks = allTasks.filter(t => t.area_id != null && trackedAreaIds.includes(t.area_id))
  const trackedRepairs = allRepairs.filter(r =>
    (r.area_id != null && trackedAreaIds.includes(r.area_id)) ||
    (r.critical_asset_id != null && watchedAssetIds.has(r.critical_asset_id))
  )
  const totalRepairsCost = trackedRepairs.reduce((sum, r) => sum + (r.total_cost || 0), 0)
  const pendingTasksCount = trackedTasks.filter(t => !['done', 'cancelled'].includes(t.status)).length

  async function toggleTrackedArea(areaId: number) {
    const next = trackedAreaIds.includes(areaId) ? trackedAreaIds.filter(id => id !== areaId) : [...trackedAreaIds, areaId]
    setTrackedAreaIds(next)
    setSavingConfig(true)
    try {
      await upsertLogisticaConfig(next)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la configuración')
    } finally {
      setSavingConfig(false)
    }
  }

  function openNewTask() {
    setTaskForm({
      title: '',
      date: todayIso(),
      event_type: 'task',
      priority: 'medium',
      status: 'pending',
      area_id: trackedAreaIds[0],
      is_personal: false,
    })
    setShowTaskDialog(true)
  }

  async function handleSaveTask() {
    if (!taskForm.title?.trim()) { toast.error('Ponle un título a la tarea'); return }
    if (!taskForm.area_id) { toast.error('Marca al menos un área de Logística arriba y selecciónala aquí'); return }
    setSavingTask(true)
    try {
      const saved = await upsertTask(taskForm)
      setAllTasks(prev => [...prev, saved])
      toast.success('Tarea creada')
      setShowTaskDialog(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear la tarea')
    } finally {
      setSavingTask(false)
    }
  }

  async function handleQuickStatus(task: Task, status: TaskStatus) {
    if (task.status === status) return
    try {
      const saved = await upsertTask({ ...task, status })
      setAllTasks(prev => prev.map(t => t.id === saved.id ? saved : t))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cambiar el estado')
    }
  }

  async function handleAddAsset() {
    if (!pickerAssetId) return
    try {
      const added = await addLogisticaAsset(pickerAssetId, worker?.id)
      setLogisticaAssets(prev => [added, ...prev])
      setPickerAssetId(undefined)
      toast.success('Activo añadido a Logística')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al añadir el activo (¿ya estaba añadido?)')
    }
  }

  async function handleRemoveAsset(la: LogisticaAsset) {
    const ok = await confirm({ title: 'Quitar activo', message: `¿Quitar "${la.asset?.description ?? la.critical_asset_id}" de Logística?` })
    if (!ok) return
    try {
      await removeLogisticaAsset(la.id)
      setLogisticaAssets(prev => prev.filter(a => a.id !== la.id))
      toast.success('Activo quitado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al quitar el activo')
    }
  }

  function exportCsv() {
    const header = ['Fecha', 'Área', 'Descripción', 'Coste material', 'Coste mano de obra', 'Coste total']
    const rows = trackedRepairs.map(r => [formatDateShort(r.request_date), r.area ?? '—', r.description, r.material_cost, r.labor_cost, r.total_cost])
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logistica-gastos-${todayIso()}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFontSize(13)
    doc.text('Informe económico — Logística', 10, 12)
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')} · ${trackedRepairs.length} reparación(es) · Coste total: ${formatCurrency(totalRepairsCost)}`, 10, 17)
    autoTable(doc, {
      startY: 22,
      head: [['Fecha', 'Área', 'Descripción', 'Material', 'Mano de obra', 'Total']],
      body: trackedRepairs.map(r => [formatDateShort(r.request_date), r.area ?? '—', r.description, formatCurrency(r.material_cost), formatCurrency(r.labor_cost), formatCurrency(r.total_cost)]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })
    doc.save(`logistica-informe-${sanitizeFileName(todayIso())}.pdf`)
  }

  if (loadingInitial || loadingTasks || loadingRepairs) return <PageLoading rows={6} />

  return (
    <div className="p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Lock size={16} className="text-blue-600 dark:text-blue-400" />
          Logística <span className="text-xs font-normal text-gray-400 dark:text-slate-500">(privado)</span>
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          Tareas, gastos y activos vigilados. Solo tú ves este apartado.
        </p>
      </div>

      <Card>
        <CardContent>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
            Áreas que cuentan como Logística (cualquier tarea o reparación marcada con estas áreas en los módulos compartidos aparece aquí)
          </p>
          <div className="flex flex-wrap gap-2">
            {areas.length === 0 && <p className="text-xs text-gray-400">No hay áreas creadas todavía (Configuración → Áreas).</p>}
            {areas.map(a => (
              <button
                key={a.id}
                onClick={() => toggleTrackedArea(a.id)}
                disabled={savingConfig}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full border',
                  trackedAreaIds.includes(a.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'
                )}
              >
                {a.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="py-3">
          <div className="flex items-center gap-2"><Euro size={16} className="text-emerald-600" /><div className="text-lg font-bold text-gray-800 dark:text-slate-100">{formatCurrency(totalRepairsCost)}</div></div>
          <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">Coste total reparaciones</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="flex items-center gap-2"><Wrench size={16} className="text-amber-600" /><div className="text-lg font-bold text-gray-800 dark:text-slate-100">{trackedRepairs.length}</div></div>
          <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">Reparaciones registradas</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="flex items-center gap-2"><ListChecks size={16} className="text-blue-600" /><div className="text-lg font-bold text-gray-800 dark:text-slate-100">{pendingTasksCount}</div></div>
          <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">Tareas pendientes</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="flex items-center gap-2"><Boxes size={16} className="text-violet-600" /><div className="text-lg font-bold text-gray-800 dark:text-slate-100">{logisticaAssets.length}</div></div>
          <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">Activos vigilados</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Tareas</p>
            <Button size="sm" variant="outline" onClick={openNewTask}><Plus size={13} /> Nueva tarea</Button>
          </div>
          {trackedTasks.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Sin tareas marcadas como Logística todavía.</p>
          ) : (
            <div className="space-y-1.5">
              {trackedTasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{task.title}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{formatDateShort(task.date)} · {task.area ?? '—'}</p>
                  </div>
                  <select
                    className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 dark:bg-slate-700 dark:text-slate-200"
                    value={task.status}
                    onChange={e => handleQuickStatus(task, e.target.value as TaskStatus)}
                  >
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Gastos / reparaciones</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportCsv}><FileSpreadsheet size={13} /> CSV</Button>
              <Button size="sm" variant="outline" onClick={exportPdf}><FileDown size={13} /> PDF</Button>
            </div>
          </div>
          {trackedRepairs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Sin reparaciones vinculadas todavía.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {trackedRepairs.map(r => (
                <div key={r.id} className="border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300">{formatDateShort(r.request_date)} · {r.area ?? '—'}</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{formatCurrency(r.total_cost)}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">{r.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-2">Activos vigilados</p>
          <div className="flex gap-2 mb-3">
            <div className="flex-1"><CriticalAssetPicker value={pickerAssetId} onChange={setPickerAssetId} /></div>
            <Button size="sm" onClick={handleAddAsset} disabled={!pickerAssetId}><Plus size={13} /> Añadir</Button>
          </div>
          {logisticaAssets.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No estás vigilando ningún activo todavía.</p>
          ) : (
            <div className="space-y-2">
              {logisticaAssets.map(la => {
                const history = assetHistory[la.critical_asset_id] ?? []
                const historyCost = history.reduce((s, r) => s + r.cost, 0)
                return (
                  <div key={la.id} className="border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">
                          {la.asset ? `${la.asset.asset_code} · ${la.asset.description}` : `Activo #${la.critical_asset_id}`}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {history.length} avería(s) registrada(s) · {formatCurrency(historyCost)}
                        </p>
                      </div>
                      <button onClick={() => handleRemoveAsset(la)} className="p-1.5 text-gray-400 hover:text-red-600 shrink-0"><Trash2 size={13} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTaskDialog} onClose={() => setShowTaskDialog(false)} title="Nueva tarea de Logística" size="sm">
        <div className="p-5 space-y-3">
          <div>
            <label className={labelClass}>Título *</label>
            <input className={inputClass} value={taskForm.title || ''} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Fecha</label>
            <input type="date" className={inputClass} value={taskForm.date || todayIso()} onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Área (Logística)</label>
            <select className={inputClass} value={taskForm.area_id || ''} onChange={e => setTaskForm(f => ({ ...f, area_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Selecciona un área marcada arriba</option>
              {areas.filter(a => trackedAreaIds.includes(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={inputClass} rows={2} value={taskForm.notes || ''} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowTaskDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveTask} disabled={savingTask}>{savingTask ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
