import { useState, useEffect } from 'react'
import { Plus, Edit2, UserCheck, UserX, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { getWorkers, upsertWorker, deleteWorker, toggleWorkerActive } from '@/lib/supabase'
import type { TeamMember } from '@/types'
import { cn, getInitials } from '@/lib/utils'

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [form, setForm] = useState<Partial<TeamMember>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setTeam(await getWorkers()) } catch { setError('Error al cargar el equipo') }
    setLoading(false)
  }

  function openCreate() {
    setSelected(null)
    setForm({ name: '', role: '', color: '#3B82F6', active: true })
    setShowDialog(true)
    setError('')
  }

  function openEdit(m: TeamMember) {
    setSelected(m)
    setForm({ ...m })
    setShowDialog(true)
    setError('')
  }

  async function handleSave() {
    if (!form.name?.trim()) return
    setSaving(true)
    setError('')
    try {
      const saved = await upsertWorker(selected ? { ...form, id: selected.id } : form)
      setTeam(prev => selected
        ? prev.map(m => m.id === selected.id ? saved : m)
        : [...prev, saved]
      )
      setShowDialog(false)
    } catch {
      setError('Error al guardar. Comprueba la conexión.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(m: TeamMember) {
    if (!confirm(`¿Eliminar a ${m.name}? Esta acción no se puede deshacer.`)) return
    try {
      await deleteWorker(m.id)
      setTeam(prev => prev.filter(w => w.id !== m.id))
    } catch {
      alert('No se pudo eliminar. Puede tener tareas asociadas.')
    }
  }

  async function handleToggleActive(m: TeamMember) {
    try {
      await toggleWorkerActive(m.id, !m.active)
      setTeam(prev => prev.map(w => w.id === m.id ? { ...w, active: !w.active } : w))
    } catch {
      alert('Error al actualizar.')
    }
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Equipo de mantenimiento</h2>
          <p className="text-xs text-gray-500">{team.filter(m => m.active).length} compañeros activos</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Nuevo compañero
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando equipo...</div>
      ) : team.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No hay compañeros aún.</p>
          <Button size="sm" className="mt-3" onClick={openCreate}>Añadir el primero</Button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {team.map(member => (
            <Card key={member.id} className={cn(!member.active && 'opacity-60')}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: member.color }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-sm">{member.name}</h3>
                      <Badge className={cn(member.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                        {member.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{member.role}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(member)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleToggleActive(member)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title={member.active ? 'Desactivar' : 'Activar'}>
                      {member.active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                    <button onClick={() => handleDelete(member)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: member.color }} />
                  <span className="text-[11px] text-gray-400">Color identificativo</span>
                </div>
                {member.observations && (
                  <p className="mt-2 text-xs text-gray-400 line-clamp-2">{member.observations}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar compañero' : 'Nuevo compañero'} size="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Nombre y apellidos"
              value={form.name || ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rol / Especialidad</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ej: Electricidad, Fontanería..."
              value={form.role || ''}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Color identificativo</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color || '#3B82F6'}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-10 h-9 border border-gray-200 rounded cursor-pointer" />
              <span className="text-xs text-gray-500">{form.color}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              rows={2}
              value={form.observations || ''}
              onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.active !== false}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="rounded border-gray-300" />
            <label htmlFor="active" className="text-sm text-gray-700">Compañero activo</label>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name?.trim()}>
              {saving ? 'Guardando...' : selected ? 'Guardar cambios' : 'Crear compañero'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
