import { useState, useEffect } from 'react'
import { Warehouse as WarehouseIcon, Plus, Trash2, Edit2, Search, Package, ArrowLeft, PenLine, X, FileSpreadsheet, FileDown, LayoutGrid } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import {
  getWarehouses, upsertWarehouse, deleteWarehouse,
  getWarehouseSections, upsertWarehouseSection, deleteWarehouseSection,
  getWarehouseItems, upsertWarehouseItem, deleteWarehouseItem, uploadWarehousePhoto,
} from '@/lib/supabase'
import type { Warehouse, WarehouseSection, WarehouseItem, WarehouseKind } from '@/types'
import { PageLoading } from '@/components/Skeleton'
import PhotoUpload from '@/components/PhotoUpload'
import WarehouseFloorPlan from '@/components/WarehouseFloorPlan'
import { cn, todayIso, sanitizeFileName } from '@/lib/utils'

const inputClass = 'w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'
const UNIT_SUGGESTIONS = ['uds', 'cajas', 'palets', 'rollos', 'sacos', 'kg', 'm']

export default function WarehousesPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const { data: warehouses, setData: setWarehouses, loading: loadingWarehouses } = useRealtimeTable('warehouses', getWarehouses)
  const { data: sections, setData: setSections, loading: loadingSections } = useRealtimeTable('warehouse_sections', getWarehouseSections)
  const { data: items, setData: setItems, loading: loadingItems } = useRealtimeTable('warehouse_items', getWarehouseItems)

  const [viewKind, setViewKind] = useState<WarehouseKind>('warehouse')
  // (w.kind ?? 'warehouse'): si el SQL de la columna "kind" aún no se ha
  // ejecutado, los almacenes existentes vienen sin ese campo — se tratan
  // como 'warehouse' en vez de desaparecer de la lista.
  const kindWarehouses = warehouses.filter(w => (w.kind ?? 'warehouse') === viewKind)
  const kindLabel = viewKind === 'rack' ? 'racking' : 'almacén'
  const kindLabelCap = viewKind === 'rack' ? 'Racking' : 'Almacén'
  const sectionLabel = viewKind === 'rack' ? 'zona' : 'sección'
  const sectionLabelCap = viewKind === 'rack' ? 'Zona' : 'Sección'

  const [activeWarehouseId, setActiveWarehouseId] = useState<number | null>(null)
  useEffect(() => {
    if (kindWarehouses.length === 0) { setActiveWarehouseId(null); return }
    if (!kindWarehouses.some(w => w.id === activeWarehouseId)) setActiveWarehouseId(kindWarehouses[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKind, warehouses])

  function switchKind(kind: WarehouseKind) {
    setViewKind(kind)
    setSearch('')
  }

  const [search, setSearch] = useState('')

  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false)
  const [warehouseForm, setWarehouseForm] = useState<Partial<Warehouse>>({})
  const [savingWarehouse, setSavingWarehouse] = useState(false)

  const [showSectionDialog, setShowSectionDialog] = useState(false)
  const [sectionForm, setSectionForm] = useState<Partial<WarehouseSection>>({})
  const [savingSection, setSavingSection] = useState(false)

  const [viewingSection, setViewingSection] = useState<WarehouseSection | null>(null)
  const [sectionEditForm, setSectionEditForm] = useState<{ name: string; notes?: string }>({ name: '' })
  const [savingSectionInfo, setSavingSectionInfo] = useState(false)
  useEffect(() => {
    if (viewingSection) setSectionEditForm({ name: viewingSection.name, notes: viewingSection.notes })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingSection?.id])
  const [pendingNewSection, setPendingNewSection] = useState<{ name: string; notes?: string } | null>(null)
  const [drawSectionId, setDrawSectionId] = useState<number | null>(null)
  const drawMode = pendingNewSection !== null || drawSectionId !== null

  const [showItemDialog, setShowItemDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null)
  const [itemForm, setItemForm] = useState<Partial<WarehouseItem>>({})
  const [savingItem, setSavingItem] = useState(false)

  function openNewWarehouse() {
    setWarehouseForm({ kind: viewKind })
    setShowWarehouseDialog(true)
  }

  function openEditWarehouse(w: Warehouse) {
    setWarehouseForm({ ...w })
    setShowWarehouseDialog(true)
  }

  async function handleSaveWarehouse() {
    if (!warehouseForm.name?.trim()) { toast.error(`Ponle un nombre al ${kindLabel}`); return }
    setSavingWarehouse(true)
    try {
      const saved = await upsertWarehouse(warehouseForm)
      setWarehouses(prev => warehouseForm.id ? prev.map(w => w.id === saved.id ? saved : w) : [...prev, saved])
      setActiveWarehouseId(saved.id)
      toast.success(`${kindLabelCap} guardado`)
      setShowWarehouseDialog(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Error al guardar el ${kindLabel}`)
    } finally {
      setSavingWarehouse(false)
    }
  }

  async function handleDeleteWarehouse(w: Warehouse) {
    const label = w.kind === 'rack' ? 'racking' : 'almacén'
    const sectionOrZone = w.kind === 'rack' ? 'zonas' : 'secciones'
    const ok = await confirm({ title: `Eliminar ${label}`, message: `¿Eliminar "${w.name}"? Se eliminarán también sus ${sectionOrZone} y artículos.` })
    if (!ok) return
    try {
      await deleteWarehouse(w.id, w.name)
      setWarehouses(prev => prev.filter(x => x.id !== w.id))
      setSections(prev => prev.filter(s => s.warehouse_id !== w.id))
      if (activeWarehouseId === w.id) setActiveWarehouseId(null)
      toast.success(`${label === 'racking' ? 'Racking' : 'Almacén'} eliminado`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Error al eliminar el ${label}`)
    }
  }

  function openNewSection() {
    if (!activeWarehouseId) return
    setSectionForm({ warehouse_id: activeWarehouseId, photos: [] })
    setShowSectionDialog(true)
  }

  function handleStartDrawSection() {
    if (!sectionForm.name?.trim()) { toast.error(`Ponle un nombre a la ${sectionLabel}`); return }
    setShowSectionDialog(false)
    setPendingNewSection({ name: sectionForm.name.trim(), notes: sectionForm.notes })
  }

  function startRedrawSection(section: WarehouseSection) {
    setViewingSection(null)
    setDrawSectionId(section.id)
  }

  function cancelDraw() {
    setPendingNewSection(null)
    setDrawSectionId(null)
  }

  async function handleFloorPlanDraw(rect: { pos_x: number; pos_y: number; width: number; height: number }) {
    if (pendingNewSection && activeWarehouseId) {
      setSavingSection(true)
      try {
        const saved = await upsertWarehouseSection({
          warehouse_id: activeWarehouseId,
          name: pendingNewSection.name,
          notes: pendingNewSection.notes,
          photos: [],
          ...rect,
        })
        setSections(prev => [...prev, saved])
        toast.success(`${sectionLabelCap} creada`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Error al crear la ${sectionLabel}`)
      } finally {
        setSavingSection(false)
        setPendingNewSection(null)
      }
    } else if (drawSectionId) {
      const existing = sections.find(s => s.id === drawSectionId)
      if (!existing) { setDrawSectionId(null); return }
      try {
        const saved = await upsertWarehouseSection({ ...existing, ...rect })
        setSections(prev => prev.map(s => s.id === saved.id ? saved : s))
        toast.success('Posición actualizada')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al actualizar la posición')
      } finally {
        setDrawSectionId(null)
      }
    }
  }

  async function handleDeleteSection(s: WarehouseSection) {
    const ok = await confirm({ title: `Eliminar ${sectionLabel}`, message: `¿Eliminar "${s.name}"? Se eliminarán también sus artículos.` })
    if (!ok) return
    try {
      await deleteWarehouseSection(s.id, s.name)
      setSections(prev => prev.filter(x => x.id !== s.id))
      setItems(prev => prev.filter(i => i.section_id !== s.id))
      if (viewingSection?.id === s.id) setViewingSection(null)
      toast.success(`${sectionLabelCap} eliminada`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Error al eliminar la ${sectionLabel}`)
    }
  }

  async function handleSectionPhotosChange(photos: string[]) {
    if (!viewingSection) return
    try {
      const saved = await upsertWarehouseSection({ ...viewingSection, photos })
      setSections(prev => prev.map(s => s.id === saved.id ? saved : s))
      setViewingSection(saved)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar las fotos')
    }
  }

  async function handleSaveSectionInfo() {
    if (!viewingSection) return
    if (!sectionEditForm.name.trim()) { toast.error(`Ponle un nombre a la ${sectionLabel}`); return }
    setSavingSectionInfo(true)
    try {
      const saved = await upsertWarehouseSection({ ...viewingSection, name: sectionEditForm.name.trim(), notes: sectionEditForm.notes })
      setSections(prev => prev.map(s => s.id === saved.id ? saved : s))
      setViewingSection(saved)
      toast.success('Nombre actualizado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar el nombre')
    } finally {
      setSavingSectionInfo(false)
    }
  }

  function openNewItem(sectionId: number) {
    setEditingItem(null)
    setItemForm({ section_id: sectionId, quantity: 0, unit: 'uds', photos: [] })
    setViewingSection(null)
    setShowItemDialog(true)
  }

  function openEditItem(item: WarehouseItem) {
    setEditingItem(item)
    setItemForm({ ...item })
    setViewingSection(null)
    setShowItemDialog(true)
  }

  async function handleSaveItem() {
    if (!itemForm.name?.trim()) { toast.error('Ponle un nombre al artículo'); return }
    setSavingItem(true)
    try {
      const saved = await upsertWarehouseItem({ ...itemForm, photos: itemForm.photos ?? [] })
      setItems(prev => editingItem ? prev.map(i => i.id === saved.id ? saved : i) : [...prev, saved])
      toast.success('Artículo guardado')
      setShowItemDialog(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar el artículo')
    } finally {
      setSavingItem(false)
    }
  }

  async function handleDeleteItem(item: WarehouseItem) {
    const ok = await confirm({ title: 'Eliminar artículo', message: `¿Eliminar "${item.name}" del inventario?` })
    if (!ok) return
    try {
      await deleteWarehouseItem(item.id, item.name)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Artículo eliminado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar el artículo')
    }
  }

  function exportWarehouseCsv(warehouse: Warehouse) {
    const label = warehouse.kind === 'rack' ? 'Zona' : 'Sección'
    const warehouseSections = sections.filter(s => s.warehouse_id === warehouse.id)
    const header = [label, 'Artículo', 'Cantidad', 'Unidad', 'Notas', 'Tiene fotos']
    const rows = warehouseSections.flatMap(s => {
      const sectionItems = items.filter(i => i.section_id === s.id)
      if (sectionItems.length === 0) return [[s.name, '—', '', '', '', '']]
      return sectionItems.map(i => [s.name, i.name, i.quantity, i.unit, i.notes ?? '', i.photos.length > 0 ? 'Sí' : 'No'])
    })
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${warehouse.kind}-${sanitizeFileName(warehouse.name)}-${todayIso()}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function exportWarehousePdf(warehouse: Warehouse) {
    const label = warehouse.kind === 'rack' ? 'Zona' : 'Sección'
    const title = warehouse.kind === 'rack' ? 'Racking' : 'Almacén'
    const warehouseSections = sections.filter(s => s.warehouse_id === warehouse.id)
    const rows = warehouseSections.flatMap(s => {
      const sectionItems = items.filter(i => i.section_id === s.id)
      if (sectionItems.length === 0) return [[s.name, '—', '', '', '']]
      return sectionItems.map(i => [s.name, i.name, `${i.quantity} ${i.unit}`, i.notes ?? '—', i.photos.length > 0 ? 'Sí' : 'No'])
    })

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    doc.setFontSize(13)
    doc.text(`${title}: ${warehouse.name}`, 10, 14)
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`Inventario generado el ${new Date().toLocaleDateString('es-ES')} · ${rows.length} artículo(s)`, 10, 19)
    autoTable(doc, {
      startY: 24,
      head: [[label, 'Artículo', 'Cantidad', 'Notas', 'Fotos']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })
    doc.save(`${warehouse.kind}-${sanitizeFileName(warehouse.name)}-${todayIso()}.pdf`)
  }

  if (loadingWarehouses || loadingSections || loadingItems) return <PageLoading rows={6} />

  const activeWarehouse = warehouses.find(w => w.id === activeWarehouseId)
  const activeSections = sections.filter(s => s.warehouse_id === activeWarehouseId)
  const searchTrim = search.trim().toLowerCase()
  const searchResults = searchTrim
    ? items
        .filter(i => i.name.toLowerCase().includes(searchTrim))
        .map(i => {
          const section = sections.find(s => s.id === i.section_id)
          const warehouse = section ? warehouses.find(w => w.id === section.warehouse_id) : undefined
          return { item: i, section, warehouse }
        })
    : []

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <WarehouseIcon size={18} className="text-blue-600 dark:text-blue-400" />
            Almacenes Mantenimiento
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Inventario por almacén/racking y {sectionLabel}: cantidad, unidad y fotos de la mercancía.
          </p>
        </div>
        <Button size="sm" onClick={openNewWarehouse}><Plus size={14} /> Añadir {kindLabel}</Button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => switchKind('warehouse')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border',
            viewKind === 'warehouse'
              ? 'bg-gray-800 dark:bg-slate-600 text-white border-gray-800 dark:border-slate-600'
              : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'
          )}
        >
          <WarehouseIcon size={13} /> Almacenes
        </button>
        <button
          onClick={() => switchKind('rack')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border',
            viewKind === 'rack'
              ? 'bg-gray-800 dark:bg-slate-600 text-white border-gray-800 dark:border-slate-600'
              : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'
          )}
        >
          <LayoutGrid size={13} /> Racking taller
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className={cn(inputClass, 'pl-9')}
          placeholder="Buscar artículo en todos los almacenes y racking..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {searchTrim ? (
        <Card>
          <CardContent className="space-y-2">
            {searchResults.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin resultados para "{search}".</p>
            ) : (
              searchResults.map(({ item, section, warehouse }) => (
                <button
                  key={item.id}
                  onClick={() => openEditItem(item)}
                  className="w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{warehouse?.name ?? '—'} · {section?.name ?? '—'}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 shrink-0">{item.quantity} {item.unit}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      ) : kindWarehouses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <WarehouseIcon size={28} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Todavía no hay ningún {kindLabel}. Añade el primero.</p>
            <Button size="sm" onClick={openNewWarehouse}><Plus size={14} /> Añadir {kindLabel}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {kindWarehouses.map(w => (
              <div key={w.id} className="flex items-center">
                <button
                  onClick={() => setActiveWarehouseId(w.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border',
                    activeWarehouseId === w.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'
                  )}
                >
                  {w.name}
                </button>
                <button onClick={() => openEditWarehouse(w)} className="ml-1 p-1 text-gray-300 hover:text-blue-500" title={`Editar nombre del ${kindLabel}`}>
                  <Edit2 size={12} />
                </button>
                <button onClick={() => handleDeleteWarehouse(w)} className="ml-0.5 p-1 text-gray-300 hover:text-red-500" title={`Eliminar ${kindLabel}`}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-500 dark:text-slate-400">{activeSections.length} {sectionLabel}(es)</p>
            <div className="flex gap-2 flex-wrap">
              {activeWarehouse && (
                <>
                  <Button size="sm" variant="outline" onClick={() => exportWarehouseCsv(activeWarehouse)}>
                    <FileSpreadsheet size={14} /> CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportWarehousePdf(activeWarehouse)}>
                    <FileDown size={14} /> PDF
                  </Button>
                </>
              )}
              {drawMode ? (
                <Button size="sm" variant="outline" onClick={cancelDraw}><X size={14} /> Cancelar dibujo</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={openNewSection}><Plus size={14} /> Añadir {sectionLabel}</Button>
              )}
            </div>
          </div>

          <WarehouseFloorPlan
            sections={activeSections}
            drawMode={drawMode}
            onDrawComplete={handleFloorPlanDraw}
            onSectionClick={setViewingSection}
            aspectRatio={viewKind === 'rack' ? '3 / 4' : '16 / 9'}
            emptyLabel={viewKind === 'rack' ? 'Todavía no hay estantes/zonas dibujados en este racking.' : 'Todavía no hay secciones dibujadas en el plano.'}
          />

          {activeSections.some(s => s.pos_x == null) && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{sectionLabelCap}s sin ubicar en el plano</p>
              {activeSections.filter(s => s.pos_x == null).map(s => (
                <div key={s.id} className="flex items-center justify-between gap-2 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 dark:text-slate-200">{s.name}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => startRedrawSection(s)}><PenLine size={13} /> Dibujar</Button>
                    <button onClick={() => handleDeleteSection(s)} className="p-1.5 text-gray-300 hover:text-red-500" title={`Eliminar ${sectionLabel}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={showWarehouseDialog}
        onClose={() => setShowWarehouseDialog(false)}
        title={`${warehouseForm.id ? 'Editar' : 'Nuevo'} ${kindLabel}`}
        size="sm"
      >
        <div className="p-5 space-y-3">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input className={inputClass} value={warehouseForm.name || ''} onChange={e => setWarehouseForm(f => ({ ...f, name: e.target.value }))} placeholder={viewKind === 'rack' ? 'Ej: Racking 1' : 'Ej: Almacén Mantenimiento 1'} />
          </div>
          <div>
            <label className={labelClass}>Ubicación</label>
            <input className={inputClass} value={warehouseForm.location || ''} onChange={e => setWarehouseForm(f => ({ ...f, location: e.target.value }))} placeholder="Ej: Planta -1, junto a carga" />
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={inputClass} rows={2} value={warehouseForm.notes || ''} onChange={e => setWarehouseForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowWarehouseDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveWarehouse} disabled={savingWarehouse}>{savingWarehouse ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={showSectionDialog} onClose={() => setShowSectionDialog(false)} title={`Nueva ${sectionLabel}`} size="sm">
        <div className="p-5 space-y-3">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input className={inputClass} value={sectionForm.name || ''} onChange={e => setSectionForm(f => ({ ...f, name: e.target.value }))} placeholder={viewKind === 'rack' ? 'Ej: Estante 1, Balda superior...' : 'Ej: Estantería A, Zona eléctrico...'} />
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={inputClass} rows={2} value={sectionForm.notes || ''} onChange={e => setSectionForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">Después de guardar el nombre, dibuja el rectángulo de la {sectionLabel} directamente sobre {viewKind === 'rack' ? 'la vista frontal del racking' : 'el plano del almacén'}.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowSectionDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleStartDrawSection}><PenLine size={14} /> Continuar y dibujar</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!viewingSection} onClose={() => setViewingSection(null)} title={viewingSection?.name} size="lg">
        {viewingSection && (
          <div className="p-5 space-y-4">
            <div className="flex justify-end gap-2 -mt-2">
              <Button size="sm" variant="outline" onClick={() => startRedrawSection(viewingSection)}><PenLine size={13} /> Redibujar</Button>
              <Button size="sm" variant="danger" onClick={() => handleDeleteSection(viewingSection)}><Trash2 size={13} /> Eliminar {sectionLabel}</Button>
            </div>
            <div className="space-y-2 border-b border-gray-100 dark:border-slate-700 pb-4">
              <div>
                <label className={labelClass}>Nombre</label>
                <input className={inputClass} value={sectionEditForm.name} onChange={e => setSectionEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Notas</label>
                <textarea className={inputClass} rows={2} value={sectionEditForm.notes || ''} onChange={e => setSectionEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={handleSaveSectionInfo} disabled={savingSectionInfo}>
                  <Edit2 size={13} /> {savingSectionInfo ? 'Guardando...' : 'Guardar nombre/notas'}
                </Button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Fotos de la {sectionLabel}</label>
              <PhotoUpload
                photos={viewingSection.photos}
                onChange={handleSectionPhotosChange}
                prefix={`section-${viewingSection.id}-`}
                uploadFn={uploadWarehousePhoto}
              />
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Artículos</p>
              <Button size="sm" variant="outline" onClick={() => openNewItem(viewingSection.id)}><Plus size={14} /> Añadir artículo</Button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {items.filter(i => i.section_id === viewingSection.id).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin artículos todavía.</p>
              ) : (
                items.filter(i => i.section_id === viewingSection.id).map(item => (
                  <div key={item.id} className="flex items-center gap-3 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2.5">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.photos[0] ? <img src={item.photos[0]} alt={item.name} className="w-full h-full object-cover" /> : <Package size={16} className="text-gray-300 dark:text-slate-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{item.name}</p>
                      {item.notes && <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{item.notes}</p>}
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 shrink-0">{item.quantity} {item.unit}</span>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditItem(item)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 size={13} /></button>
                      <button onClick={() => handleDeleteItem(item)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={showItemDialog} onClose={() => setShowItemDialog(false)} title={editingItem ? 'Editar artículo' : 'Nuevo artículo'} size="sm">
        <div className="p-5 space-y-3">
          <button
            type="button"
            onClick={() => {
              setShowItemDialog(false)
              const section = sections.find(s => s.id === itemForm.section_id)
              if (section) setViewingSection(section)
            }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 -mt-1 mb-1"
          >
            <ArrowLeft size={12} /> Volver a la sección
          </button>
          <div>
            <label className={labelClass}>Nombre *</label>
            <input className={inputClass} value={itemForm.name || ''} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Tornillería M8, Filtro de aire..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Cantidad</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={itemForm.quantity ?? 0} onChange={e => setItemForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelClass}>Unidad</label>
              <input list="unit-suggestions" className={inputClass} value={itemForm.unit || 'uds'} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} />
              <datalist id="unit-suggestions">
                {UNIT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 -mt-2">
            Si no se puede contar con precisión, usa la unidad "palets" y pon el número de palets.
          </p>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={inputClass} rows={2} value={itemForm.notes || ''} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Fotos</label>
            <PhotoUpload
              photos={itemForm.photos || []}
              onChange={photos => setItemForm(f => ({ ...f, photos }))}
              prefix={`item-${itemForm.id ?? 'new'}-${Date.now()}-`}
              uploadFn={uploadWarehousePhoto}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowItemDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveItem} disabled={savingItem}>{savingItem ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
