import { useState, useEffect } from 'react'
import { Store, Plus, Trash2, Edit2, Search, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { getGoyaTasks, upsertGoyaTask, deleteGoyaTask, uploadGoyaTaskPhoto, getWorkers } from '@/lib/supabase'
import type { GoyaTask, GoyaTaskStatus, TeamMember } from '@/types'
import { PageLoading } from '@/components/Skeleton'
import PhotoUpload from '@/components/PhotoUpload'
import { cn } from '@/lib/utils'

const inputClass = 'w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'

const FLOORS = [1, 0, -1, -2]
const FLOOR_LABELS: Record<number, string> = { 1: 'Planta 1', 0: 'Planta 0', '-1': 'Planta -1', '-2': 'Planta -2' } as Record<number, string>

const STATUS_META: Record<GoyaTaskStatus, { label: string; className: string }> = {
  pending: { label: 'Sin hacer', className: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300' },
  inprogress: { label: 'En proceso', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  done: { label: 'Terminado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}
const STATUS_ORDER: GoyaTaskStatus[] = ['pending', 'inprogress', 'done']

// Transcripción de las notas en papel que se pasaron para arrancar el
// tablero — revisar fechas y detalles cortados antes de dar por buena
// la lista (quedan marcados con "(confirmar...)").
const SEED_TASKS: Partial<GoyaTask>[] = [
  { floor: 1, title: 'Termómetro quitado por pingüinos', status: 'pending' },
  { floor: 1, title: 'Insectocaptor: revisión', notes: 'Marzo (confirmar año/fecha exacta)', status: 'pending' },
  { floor: 1, title: 'Máquina de hielo rota', notes: 'El técnico dice que... (texto cortado en la nota original, completar)', status: 'inprogress' },
  { floor: 1, title: 'Nevera averiada', status: 'pending' },
  { floor: 1, title: 'Hielo en el techo de la cámara', status: 'pending' },
  { floor: 0, title: 'Cafetería caída', status: 'pending' },
  { floor: 0, title: 'Downlights fundidos', status: 'pending' },
  { floor: -1, title: 'Cerradura del almacén Bussines rota', status: 'pending' },
  { floor: -1, title: 'Tuberías del clima deshechas', status: 'pending' },
  { floor: -1, title: 'Cuadros eléctricos inaccesibles', status: 'pending' },
  { floor: -1, title: 'Downlights fundidos', status: 'pending' },
  { floor: -1, title: 'Estanterías del almacén sueltas', status: 'pending' },
  { floor: -1, title: 'Cerrar registros', status: 'pending' },
  { floor: -1, title: 'Revisión BIEs y extintores de la tienda', notes: 'Septiembre (confirmar día exacto)', status: 'pending' },
  { floor: -1, title: 'Baños: faltan 2 percheros', status: 'pending' },
  { floor: -1, title: 'Baños: los grifos no cortan el agua', notes: 'Solucionado', status: 'done' },
  { floor: -2, title: 'Revisión PCI y grupo electrógeno', notes: 'Septiembre (confirmar día exacto)', status: 'pending' },
  { floor: -2, title: 'Cerradura subida rota', status: 'pending' },
  { floor: -2, title: 'Inventario de material', status: 'pending' },
  { floor: -2, title: 'Pasarela del montacargas', status: 'pending' },
  { floor: -2, title: 'Baños', notes: 'Revisado, sin incidencias', status: 'done' },
  { floor: -2, title: 'CPD', notes: 'Revisado, sin incidencias', status: 'done' },
]

export default function GoyaPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: tasks, setData: setTasks, loading } = useRealtimeTable('goya_tasks', getGoyaTasks)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<GoyaTaskStatus | ''>('')

  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<GoyaTask | null>(null)
  const [form, setForm] = useState<Partial<GoyaTask>>({ floor: 1, status: 'pending', photos: [] })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => { getWorkers().then(setWorkers) }, [])

  const filtered = tasks.filter(t =>
    (!search || t.title.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || t.status === statusFilter)
  )

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inprogress: tasks.filter(t => t.status === 'inprogress').length,
    done: tasks.filter(t => t.status === 'done').length,
  }

  function toggleStatusFilter(s: GoyaTaskStatus) {
    setStatusFilter(prev => prev === s ? '' : s)
  }

  function openCreate(floor: number) {
    setSelected(null)
    setForm({ floor, status: 'pending', photos: [] })
    setShowDialog(true)
  }

  function openEdit(task: GoyaTask) {
    setSelected(task)
    setForm({ ...task })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.title?.trim()) { toast.error('Escribe qué hay que hacer'); return }
    setSaving(true)
    try {
      const saved = await upsertGoyaTask(selected ? { ...form, id: selected.id } : form)
      setTasks(prev => selected ? prev.map(t => t.id === saved.id ? saved : t) : [...prev, saved])
      toast.success(selected ? 'Tarea actualizada' : 'Tarea creada')
      setShowDialog(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la tarea')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(task: GoyaTask) {
    const ok = await confirm({ title: 'Eliminar tarea', message: `¿Eliminar "${task.title}"?` })
    if (!ok) return
    try {
      await deleteGoyaTask(task.id, task.title)
      setTasks(prev => prev.filter(t => t.id !== task.id))
      toast.success('Tarea eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar la tarea')
    }
  }

  async function handleQuickStatus(task: GoyaTask, status: GoyaTaskStatus) {
    if (task.status === status) return
    try {
      const saved = await upsertGoyaTask({ ...task, status })
      setTasks(prev => prev.map(t => t.id === saved.id ? saved : t))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cambiar el estado')
    }
  }

  async function handleSeed() {
    const ok = await confirm({ title: 'Cargar tareas iniciales', message: `Se crearán ${SEED_TASKS.length} tareas transcritas de las notas en papel. Podrás editarlas o borrarlas después.` })
    if (!ok) return
    setSeeding(true)
    try {
      const created: GoyaTask[] = []
      for (const t of SEED_TASKS) {
        created.push(await upsertGoyaTask({ ...t, photos: [] }))
      }
      setTasks(prev => [...prev, ...created])
      toast.success(`${created.length} tareas cargadas`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar las tareas')
    } finally {
      setSeeding(false)
    }
  }

  if (loading) return <PageLoading rows={6} />

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Store size={18} className="text-blue-600 dark:text-blue-400" />
            Tienda Goya
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Tareas pendientes por planta — se notifica a quien se le asigne cada una.
          </p>
        </div>
        {tasks.length === 0 && (
          <Button size="sm" variant="outline" onClick={handleSeed} disabled={seeding}>
            <Sparkles size={14} /> {seeding ? 'Cargando...' : 'Cargar tareas iniciales'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {STATUS_ORDER.map(s => (
          <button key={s} onClick={() => toggleStatusFilter(s)} className="text-left focus:outline-none">
            <div className={cn(
              'rounded-xl border border-gray-200 dark:border-slate-700 p-3',
              statusFilter === s && 'ring-2 ring-blue-400'
            )}>
              <div className="text-xl font-bold text-gray-800 dark:text-slate-100">{stats[s]}</div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400">{STATUS_META[s].label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className={cn(inputClass, 'pl-9')}
          placeholder="Buscar tarea..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Store size={28} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-slate-400">Todavía no hay ninguna tarea de Goya.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {FLOORS.map(floor => {
            const floorTasks = filtered.filter(t => t.floor === floor)
            if (search || statusFilter) {
              if (floorTasks.length === 0) return null
            }
            return (
              <div key={floor}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">{FLOOR_LABELS[floor]}</h3>
                  <Button size="sm" variant="outline" onClick={() => openCreate(floor)}><Plus size={13} /> Añadir tarea</Button>
                </div>
                {floorTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 pl-1">Sin tareas.</p>
                ) : (
                  <div className="space-y-1.5">
                    {floorTasks.map(task => (
                      <div key={task.id} className={cn(
                        'flex items-center gap-3 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2.5',
                        task.status === 'done' && 'opacity-60'
                      )}>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-medium text-gray-800 dark:text-slate-100', task.status === 'done' && 'line-through')}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
                            {task.notes && <span className="truncate">{task.notes}</span>}
                            {task.responsible && <span className="shrink-0">· {task.responsible.name}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {STATUS_ORDER.map(s => (
                            <button
                              key={s}
                              onClick={() => handleQuickStatus(task, s)}
                              className={cn(
                                'px-2 py-1 text-[11px] font-medium rounded-full border transition-colors',
                                task.status === s
                                  ? cn(STATUS_META[s].className, 'border-transparent')
                                  : 'bg-transparent text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-600 hover:border-gray-300'
                              )}
                            >
                              {STATUS_META[s].label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEdit(task)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 size={13} /></button>
                          <button onClick={() => handleDelete(task)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar tarea' : 'Nueva tarea'} size="sm">
        <div className="p-5 space-y-3">
          <div>
            <label className={labelClass}>Planta</label>
            <select className={inputClass} value={form.floor ?? 1} onChange={e => setForm(f => ({ ...f, floor: Number(e.target.value) }))}>
              {FLOORS.map(f => <option key={f} value={f}>{FLOOR_LABELS[f]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>¿Qué hay que hacer? *</label>
            <input className={inputClass} value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Cambiar downlight fundido" />
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={inputClass} rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Estado</label>
              <select className={inputClass} value={form.status || 'pending'} onChange={e => setForm(f => ({ ...f, status: e.target.value as GoyaTaskStatus }))}>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Responsable</label>
              <select className={inputClass} value={form.responsible_id || ''} onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value ? Number(e.target.value) : undefined }))}>
                <option value="">Sin asignar</option>
                {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Fotos</label>
            <PhotoUpload
              photos={form.photos || []}
              onChange={photos => setForm(f => ({ ...f, photos }))}
              prefix={`goya-${form.id ?? 'new'}-${Date.now()}-`}
              uploadFn={uploadGoyaTaskPhoto}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
