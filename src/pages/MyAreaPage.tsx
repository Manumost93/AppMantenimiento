import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Star, StarOff, Phone, Package, StickyNote, Calendar, ClipboardList, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import { useAuth } from '@/contexts/AuthContext'
import {
  getTasks, upsertTask, deleteTask,
  getPersonalNotes, upsertPersonalNote, deletePersonalNote,
  getMaterialRequests, upsertMaterialRequest, deleteMaterialRequest,
  getFavoriteProviders, getProviders, addFavoriteProvider, removeFavoriteProvider,
} from '@/lib/supabase'
import type { LucideIcon } from 'lucide-react'
import type { Task, PersonalNote, MaterialRequest, Provider } from '@/types'
import { cn, STATUS_LABELS, STATUS_CLASSES, formatCurrency, todayIso, getInitials } from '@/lib/utils'

type Tab = 'tasks' | 'calendar' | 'notes' | 'providers' | 'materials'

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'tasks', label: 'Mis tareas', icon: ClipboardList },
  { key: 'calendar', label: 'Mi calendario', icon: Calendar },
  { key: 'notes', label: 'Notas', icon: StickyNote },
  { key: 'providers', label: 'Proveedores', icon: Phone },
  { key: 'materials', label: 'Materiales', icon: ShoppingCart },
]

const NOTE_COLORS = ['#FEF9C3', '#DCFCE7', '#DBEAFE', '#FCE7F3', '#F3E8FF', '#FFE4E1']

export default function MyAreaPage() {
  const { worker } = useAuth()
  const [tab, setTab] = useState<Tab>('tasks')

  // --- Tareas personales ---
  const [tasks, setTasks] = useState<Task[]>([])
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [taskForm, setTaskForm] = useState<Partial<Task>>({ title: '', date: todayIso(), priority: 'medium', status: 'pending', is_personal: true })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [savingTask, setSavingTask] = useState(false)

  // --- Notas ---
  const [notes, setNotes] = useState<PersonalNote[]>([])
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [noteForm, setNoteForm] = useState<Partial<PersonalNote>>({ title: '', content: '', color: '#FEF9C3' })
  const [selectedNote, setSelectedNote] = useState<PersonalNote | null>(null)

  // --- Materiales ---
  const [materials, setMaterials] = useState<MaterialRequest[]>([])
  const [showMaterialDialog, setShowMaterialDialog] = useState(false)
  const [materialForm, setMaterialForm] = useState<Partial<MaterialRequest>>({ item_name: '', quantity: 1, unit_price: 0, status: 'pending' })
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialRequest | null>(null)

  // --- Proveedores favoritos ---
  const [favProviders, setFavProviders] = useState<Provider[]>([])
  const [allProviders, setAllProviders] = useState<Provider[]>([])
  const [showAddProvider, setShowAddProvider] = useState(false)

  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!worker) return
    Promise.all([
      getTasks({ is_personal: true, responsible_id: worker.id }),
      getPersonalNotes(worker.id),
      getMaterialRequests(worker.id),
      getFavoriteProviders(worker.id),
      getProviders(),
    ]).then(([t, n, m, fp, ap]) => {
      setTasks(t)
      setNotes(n)
      setMaterials(m)
      setFavProviders(fp)
      setAllProviders(ap)
    }).finally(() => setLoadingData(false))
  }, [worker])

  // ── Tareas ──────────────────────────────────────────────────────────────────

  async function saveTask() {
    if (!worker || !taskForm.title?.trim()) return
    setSavingTask(true)
    try {
      const saved = await upsertTask({
        ...taskForm,
        id: selectedTask?.id,
        responsible_id: worker.id,
        is_personal: true,
      })
      setTasks(prev => selectedTask ? prev.map(t => t.id === selectedTask.id ? saved : t) : [saved, ...prev])
      setShowTaskDialog(false)
      setSelectedTask(null)
    } catch { alert('Error al guardar.') } finally { setSavingTask(false) }
  }

  async function removeTask(id: number) {
    if (!confirm('¿Eliminar esta tarea?')) return
    try { await deleteTask(id); setTasks(prev => prev.filter(t => t.id !== id)) }
    catch { alert('Error al eliminar.') }
  }

  // ── Notas ───────────────────────────────────────────────────────────────────

  async function saveNote() {
    if (!worker || !noteForm.title?.trim()) return
    try {
      const saved = await upsertPersonalNote({ ...noteForm, id: selectedNote?.id, worker_id: worker.id })
      setNotes(prev => selectedNote ? prev.map(n => n.id === selectedNote.id ? saved : n) : [saved, ...prev])
      setShowNoteDialog(false)
      setSelectedNote(null)
    } catch { alert('Error al guardar.') }
  }

  async function removeNote(id: number) {
    try { await deletePersonalNote(id); setNotes(prev => prev.filter(n => n.id !== id)) }
    catch { alert('Error al eliminar.') }
  }

  // ── Materiales ───────────────────────────────────────────────────────────────

  async function saveMaterial() {
    if (!worker || !materialForm.item_name?.trim()) return
    try {
      const saved = await upsertMaterialRequest({ ...materialForm, id: selectedMaterial?.id, worker_id: worker.id })
      setMaterials(prev => selectedMaterial ? prev.map(m => m.id === selectedMaterial.id ? saved : m) : [saved, ...prev])
      setShowMaterialDialog(false)
      setSelectedMaterial(null)
    } catch { alert('Error al guardar.') }
  }

  async function removeMaterial(id: number) {
    try { await deleteMaterialRequest(id); setMaterials(prev => prev.filter(m => m.id !== id)) }
    catch { alert('Error al eliminar.') }
  }

  // ── Proveedores favoritos ─────────────────────────────────────────────────────

  async function toggleFavorite(provider: Provider) {
    if (!worker) return
    const isFav = favProviders.some(fp => fp.id === provider.id)
    try {
      if (isFav) {
        await removeFavoriteProvider(worker.id, provider.id)
        setFavProviders(prev => prev.filter(fp => fp.id !== provider.id))
      } else {
        await addFavoriteProvider(worker.id, provider.id)
        setFavProviders(prev => [...prev, provider])
      }
    } catch { alert('Error.') }
  }

  // ── Calendar events ───────────────────────────────────────────────────────────

  const calendarEvents = tasks.map(task => ({
    id: String(task.id),
    title: task.title,
    start: task.start_time ? `${task.date}T${task.start_time}` : task.date,
    end: task.end_time ? `${task.date}T${task.end_time}` : undefined,
    allDay: !task.start_time,
    backgroundColor: task.priority === 'urgent' ? '#DC2626' : worker?.color || '#3B82F6',
    borderColor: task.priority === 'urgent' ? '#B91C1C' : worker?.color || '#3B82F6',
    textColor: '#ffffff',
  }))

  const pendingMaterialsCost = materials
    .filter(m => m.status === 'pending' || m.status === 'ordered')
    .reduce((s, m) => s + (m.total_price || 0), 0)

  if (!worker) return null
  if (loadingData) return <div className="p-5 text-center text-gray-400">Cargando tu área personal...</div>

  return (
    <div className="p-4 space-y-4">
      {/* Cabecera personal */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ backgroundColor: worker.color }}>
          {getInitials(worker.name)}
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Hola, {worker.name.split(' ')[0]}</h2>
          <p className="text-xs text-gray-500">{worker.role} · Área personal</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-0">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon size={14} />
              {t.label}
              {t.key === 'tasks' && tasks.filter(t => t.status !== 'done').length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-600 rounded-full">
                  {tasks.filter(t => t.status !== 'done').length}
                </span>
              )}
              {t.key === 'materials' && materials.filter(m => m.status === 'pending').length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-600 rounded-full">
                  {materials.filter(m => m.status === 'pending').length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB: MIS TAREAS ── */}
      {tab === 'tasks' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{tasks.filter(t => t.status !== 'done').length} tareas pendientes</span>
            <Button size="sm" onClick={() => { setSelectedTask(null); setTaskForm({ title: '', date: todayIso(), priority: 'medium', status: 'pending', is_personal: true }); setShowTaskDialog(true) }}>
              <Plus size={14} />Nueva tarea
            </Button>
          </div>
          {tasks.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ClipboardList size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin tareas personales.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <div key={task.id} className={cn('bg-white rounded-lg border border-gray-200 p-3 flex gap-3 items-start', task.status === 'done' && 'opacity-60')}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-sm font-medium', task.status === 'done' && 'line-through text-gray-400')}>{task.title}</span>
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', STATUS_CLASSES[task.status])}>{STATUS_LABELS[task.status]}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{task.date}</span>
                      {task.start_time && <span className="text-xs text-gray-400">{task.start_time.substring(0,5)}</span>}
                      {task.notes && <span className="text-xs text-gray-400 truncate max-w-[200px]">{task.notes}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setSelectedTask(task); setTaskForm({ ...task }); setShowTaskDialog(true) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => removeTask(task.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MI CALENDARIO ── */}
      {tab === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style={{ height: '500px' }}>
          <FullCalendar
            plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={esLocale}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,listWeek' }}
            buttonText={{ today: 'Hoy', month: 'Mes', list: 'Lista' }}
            events={calendarEvents}
            height="100%"
            selectable
            select={(info) => {
              setTaskForm({ title: '', date: info.startStr.split('T')[0], priority: 'medium', status: 'pending', is_personal: true })
              setSelectedTask(null)
              setShowTaskDialog(true)
            }}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }}
          />
        </div>
      )}

      {/* ── TAB: NOTAS ── */}
      {tab === 'notes' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{notes.length} notas</span>
            <Button size="sm" onClick={() => { setSelectedNote(null); setNoteForm({ title: '', content: '', color: '#FEF9C3' }); setShowNoteDialog(true) }}>
              <Plus size={14} />Nueva nota
            </Button>
          </div>
          {notes.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <StickyNote size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin notas personales.</p>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {notes.map(note => (
                <div key={note.id} className="rounded-xl p-4 shadow-sm relative group" style={{ backgroundColor: note.color }}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">{note.title}</h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      <button onClick={() => { setSelectedNote(note); setNoteForm({ ...note }); setShowNoteDialog(true) }} className="p-1 text-gray-600 hover:text-blue-600 rounded">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => removeNote(note.id)} className="p-1 text-gray-600 hover:text-red-600 rounded">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  <p className="text-[10px] text-gray-400 mt-2">{new Date(note.updated_at).toLocaleDateString('es-ES')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PROVEEDORES FAVORITOS ── */}
      {tab === 'providers' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{favProviders.length} proveedores guardados</span>
            <Button size="sm" variant="outline" onClick={() => setShowAddProvider(true)}>
              <Star size={14} />Gestionar favoritos
            </Button>
          </div>
          {favProviders.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Phone size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin proveedores favoritos.</p>
              <p className="text-xs mt-1">Añade los que usas habitualmente para tenerlos a mano.</p>
              <Button size="sm" className="mt-3" onClick={() => setShowAddProvider(true)}>Añadir</Button>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {favProviders.map(p => (
                <Card key={p.id}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900">{p.name}</h3>
                        {p.area && <p className="text-xs text-blue-600 mt-0.5">{p.area}</p>}
                        {p.contact_person && <p className="text-xs text-gray-500 mt-0.5">{p.contact_person}</p>}
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="flex items-center gap-1 mt-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 px-2.5 py-1.5 rounded-md w-fit transition-colors">
                            <Phone size={11} />
                            {p.phone}
                          </a>
                        )}
                      </div>
                      <button onClick={() => toggleFavorite(p)} className="p-1.5 text-amber-400 hover:text-amber-600 rounded ml-2">
                        <StarOff size={16} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MATERIALES ── */}
      {tab === 'materials' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <span className="text-sm text-gray-500">{materials.length} solicitudes</span>
              {pendingMaterialsCost > 0 && (
                <span className="ml-2 text-xs font-medium text-amber-600">Pendiente: {formatCurrency(pendingMaterialsCost)}</span>
              )}
            </div>
            <Button size="sm" onClick={() => { setSelectedMaterial(null); setMaterialForm({ item_name: '', quantity: 1, unit_price: 0, status: 'pending' }); setShowMaterialDialog(true) }}>
              <Plus size={14} />Añadir material
            </Button>
          </div>

          {materials.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Package size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin solicitudes de materiales.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Material', 'Cant.', 'Precio unit.', 'Total', 'Proveedor', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materials.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-xs font-medium">{m.item_name}</td>
                      <td className="px-3 py-2.5 text-xs">{m.quantity}</td>
                      <td className="px-3 py-2.5 text-xs">{formatCurrency(m.unit_price)}</td>
                      <td className="px-3 py-2.5 text-xs font-medium">{formatCurrency(m.total_price)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{m.supplier || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', {
                          pending: 'bg-gray-100 text-gray-600',
                          ordered: 'bg-blue-100 text-blue-600',
                          received: 'bg-emerald-100 text-emerald-600',
                          cancelled: 'bg-red-100 text-red-600',
                        }[m.status])}>
                          {{ pending: 'Pendiente', ordered: 'Pedido', received: 'Recibido', cancelled: 'Cancelado' }[m.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => { setSelectedMaterial(m); setMaterialForm({ ...m }); setShowMaterialDialog(true) }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={12} /></button>
                          <button onClick={() => removeMaterial(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* Dialog tarea */}
      <Dialog open={showTaskDialog} onClose={() => setShowTaskDialog(false)} title={selectedTask ? 'Editar tarea' : 'Nueva tarea personal'} size="sm">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={taskForm.title || ''} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={taskForm.date || todayIso()} onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hora</label>
              <input type="time" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={taskForm.start_time || ''} onChange={e => setTaskForm(f => ({ ...f, start_time: e.target.value || undefined }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={taskForm.priority || 'medium'} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as Task['priority'] }))}>
                <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={taskForm.status || 'pending'} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value as Task['status'] }))}>
                <option value="pending">Pendiente</option><option value="inprogress">En curso</option><option value="done">Finalizada</option><option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" rows={2}
              value={taskForm.notes || ''} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowTaskDialog(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={saveTask} disabled={savingTask || !taskForm.title?.trim()}>
              {savingTask ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog nota */}
      <Dialog open={showNoteDialog} onClose={() => setShowNoteDialog(false)} title={selectedNote ? 'Editar nota' : 'Nueva nota'} size="sm">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={noteForm.title || ''} onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contenido</label>
            <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" rows={4}
              value={noteForm.content || ''} onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2">
              {NOTE_COLORS.map(c => (
                <button key={c} onClick={() => setNoteForm(f => ({ ...f, color: c }))}
                  className={cn('w-7 h-7 rounded-full border-2 transition-all', noteForm.color === c ? 'border-gray-600 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowNoteDialog(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={saveNote} disabled={!noteForm.title?.trim()}>Guardar</Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog material */}
      <Dialog open={showMaterialDialog} onClose={() => setShowMaterialDialog(false)} title={selectedMaterial ? 'Editar material' : 'Nuevo material'} size="sm">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Material *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Nombre del material..." value={materialForm.item_name || ''} onChange={e => setMaterialForm(f => ({ ...f, item_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
              <input type="number" min="1" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={materialForm.quantity || 1} onChange={e => setMaterialForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio unit. (€)</label>
              <input type="number" min="0" step="0.01" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={materialForm.unit_price || 0} onChange={e => setMaterialForm(f => ({ ...f, unit_price: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Proveedor</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="¿Dónde se pide?" value={materialForm.supplier || ''} onChange={e => setMaterialForm(f => ({ ...f, supplier: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={materialForm.status || 'pending'} onChange={e => setMaterialForm(f => ({ ...f, status: e.target.value as MaterialRequest['status'] }))}>
              <option value="pending">Pendiente</option>
              <option value="ordered">Pedido</option>
              <option value="received">Recibido</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Para qué reparación, urgencia..." value={materialForm.notes || ''} onChange={e => setMaterialForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowMaterialDialog(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={saveMaterial} disabled={!materialForm.item_name?.trim()}>Guardar</Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog gestionar proveedores favoritos */}
      <Dialog open={showAddProvider} onClose={() => setShowAddProvider(false)} title="Gestionar proveedores favoritos">
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {allProviders.filter(p => p.active).map(p => {
            const isFav = favProviders.some(fp => fp.id === p.id)
            return (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.area}{p.phone ? ` · ${p.phone}` : ''}</p>
                </div>
                <button onClick={() => toggleFavorite(p)} className={cn('p-1.5 rounded transition-colors', isFav ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400')}>
                  <Star size={18} fill={isFav ? 'currentColor' : 'none'} />
                </button>
              </div>
            )
          })}
        </div>
      </Dialog>
    </div>
  )
}
