import { useState, useEffect } from 'react'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { useToast } from '@/contexts/ToastContext'
import { Plus, Trash2, CheckCircle2, Clock, Truck, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SkeletonKpis, SkeletonCard } from '@/components/Skeleton'
import { getWasteRequests, upsertWasteRequest, deleteWasteRequest, getWorkers } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { WasteRequest, WasteRequestType, TeamMember } from '@/types'
import { cn, formatDateShort, todayIso } from '@/lib/utils'

const TYPE_INFO: Record<WasteRequestType, { label: string; emoji: string; desc: string; color: string }> = {
  pickup:          { label: 'Vaciado urgente',   emoji: '🚛', desc: 'El contenedor está lleno o casi lleno', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  extra_container: { label: 'Contenedor extra',  emoji: '📦', desc: 'Se necesita un contenedor adicional',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  prevention:      { label: 'Previsión de carga', emoji: '📋', desc: 'Prevemos alta generación de residuos',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
}

const STATUS_INFO = {
  pending:   { label: 'Pendiente',   color: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300', icon: Clock },
  requested: { label: 'Solicitado',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Truck },
  resolved:  { label: 'Resuelto',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle2 },
}

export default function WastePage() {
  const toast = useToast()
  const { worker, isAdmin } = useAuth()
  const { data: requests, setData: setRequests, loading } = useRealtimeTable('waste_requests', getWasteRequests)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showDialog, setShowDialog] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [toDelete, setToDelete] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<WasteRequest>>({ type: 'pickup', status: 'pending' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getWorkers().then(setWorkers)
  }, [])

  const filtered = filterStatus ? requests.filter(r => r.status === filterStatus) : requests

  const active = requests.filter(r => r.status !== 'resolved')
  const pending = requests.filter(r => r.status === 'pending').length
  const requested = requests.filter(r => r.status === 'requested').length
  const resolved = requests.filter(r => r.status === 'resolved').length

  function openCreate() {
    setForm({ type: 'pickup', status: 'pending', date: todayIso(), created_by_id: worker?.id })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.type) return
    setSaving(true)
    try {
      const saved = await upsertWasteRequest(form)
      const withCreator = { ...saved, created_by: workers.find(w => w.id === saved.created_by_id) }
      setRequests(prev => [withCreator, ...prev])
      setShowDialog(false)
      toast.success('Solicitud creada')
    } catch { toast.error('Error al guardar.') }
    finally { setSaving(false) }
  }

  async function handleStatusChange(req: WasteRequest, newStatus: WasteRequest['status']) {
    try {
      const updated = await upsertWasteRequest({
        ...req,
        status: newStatus,
        resolved_at: newStatus === 'resolved' ? todayIso() : undefined,
      })
      setRequests(prev => prev.map(r => r.id === req.id
        ? { ...updated, created_by: workers.find(w => w.id === updated.created_by_id) }
        : r
      ))
      toast.success(newStatus === 'resolved' ? 'Solicitud resuelta' : 'Estado actualizado')
    } catch { toast.error('Error al actualizar.') }
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await deleteWasteRequest(toDelete)
      setRequests(prev => prev.filter(r => r.id !== toDelete))
      toast.success('Solicitud eliminada')
    } catch { toast.error('No se pudo eliminar.') }
    finally { setShowConfirm(false); setToDelete(null) }
  }

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🗑️ Residuos / Contenedores
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {active.length} avisos activos
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Nuevo aviso
        </Button>
      </div>

      {/* KPIs — clickables como filtro rápido */}
      {loading ? <SkeletonKpis count={3} /> : (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pendientes',  val: 'pending',   value: pending,   color: 'text-gray-600 dark:text-gray-300',       bg: 'bg-gray-50 dark:bg-slate-700',         ring: 'ring-gray-400',   icon: Clock },
            { label: 'Solicitados', val: 'requested', value: requested, color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     ring: 'ring-amber-400',  icon: Truck },
            { label: 'Resueltos',   val: 'resolved',  value: resolved,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'ring-emerald-400', icon: CheckCircle2 },
          ].map(k => {
            const Icon = k.icon
            const active = filterStatus === k.val
            return (
              <button key={k.label} onClick={() => setFilterStatus(prev => prev === k.val ? '' : k.val)} className="text-left focus:outline-none">
                <div className={cn('rounded-xl border border-gray-200 dark:border-slate-700 p-3 flex items-center gap-2.5 transition-all', k.bg, active && `ring-2 ${k.ring}`)}>
                  <Icon size={18} className={k.color} />
                  <div>
                    <p className={cn('text-xl font-bold', k.color)}>{k.value}</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">{k.label}</p>
                  </div>
                  {active && <span className="ml-auto text-[10px] font-medium text-white bg-gray-500 dark:bg-slate-600 rounded-full px-1.5 py-0.5">✕</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Breadcrumb de filtro activo */}
      {filterStatus && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <span>Mostrando:</span>
          <span className="font-semibold text-gray-800 dark:text-white">{STATUS_INFO[filterStatus as WasteRequest['status']].label}</span>
          <span className="text-gray-400">({filtered.length})</span>
          <button onClick={() => setFilterStatus('')} className="ml-1 text-blue-500 hover:underline">Ver todos</button>
        </div>
      )}

      {/* Aviso si hay algo urgente */}
      {!loading && requests.some(r => r.type === 'pickup' && r.status === 'pending') && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">
            Hay vaciados urgentes pendientes de solicitar al servicio de residuos.
          </p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const typeInfo = TYPE_INFO[req.type]
            const statusInfo = STATUS_INFO[req.status]
            const StatusIcon = statusInfo.icon
            return (
              <div key={req.id} className={cn(
                'bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden transition-all',
                req.status === 'resolved' ? 'border-gray-200 dark:border-slate-700 opacity-60' : 'border-gray-200 dark:border-slate-700'
              )}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold', typeInfo.color)}>
                          {typeInfo.emoji} {typeInfo.label}
                        </span>
                        <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1', statusInfo.color)}>
                          <StatusIcon size={11} />
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{typeInfo.desc}</p>
                      {req.zone && <p className="text-xs font-medium text-gray-700 dark:text-slate-300">📍 {req.zone}</p>}
                      {req.notes && <p className="text-sm text-gray-600 dark:text-slate-300 mt-1 italic">"{req.notes}"</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] text-gray-400 dark:text-slate-500">{formatDateShort(req.date)}</span>
                        {req.created_by && (
                          <div className="flex items-center gap-1">
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                              style={{ backgroundColor: req.created_by.color }}>
                              {req.created_by.name[0]}
                            </div>
                            <span className="text-[11px] text-gray-400 dark:text-slate-500">{req.created_by.name.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => { setToDelete(req.id); setShowConfirm(true) }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Acciones de estado */}
                  {req.status !== 'resolved' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                      {req.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(req, 'requested')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition-colors"
                        >
                          <Truck size={13} />
                          Marcar como solicitado
                        </button>
                      )}
                      {(req.status === 'pending' || req.status === 'requested') && (
                        <button
                          onClick={() => handleStatusChange(req, 'resolved')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
                        >
                          <CheckCircle2 size={13} />
                          Resuelto
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">
              🗑️
              <p className="mt-2">{filterStatus ? 'No hay avisos con ese estado.' : 'No hay avisos de contenedores.'}</p>
              <button onClick={openCreate} className="mt-3 text-blue-500 underline text-xs">Crear el primero</button>
            </div>
          )}
        </div>
      )}

      {/* Dialog nuevo aviso */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title="Nuevo aviso de contenedor">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">Tipo de aviso *</label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(TYPE_INFO) as [WasteRequestType, typeof TYPE_INFO[WasteRequestType]][]).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setForm(f => ({ ...f, type: key }))}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                    form.type === key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  )}
                >
                  <span className="text-2xl">{info.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">{info.label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{info.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Zona / Ubicación (opcional)</label>
            <input
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Ej: Muelle de carga, Zona exterior..."
              value={form.zone ?? ''} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Notas adicionales</label>
            <textarea
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200 resize-none" rows={2}
              placeholder="Detalles sobre el tipo de residuo, cantidad estimada..."
              value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Crear aviso'}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={showConfirm}
        title="Eliminar aviso"
        message="¿Seguro que quieres eliminar este aviso de contenedor?"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => { setShowConfirm(false); setToDelete(null) }}
      />
    </div>
  )
}
