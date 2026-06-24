import { useState, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { Settings, Plus, Edit2, Trash2, Key, Info, Shield, Lock, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { getAreas, upsertArea, deleteArea, getWorkers, setWorkerPin, resetAllWorkerPins } from '@/lib/supabase'
import type { Area, TeamMember } from '@/types'
import { cn } from '@/lib/utils'

type Tab = 'sections' | 'pin' | 'security' | 'about'

export default function SettingsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { worker, isAdmin } = useAuth()

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Lock size={48} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Acceso restringido</h2>
        <p className="text-sm text-gray-400 max-w-xs">Esta sección es solo para administradores. Contacta con el encargado si necesitas hacer cambios.</p>
      </div>
    )
  }
  const [tab, setTab] = useState<Tab>('sections')

  // ── Secciones ──────────────────────────────────────────────────────────────
  const [areas, setAreas] = useState<Area[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loadingAreas, setLoadingAreas] = useState(true)
  const [showAreaDialog, setShowAreaDialog] = useState(false)
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [areaForm, setAreaForm] = useState<Partial<Area>>({ name: '', color: '#6B7280' })
  const [savingArea, setSavingArea] = useState(false)

  // ── PIN ─────────────────────────────────────────────────────────────────────
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [savingPin, setSavingPin] = useState(false)

  // ── Seguridad ───────────────────────────────────────────────────────────────
  const [resettingPins, setResettingPins] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  useEffect(() => {
    Promise.all([getAreas(), getWorkers()])
      .then(([a, w]) => { setAreas(a); setWorkers(w) })
      .finally(() => setLoadingAreas(false))
  }, [])

  // ── Secciones CRUD ─────────────────────────────────────────────────────────

  function openCreateArea() {
    setSelectedArea(null)
    setAreaForm({ name: '', color: '#6B7280', description: '' })
    setShowAreaDialog(true)
  }

  function openEditArea(a: Area) {
    setSelectedArea(a)
    setAreaForm({ ...a })
    setShowAreaDialog(true)
  }

  async function handleSaveArea() {
    if (!areaForm.name?.trim()) return
    setSavingArea(true)
    try {
      const saved = await upsertArea(selectedArea ? { ...areaForm, id: selectedArea.id } : areaForm)
      const withManager = { ...saved, manager: workers.find(w => w.id === saved.manager_id) }
      setAreas(prev => selectedArea ? prev.map(a => a.id === selectedArea.id ? withManager : a) : [...prev, withManager])
      setShowAreaDialog(false)
      toast.success(selectedArea ? 'Sección actualizada' : 'Sección creada')
    } catch { toast.error('Error al guardar.') } finally { setSavingArea(false) }
  }

  async function handleDeleteArea(a: Area) {
    const ok = await confirm({ title: 'Eliminar sección', message: `¿Eliminar la sección "${a.name}"? Las tareas asociadas quedarán sin sección.` })
    if (!ok) return
    try {
      await deleteArea(a.id)
      setAreas(prev => prev.filter(x => x.id !== a.id))
      toast.success('Sección eliminada')
    } catch { toast.error('No se pudo eliminar. Puede tener datos asociados.') }
  }

  // ── PIN ─────────────────────────────────────────────────────────────────────

  async function handleSavePin() {
    if (!worker) return
    if (pin1.length < 6) return setPinMsg('El PIN debe tener 6 dígitos.')
    if (pin1 !== pin2) return setPinMsg('Los PINs no coinciden.')
    if (!/^\d{6}$/.test(pin1)) return setPinMsg('Solo se permiten números.')
    setSavingPin(true)
    setPinMsg('')
    try {
      await setWorkerPin(worker.id, pin1)
      setPinMsg('✓ PIN actualizado correctamente.')
      setPin1('')
      setPin2('')
    } catch {
      setPinMsg('Error al guardar el PIN.')
    } finally { setSavingPin(false) }
  }

  const AREA_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316', '#06B6D4', '#EC4899', '#64748B', '#6B7280']

  return (
    <div className="p-5 space-y-4">
      <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
        <Settings size={18} className="text-gray-500" />
        Configuración
      </h2>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'sections' as Tab, label: 'Secciones', icon: Shield },
          { key: 'pin' as Tab, label: 'Mi PIN', icon: Key },
          { key: 'security' as Tab, label: 'Seguridad', icon: AlertTriangle },
          { key: 'about' as Tab, label: 'Acerca de', icon: Info },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors',
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              <Icon size={14} />{t.label}
            </button>
          )
        })}
      </div>

      {/* ── SECCIONES ── */}
      {tab === 'sections' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-700">Secciones / Áreas de trabajo</p>
              <p className="text-xs text-gray-400">Gestiona las secciones y sus encargados</p>
            </div>
            <Button size="sm" onClick={openCreateArea}><Plus size={14} />Nueva sección</Button>
          </div>

          {loadingAreas ? (
            <div className="text-center py-8 text-gray-400">Cargando...</div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {areas.map(area => (
                <Card key={area.id}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: area.color + '20', border: `2px solid ${area.color}` }}>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: area.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900">{area.name}</h3>
                        {area.description && <p className="text-xs text-gray-400 mt-0.5">{area.description}</p>}
                        {area.manager ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                              style={{ backgroundColor: area.manager.color }}>
                              {area.manager.name[0]}
                            </div>
                            <span className="text-xs text-gray-500">Encargado: <span className="font-medium">{area.manager.name}</span></span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 mt-1 block">Sin encargado asignado</span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEditArea(area)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteArea(area)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {areas.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-400">
                  <p>No hay secciones. Crea la primera.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PIN ── */}
      {tab === 'pin' && (
        <div className="max-w-sm space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            Cambia tu PIN de 6 dígitos. Lo necesitarás para acceder a tu área personal en este dispositivo.
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nuevo PIN (6 dígitos)</label>
            <input
              type="password"
              maxLength={6}
              pattern="[0-9]*"
              inputMode="numeric"
              className="w-full text-center tracking-[1em] text-2xl border border-gray-200 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="······"
              value={pin1}
              onChange={e => setPin1(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar PIN</label>
            <input
              type="password"
              maxLength={6}
              pattern="[0-9]*"
              inputMode="numeric"
              className="w-full text-center tracking-[1em] text-2xl border border-gray-200 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="······"
              value={pin2}
              onChange={e => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          {pinMsg && (
            <p className={cn('text-sm', pinMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500')}>{pinMsg}</p>
          )}
          <Button onClick={handleSavePin} disabled={savingPin || pin1.length < 6 || pin2.length < 6} className="w-full">
            {savingPin ? 'Guardando...' : 'Guardar PIN'}
          </Button>
        </div>
      )}

      {/* ── SEGURIDAD ── */}
      {tab === 'security' && (
        <div className="max-w-lg space-y-4">
          {/* Estado actual */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Shield size={15} className="text-blue-500" />
                Estado de seguridad
              </h3>
              {[
                { label: 'Conexión HTTPS (Vercel)', ok: true, note: 'Todo el tráfico está cifrado' },
                { label: 'Contraseñas con bcrypt', ok: true, note: 'Los PINs están hasheados (no texto plano)' },
                { label: 'Acceso por PIN de 6 dígitos', ok: true, note: 'Protege el área personal de cada trabajador' },
                { label: 'Notificaciones en tiempo real', ok: true, note: 'Supabase Realtime para asignaciones' },
                { label: 'RLS (control de acceso)', ok: false, note: 'Políticas permisivas — app de uso interno' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2.5">
                  {item.ok
                    ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    : <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className="text-xs font-medium text-gray-700 dark:text-slate-300">{item.label}</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500">{item.note}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recomendaciones */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Lock size={15} className="text-amber-500" />
                Recomendaciones
              </h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-medium">¿Quieres PINs más seguros?</p>
                <p>Aumentar a 6 dígitos mejora significativamente la seguridad. Para hacerlo:</p>
                <ol className="list-decimal ml-4 space-y-1 mt-1">
                  <li>Haz clic en <strong>"Forzar reset de PINs"</strong> — todos los compañeros tendrán que crear un PIN nuevo</li>
                  <li>Pide a cada compañero que use mínimo 6 dígitos al crear su nuevo PIN</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Acciones */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <RefreshCw size={15} className="text-red-500" />
                Acciones de seguridad
              </h3>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-xs text-red-700 dark:text-red-400">
                <p className="font-medium mb-1">Forzar actualización de PINs</p>
                <p>Borra todos los PINs actuales. Al siguiente inicio de sesión, cada compañero tendrá que crear un nuevo PIN. Úsalo si sospechas que algún PIN está comprometido.</p>
              </div>
              {resetMsg && (
                <p className={cn('text-sm', resetMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500')}>
                  {resetMsg}
                </p>
              )}
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 w-full"
                disabled={resettingPins}
                onClick={async () => {
                  const ok = await confirm({ title: 'Reiniciar todos los PINs', message: '¿Seguro? Todos los compañeros tendrán que crear un nuevo PIN la próxima vez que accedan.', confirmLabel: 'Sí, reiniciar', danger: true })
                  if (!ok) return
                  setResettingPins(true)
                  setResetMsg('')
                  try {
                    await resetAllWorkerPins()
                    setResetMsg('✓ PINs reiniciados. Los compañeros deberán crear uno nuevo.')
                  } catch {
                    setResetMsg('Error al reiniciar los PINs.')
                  } finally {
                    setResettingPins(false)
                  }
                }}
              >
                <RefreshCw size={14} />
                {resettingPins ? 'Reiniciando...' : 'Forzar reset de todos los PINs'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ACERCA DE ── */}
      {tab === 'about' && (
        <div className="max-w-md space-y-4">
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">IK</div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">IKEA Mantenimiento</h3>
                  <p className="text-xs text-gray-400">Versión 1.0.0</p>
                </div>
              </div>
              <div className="space-y-2 border-t border-gray-100 pt-4">
                {[
                  { label: 'Desarrollador', value: 'Manuel Honrado Vega' },
                  { label: 'Email', value: 'myjhonradov@gmail.com' },
                  { label: 'Tecnología', value: 'React 18 + Supabase + PWA' },
                  { label: 'Año', value: '2025' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-xs font-medium text-gray-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-gray-400">
            App diseñada para los equipos de mantenimiento de tiendas IKEA.<br />
            Gestión de tareas, incidencias y materiales en un solo lugar.
          </div>
        </div>
      )}

      {/* Dialog área */}
      <Dialog open={showAreaDialog} onClose={() => setShowAreaDialog(false)} title={selectedArea ? 'Editar sección' : 'Nueva sección'} size="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ej: KONE, Electricidad..." value={areaForm.name || ''} onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Descripción breve..." value={areaForm.description || ''} onChange={e => setAreaForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {AREA_COLORS.map(c => (
                <button key={c} onClick={() => setAreaForm(f => ({ ...f, color: c }))}
                  className={cn('w-8 h-8 rounded-full border-2 transition-all', areaForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105')}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                value={areaForm.color || '#6B7280'} onChange={e => setAreaForm(f => ({ ...f, color: e.target.value }))} title="Color personalizado" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Encargado</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={areaForm.manager_id || ''} onChange={e => setAreaForm(f => ({ ...f, manager_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin encargado</option>
              {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAreaDialog(false)} disabled={savingArea}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSaveArea} disabled={savingArea || !areaForm.name?.trim()}>
              {savingArea ? 'Guardando...' : selectedArea ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
