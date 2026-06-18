import { useState, useEffect, useRef } from 'react'
import { ClipboardCheck, Sun, Moon, ArrowLeft, ArrowRight, Check, Camera, FileDown, Pencil, History, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRondas, upsertRonda, deleteRonda, getWorkers } from '@/lib/supabase'
import type { RondaEntry, TeamMember, TipoRonda } from '@/types'
import { cn, todayIso, getInitials } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── SQL para añadir columnas nuevas en Supabase (ejecutar una vez) ───────────
// ALTER TABLE rondas
//   ADD COLUMN IF NOT EXISTS lectura_agua_pci NUMERIC(12,2),
//   ADD COLUMN IF NOT EXISTS dia_semana TEXT,
//   ADD COLUMN IF NOT EXISTS dia_mes INTEGER,
//   ADD COLUMN IF NOT EXISTS semana_mes INTEGER,
//   ADD COLUMN IF NOT EXISTS hora_fin TIME,
//   ADD COLUMN IF NOT EXISTS checks JSONB DEFAULT '[]'::jsonb,
//   ADD COLUMN IF NOT EXISTS nombre_libre TEXT;

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckItem {
  ubicacion: string
  descripcion: string
  estado: 'bien' | 'mal'
  comentario: string
}

interface WizardForm {
  tipo: 'apertura' | 'cierre'
  nombre: string
  hora_inicio: string
  hora_fin: string
  dia_semana: string
  dia_mes: number
  semana_mes: number
  electricidad: string
  agua_pci: string
  agua_comercial: string
  pci_jockey: string
  compresor: string
  checks: CheckItem[]
  fecha: string
}

type WizardStep = 'tipo' | 'datos' | 'lecturas' | 'formulario'

// ─── Constants ───────────────────────────────────────────────────────────────

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const LECTURAS_CONFIG: { key: keyof WizardForm; label: string; desc: string; unit: string; color: string }[] = [
  { key: 'agua_comercial', label: 'Agua Comercial', desc: 'Fotografia el contador de AGUA COMERCIAL', unit: 'm³', color: 'bg-blue-500' },
  { key: 'agua_pci', label: 'Agua PCI', desc: 'Fotografía el contador de AGUA PCI', unit: 'm³', color: 'bg-cyan-500' },
  { key: 'electricidad', label: 'Electricidad', desc: 'Fotografía el contador de ELECTRICIDAD', unit: 'kWh', color: 'bg-yellow-500' },
  { key: 'compresor', label: 'Compresor', desc: 'Fotografía el contador de ARRANQUES COMPRESOR', unit: 'arr.', color: 'bg-orange-500' },
  { key: 'pci_jockey', label: 'PCI Jockey', desc: 'Fotografía el contador de ARRANQUES PCI JOCKEY', unit: 'arr.', color: 'bg-red-500' },
]

const DEFAULT_CHECKS: CheckItem[] = [
  { ubicacion: 'SAI 1', descripcion: 'Estado equipo', estado: 'bien', comentario: '' },
  { ubicacion: 'SAI 1', descripcion: 'Tensión de entrada', estado: 'bien', comentario: '' },
  { ubicacion: 'SAI 1', descripcion: 'Climatización sala', estado: 'bien', comentario: '22' },
  { ubicacion: 'SAI 2', descripcion: 'Estado equipo', estado: 'bien', comentario: '' },
  { ubicacion: 'SAI 2', descripcion: 'Tensión de entrada', estado: 'bien', comentario: '' },
  { ubicacion: 'SAI 2', descripcion: 'Climatización sala', estado: 'bien', comentario: '22' },
  { ubicacion: 'COMPUTER ROOM', descripcion: 'Estado equipo', estado: 'bien', comentario: '' },
  { ubicacion: 'COMPUTER ROOM', descripcion: 'Climatización sala', estado: 'bien', comentario: '21-22' },
  { ubicacion: 'C.G.B.T', descripcion: 'Protecciones disparadas', estado: 'bien', comentario: '' },
  { ubicacion: 'C.G.B.T', descripcion: 'Funcionamiento Extractor', estado: 'bien', comentario: '' },
  { ubicacion: 'C.G.B.T', descripcion: 'Baterías de Condensadores', estado: 'bien', comentario: '' },
  { ubicacion: 'BMS', descripcion: 'Comunicación autómatas', estado: 'mal', comentario: 'FILTRO 1-2-3' },
  { ubicacion: 'BMS', descripcion: 'Revisar alarmas', estado: 'mal', comentario: 'RESETEO ALARMAS' },
  { ubicacion: 'SALA GRUPO ELECTROGENO', descripcion: 'Estado equipo', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA GRUPO ELECTROGENO', descripcion: 'Equipo en stand by', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA GRUPO ELECTROGENO', descripcion: 'Nivel combustible', estado: 'bien', comentario: '100%' },
  { ubicacion: 'SALA GRUPO ELECTROGENO', descripcion: 'Resistencia de caldeo', estado: 'bien', comentario: '' },
  { ubicacion: 'FV', descripcion: 'Estado Alarmas', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA CALDERAS', descripcion: 'Estado Equipos', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA CALDERAS', descripcion: 'Presión de gas', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA CALDERAS', descripcion: 'Fugas de agua', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA BOMBAS FRIO', descripcion: 'Estado Equipos', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA BOMBAS FRIO', descripcion: 'Fugas de agua', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA BOMBAS FRIO', descripcion: 'Enfriadoras', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA ACS', descripcion: 'Estado Equipos', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA ACS', descripcion: 'Fugas de agua', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA ACS', descripcion: 'Presión de gas', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA ACS', descripcion: 'Temperatura depósito ACS', estado: 'bien', comentario: '27-32' },
  { ubicacion: 'MUELLE EXTERIOR', descripcion: 'Estado contenedores', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA AFS', descripcion: 'Estado Equipos', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA AFS', descripcion: 'Presión de agua de entrada', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA AFS', descripcion: 'Fugas de agua', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA AFS', descripcion: 'Sal descalcificador', estado: 'bien', comentario: 'no hay' },
  { ubicacion: 'SALA PCI', descripcion: 'Estado equipos', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA PCI', descripcion: 'Bombas en automático', estado: 'bien', comentario: '' },
  { ubicacion: 'SALA PCI', descripcion: 'Nivel combustible diesel', estado: 'bien', comentario: '100%' },
  { ubicacion: 'SALA PCI', descripcion: 'Nº arranques Jockey', estado: 'bien', comentario: '13' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function addHour(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function weekOfMonth() { return Math.ceil(new Date().getDate() / 7) }
function dayOfWeek() {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return days[new Date().getDay()]
}
function emptyForm(): WizardForm {
  const h = now()
  return {
    tipo: 'apertura', nombre: '', fecha: todayIso(),
    hora_inicio: h, hora_fin: addHour(h),
    dia_semana: dayOfWeek(), dia_mes: new Date().getDate(), semana_mes: weekOfMonth(),
    electricidad: '', agua_pci: '', agua_comercial: '', pci_jockey: '', compresor: '',
    checks: DEFAULT_CHECKS.map(c => ({ ...c })),
  }
}

// ─── Camera capture ───────────────────────────────────────────────────────────

function CameraCapture({ label, desc, unit, value, onChange }: {
  label: string; desc: string; unit: string; value: string; onChange: (v: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)   // ref evita re-renders
  const [camOn, setCamOn] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [starting, setStarting] = useState(false)
  const [ready, setReady] = useState(false)            // video listo para disparar

  // Asignar srcObject una vez que el elemento video está en el DOM
  useEffect(() => {
    if (camOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [camOn])

  // Limpiar cámara al desmontar
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  async function openCam() {
    setErr(''); setReady(false); setStarting(true)
    try {
      streamRef.current?.getTracks().forEach(t => t.stop())
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      })
      streamRef.current = s
      setCamOn(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setErr(msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')
        ? 'Permiso de cámara denegado. Actívalo en ajustes del navegador o escribe el valor manualmente.'
        : 'Cámara no disponible en este dispositivo. Introduce el valor manualmente.'
      )
    } finally { setStarting(false) }
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCamOn(false); setReady(false)
  }

  function shoot() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    if (!ready || video.videoWidth === 0) {
      setErr('La cámara aún no está lista, espera un momento.')
      return
    }
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    setPhoto(canvas.toDataURL('image/jpeg', 0.85))
    stopCam()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-800 font-medium">
        {desc}
      </p>

      {camOn ? (
        <div className="relative rounded-xl overflow-hidden bg-black" style={{ minHeight: 200 }}>
          <video
            ref={videoRef}
            autoPlay playsInline muted
            onCanPlay={() => setReady(true)}
            className="w-full rounded-xl"
            style={{ maxHeight: '55vh', display: 'block' }}
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl">
              <p className="text-white text-sm">Iniciando cámara...</p>
            </div>
          )}
          {/* Botón disparar */}
          <button
            onClick={shoot}
            disabled={!ready}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-white border-4 border-gray-200 shadow-2xl flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
          >
            <Camera size={30} className="text-gray-800" />
          </button>
          {/* Cancelar */}
          <button
            onClick={stopCam}
            className="absolute top-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full"
          >✕ Cancelar</button>
        </div>
      ) : photo ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300 dark:border-emerald-700">
          <img src={photo} className="w-full rounded-xl object-contain bg-black" style={{ maxHeight: '40vh' }} alt="Foto contador" />
          <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">✓ Foto tomada</div>
          <button
            onClick={() => { setPhoto(null); openCam() }}
            className="absolute top-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full"
          >↺ Repetir</button>
        </div>
      ) : (
        <button
          onClick={openCam}
          disabled={starting}
          className="w-full h-32 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-slate-500 hover:border-blue-400 hover:text-blue-400 transition-colors disabled:opacity-50"
        >
          <Camera size={30} />
          <span className="text-sm font-medium">{starting ? 'Iniciando cámara...' : 'Fotografiar el contador'}</span>
          <span className="text-xs opacity-70">o escribe el valor directamente abajo</span>
        </button>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {err && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
          ⚠️ {err}
        </p>
      )}

      {/* Input del valor — siempre visible */}
      <div className={photo ? 'ring-2 ring-emerald-400 rounded-xl' : ''}>
        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
          {photo ? '✓ ' : ''}Valor del contador — <span className="text-blue-600 dark:text-blue-400">{label}</span> <span className="text-gray-400 font-normal">({unit})</span>
        </label>
        <input
          type="number"
          inputMode="numeric"
          step="1" min="0"
          placeholder="Escribe el número que ves..."
          className="w-full text-2xl font-mono text-center border-2 border-gray-200 dark:border-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CellDef = any

function generatePDF(form: WizardForm) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()   // 297 mm
  const MARGIN = 4

  // ── Cabecera ────────────────────────────────────────────────────────────────
  // Fondo negro
  doc.setFillColor(0, 0, 0)
  doc.rect(0, 0, pw, 15, 'F')

  // Caja blanca IKEA (izquierda)
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 32, 15, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(0, 0, 0)
  doc.text('IKEA', 3, 10)
  doc.setFontSize(7); doc.text('ALCORCÓN', 3, 14)

  // Título central (blanco sobre negro)
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text('FICHA DIARIA MANTENIMIENTO PREVENTIVO', pw / 2, 9, { align: 'center' })

  // Caja amarilla con día y semana (derecha)
  const dayW = 42
  doc.setFillColor(255, 255, 0)
  doc.rect(pw - dayW, 0, dayW, 15, 'F')
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(14)
  doc.text(form.dia_semana.toUpperCase(), pw - 2, 8, { align: 'right' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('S.', pw - dayW + 2, 13.5)
  doc.setFontSize(13)
  doc.text(String(form.semana_mes), pw - 2, 13.5, { align: 'right' })

  // ── Subtítulo ronda ──────────────────────────────────────────────────────────
  doc.setFillColor(230, 230, 230)
  doc.rect(0, 15, pw, 7, 'F')
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(12); doc.setTextColor(0, 0, 0)
  doc.text(
    `RONDA DE ${form.tipo === 'apertura' ? 'APERTURA' : 'CIERRE'}`,
    pw / 2, 20.5, { align: 'center' }
  )

  // ── Tabla de checks con rowspan por ubicación ────────────────────────────────
  // Agrupar por ubicación para hacer rowspan visual
  const groups: Record<string, CheckItem[]> = {}
  form.checks.forEach(c => {
    if (!groups[c.ubicacion]) groups[c.ubicacion] = []
    groups[c.ubicacion].push(c)
  })

  const tableBody: CellDef[][] = []
  Object.entries(groups).forEach(([ubicacion, items]) => {
    items.forEach((c, i) => {
      const row: CellDef[] = []
      if (i === 0) {
        row.push({
          content: ubicacion,
          rowSpan: items.length,
          styles: { fontStyle: 'bold', valign: 'middle', halign: 'center', fontSize: 7 },
        })
      }
      row.push({ content: c.descripcion })
      // BIEN: verde si bien, blanco si mal
      row.push({
        content: 'BIEN',
        styles: c.estado === 'bien'
          ? { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }
          : { fillColor: [255, 255, 255], textColor: [0, 0, 0], halign: 'center' },
      })
      // MAL: rojo si mal, blanco si bien
      row.push({
        content: 'MAL',
        styles: c.estado === 'mal'
          ? { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }
          : { fillColor: [255, 255, 255], textColor: [0, 0, 0], halign: 'center' },
      })
      // Comentario: amarillo si hay texto
      row.push({
        content: c.comentario,
        styles: c.comentario
          ? { fillColor: [255, 255, 0], textColor: [0, 0, 0] }
          : {},
      })
      tableBody.push(row)
    })
  })

  autoTable(doc, {
    startY: 23,
    head: [
      [
        { content: 'UBICACIÓN', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'DESCRIPCIÓN', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'CHECK', colSpan: 2, styles: { halign: 'center' } },
        { content: 'COMENTARIOS', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
      ],
      ['BIEN', 'MAL'],
    ],
    body: tableBody,
    styles: { fontSize: 7, cellPadding: 1.2, lineColor: [180, 180, 180], lineWidth: 0.1 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 63 },
      2: { cellWidth: 14 },
      3: { cellWidth: 14 },
      4: { cellWidth: 'auto' },
    },
    margin: { left: MARGIN, right: MARGIN },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checksY = (doc as any).lastAutoTable.finalY

  // ── Fila REALIZADO POR ───────────────────────────────────────────────────────
  autoTable(doc, {
    startY: checksY + 1,
    body: [[
      { content: 'REALIZADO POR:', styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } },
      { content: form.nombre.toUpperCase(), styles: { fillColor: [255, 255, 0], fontStyle: 'bold', textColor: [0, 0, 0] } },
      { content: 'Hora Inicio:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255] } },
      { content: form.hora_inicio, styles: { fillColor: [255, 255, 0], fontStyle: 'bold', halign: 'center' } },
      { content: 'Hora Fin:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255] } },
      { content: form.hora_fin, styles: { fillColor: [255, 255, 0], fontStyle: 'bold', halign: 'center' } },
    ]],
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [180, 180, 180], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 50 },
      2: { cellWidth: 24 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 18 },
    },
    margin: { left: MARGIN, right: MARGIN },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realizadoY = (doc as any).lastAutoTable.finalY

  // ── Fila DIA DEL MES + lecturas ──────────────────────────────────────────────
  autoTable(doc, {
    startY: realizadoY + 0.5,
    head: [['DIA DEL MES', 'Electricidad', 'AGUA PCI', 'AGUA COMERCIAL', 'PCI JOCKEY', 'COMPRESOR']],
    body: [[
      { content: String(form.dia_mes), styles: { fillColor: [255, 255, 0], fontStyle: 'bold' } },
      { content: form.electricidad || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold' } },
      { content: form.agua_pci || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold' } },
      { content: form.agua_comercial || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold' } },
      { content: form.pci_jockey || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold' } },
      { content: form.compresor || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold' } },
    ]],
    styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', lineColor: [180, 180, 180], lineWidth: 0.1 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.3 },
    margin: { left: MARGIN, right: MARGIN },
  })

  doc.save(`ronda-${form.tipo}-${form.fecha}.pdf`)
}

// ─── Main component ───────────────────────────────────────────────────────────

const TIPO_CFG = {
  apertura: { label: 'Apertura', Icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', btn: 'bg-amber-500 hover:bg-amber-600' },
  cierre: { label: 'Cierre', Icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800', btn: 'bg-indigo-600 hover:bg-indigo-700' },
}

export default function RondasPage() {
  const { worker } = useAuth()

  // Wizard state
  const [wizardOn, setWizardOn] = useState(false)
  const [step, setStep] = useState<WizardStep>('tipo')
  const [lecturaIdx, setLecturaIdx] = useState(0)
  const [wForm, setWForm] = useState<WizardForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  // List state
  const [rondas, setRondas] = useState<RondaEntry[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    Promise.all([getRondas(), getWorkers()])
      .then(([r, w]) => { setRondas(r); setWorkers(w) })
      .finally(() => setLoading(false))
  }, [])

  function startWizard() {
    const f = emptyForm()
    f.nombre = worker?.name || ''
    setWForm(f)
    setStep('tipo')
    setLecturaIdx(0)
    setWizardOn(true)
  }

  function setCheck(i: number, field: 'estado' | 'comentario', val: string) {
    setWForm(f => ({
      ...f,
      checks: f.checks.map((c, idx) => idx === i ? { ...c, [field]: val } : c),
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await upsertRonda({
        fecha: wForm.fecha,
        hora: wForm.hora_inicio,
        tipo: wForm.tipo as TipoRonda,
        worker_id: workers.find(w => w.name === wForm.nombre)?.id || worker?.id,
        lectura_luz: wForm.electricidad ? Number(wForm.electricidad) : undefined,
        lectura_agua: wForm.agua_comercial ? Number(wForm.agua_comercial) : undefined,
        arranques_jockey: wForm.pci_jockey ? Number(wForm.pci_jockey) : undefined,
        arranques_compresor: wForm.compresor ? Number(wForm.compresor) : undefined,
        observaciones: JSON.stringify({
          dia_semana: wForm.dia_semana, dia_mes: wForm.dia_mes, semana_mes: wForm.semana_mes,
          hora_fin: wForm.hora_fin, agua_pci: wForm.agua_pci, nombre: wForm.nombre,
          checks: wForm.checks,
        }),
      })
      const withWorker = { ...saved, worker: workers.find(w => w.id === saved.worker_id) }
      // Dedup: si ya existe una ronda con el mismo id (upsert actualizó una existente), reemplázala; si no, prepénde
      setRondas(prev => {
        const exists = prev.some(r => r.id === saved.id)
        return exists ? prev.map(r => r.id === saved.id ? withWorker : r) : [withWorker, ...prev]
      })
      setWizardOn(false)
    } catch {
      alert('Error al guardar la ronda.')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta ronda?')) return
    try { await deleteRonda(id); setRondas(prev => prev.filter(r => r.id !== id)) }
    catch { alert('No se pudo eliminar.') }
  }

  // ── Wizard rendering ────────────────────────────────────────────────────────

  function renderStep() {
    // Step 1: Tipo
    if (step === 'tipo') return (
      <div className="flex flex-col items-center gap-6 py-8">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">¿Qué ronda vas a realizar?</h2>
        <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
          {(['apertura', 'cierre'] as const).map(tipo => {
            const cfg = TIPO_CFG[tipo]
            return (
              <button
                key={tipo}
                onClick={() => { setWForm(f => ({ ...f, tipo })); setStep('datos') }}
                className={cn(
                  'flex items-center gap-4 p-6 rounded-2xl border-2 transition-all hover:scale-105 active:scale-100',
                  cfg.bg, cfg.border,
                )}
              >
                <cfg.Icon size={40} className={cfg.color} />
                <div className="text-left">
                  <p className="text-lg font-bold text-gray-800 dark:text-white">Ronda de {cfg.label}</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {tipo === 'apertura' ? 'Inicio de jornada — apertura de instalaciones' : 'Fin de jornada — cierre de instalaciones'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )

    // Step 2: Datos
    if (step === 'datos') return (
      <div className="space-y-4 py-4">
        <h2 className="text-base font-bold text-gray-800 dark:text-white">Datos de la ronda</h2>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">¿Quién realiza la ronda?</label>
          <select
            className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
            value={wForm.nombre}
            onChange={e => setWForm(f => ({ ...f, nombre: e.target.value }))}
          >
            <option value="">Selecciona...</option>
            {workers.filter(w => w.active).map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Hora de inicio</label>
            <input type="time"
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={wForm.hora_inicio}
              onChange={e => setWForm(f => ({ ...f, hora_inicio: e.target.value, hora_fin: addHour(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Hora de fin (auto +1h)</label>
            <input type="time"
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={wForm.hora_fin}
              onChange={e => setWForm(f => ({ ...f, hora_fin: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Día de la semana</label>
          <div className="grid grid-cols-4 gap-2">
            {DIAS.map(d => (
              <button key={d} onClick={() => setWForm(f => ({ ...f, dia_semana: d }))}
                className={cn('py-2 text-xs rounded-xl font-medium border transition-colors',
                  wForm.dia_semana === d
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-blue-400'
                )}>
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Día del mes</label>
            <input type="number" min={1} max={31}
              className="w-full text-center text-lg font-mono border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={wForm.dia_mes}
              onChange={e => setWForm(f => ({ ...f, dia_mes: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Semana del mes (S.)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setWForm(f => ({ ...f, semana_mes: s }))}
                  className={cn('flex-1 py-2.5 text-sm rounded-xl font-bold border transition-colors',
                    wForm.semana_mes === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-blue-400'
                  )}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )

    // Step 3: Lecturas (cámara)
    if (step === 'lecturas') {
      const lec = LECTURAS_CONFIG[lecturaIdx]
      const isLast = lecturaIdx === LECTURAS_CONFIG.length - 1
      return (
        <div className="space-y-4 py-4">
          {/* Progreso */}
          <div className="flex items-center gap-2">
            {LECTURAS_CONFIG.map((l, i) => (
              <div key={l.key} className={cn(
                'flex-1 h-1.5 rounded-full transition-colors',
                i < lecturaIdx ? 'bg-blue-500' : i === lecturaIdx ? 'bg-blue-300' : 'bg-gray-200 dark:bg-slate-600'
              )} />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-800 dark:text-white">
              Lectura {lecturaIdx + 1} de {LECTURAS_CONFIG.length}: <span className="text-blue-600 dark:text-blue-400">{lec.label}</span>
            </h2>
          </div>
          <CameraCapture
            key={lec.key}
            label={lec.label}
            desc={lec.desc}
            unit={lec.unit}
            value={String(wForm[lec.key] ?? '')}
            onChange={v => setWForm(f => ({ ...f, [lec.key]: v }))}
          />
          <div className="flex gap-3 pt-2">
            {lecturaIdx > 0 && (
              <button onClick={() => setLecturaIdx(i => i - 1)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700">
                <ArrowLeft size={15} /> Anterior
              </button>
            )}
            <button
              onClick={() => isLast ? setStep('formulario') : setLecturaIdx(i => i + 1)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              {isLast ? (<><Check size={15} /> Ver formulario completo</>) : (<>Siguiente: {LECTURAS_CONFIG[lecturaIdx + 1].label} <ArrowRight size={15} /></>)}
            </button>
          </div>
        </div>
      )
    }

    // Step 4: Formulario Excel
    if (step === 'formulario') {
      // Agrupar checks por ubicacion
      const groups: Record<string, { item: CheckItem; idx: number }[]> = {}
      wForm.checks.forEach((c, idx) => {
        if (!groups[c.ubicacion]) groups[c.ubicacion] = []
        groups[c.ubicacion].push({ item: c, idx })
      })

      return (
        <div className="space-y-3 py-2">
          {/* Header estilo Excel */}
          <div className="bg-black text-white rounded-t-xl">
            <div className="grid grid-cols-3 items-center p-2 gap-2">
              <div>
                <p className="text-yellow-300 font-bold text-xs leading-tight">IKEA</p>
                <p className="text-yellow-300 text-[10px]">ALCORCÓN</p>
              </div>
              <p className="text-center text-xs font-bold">FICHA DIARIA MANTENIMIENTO PREVENTIVO</p>
              <div className="text-right">
                <p className="text-yellow-300 font-bold text-sm">{wForm.dia_semana.toUpperCase()}</p>
                <p className="text-yellow-300 text-xs">S. {wForm.semana_mes}</p>
              </div>
            </div>
            <div className={cn('text-center py-1.5 font-bold text-sm tracking-widest italic', wForm.tipo === 'apertura' ? 'bg-blue-900' : 'bg-purple-900')}>
              RONDA DE {wForm.tipo === 'apertura' ? 'APERTURA' : 'CIERRE'}
            </div>
          </div>

          {/* Tabla de checks */}
          <div className="overflow-x-auto rounded-b-xl border border-gray-200 dark:border-slate-700">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="bg-black text-white">
                  <th className="py-2 px-2 text-left font-bold w-28">UBICACIÓN</th>
                  <th className="py-2 px-2 text-left font-bold">DESCRIPCIÓN</th>
                  <th className="py-2 px-2 text-center font-bold w-16">CHECK</th>
                  <th className="py-2 px-2 text-left font-bold">COMENTARIOS</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groups).map(([ubicacion, items]) =>
                  items.map(({ item, idx }, i) => (
                    <tr key={idx} className="border-t border-gray-100 dark:border-slate-700">
                      {i === 0 && (
                        <td
                          rowSpan={items.length}
                          className="px-2 py-1 font-bold text-[10px] align-middle border-r border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300"
                        >
                          {ubicacion}
                        </td>
                      )}
                      <td className="px-2 py-1.5 text-gray-700 dark:text-slate-300">{item.descripcion}</td>
                      <td className="px-2 py-1 text-center">
                        <button
                          onClick={() => setCheck(idx, 'estado', item.estado === 'bien' ? 'mal' : 'bien')}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold w-full transition-colors',
                            item.estado === 'bien'
                              ? 'bg-green-600 text-white hover:bg-red-600'
                              : 'bg-red-600 text-white hover:bg-green-600'
                          )}
                        >
                          {item.estado === 'bien' ? 'BIEN' : 'MAL'}
                        </button>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          className={cn(
                            'w-full text-xs px-1.5 py-0.5 rounded border focus:outline-none focus:ring-1 focus:ring-blue-400',
                            item.comentario
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-gray-800 dark:text-yellow-100 font-semibold'
                              : 'bg-transparent border-transparent dark:text-slate-300 hover:border-gray-200 dark:hover:border-slate-600'
                          )}
                          value={item.comentario}
                          onChange={e => setCheck(idx, 'comentario', e.target.value)}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pie con lecturas */}
          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-bold text-gray-600 dark:text-slate-400">REALIZADO POR: </span>
                <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded">{wForm.nombre || '—'}</span>
              </div>
              <div className="flex gap-4 text-xs text-gray-600 dark:text-slate-400">
                <span>Hora inicio: <strong className="dark:text-white">{wForm.hora_inicio}</strong></span>
                <span>Hora fin: <strong className="dark:text-white">{wForm.hora_fin}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="font-bold text-gray-600 dark:text-slate-400">DÍA: <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 rounded">{wForm.dia_mes}</span></span>
              {[
                { label: 'Electricidad', val: wForm.electricidad },
                { label: 'Agua PCI', val: wForm.agua_pci },
                { label: 'Agua Comercial', val: wForm.agua_comercial },
                { label: 'PCI Jockey', val: wForm.pci_jockey },
                { label: 'Compresor', val: wForm.compresor },
              ].map(({ label, val }) => (
                <span key={label} className="text-gray-500 dark:text-slate-400">
                  {label}: <strong className="text-gray-800 dark:text-slate-100 font-mono">{val || '—'}</strong>
                </span>
              ))}
            </div>
          </div>

          {/* Botones finales */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => generatePDF(wForm)}
              className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 border-2 border-blue-300 dark:border-blue-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <FileDown size={16} /> Descargar PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl transition-colors"
            >
              <Check size={16} /> {saving ? 'Guardando...' : 'Guardar ronda'}
            </button>
          </div>
        </div>
      )
    }
  }

  // ── Wizard overlay ──────────────────────────────────────────────────────────

  if (wizardOn) {
    const steps: WizardStep[] = ['tipo', 'datos', 'lecturas', 'formulario']
    const stepIdx = steps.indexOf(step)
    const stepLabels = ['Tipo', 'Datos', 'Lecturas', 'Formulario']

    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 shrink-0">
          <button
            onClick={() => {
              if (step === 'tipo') { setWizardOn(false) }
              else if (step === 'datos') setStep('tipo')
              else if (step === 'lecturas' && lecturaIdx > 0) setLecturaIdx(i => i - 1)
              else if (step === 'lecturas') setStep('datos')
              else if (step === 'formulario') setStep('lecturas')
            }}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white"
          >
            <ArrowLeft size={16} /> Atrás
          </button>
          <div className="flex items-center gap-1.5">
            {stepLabels.map((l, i) => (
              <div key={l} className="flex items-center gap-1">
                <div className={cn(
                  'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center',
                  i < stepIdx ? 'bg-blue-600 text-white' : i === stepIdx ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 ring-1 ring-blue-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                )}>{i + 1}</div>
                {i < stepLabels.length - 1 && <div className={cn('w-5 h-px', i < stepIdx ? 'bg-blue-400' : 'bg-gray-200 dark:bg-slate-600')} />}
              </div>
            ))}
          </div>
          <button onClick={() => setWizardOn(false)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500">Cancelar</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {renderStep()}
        </div>

        {/* Bottom nav (only for datos step) */}
        {step === 'datos' && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setStep('lecturas')}
              disabled={!wForm.nombre}
              className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Continuar con lecturas <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Normal page view ────────────────────────────────────────────────────────

  const today = rondas.filter(r => r.fecha === todayIso())
  const apertura = today.filter(r => r.tipo === 'apertura')[0]
  const cierre = today.filter(r => r.tipo === 'cierre')[0]

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} className="text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Rondas de apertura y cierre</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Ficha diaria de mantenimiento preventivo</p>
          </div>
        </div>
        <Button onClick={startWizard} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus size={14} /> Nueva ronda
        </Button>
      </div>

      {/* Estado del día */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['apertura', 'cierre'] as const).map(tipo => {
            const cfg = TIPO_CFG[tipo]
            const r = tipo === 'apertura' ? apertura : cierre
            return (
              <div key={tipo} className={cn('rounded-2xl border-2 p-4', cfg.border, cfg.bg)}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', cfg.bg)}>
                    <cfg.Icon size={22} className={cfg.color} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-white">Ronda de {cfg.label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {r ? `Realizada a las ${r.hora?.substring(0, 5)}` : 'Sin registrar hoy'}
                    </p>
                  </div>
                  {r && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
                      <Check size={11} /> Hecho
                    </span>
                  )}
                </div>
                {r ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {r.worker && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: r.worker.color }}>
                          {getInitials(r.worker.name)}
                        </div>
                        <span className="text-gray-700 dark:text-slate-300 font-medium">{r.worker.name}</span>
                      </div>
                    )}
                    {r.lectura_luz != null && <div className="bg-white/60 dark:bg-slate-700/50 rounded-lg px-2 py-1.5"><p className="text-gray-400 text-[10px]">Electricidad</p><p className="font-mono font-bold text-gray-800 dark:text-white">{r.lectura_luz}</p></div>}
                    {r.lectura_agua != null && <div className="bg-white/60 dark:bg-slate-700/50 rounded-lg px-2 py-1.5"><p className="text-gray-400 text-[10px]">Agua Comercial</p><p className="font-mono font-bold text-gray-800 dark:text-white">{r.lectura_agua}</p></div>}
                    {r.arranques_jockey != null && <div className="bg-white/60 dark:bg-slate-700/50 rounded-lg px-2 py-1.5"><p className="text-gray-400 text-[10px]">PCI Jockey</p><p className="font-mono font-bold text-gray-800 dark:text-white">{r.arranques_jockey}</p></div>}
                    {r.arranques_compresor != null && <div className="bg-white/60 dark:bg-slate-700/50 rounded-lg px-2 py-1.5"><p className="text-gray-400 text-[10px]">Compresor</p><p className="font-mono font-bold text-gray-800 dark:text-white">{r.arranques_compresor}</p></div>}
                  </div>
                ) : (
                  <button
                    onClick={startWizard}
                    className={cn('w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors', cfg.btn)}
                  >
                    + Registrar ahora
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Historial */}
      <div>
        <button
          onClick={() => setShowHistory(h => !h)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white mb-3"
        >
          <History size={15} />
          Historial de rondas ({rondas.length})
          <span className="text-xs text-gray-400">{showHistory ? '▲' : '▼'}</span>
        </button>
        {showHistory && rondas.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden overflow-x-auto shadow-sm">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  {['Fecha', 'Hora', 'Tipo', 'Responsable', 'Electricidad', 'Agua Com.', 'Jockey', 'Compresor', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {rondas.map(r => {
                  const cfg = TIPO_CFG[r.tipo]
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                      <td className="px-3 py-2 text-gray-600 dark:text-slate-300">{r.fecha}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-slate-300">{r.hora?.substring(0, 5)}</td>
                      <td className="px-3 py-2"><span className={cn('font-medium', cfg.color)}>{cfg.label}</span></td>
                      <td className="px-3 py-2">
                        {r.worker ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: r.worker.color }}>{r.worker.name[0]}</div>
                            <span className="text-gray-700 dark:text-slate-300">{r.worker.name.split(' ')[0]}</span>
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700 dark:text-slate-200">{r.lectura_luz ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-gray-700 dark:text-slate-200">{r.lectura_agua ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-gray-700 dark:text-slate-200">{r.arranques_jockey ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-gray-700 dark:text-slate-200">{r.arranques_compresor ?? '—'}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => handleDelete(r.id)} className="text-gray-300 dark:text-slate-600 hover:text-red-500 p-1 rounded">
                          <Pencil size={11} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
