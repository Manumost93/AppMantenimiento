import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, AlertCircle, CheckCircle2, FileDown, Users, Building2, Wrench } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getTasks, getRepairs, getKoneIncidents, getWorkers, getCominIonJobs } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { Task, GeneralRepair, KoneIncident, TeamMember, CominIonJob } from '@/types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type DateRange = 'month' | '3months' | 'year' | 'all'

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  month: 'Este mes',
  '3months': 'Últimos 3 meses',
  year: 'Este año',
  all: 'Histórico',
}

function cutoffDate(range: DateRange): Date | null {
  const now = new Date()
  if (range === 'all') return null
  const d = new Date(now)
  if (range === 'month') d.setMonth(d.getMonth() - 1)
  else if (range === '3months') d.setMonth(d.getMonth() - 3)
  else if (range === 'year') d.setFullYear(d.getFullYear() - 1)
  return d
}

function filterByRange<T>(items: T[], getDate: (i: T) => string, range: DateRange): T[] {
  const cutoff = cutoffDate(range)
  if (!cutoff) return items
  return items.filter(i => new Date(getDate(i)) >= cutoff)
}

// ─── PDF helpers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reportHeader(doc: jsPDF, title: string, subtitle: string) {
  const pw = doc.internal.pageSize.getWidth()
  doc.setFillColor(0, 0, 0); doc.rect(0, 0, pw, 18, 'F')
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, 30, 18, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0, 0, 0)
  doc.text('IKEA', 3, 11); doc.setFontSize(6); doc.text('ALCORCÓN', 3, 16)
  doc.setTextColor(255, 255, 255); doc.setFontSize(12)
  doc.text(title, pw / 2, 10, { align: 'center' })
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(subtitle, pw / 2, 16, { align: 'center' })
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  doc.setFontSize(7); doc.setTextColor(200, 200, 200)
  doc.text(`Generado: ${today}`, pw - 4, 16, { align: 'right' })
}

function downloadCostesReport(repairs: GeneralRepair[], kone: KoneIncident[], comin: CominIonJob[], range: DateRange) {
  const rF = filterByRange(repairs, r => r.request_date || r.created_at, range)
  const kF = filterByRange(kone, k => k.date || k.created_at, range)
  const cF = filterByRange(comin, c => c.date || c.created_at, range)

  // Group repairs by area
  const byArea = rF.reduce((acc, r) => {
    const area = r.area || 'Sin sección'
    if (!acc[area]) acc[area] = { count: 0, material: 0, labor: 0, total: 0 }
    acc[area].count++
    acc[area].material += r.material_cost || 0
    acc[area].labor += r.labor_cost || 0
    acc[area].total += r.total_cost || 0
    return acc
  }, {} as Record<string, { count: number; material: number; labor: number; total: number }>)

  const koneTotal = kF.reduce((s, k) => s + (k.total_cost || 0), 0)
  const cominTotal = cF.reduce((s, c) => s + (c.real_cost || 0), 0)
  const grandTotal = Object.values(byArea).reduce((s, a) => s + a.total, 0) + koneTotal + cominTotal

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  reportHeader(doc, 'INFORME DE COSTES POR SECCIÓN', DATE_RANGE_LABELS[range])

  // Repairs by area
  autoTable(doc, {
    startY: 22,
    head: [['SECCIÓN', 'Nº Reparaciones', 'Coste material', 'Coste mano obra', 'Total sección']],
    body: [
      ...Object.entries(byArea).sort((a, b) => b[1].total - a[1].total).map(([area, v]) => [
        area,
        String(v.count),
        formatCurrency(v.material),
        formatCurrency(v.labor),
        formatCurrency(v.total),
      ]),
      [{ content: 'Subtotal Reparaciones Generales', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: formatCurrency(Object.values(byArea).reduce((s, a) => s + a.total, 0)), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      [{ content: `KONE / Ascensores (${kF.length} incidencias)`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: formatCurrency(koneTotal), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      [{ content: `COMIN/IOM (${cF.length} trabajos)`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: formatCurrency(cominTotal), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      [{ content: 'TOTAL GLOBAL', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [255, 255, 0], textColor: [0, 0, 0] } },
        { content: formatCurrency(grandTotal), styles: { fontStyle: 'bold', fillColor: [255, 255, 0], textColor: [0, 0, 0], fontSize: 11 } }],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { cellWidth: 70 }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 4, right: 4 },
  })

  doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text('IKEA Alcorcón — Informe de Costes', pw - 4, doc.internal.pageSize.getHeight() - 3, { align: 'right' })
  doc.save(`informe-costes-${new Date().toISOString().substring(0, 10)}.pdf`)
}

function downloadReparacionesReport(repairs: GeneralRepair[], workers: TeamMember[], range: DateRange) {
  const rF = filterByRange(repairs, r => r.request_date || r.created_at, range)

  const STATUS_LABEL: Record<string, string> = {
    pending: 'Pendiente', inprogress: 'En curso', blocked: 'Bloqueada', done: 'Finalizada', cancelled: 'Cancelada',
  }
  const PRIORITY_LABEL: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  reportHeader(doc, 'INFORME DE REPARACIONES', DATE_RANGE_LABELS[range])

  // Summary row
  const done = rF.filter(r => r.status === 'done').length
  const totalCost = rF.reduce((s, r) => s + (r.total_cost || 0), 0)
  autoTable(doc, {
    startY: 22,
    body: [[
      { content: `Total: ${rF.length}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: `Finalizadas: ${done}`, styles: { fontStyle: 'bold', fillColor: [220, 255, 220] } },
      { content: `Pendientes: ${rF.filter(r => r.status === 'pending').length}`, styles: { fontStyle: 'bold', fillColor: [255, 255, 220] } },
      { content: `Bloqueadas: ${rF.filter(r => r.blocked_by_material).length}`, styles: { fontStyle: 'bold', fillColor: [255, 230, 200] } },
      { content: `Coste total: ${formatCurrency(totalCost)}`, styles: { fontStyle: 'bold', fillColor: [255, 255, 0] } },
    ]],
    styles: { fontSize: 9, cellPadding: 2, halign: 'center' },
    margin: { left: 4, right: 4 },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryY = (doc as any).lastAutoTable.finalY

  autoTable(doc, {
    startY: summaryY + 2,
    head: [['Fecha', 'Descripción', 'Sección', 'Responsable', 'Prioridad', 'Estado', 'Mat.', 'M.O.', 'Total']],
    body: rF.map(r => {
      const w = r.responsible || workers.find(w => w.id === r.responsible_id)
      return [
        r.request_date || '—',
        r.description.length > 45 ? r.description.substring(0, 45) + '…' : r.description,
        r.area || '—',
        w?.name || '—',
        PRIORITY_LABEL[r.priority] || r.priority,
        STATUS_LABEL[r.status] || r.status,
        formatCurrency(r.material_cost || 0),
        formatCurrency(r.labor_cost || 0),
        formatCurrency(r.total_cost || 0),
      ]
    }),
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 22 }, 1: { cellWidth: 68 }, 2: { cellWidth: 28 }, 3: { cellWidth: 28 },
      4: { cellWidth: 18, halign: 'center' }, 5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 22, halign: 'right' }, 7: { cellWidth: 22, halign: 'right' }, 8: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 4, right: 4 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const v = String(data.cell.raw)
        if (v === 'Finalizada') data.cell.styles.textColor = [21, 128, 61]
        else if (v === 'Bloqueada') data.cell.styles.textColor = [180, 70, 0]
        else if (v === 'Urgente') data.cell.styles.textColor = [220, 38, 38]
      }
    },
  })

  doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text('IKEA Alcorcón — Informe de Reparaciones', pw - 4, doc.internal.pageSize.getHeight() - 3, { align: 'right' })
  doc.save(`informe-reparaciones-${new Date().toISOString().substring(0, 10)}.pdf`)
}

function downloadTareasReport(tasks: Task[], workers: TeamMember[], range: DateRange) {
  const tF = filterByRange(tasks, t => t.date || t.created_at, range)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  reportHeader(doc, 'TAREAS POR COMPAÑERO', DATE_RANGE_LABELS[range])

  const byWorker = workers
    .map(w => {
      const wt = tF.filter(t => t.responsible_id === w.id)
      return {
        name: w.name,
        role: w.role,
        total: wt.length,
        done: wt.filter(t => t.status === 'done').length,
        inprogress: wt.filter(t => t.status === 'inprogress').length,
        blocked: wt.filter(t => t.status === 'blocked').length,
        pending: wt.filter(t => t.status === 'pending').length,
        urgent: wt.filter(t => t.priority === 'urgent' && t.status !== 'done').length,
        pct: wt.length ? Math.round((wt.filter(t => t.status === 'done').length / wt.length) * 100) : 0,
      }
    })
    .filter(w => w.total > 0)
    .sort((a, b) => b.total - a.total)

  autoTable(doc, {
    startY: 22,
    head: [['Compañero', 'Rol', 'Total', 'Pend.', 'En curso', 'Bloq.', 'Fin.', 'Urgentes', '% Completado']],
    body: byWorker.map(w => [
      w.name,
      w.role,
      { content: String(w.total), styles: { fontStyle: 'bold' } },
      String(w.pending),
      String(w.inprogress),
      { content: String(w.blocked), styles: w.blocked > 0 ? { textColor: [180, 70, 0], fontStyle: 'bold' } : {} },
      { content: String(w.done), styles: { textColor: [21, 128, 61] } },
      { content: String(w.urgent), styles: w.urgent > 0 ? { textColor: [220, 38, 38], fontStyle: 'bold' } : {} },
      { content: `${w.pct}%`, styles: { fontStyle: 'bold', fillColor: w.pct >= 80 ? [220, 255, 220] : w.pct >= 50 ? [255, 255, 200] : [255, 230, 230] } },
    ]),
    foot: [[
      { content: 'TOTAL', styles: { fontStyle: 'bold' } },
      '',
      { content: String(tF.length), styles: { fontStyle: 'bold' } },
      String(tF.filter(t => t.status === 'pending').length),
      String(tF.filter(t => t.status === 'inprogress').length),
      String(tF.filter(t => t.status === 'blocked').length),
      String(tF.filter(t => t.status === 'done').length),
      String(tF.filter(t => t.priority === 'urgent' && t.status !== 'done').length),
      `${tF.length ? Math.round((tF.filter(t => t.status === 'done').length / tF.length) * 100) : 0}%`,
    ]],
    styles: { fontSize: 9, cellPadding: 2.5, halign: 'center' },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'left', fontSize: 8 } },
    margin: { left: 10, right: 10 },
  })

  // Detailed task list per worker
  if (byWorker.length > 0) {
    doc.addPage()
    reportHeader(doc, 'DETALLE DE TAREAS POR COMPAÑERO', DATE_RANGE_LABELS[range])
    let startY = 22
    const STATUS_LABEL: Record<string, string> = { pending: 'Pendiente', inprogress: 'En curso', blocked: 'Bloqueada', done: 'Finalizada', cancelled: 'Cancelada' }

    for (const w of byWorker) {
      const wt = tF.filter(t => t.responsible_id === workers.find(wk => wk.name === w.name)?.id)
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0)
      doc.text(`${w.name} — ${w.role}`, 10, startY + 4)
      startY += 2
      autoTable(doc, {
        startY,
        head: [['Fecha', 'Título', 'Área', 'Prioridad', 'Estado']],
        body: wt.map(t => [t.date, t.title.length > 50 ? t.title.substring(0, 50) + '…' : t.title, t.area || '—', t.priority, STATUS_LABEL[t.status] || t.status]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        margin: { left: 10, right: 10 },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      startY = (doc as any).lastAutoTable.finalY + 6
      if (startY > 260) { doc.addPage(); reportHeader(doc, 'DETALLE DE TAREAS (cont.)', ''); startY = 22 }
    }
  }

  doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text('IKEA Alcorcón — Tareas por compañero', pw - 10, doc.internal.pageSize.getHeight() - 5, { align: 'right' })
  doc.save(`informe-tareas-${new Date().toISOString().substring(0, 10)}.pdf`)
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [repairs, setRepairs] = useState<GeneralRepair[]>([])
  const [kone, setKone] = useState<KoneIncident[]>([])
  const [comin, setComin] = useState<CominIonJob[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>('year')
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getTasks({ is_personal: false }),
      getRepairs(),
      getKoneIncidents(),
      getCominIonJobs(),
      getWorkers(),
    ])
      .then(([t, r, k, c, w]) => { setTasks(t); setRepairs(r); setKone(k); setComin(c); setWorkers(w.filter(w => w.active)) })
      .finally(() => setLoading(false))
  }, [])

  const currentMonth = new Date().toISOString().substring(0, 7)
  const tasksMonth = tasks.filter(t => t.date.startsWith(currentMonth))

  const stats = {
    totalTasks: tasks.length,
    tasksDone: tasks.filter(t => t.status === 'done').length,
    tasksUrgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length,
    tasksBlocked: tasks.filter(t => t.status === 'blocked').length,
    tasksMonth: tasksMonth.length,
    tasksDoneMonth: tasksMonth.filter(t => t.status === 'done').length,
    costRepairs: repairs.reduce((s, r) => s + (r.total_cost || 0), 0),
    costKone: kone.reduce((s, k) => s + (k.total_cost || 0), 0),
    costComin: comin.reduce((s, c) => s + (c.real_cost || 0), 0),
    repairsDone: repairs.filter(r => r.status === 'done').length,
    repairsBlocked: repairs.filter(r => r.blocked_by_material).length,
  }

  const statusCounts = ['pending', 'inprogress', 'blocked', 'done', 'cancelled'].map(s => ({
    label: ({ pending: 'Pendiente', inprogress: 'En curso', blocked: 'Bloqueada', done: 'Finalizada', cancelled: 'Cancelada' } as Record<string, string>)[s] || s,
    count: tasks.filter(t => t.status === s).length,
    color: ({ pending: 'bg-gray-400', inprogress: 'bg-blue-500', blocked: 'bg-amber-500', done: 'bg-emerald-500', cancelled: 'bg-red-400' } as Record<string, string>)[s] || 'bg-gray-400',
  }))

  // Per-worker stats for inline table
  const workerStats = workers
    .map(w => {
      const wt = tasks.filter(t => t.responsible_id === w.id)
      const wr = repairs.filter(r => r.responsible_id === w.id)
      return { worker: w, tasks: wt.length, tasksDone: wt.filter(t => t.status === 'done').length, repairs: wr.length, repairsDone: wr.filter(r => r.status === 'done').length }
    })
    .filter(ws => ws.tasks > 0 || ws.repairs > 0)
    .sort((a, b) => (b.tasks + b.repairs) - (a.tasks + a.repairs))

  // Per-area costs for inline table
  const areaStats = Object.entries(
    repairs.reduce((acc, r) => {
      const area = r.area || 'Sin sección'
      if (!acc[area]) acc[area] = { repairs: 0, total: 0 }
      acc[area].repairs++; acc[area].total += r.total_cost || 0
      return acc
    }, {} as Record<string, { repairs: number; total: number }>)
  ).sort((a, b) => b[1].total - a[1].total)

  function handleDownload(id: string, fn: () => void) {
    setDownloading(id)
    setTimeout(() => { try { fn() } finally { setDownloading(null) } }, 50)
  }

  if (loading) return <div className="p-5 text-center text-gray-400">Generando informe...</div>

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Informes y estadísticas</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">Datos globales de la aplicación</p>
        </div>
        {/* Date range */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                range === r ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-slate-400'
              }`}>
              {DATE_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tareas totales', value: stats.totalTasks, icon: <BarChart2 size={18} />, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Finalizadas', value: stats.tasksDone, icon: <CheckCircle2 size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Urgentes activas', value: stats.tasksUrgent, icon: <AlertCircle size={18} />, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Coste total', value: formatCurrency(stats.costRepairs + stats.costKone + stats.costComin), icon: <TrendingUp size={18} />, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${kpi.bg} ${kpi.color}`}>{kpi.icon}</div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Download reports */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <FileDown size={16} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Descargar informes PDF</h3>
          <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">({DATE_RANGE_LABELS[range]})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleDownload('costes', () => downloadCostesReport(repairs, kone, comin, range))}
            disabled={!!downloading}
            className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Costes por sección</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Reparaciones, KONE, COMIN</p>
            </div>
            {downloading === 'costes' ? <div className="ml-auto w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /> : <FileDown size={14} className="ml-auto text-purple-400" />}
          </button>

          <button
            onClick={() => handleDownload('reparaciones', () => downloadReparacionesReport(repairs, workers, range))}
            disabled={!!downloading}
            className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <Wrench size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Informe reparaciones</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Detalle y costes</p>
            </div>
            {downloading === 'reparaciones' ? <div className="ml-auto w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /> : <FileDown size={14} className="ml-auto text-orange-400" />}
          </button>

          <button
            onClick={() => handleDownload('tareas', () => downloadTareasReport(tasks, workers, range))}
            disabled={!!downloading}
            className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Tareas por compañero</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Carga de trabajo y detalle</p>
            </div>
            {downloading === 'tareas' ? <div className="ml-auto w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : <FileDown size={14} className="ml-auto text-blue-400" />}
          </button>
        </div>
      </div>

      {/* Inline tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Tasks by status */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Tareas por estado</h3>
            <div className="space-y-2">
              {statusCounts.map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="w-20 text-xs text-gray-600 dark:text-slate-400">{s.label}</div>
                  <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${s.color}`}
                      style={{ width: stats.totalTasks ? `${(s.count / stats.totalTasks) * 100}%` : '0%' }} />
                  </div>
                  <div className="w-6 text-right text-xs font-medium text-gray-600 dark:text-slate-300">{s.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Costs by module */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Costes por módulo (histórico)</h3>
            <div className="space-y-3">
              {[
                { label: 'Reparaciones generales', value: stats.costRepairs, color: 'text-orange-600' },
                { label: 'KONE / Ascensores', value: stats.costKone, color: 'text-blue-600' },
                { label: 'COMIN / IOM', value: stats.costComin, color: 'text-teal-600' },
                { label: 'Total acumulado', value: stats.costRepairs + stats.costKone + stats.costComin, color: 'text-purple-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-slate-400">{item.label}</span>
                  <span className={`text-sm font-bold ${item.color}`}>{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Per-worker summary */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Users size={14} className="text-blue-500" /> Carga por compañero
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[280px]">
                <thead>
                  <tr className="text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left pb-2 font-medium">Compañero</th>
                    <th className="text-center pb-2 font-medium">Tareas</th>
                    <th className="text-center pb-2 font-medium">Fin.</th>
                    <th className="text-center pb-2 font-medium">Repar.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                  {workerStats.map(ws => (
                    <tr key={ws.worker.id}>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: ws.worker.color }}>
                            {ws.worker.name[0]}
                          </div>
                          <span className="font-medium text-gray-800 dark:text-slate-200 truncate max-w-[100px]">{ws.worker.name.split(' ')[0]}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-center font-bold text-gray-700 dark:text-slate-300">{ws.tasks}</td>
                      <td className="py-1.5 text-center text-emerald-600 font-bold">{ws.tasksDone}</td>
                      <td className="py-1.5 text-center text-orange-600 font-bold">{ws.repairs}</td>
                    </tr>
                  ))}
                  {workerStats.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-gray-400">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Per-area costs */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Building2 size={14} className="text-purple-500" /> Costes por sección (reparaciones)
            </h3>
            <div className="space-y-1.5">
              {areaStats.slice(0, 6).map(([area, v]) => (
                <div key={area} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-gray-600 dark:text-slate-400 truncate">{area}</span>
                    <span className="text-[10px] text-gray-400">({v.repairs})</span>
                  </div>
                  <span className="text-xs font-bold text-purple-600 ml-2 shrink-0">{formatCurrency(v.total)}</span>
                </div>
              ))}
              {areaStats.length === 0 && <p className="text-xs text-gray-400 py-2">Sin datos de reparaciones</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
