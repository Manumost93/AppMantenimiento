import { useState, useEffect } from 'react'
import { Boxes, Plus, Trash2, Layers, StickyNote, Image as ImageIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import {
  getBuildingFloors, upsertBuildingFloor, deleteBuildingFloor, uploadBuildingPlanImage,
  getBuildingMarkers, upsertBuildingMarker, deleteBuildingMarker,
  getCriticalAssetsLite, getEdgeAssets, getLinkedRecordsForAsset, getEdgeAssetRepairs,
} from '@/lib/supabase'
import type { LinkedAssetRecord } from '@/lib/supabase'
import type { BuildingFloor, BuildingMarker, CriticalAssetLite, EdgeAsset, EdgeAssetRepair } from '@/types'
import { PageLoading } from '@/components/Skeleton'
import BuildingScene from '@/components/building3d/BuildingScene'
import CriticalAssetPicker from '@/components/CriticalAssetPicker'
import EdgeAssetPicker from '@/components/EdgeAssetPicker'
import { ASSET_TYPE_META, STATUS_META } from '@/lib/edgeAssets'
import { cn, formatCurrency } from '@/lib/utils'

const inputClass = 'w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'

type NewMarkerLinkType = 'critical_asset' | 'edge_asset' | 'note'

export default function BuildingModelPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { worker } = useAuth()

  const { data: floors, setData: setFloors, loading: loadingFloors } = useRealtimeTable('building_floors', getBuildingFloors)
  const { data: markers, setData: setMarkers, loading: loadingMarkers } = useRealtimeTable('building_markers', getBuildingMarkers)
  const [criticalAssets, setCriticalAssets] = useState<CriticalAssetLite[]>([])
  const [edgeAssets, setEdgeAssets] = useState<EdgeAsset[]>([])

  useEffect(() => {
    getCriticalAssetsLite().then(setCriticalAssets).catch(() => {})
    getEdgeAssets().then(setEdgeAssets).catch(() => {})
  }, [])

  const [activeFloorId, setActiveFloorId] = useState<number | null>(null)

  const [showFloorDialog, setShowFloorDialog] = useState(false)
  const [floorForm, setFloorForm] = useState<Partial<BuildingFloor>>({})
  const [floorFile, setFloorFile] = useState<File | null>(null)
  const [savingFloor, setSavingFloor] = useState(false)

  const [newMarkerTarget, setNewMarkerTarget] = useState<{ floorId: number; posX: number; posY: number } | null>(null)
  const [newMarkerType, setNewMarkerType] = useState<NewMarkerLinkType>('critical_asset')
  const [newMarkerCriticalAssetId, setNewMarkerCriticalAssetId] = useState<number | undefined>()
  const [newMarkerEdgeAssetId, setNewMarkerEdgeAssetId] = useState<number | undefined>()
  const [newMarkerLabel, setNewMarkerLabel] = useState('')
  const [newMarkerNote, setNewMarkerNote] = useState('')
  const [savingMarker, setSavingMarker] = useState(false)

  const [selectedMarker, setSelectedMarker] = useState<BuildingMarker | null>(null)
  const [linkedRecords, setLinkedRecords] = useState<LinkedAssetRecord[]>([])
  const [edgeRepairs, setEdgeRepairs] = useState<EdgeAssetRepair[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [viewingPlanFloor, setViewingPlanFloor] = useState<BuildingFloor | null>(null)

  function markerColor(marker: BuildingMarker) {
    if (marker.critical_asset_id) return { fill: '#2563EB', ring: '#1D4ED8' }
    if (marker.edge_asset_id) {
      const asset = edgeAssets.find(a => a.id === marker.edge_asset_id)
      const color = asset ? STATUS_META[asset.status].color : '#F59E0B'
      return { fill: color, ring: color }
    }
    return { fill: '#8B5CF6', ring: '#7C3AED' }
  }

  async function openMarkerDetail(marker: BuildingMarker) {
    setSelectedMarker(marker)
    setLinkedRecords([])
    setEdgeRepairs([])
    if (marker.critical_asset_id) {
      setLoadingDetail(true)
      try { setLinkedRecords(await getLinkedRecordsForAsset(marker.critical_asset_id)) } finally { setLoadingDetail(false) }
    } else if (marker.edge_asset_id) {
      setLoadingDetail(true)
      try { setEdgeRepairs(await getEdgeAssetRepairs(marker.edge_asset_id)) } finally { setLoadingDetail(false) }
    }
  }

  function handleFloorClick(floorId: number, posX: number, posY: number) {
    setNewMarkerTarget({ floorId, posX, posY })
    setNewMarkerType('critical_asset')
    setNewMarkerCriticalAssetId(undefined)
    setNewMarkerEdgeAssetId(undefined)
    setNewMarkerLabel('')
    setNewMarkerNote('')
  }

  async function handleSaveMarker() {
    if (!newMarkerTarget) return
    const payload: Partial<BuildingMarker> = {
      floor_id: newMarkerTarget.floorId,
      pos_x: newMarkerTarget.posX,
      pos_y: newMarkerTarget.posY,
      created_by_id: worker?.id,
    }
    if (newMarkerType === 'critical_asset') {
      if (!newMarkerCriticalAssetId) { toast.error('Selecciona un activo crítico'); return }
      payload.critical_asset_id = newMarkerCriticalAssetId
    } else if (newMarkerType === 'edge_asset') {
      if (!newMarkerEdgeAssetId) { toast.error('Selecciona un activo edge'); return }
      payload.edge_asset_id = newMarkerEdgeAssetId
    } else {
      if (!newMarkerLabel.trim()) { toast.error('Escribe un título para la nota'); return }
      payload.label = newMarkerLabel.trim()
      payload.note_text = newMarkerNote.trim() || undefined
    }
    setSavingMarker(true)
    try {
      const saved = await upsertBuildingMarker(payload)
      setMarkers(prev => [...prev, saved])
      toast.success('Marcador añadido')
      setNewMarkerTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar el marcador')
    } finally {
      setSavingMarker(false)
    }
  }

  async function handleDeleteMarker() {
    if (!selectedMarker) return
    const ok = await confirm({ title: 'Eliminar marcador', message: '¿Eliminar este marcador del plano?' })
    if (!ok) return
    try {
      await deleteBuildingMarker(selectedMarker.id)
      setMarkers(prev => prev.filter(m => m.id !== selectedMarker.id))
      toast.success('Marcador eliminado')
      setSelectedMarker(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  function openNewFloor() {
    setFloorForm({ floor_order: floors.length })
    setFloorFile(null)
    setShowFloorDialog(true)
  }

  async function handleSaveFloor() {
    if (!floorForm.name?.trim()) { toast.error('Ponle un nombre a la planta'); return }
    setSavingFloor(true)
    try {
      let plan_image_url = floorForm.plan_image_url
      if (floorFile) {
        const path = `${Date.now()}-${floorFile.name}`
        plan_image_url = await uploadBuildingPlanImage(floorFile, path)
      }
      const saved = await upsertBuildingFloor({ ...floorForm, plan_image_url })
      setFloors(prev => floorForm.id ? prev.map(f => f.id === saved.id ? saved : f) : [...prev, saved])
      toast.success('Planta guardada')
      setShowFloorDialog(false)
    } catch (e) {
      console.error('Error guardando planta:', e)
      const msg = e instanceof Error ? e.message : ''
      toast.error(msg ? `Error al guardar la planta: ${msg}` : 'Error al guardar la planta.')
    } finally {
      setSavingFloor(false)
    }
  }

  async function handleDeleteFloor(floor: BuildingFloor) {
    const ok = await confirm({ title: 'Eliminar planta', message: `¿Eliminar "${floor.name}"? Se eliminarán también sus marcadores.` })
    if (!ok) return
    try {
      await deleteBuildingFloor(floor.id, floor.name)
      setFloors(prev => prev.filter(f => f.id !== floor.id))
      setMarkers(prev => prev.filter(m => m.floor_id !== floor.id))
      if (activeFloorId === floor.id) setActiveFloorId(null)
      toast.success('Planta eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar la planta')
    }
  }

  const criticalAssetLabel = (id: number) => {
    const a = criticalAssets.find(x => x.id === id)
    return a ? `${a.asset_code} · ${a.description}` : `Activo #${id}`
  }
  const edgeAssetLabel = (id: number) => edgeAssets.find(x => x.id === id)?.name ?? `Activo #${id}`

  if (loadingFloors || loadingMarkers) return <PageLoading rows={6} />

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Boxes size={18} className="text-blue-600 dark:text-blue-400" />
            Modelo 3D del edificio
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Navega el edificio en 3D y consulta o añade activos, cuadros eléctricos y averías directamente sobre el plano.
          </p>
        </div>
        <Button size="sm" onClick={openNewFloor}><Plus size={14} /> Añadir planta</Button>
      </div>

      {floors.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Layers size={28} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
              Todavía no hay ninguna planta. Añade la primera con la foto de su plano.
            </p>
            <Button size="sm" onClick={openNewFloor}><Plus size={14} /> Añadir planta</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveFloorId(null)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg border',
                activeFloorId === null
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'
              )}
            >
              Todas las plantas
            </button>
            {[...floors].sort((a, b) => b.floor_order - a.floor_order).map(f => (
              <div key={f.id} className="flex items-center">
                <button
                  onClick={() => setActiveFloorId(f.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border',
                    activeFloorId === f.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'
                  )}
                >
                  {f.name}
                </button>
                {f.plan_image_url && (
                  <button onClick={() => setViewingPlanFloor(f)} className="ml-1 p-1 text-gray-300 hover:text-blue-500" title="Ver plano original">
                    <ImageIcon size={12} />
                  </button>
                )}
                <button onClick={() => handleDeleteFloor(f)} className="ml-1 p-1 text-gray-300 hover:text-red-500" title="Eliminar planta">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div style={{ height: '60vh', minHeight: 420 }}>
              <BuildingScene
                floors={floors}
                markers={markers}
                activeFloorId={activeFloorId}
                markerColor={markerColor}
                onMarkerClick={openMarkerDetail}
                onFloorClick={handleFloorClick}
              />
            </div>
          </Card>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">
            Arrastra para rotar, rueda para zoom. Pincha un punto vacío del plano para añadir un marcador; pincha un marcador existente para ver su ficha.
          </p>
        </>
      )}

      <Dialog open={showFloorDialog} onClose={() => setShowFloorDialog(false)} title="Nueva planta" size="sm">
        <div className="p-5 space-y-3">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input className={inputClass} placeholder="Ej: Planta baja, Planta -1..." value={floorForm.name || ''} onChange={e => setFloorForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Orden vertical (0 = planta baja, negativo = sótano)</label>
            <input type="number" className={inputClass} value={floorForm.floor_order ?? 0} onChange={e => setFloorForm(f => ({ ...f, floor_order: Number(e.target.value) }))} />
          </div>
          <div>
            <label className={labelClass}>Foto del plano</label>
            <input type="file" accept="image/*" className={inputClass} onChange={e => setFloorFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowFloorDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveFloor} disabled={savingFloor}>{savingFloor ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!newMarkerTarget} onClose={() => setNewMarkerTarget(null)} title="Nuevo marcador" size="sm">
        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            {([
              ['critical_asset', 'Activo Crítico'],
              ['edge_asset', 'Activo Edge / Cuadro'],
              ['note', 'Nota libre'],
            ] as [NewMarkerLinkType, string][]).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setNewMarkerType(type)}
                className={cn(
                  'flex-1 text-xs font-medium px-2 py-1.5 rounded-lg border',
                  newMarkerType === type
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {newMarkerType === 'critical_asset' && (
            <div>
              <label className={labelClass}>Activo Crítico</label>
              <CriticalAssetPicker value={newMarkerCriticalAssetId} onChange={setNewMarkerCriticalAssetId} />
            </div>
          )}
          {newMarkerType === 'edge_asset' && (
            <div>
              <label className={labelClass}>Activo Edge (rack, cuadro, UPS...)</label>
              <EdgeAssetPicker value={newMarkerEdgeAssetId} onChange={setNewMarkerEdgeAssetId} />
            </div>
          )}
          {newMarkerType === 'note' && (
            <>
              <div>
                <label className={labelClass}>Título *</label>
                <input className={inputClass} value={newMarkerLabel} onChange={e => setNewMarkerLabel(e.target.value)} placeholder="Ej: Posible avería, punto a revisar..." />
              </div>
              <div>
                <label className={labelClass}>Detalle</label>
                <textarea className={inputClass} rows={3} value={newMarkerNote} onChange={e => setNewMarkerNote(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setNewMarkerTarget(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveMarker} disabled={savingMarker}>{savingMarker ? 'Guardando...' : 'Añadir marcador'}</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!selectedMarker} onClose={() => setSelectedMarker(null)} title="Marcador" size="md">
        {selectedMarker && (
          <div className="p-5 space-y-3">
            {selectedMarker.critical_asset_id && (
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-100">
                <Boxes size={16} className="text-blue-600" /> {criticalAssetLabel(selectedMarker.critical_asset_id)}
              </div>
            )}
            {selectedMarker.edge_asset_id && (() => {
              const asset = edgeAssets.find(a => a.id === selectedMarker.edge_asset_id)
              const meta = asset ? ASSET_TYPE_META[asset.asset_type] : null
              const Icon = meta?.icon ?? Boxes
              return (
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-100">
                  <Icon size={16} className="text-amber-600" /> {edgeAssetLabel(selectedMarker.edge_asset_id)}
                  {asset && (
                    <span className={cn('ml-1 text-[10px] px-1.5 py-0.5 rounded-full', STATUS_META[asset.status].className)}>
                      {STATUS_META[asset.status].label}
                    </span>
                  )}
                </div>
              )
            })()}
            {selectedMarker.label && (
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-100">
                  <StickyNote size={16} className="text-violet-600" /> {selectedMarker.label}
                </div>
                {selectedMarker.note_text && <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">{selectedMarker.note_text}</p>}
              </div>
            )}

            {loadingDetail && <p className="text-xs text-gray-400">Cargando histórico...</p>}

            {selectedMarker.critical_asset_id && !loadingDetail && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Averías / reparaciones vinculadas</p>
                {linkedRecords.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin averías registradas.</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {linkedRecords.map((r, i) => (
                      <div key={i} className="border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-600 dark:text-slate-300">{r.source} · {r.date}</span>
                          {r.cost > 0 && <span className="font-bold text-gray-800 dark:text-slate-100">{formatCurrency(r.cost)}</span>}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">{r.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedMarker.edge_asset_id && !loadingDetail && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Histórico de reparaciones</p>
                {edgeRepairs.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin reparaciones registradas.</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {edgeRepairs.map(r => (
                      <div key={r.id} className="border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-600 dark:text-slate-300">{r.date}</span>
                          <span className="font-bold text-gray-800 dark:text-slate-100">{formatCurrency(r.total_cost)}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">{r.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-slate-700">
              <Button variant="danger" size="sm" onClick={handleDeleteMarker}><Trash2 size={14} /> Eliminar marcador</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={!!viewingPlanFloor} onClose={() => setViewingPlanFloor(null)} title={viewingPlanFloor?.name} size="xl">
        {viewingPlanFloor?.plan_image_url && (
          <div className="p-3">
            <img src={viewingPlanFloor.plan_image_url} alt={viewingPlanFloor.name} className="w-full h-auto rounded-lg" />
          </div>
        )}
      </Dialog>
    </div>
  )
}
