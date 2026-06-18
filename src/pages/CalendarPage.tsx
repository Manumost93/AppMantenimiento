import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { getTasks, upsertTask, deleteTask, getWorkers, getAreas } from '@/lib/supabase'
import { STATUS_COLORS, STATUS_CLASSES, STATUS_LABELS, PRIORITY_CLASSES, PRIORITY_LABELS, cn, getInitials, todayIso } from '@/lib/utils'
import { Plus, Filter, Trash2, Save, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import type { Task, TeamMember, Area } from '@/types'

function buildCalendarEvents(tasks: Task[]) {
  return tasks.map(task => {
    const member = task.responsible
    return {
      id: String(task.id),
      title: task.title,
      start: task.start_time ? `${task.date}T${task.start_time}` : task.date,
      end: task.end_time ? `${task.date}T${task.end_time}` : undefined,
      allDay: !task.start_time,
      backgroundColor: task.priority === 'urgent' ? '#DC2626' : member?.color || STATUS_COLORS[task.status],
      borderColor: task.priority === 'urgent' ? '#B91C1C' : member?.color || STATUS_COLORS[task.status],
      textColor: '#ffffff',
      extendedProps: { task, member },
    }
  })
}

const EMPTY_FORM: Partial<Task> = {
  title: '', description: '', date: todayIso(),
  event_type: 'task', priority: 'medium', status: 'pending',
  is_personal: false,
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMember, setFilterMember] = useState<number | undefined>()
  const [showDialog, setShowDialog] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [form, setForm] = useState<Partial<Task>>(EMPTY_FORM)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      getTasks({ is_personal: false }),
      getWorkers(),
      getAreas(),
    ]).then(([t, w, a]) => {
      setTasks(t)
      setWorkers(w)
      setAreas(a)
    }).finally(() => setLoading(false))
  }, [])

  const events = buildCalendarEvents(tasks).filter(e =>
    !filterMember || e.extendedProps.member?.id === filterMember
  )

  function openCreate(date?: string) {
    setForm({ ...EMPTY_FORM, date: date || todayIso() })
    setShowDialog(true)
  }

  function handleDateSelect(arg: DateSelectArg) {
    openCreate(arg.startStr.split('T')[0])
  }

  function handleEventClick(info: EventClickArg) {
    const task = info.event.extendedProps['task'] as Task
    setSelectedTask(task)
    setShowDetail(true)
  }

  async function handleSave() {
    if (!form.title?.trim() || !form.date) return
    setSaving(true)
    try {
      const saved = await upsertTask({ ...form, is_personal: false })
      setTasks(prev => form.id
        ? prev.map(t => t.id === form.id ? { ...saved, responsible: workers.find(w => w.id === saved.responsible_id) } : t)
        : [...prev, { ...saved, responsible: workers.find(w => w.id === saved.responsible_id) }]
      )
      setShowDialog(false)
      setForm(EMPTY_FORM)
    } catch {
      alert('Error al guardar la tarea.')
    } finally {
      setSaving(false)
    }
  }

  async function handleComplete(task: Task) {
    try {
      const saved = await upsertTask({ ...task, status: 'done' })
      setTasks(prev => prev.map(t => t.id === task.id
        ? { ...saved, responsible: workers.find(w => w.id === saved.responsible_id) }
        : t
      ))
      setShowDetail(false)
    } catch {
      alert('Error al completar.')
    }
  }

  async function handleDelete(task: Task) {
    if (!confirm(`¿Eliminar "${task.title}"?`)) return
    try {
      await deleteTask(task.id)
      setTasks(prev => prev.filter(t => t.id !== task.id))
      setShowDetail(false)
    } catch {
      alert('Error al eliminar.')
    }
  }

  function editTask(task: Task) {
    setForm({ ...task })
    setShowDetail(false)
    setShowDialog(true)
  }

  if (loading) return <div className="p-5 text-center text-gray-400">Cargando calendario...</div>

  return (
    <div className="p-4 h-full flex flex-col gap-3">
      {/* Barra de acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500 dark:text-slate-400">Filtrar:</span>
          <select
            className="text-xs border border-gray-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={filterMember || ''}
            onChange={e => setFilterMember(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Todos los compañeros</option>
            {workers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {/* Avatares de equipo */}
          <div className="flex gap-1.5">
            {workers.filter(m => m.active).slice(0, 8).map(m => (
              <button
                key={m.id}
                title={m.name}
                onClick={() => setFilterMember(filterMember === m.id ? undefined : m.id)}
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold transition-all',
                  filterMember === m.id ? 'ring-2 ring-offset-1 ring-blue-400 scale-110' : 'opacity-70 hover:opacity-100'
                )}
                style={{ backgroundColor: m.color }}
              >
                {getInitials(m.name)}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus size={14} />
            <span className="hidden sm:inline">Nueva tarea</span>
          </Button>
        </div>
      </div>

      {/* Calendario */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek',
          }}
          buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Lista' }}
          events={events}
          height="100%"
          editable
          selectable
          selectMirror
          eventClick={(info) => handleEventClick(info)}
          select={handleDateSelect}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }}
        />
      </div>

      {/* Dialog crear/editar tarea */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={form.id ? 'Editar tarea' : 'Nueva tarea compartida'}>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Título *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Describe la tarea..."
              value={form.title || ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha *</label>
              <input type="date" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.date || ''}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Responsable</label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.responsible_id || ''}
                onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value ? Number(e.target.value) : undefined }))}>
                <option value="">Sin asignar</option>
                {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Hora inicio</label>
              <input type="time" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.start_time || ''}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value || undefined }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Hora fin</label>
              <input type="time" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.end_time || ''}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value || undefined }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.priority || 'medium'}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as Task['priority'] }))}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Estado</label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.status || 'pending'}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Task['status'] }))}>
                <option value="pending">Pendiente</option>
                <option value="inprogress">En curso</option>
                <option value="blocked">Bloqueada</option>
                <option value="done">Finalizada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Sección</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.area_id || ''}
              onChange={e => setForm(f => ({ ...f, area_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin sección</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción / Notas</label>
            <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              rows={3}
              value={form.notes || ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.title?.trim()}>
              <Save size={14} />
              {saving ? 'Guardando...' : form.id ? 'Guardar' : 'Crear tarea'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog detalle de tarea */}
      {selectedTask && (
        <Dialog open={showDetail} onClose={() => setShowDetail(false)} title={selectedTask.title}>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-slate-400 text-xs">Fecha</span>
                <p className="font-medium dark:text-slate-200">{new Date(selectedTask.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              </div>
              {selectedTask.start_time && (
                <div>
                  <span className="text-gray-500 dark:text-slate-400 text-xs">Hora</span>
                  <p className="font-medium dark:text-slate-200">{selectedTask.start_time.slice(0,5)}{selectedTask.end_time ? ` — ${selectedTask.end_time.slice(0,5)}` : ''}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500 dark:text-slate-400 text-xs block mb-1">Estado</span>
                <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_CLASSES[selectedTask.status])}>
                  {STATUS_LABELS[selectedTask.status]}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400 text-xs block mb-1">Prioridad</span>
                <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium', PRIORITY_CLASSES[selectedTask.priority])}>
                  {PRIORITY_LABELS[selectedTask.priority]}
                </span>
              </div>
              {selectedTask.responsible && (
                <div className="col-span-2">
                  <span className="text-gray-500 dark:text-slate-400 text-xs">Responsable</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: selectedTask.responsible.color }}>
                      {getInitials(selectedTask.responsible.name)}
                    </div>
                    <span className="text-sm font-medium dark:text-slate-200">{selectedTask.responsible.name}</span>
                  </div>
                </div>
              )}
            </div>
            {selectedTask.notes && (
              <p className="text-sm text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-700 rounded-lg p-3">{selectedTask.notes}</p>
            )}
            <div className="flex gap-2 pt-2 flex-wrap">
              {selectedTask.status !== 'done' && (
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                  onClick={() => handleComplete(selectedTask)}
                >
                  <CheckCircle2 size={14} />
                  Completar
                </Button>
              )}
              <Button variant="outline" className="flex-1 min-w-[80px]" onClick={() => editTask(selectedTask)}>
                Editar
              </Button>
              <button
                onClick={() => handleDelete(selectedTask)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
