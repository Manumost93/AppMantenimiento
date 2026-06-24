import { useState, useEffect } from 'react'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Plus, Trash2, Edit2, Search, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getCominIonJobs, upsertCominIonJob, deleteCominIonJob, getWorkers } from '@/lib/supabase'
import type { CominIonJob, TeamMember } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, formatCurrency, formatDateShort, todayIso } from '@/lib/utils'
import { PageLoading } from '@/components/Skeleton'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PRIORITY_LABELS_ES: Record<string, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'URGENTE',
}

function generateExternalPDF(jobs: CominIonJob[], contactName: string, contactPhone: string, filterMode: 'ion' | 'pending' | 'all') {
  const filtered = jobs.filter(j => {
    if (filterMode === 'ion') return j.involves_ion && !['done', 'cancelled'].includes(j.status)
    if (filterMode === 'pending') return !['done', 'cancelled'].includes(j.status)
    return true
  })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()

  // ── Header IKEA ──
  doc.setFillColor(0, 0, 0)
  doc.rect(0, 0, pw, 16, 'F')

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 35, 16, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(0, 0, 0)
  doc.text('IKEA', 3, 10)
  doc.setFontSize(7)
  doc.text('ALCORCÓN', 3, 15)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text('LISTA DE TRABAJOS — EMPRESA EXTERNA', pw / 2, 9, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(filterMode === 'ion' ? 'IOM / DECORACIÓN' : 'COMIN / IOM', pw / 2, 14, { align: 'center' })

  const dateW = 36
  doc.setFillColor(255, 255, 0)
  doc.rect(pw - dateW, 0, dateW, 16, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  doc.text(new Date().toLocaleDateString('es-ES'), pw - dateW / 2, 9, { align: 'center' })

  // ── Info block ──
  let y = 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text(`Ubicación: IKEA Alcorcón · Avda. Partenón 16-18, 28042 Madrid`, 10, y)
  y += 5
  if (contactName) {
    doc.setFont('helvetica', 'bold')
    doc.text(`Contacto COMIN: `, 10, y)
    doc.setFont('helvetica', 'normal')
    const labelW = doc.getTextWidth('Contacto COMIN: ')
    doc.text(`${contactName}${contactPhone ? `  ·  Tel: ${contactPhone}` : ''}`, 10 + labelW, y)
    y += 5
  }
  doc.setFont('helvetica', 'normal')
  doc.text(`Total trabajos en esta lista: ${filtered.length}`, 10, y)
  y += 3

  // ── Table ──
  autoTable(doc, {
    startY: y + 2,
    head: [['#', 'Fecha', 'Zona', 'Trabajo solicitado', 'Material', 'Prioridad', 'Estado']],
    body: filtered.map((j, i) => [
      i + 1,
      formatDateShort(j.date),
      j.affected_zone,
      j.work_requested,
      j.material_requested || '—',
      PRIORITY_LABELS_ES[j.priority] || j.priority,
      STATUS_LABELS[j.status] || j.status,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 28 },
      3: { cellWidth: 55 },
      4: { cellWidth: 35 },
      5: { cellWidth: 18 },
      6: { cellWidth: 22 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const v = String(data.cell.raw)
        if (v === 'URGENTE') data.cell.styles.textColor = [220, 38, 38]
        if (v === 'Alta') data.cell.styles.textColor = [234, 88, 12]
      }
    },
  })

  // ── Signature area ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 12
  const pageH = doc.internal.pageSize.getHeight()
  if (finalY < pageH - 30) {
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Firma responsable externo:', 10, finalY)
    doc.line(10, finalY + 12, 80, finalY + 12)
    doc.text('Firma responsable COMIN:', pw / 2 + 5, finalY)
    doc.line(pw / 2 + 5, finalY + 12, pw - 10, finalY + 12)
    doc.text('Fecha: _______________', 10, finalY + 18)
  }

  doc.save(`trabajos-externos-${new Date().toISOString().split('T')[0]}.pdf`)
}

export default function CominIonPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: jobs, setData: setJobs, loading } = useRealtimeTable('comin_ion_jobs', getCominIonJobs)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<CominIonJob | null>(null)
  const [form, setForm] = useState<Partial<CominIonJob>>({ status: 'pending', priority: 'medium', estimated_cost: 0, real_cost: 0, involves_ion: false, blocked_by_material: false })
  const [saving, setSaving] = useState(false)
  const [showPdfDialog, setShowPdfDialog] = useState(false)
  const [pdfContact, setPdfContact] = useState('')
  const [pdfPhone, setPdfPhone] = useState('')
  const [pdfFilter, setPdfFilter] = useState<'ion' | 'pending' | 'all'>('pending')

  useEffect(() => {
    getWorkers().then(setWorkers)
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
      toast.success(selected ? 'Trabajo actualizado' : 'Trabajo creado')
    } catch { toast.error('Error al guardar.') } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    const ok = await confirm({ title: 'Eliminar trabajo', message: '¿Eliminar este trabajo COMIN/IOM?' })
    if (!ok) return
    try {
      await deleteCominIonJob(id)
      setJobs(prev => prev.filter(j => j.id !== id))
      toast.success('Trabajo eliminado')
    } catch { toast.error('No se pudo eliminar.') }
  }

  if (loading) return <PageLoading rows={5} />

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">🎨 COMIN / IOM / Decoración</h2>
          <p className="text-xs text-gray-500">{jobs.length} trabajos · Coste real: {formatCurrency(totalCost)}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPdfDialog(true)}>
            <FileDown size={14} />
            PDF para externo
          </Button>
          <Button size="sm" onClick={openCreate}><Plus size={14} />Nuevo trabajo</Button>
        </div>
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
            <tr>{['Fecha', 'Zona', 'Trabajo', 'Responsable', 'Coste est.', 'Coste real', 'IOM', 'Estado', ''].map(h => (
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

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar trabajo' : 'Nuevo trabajo COMIN/IOM'}>
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
              Involucra IOM
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

      {/* PDF para empresa externa */}
      <Dialog open={showPdfDialog} onClose={() => setShowPdfDialog(false)} title="Generar PDF para empresa externa" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">Genera una lista imprimible de trabajos pendientes para el externo (IOM u otro).</p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contacto COMIN responsable</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Nombre del encargado COMIN"
              value={pdfContact}
              onChange={e => setPdfContact(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono de contacto</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="600 123 456"
              inputMode="tel"
              value={pdfPhone}
              onChange={e => setPdfPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">¿Qué incluir?</label>
            <div className="space-y-2">
              {([
                { value: 'ion', label: 'Solo trabajos IOM pendientes', desc: 'Filtra por "Involucra IOM" y estado activo' },
                { value: 'pending', label: 'Todos los trabajos pendientes', desc: 'Estado activo (excluye finalizados y cancelados)' },
                { value: 'all', label: 'Todos los trabajos', desc: 'Lista completa sin filtrar por estado' },
              ] as { value: typeof pdfFilter; label: string; desc: string }[]).map(opt => (
                <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pdfFilter"
                    value={opt.value}
                    checked={pdfFilter === opt.value}
                    onChange={() => setPdfFilter(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm text-gray-700 font-medium">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <Button variant="outline" className="flex-1" onClick={() => setShowPdfDialog(false)}>Cancelar</Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                generateExternalPDF(jobs, pdfContact, pdfPhone, pdfFilter)
                setShowPdfDialog(false)
              }}
            >
              <FileDown size={14} />
              Descargar PDF
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
