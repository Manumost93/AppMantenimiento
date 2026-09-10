import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShoppingCart, Plus, Trash2, Edit2, Search, QrCode, Printer, Layers, AlertTriangle, Wrench } from 'lucide-react'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { getCarts, upsertCart, deleteCart, uploadCartPhoto } from '@/lib/supabase'
import type { Cart, CartStatus } from '@/types'
import { PageLoading } from '@/components/Skeleton'
import PhotoUpload from '@/components/PhotoUpload'
import { cn } from '@/lib/utils'

const inputClass = 'w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'

const STATUS_META: Record<CartStatus, { label: string; className: string }> = {
  ok: { label: 'Operativo', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  damaged: { label: 'Dañado', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  maintenance: { label: 'En mantenimiento', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  retired: { label: 'De baja', className: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300' },
}
const STATUS_ORDER: CartStatus[] = ['ok', 'damaged', 'maintenance', 'retired']

function nextCode(carts: Cart[]): string {
  let max = 0
  for (const c of carts) {
    const m = c.code.match(/(\d+)\s*$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `CARRO-${String(max + 1).padStart(3, '0')}`
}

export default function CartsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: carts, setData: setCarts, loading } = useRealtimeTable('carts', getCarts)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CartStatus | ''>('')

  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<Cart | null>(null)
  const [form, setForm] = useState<Partial<Cart>>({ status: 'ok', photos: [] })
  const [saving, setSaving] = useState(false)
  const [printingAll, setPrintingAll] = useState(false)

  // Al escanear un QR físico (?code=CARRO-001) se abre directamente su ficha.
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code || carts.length === 0) return
    const found = carts.find(c => c.code === code)
    if (found) {
      setSelected(found)
      setForm({ ...found })
      setShowDialog(true)
    }
    searchParams.delete('code')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carts])

  const filtered = carts.filter(c =>
    (!search || c.code.toLowerCase().includes(search.toLowerCase()) || (c.location ?? '').toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || c.status === statusFilter)
  )

  const stats = {
    total: carts.length,
    ok: carts.filter(c => c.status === 'ok').length,
    damaged: carts.filter(c => c.status === 'damaged').length,
    maintenance: carts.filter(c => c.status === 'maintenance').length,
  }

  function toggleStatusFilter(s: CartStatus) {
    setStatusFilter(prev => prev === s ? '' : s)
  }

  function openCreate() {
    setSelected(null)
    setForm({ code: nextCode(carts), status: 'ok', photos: [] })
    setShowDialog(true)
  }

  function openEdit(cart: Cart) {
    setSelected(cart)
    setForm({ ...cart })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.code?.trim()) { toast.error('Ponle un código al carro'); return }
    setSaving(true)
    try {
      const saved = await upsertCart(selected ? { ...form, id: selected.id } : form)
      setCarts(prev => selected ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved])
      toast.success(selected ? 'Carro actualizado' : 'Carro creado')
      setShowDialog(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar el carro')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cart: Cart) {
    const ok = await confirm({ title: 'Eliminar carro', message: `¿Eliminar "${cart.code}" del inventario?` })
    if (!ok) return
    try {
      await deleteCart(cart.id, cart.code)
      setCarts(prev => prev.filter(c => c.id !== cart.id))
      toast.success('Carro eliminado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar el carro')
    }
  }

  async function printQr(cart: Cart) {
    try {
      const url = `${window.location.origin}/carts?code=${encodeURIComponent(cart.code)}`
      const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 })
      const doc = new jsPDF({ unit: 'mm', format: [80, 50] })
      doc.addImage(qrDataUrl, 'PNG', 3, 3, 44, 44)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text(cart.code, 50, 20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      if (cart.location) doc.text(doc.splitTextToSize(cart.location, 27), 50, 28)
      doc.setFontSize(6)
      doc.setTextColor(130, 130, 130)
      doc.text('Escanea para ver su ficha', 50, 46)
      doc.save(`qr-${cart.code}.pdf`)
    } catch {
      toast.error('No se pudo generar el código QR.')
    }
  }

  async function printAllQr() {
    if (carts.length === 0) return
    setPrintingAll(true)
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const cols = 3, rows = 6
      const cellW = 65, cellH = 45
      const marginX = 7, marginY = 8
      let col = 0, row = 0
      for (let i = 0; i < carts.length; i++) {
        const cart = carts[i]
        if (i > 0 && col === 0 && row === 0) doc.addPage()
        const x = marginX + col * cellW
        const y = marginY + row * cellH
        const url = `${window.location.origin}/carts?code=${encodeURIComponent(cart.code)}`
        // eslint-disable-next-line no-await-in-loop
        const qrDataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 })
        doc.setDrawColor(220, 220, 220)
        doc.rect(x, y, cellW - 3, cellH - 3, 'S')
        doc.addImage(qrDataUrl, 'PNG', x + 2, y + 2, 30, 30)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(cart.code, x + 34, y + 12)
        if (cart.location) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6.5)
          doc.text(doc.splitTextToSize(cart.location, 25), x + 34, y + 18)
        }
        col++
        if (col >= cols) { col = 0; row++ }
        if (row >= rows) { row = 0 }
      }
      doc.save(`qr-carros-${carts.length}.pdf`)
    } catch {
      toast.error('No se pudo generar la hoja de códigos QR.')
    } finally {
      setPrintingAll(false)
    }
  }

  if (loading) return <PageLoading rows={6} />

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart size={18} className="text-blue-600 dark:text-blue-400" />
            Carros planos
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Inventario de carros y códigos QR para pegar físicamente en cada uno.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={printAllQr} disabled={printingAll || carts.length === 0}>
            <Printer size={14} /> {printingAll ? 'Generando...' : 'Imprimir todos los QR'}
          </Button>
          <Button size="sm" onClick={openCreate}><Plus size={14} /> Nuevo carro</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, val: '' as const, icon: Layers, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
          { label: 'Operativos', value: stats.ok, val: 'ok' as const, icon: ShoppingCart, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          { label: 'Dañados', value: stats.damaged, val: 'damaged' as const, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' },
          { label: 'En mantenimiento', value: stats.maintenance, val: 'maintenance' as const, icon: Wrench, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
        ].map(kpi => (
          <button key={kpi.label} onClick={() => kpi.val && toggleStatusFilter(kpi.val)} className="text-left focus:outline-none" disabled={!kpi.val}>
            <div className={cn('rounded-xl border border-gray-200 dark:border-slate-700 p-3 flex items-center gap-2.5', kpi.bg, kpi.val && statusFilter === kpi.val && 'ring-2 ring-blue-400')}>
              <kpi.icon size={16} className={kpi.color} />
              <div>
                <div className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400">{kpi.label}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className={cn(inputClass, 'pl-9')} placeholder="Buscar por código o ubicación..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {carts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <ShoppingCart size={28} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Todavía no hay ningún carro inventariado.</p>
            <Button size="sm" onClick={openCreate}><Plus size={14} /> Nuevo carro</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(cart => (
            <Card key={cart.id}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-800 dark:text-slate-100">{cart.code}</p>
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_META[cart.status].className)}>{STATUS_META[cart.status].label}</span>
                </div>
                {cart.location && <p className="text-xs text-gray-500 dark:text-slate-400">{cart.location}</p>}
                {cart.photos[0] && <img src={cart.photos[0]} alt={cart.code} className="w-full h-24 object-cover rounded-lg" />}
                <div className="flex justify-end gap-1 pt-1">
                  <button onClick={() => printQr(cart)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Imprimir QR"><QrCode size={14} /></button>
                  <button onClick={() => openEdit(cart)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Editar"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(cart)} className="p-1.5 text-gray-400 hover:text-red-600" title="Eliminar"><Trash2 size={14} /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar carro' : 'Nuevo carro'} size="sm">
        <div className="p-5 space-y-3">
          <div>
            <label className={labelClass}>Código *</label>
            <input className={inputClass} value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <select className={inputClass} value={form.status || 'ok'} onChange={e => setForm(f => ({ ...f, status: e.target.value as CartStatus }))}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Ubicación</label>
            <input className={inputClass} value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Ej: Autoservicio, planta 1" />
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={inputClass} rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Fotos</label>
            <PhotoUpload
              photos={form.photos || []}
              onChange={photos => setForm(f => ({ ...f, photos }))}
              prefix={`cart-${form.id ?? 'new'}-${Date.now()}-`}
              uploadFn={uploadCartPhoto}
            />
          </div>
          {selected && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => printQr(selected)}><QrCode size={14} /> Imprimir QR de este carro</Button>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
