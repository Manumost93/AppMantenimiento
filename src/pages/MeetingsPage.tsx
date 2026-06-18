import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, FileText, CheckSquare, Square, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getMeetings, upsertMeeting, deleteMeeting, getWorkers } from '@/lib/supabase'
import type { Meeting, MeetingPoint, MeetingDepartment, TeamMember } from '@/types'
import { cn, formatDateShort, todayIso } from '@/lib/utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const DEPARTMENTS: Record<MeetingDepartment, { label: string; color: string; emoji: string }> = {
  general:  { label: 'General',          color: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',    emoji: '🏢' },
  kone:     { label: 'KONE / Ascensores', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',   emoji: '🏗️' },
  comin:    { label: 'COMIN / ION',       color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', emoji: '🎨' },
  food:     { label: 'FOOD / Restaurante',color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', emoji: '🍽️' },
  security: { label: 'Seguridad',         color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',       emoji: '🛡️' },
  repairs:  { label: 'Reparaciones',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', emoji: '🔧' },
}

function newPoint(): MeetingPoint {
  return { id: crypto.randomUUID(), title: '', notes: '', done: false }
}

function generateMeetingPDF(meeting: Meeting, workers: TeamMember[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dept = DEPARTMENTS[meeting.department]

  // Header
  doc.setFillColor(0, 0, 0)
  doc.rect(0, 0, 210, 22, 'F')
  doc.setFillColor(255, 204, 0)
  doc.rect(8, 5, 18, 12, 'F')
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('IKEA', 12, 13)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text('ACTA DE REUNIÓN', 105, 13, { align: 'center' })
  doc.setFontSize(9)
  doc.text(new Date(meeting.date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }), 190, 13, { align: 'right' })

  // Info block
  let y = 32
  doc.setTextColor(0)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(meeting.title, 14, y)
  y += 7

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Departamento: ${dept.emoji} ${dept.label}`, 14, y)
  if (meeting.time) doc.text(`Hora: ${meeting.time}`, 130, y)
  y += 5
  if (meeting.participants) {
    doc.text(`Asistentes: ${meeting.participants}`, 14, y)
    y += 5
  }

  // Agenda
  y += 4
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDEN DEL DÍA', 14, y)
  y += 2

  const agendaRows = meeting.agenda.map((p, i) => [
    String(i + 1),
    p.title,
    workers.find(w => w.id === p.responsible_id)?.name ?? '—',
    p.done ? '✓ Tratado' : 'Pendiente',
    p.notes ?? '',
  ])

  autoTable(doc, {
    startY: y + 2,
    head: [['#', 'Punto', 'Responsable', 'Estado', 'Notas']],
    body: agendaRows.length ? agendaRows : [['—', 'Sin puntos en el orden del día', '', '', '']],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 32 }, 3: { cellWidth: 22 } },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 14, right: 14 },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Notes
  if (meeting.notes) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('OBSERVACIONES', 14, finalY)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(meeting.notes, 182)
    doc.text(lines, 14, finalY + 6)
  }

  // Signature area
  const sigY = Math.min(finalY + (meeting.notes ? 24 : 8), 250)
  doc.setDrawColor(180)
  doc.line(14, sigY, 90, sigY)
  doc.line(120, sigY, 196, sigY)
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text('Firma responsable', 52, sigY + 4, { align: 'center' })
  doc.text('Firma dirección', 158, sigY + 4, { align: 'center' })

  const dateStr = meeting.date.replace(/-/g, '')
  doc.save(`reunion-${meeting.department}-${dateStr}.pdf`)
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDept, setFilterDept] = useState<MeetingDepartment | ''>('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<Meeting | null>(null)
  const [form, setForm] = useState<Partial<Meeting>>({ department: 'general', agenda: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getMeetings(), getWorkers()])
      .then(([m, w]) => { setMeetings(m); setWorkers(w) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = filterDept ? meetings.filter(m => m.department === filterDept) : meetings

  function openCreate() {
    setSelected(null)
    setForm({ department: 'general', agenda: [newPoint()], date: todayIso() })
    setShowDialog(true)
  }

  function openEdit(m: Meeting, e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(m)
    setForm({ ...m, agenda: m.agenda.length ? m.agenda : [newPoint()] })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.title?.trim()) return
    setSaving(true)
    try {
      const cleanAgenda = (form.agenda ?? []).filter(p => p.title.trim())
      const saved = await upsertMeeting({ ...form, agenda: cleanAgenda })
      const withCreator = { ...saved, created_by: workers.find(w => w.id === saved.created_by_id) }
      setMeetings(prev => selected
        ? prev.map(m => m.id === selected.id ? withCreator : m)
        : [withCreator, ...prev]
      )
      setShowDialog(false)
    } catch { alert('Error al guardar.') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar esta reunión?')) return
    try { await deleteMeeting(id); setMeetings(prev => prev.filter(m => m.id !== id)) }
    catch { alert('No se pudo eliminar.') }
  }

  async function togglePoint(meeting: Meeting, pointId: string) {
    const updated = { ...meeting, agenda: meeting.agenda.map(p => p.id === pointId ? { ...p, done: !p.done } : p) }
    setMeetings(prev => prev.map(m => m.id === meeting.id ? updated : m))
    try { await upsertMeeting({ id: meeting.id, agenda: updated.agenda }) }
    catch { setMeetings(prev => prev.map(m => m.id === meeting.id ? meeting : m)) }
  }

  function addPoint() {
    setForm(f => ({ ...f, agenda: [...(f.agenda ?? []), newPoint()] }))
  }

  function removePoint(id: string) {
    setForm(f => ({ ...f, agenda: (f.agenda ?? []).filter(p => p.id !== id) }))
  }

  function updatePoint(id: string, field: keyof MeetingPoint, value: unknown) {
    setForm(f => ({ ...f, agenda: (f.agenda ?? []).map(p => p.id === id ? { ...p, [field]: value } : p) }))
  }

  if (loading) return <div className="p-5 text-center text-gray-400">Cargando reuniones...</div>

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={18} className="text-indigo-500" />
            Reuniones
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">{meetings.length} reuniones registradas</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Nueva reunión
        </Button>
      </div>

      {/* Filtros por departamento */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterDept('')}
          className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', !filterDept ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600')}
        >
          Todos
        </button>
        {(Object.entries(DEPARTMENTS) as [MeetingDepartment, typeof DEPARTMENTS[MeetingDepartment]][]).map(([key, d]) => (
          <button
            key={key}
            onClick={() => setFilterDept(key)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', filterDept === key ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600')}
          >
            {d.emoji} {d.label}
          </button>
        ))}
      </div>

      {/* Lista de reuniones */}
      <div className="space-y-3">
        {filtered.map(meeting => {
          const dept = DEPARTMENTS[meeting.department]
          const doneCount = meeting.agenda.filter(p => p.done).length
          const totalPoints = meeting.agenda.length
          const isExpanded = expanded === meeting.id

          return (
            <div key={meeting.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
              {/* Cabecera de la tarjeta */}
              <button
                className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : meeting.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', dept.color)}>
                      {dept.emoji} {dept.label}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {formatDateShort(meeting.date)}{meeting.time ? ` · ${meeting.time}` : ''}
                    </span>
                  </div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{meeting.title}</p>
                  {meeting.participants && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                      👥 {meeting.participants}
                    </p>
                  )}
                  {totalPoints > 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      {doneCount}/{totalPoints} puntos tratados
                      {doneCount > 0 && (
                        <span className="ml-1.5 text-emerald-500">{'▓'.repeat(doneCount)}{'░'.repeat(totalPoints - doneCount)}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); generateMeetingPDF(meeting, workers) }}
                    title="Descargar PDF"
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    onClick={e => openEdit(meeting, e)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={e => handleDelete(meeting.id, e)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* Puntos del orden del día */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3 space-y-2">
                  {meeting.agenda.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 py-2">Sin puntos en el orden del día.</p>
                  )}
                  {meeting.agenda.map((point, idx) => (
                    <div key={point.id} className={cn('flex gap-2.5 p-2.5 rounded-lg', point.done ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-50 dark:bg-slate-700/50')}>
                      <button
                        onClick={() => togglePoint(meeting, point.id)}
                        className="shrink-0 mt-0.5 text-gray-400 hover:text-emerald-600 transition-colors"
                      >
                        {point.done ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium', point.done ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200')}>
                          <span className="text-gray-400 dark:text-slate-500 mr-1">{idx + 1}.</span>
                          {point.title}
                        </p>
                        {point.responsible_id && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            👤 {workers.find(w => w.id === point.responsible_id)?.name}
                          </p>
                        )}
                        {point.notes && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 italic">{point.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {meeting.notes && (
                    <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">Notas / Acuerdos</p>
                      <p className="text-xs text-gray-700 dark:text-slate-300">{meeting.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            {filterDept ? 'No hay reuniones en este departamento.' : 'No hay reuniones registradas.'}
            <br />
            <button onClick={openCreate} className="mt-3 text-blue-500 underline text-xs">Crear la primera</button>
          </div>
        )}
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar reunión' : 'Nueva reunión'} size="lg">
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Datos básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-full">
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Título de la reunión *</label>
              <input
                className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                placeholder="Ej: Reunión mensual de mantenimiento"
                value={form.title ?? ''}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha</label>
              <input type="date" className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                value={form.date ?? todayIso()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Hora (opcional)</label>
              <input type="time" className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                value={form.time ?? ''} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Departamento</label>
              <select className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                value={form.department ?? 'general'} onChange={e => setForm(f => ({ ...f, department: e.target.value as MeetingDepartment }))}>
                {(Object.entries(DEPARTMENTS) as [MeetingDepartment, typeof DEPARTMENTS[MeetingDepartment]][]).map(([k, d]) => (
                  <option key={k} value={k}>{d.emoji} {d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Asistentes</label>
              <input className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                placeholder="Ej: Manuel, Pedro, Ana..."
                value={form.participants ?? ''} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} />
            </div>
          </div>

          {/* Orden del día */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Orden del día</label>
              <button onClick={addPoint} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <Plus size={12} /> Añadir punto
              </button>
            </div>
            <div className="space-y-2">
              {(form.agenda ?? []).map((point, idx) => (
                <div key={point.id} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-xs text-gray-400 dark:text-slate-500 font-medium mt-2.5 w-5 shrink-0">{idx + 1}.</span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                      placeholder="Punto a tratar *"
                      value={point.title}
                      onChange={e => updatePoint(point.id, 'title', e.target.value)}
                    />
                    <select
                      className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                      value={point.responsible_id ?? ''}
                      onChange={e => updatePoint(point.id, 'responsible_id', e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">Sin responsable</option>
                      {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <input
                      className="sm:col-span-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                      placeholder="Notas o descripción (opcional)"
                      value={point.notes ?? ''}
                      onChange={e => updatePoint(point.id, 'notes', e.target.value)}
                    />
                  </div>
                  <button onClick={() => removePoint(point.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg mt-0.5 shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {(form.agenda ?? []).length === 0 && (
                <button onClick={addPoint} className="w-full py-3 text-xs text-gray-400 dark:text-slate-500 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-lg hover:border-blue-300 hover:text-blue-500 transition-colors">
                  + Añadir el primer punto del orden del día
                </button>
              )}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Notas / Acuerdos</label>
            <textarea
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200 resize-none" rows={3}
              placeholder="Resumen de acuerdos, notas importantes..."
              value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.title?.trim()}>
              {saving ? 'Guardando...' : 'Guardar reunión'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
