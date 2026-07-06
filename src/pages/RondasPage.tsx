import { useState, useEffect, useRef } from 'react'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { ClipboardCheck, Sun, Moon, ArrowLeft, ArrowRight, Check, Camera, FileDown, Pencil, History, Plus, Trash2, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRondas, upsertRonda, deleteRonda, getWorkers, uploadRondaPDF, patchRondaObservaciones } from '@/lib/supabase'
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
function weekOfYear() {
  const d = new Date()
  const dayNum = d.getDay() || 7
  d.setDate(d.getDate() + 4 - dayNum)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
function dayOfWeek() {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return days[new Date().getDay()]
}
function emptyForm(): WizardForm {
  const h = now()
  return {
    tipo: 'apertura', nombre: '', fecha: todayIso(),
    hora_inicio: h, hora_fin: addHour(h),
    dia_semana: dayOfWeek(), dia_mes: new Date().getDate(), semana_mes: weekOfYear(),
    electricidad: '', agua_pci: '', agua_comercial: '', pci_jockey: '', compresor: '',
    checks: DEFAULT_CHECKS.map(c => ({ ...c })),
  }
}

// ─── OCR helpers ──────────────────────────────────────────────────────────────

function otsuThreshold(grays: number[]): number {
  const hist = new Array(256).fill(0)
  grays.forEach(g => hist[Math.min(255, Math.round(g))]++)
  const total = grays.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, max = 0, threshold = 128
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue
    const wF = total - wB; if (!wF) break
    sumB += i * hist[i]
    const between = wB * wF * ((sumB / wB) - ((sum - sumB) / wF)) ** 2
    if (between > max) { max = between; threshold = i }
  }
  return threshold
}

async function extractNumberFromCanvas(
  canvas: HTMLCanvasElement,
  mode: 'analog' | 'digital' = 'analog'
): Promise<string> {
  try {
    const scale = mode === 'digital' ? 4 : 3
    const padPx = 20
    const offscreen = document.createElement('canvas')
    offscreen.width = canvas.width * scale + padPx * 2
    offscreen.height = canvas.height * scale + padPx * 2
    const ctx = offscreen.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, offscreen.width, offscreen.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(canvas, padPx, padPx, canvas.width * scale, canvas.height * scale)

    const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height)
    const d = imgData.data

    if (mode === 'digital') {
      // Grayscale → Otsu binarize → auto-invert if background is dark
      const grays: number[] = []
      for (let i = 0; i < d.length; i += 4)
        grays.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
      const thr = otsuThreshold(grays)
      let blacks = 0
      for (let i = 0; i < d.length; i += 4) {
        const v = grays[i / 4] > thr ? 255 : 0
        d[i] = d[i + 1] = d[i + 2] = v
        if (v === 0) blacks++
      }
      if (blacks / (d.length / 4) > 0.6) {
        for (let i = 0; i < d.length; i += 4)
          d[i] = d[i + 1] = d[i + 2] = 255 - d[i]
      }
    } else {
      // Analog: aggressive contrast stretch [50,200] → [0,255]
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        const v = Math.min(255, Math.max(0, ((gray - 50) / 150) * 255))
        d[i] = d[i + 1] = d[i + 2] = v
      }
    }
    ctx.putImageData(imgData, 0, 0)

    const { createWorker } = await import('tesseract.js')
    const tWorker = await createWorker('eng', 1, { logger: () => {} })
    await tWorker.setParameters({
      tessedit_char_whitelist: '0123456789.',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tessedit_pageseg_mode: 7 as any,
    })
    let { data: { text, confidence } } = await tWorker.recognize(offscreen)
    let clean = text.replace(/[^0-9.]/g, '').replace(/\.{2,}/g, '.').replace(/^\./, '').replace(/\.$/, '')

    // Low confidence or empty → retry with PSM 8 (single word)
    if (confidence < 40 || !clean) {
      await tWorker.setParameters({
        tessedit_char_whitelist: '0123456789.',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tessedit_pageseg_mode: 8 as any,
      })
      const { data: { text: t2 } } = await tWorker.recognize(offscreen)
      const clean2 = t2.replace(/[^0-9.]/g, '').replace(/\.{2,}/g, '.').replace(/^\./, '').replace(/\.$/, '')
      if (clean2.length > clean.length) clean = clean2
    }

    await tWorker.terminate()
    return clean
  } catch {
    return ''
  }
}

// ─── Camera capture ───────────────────────────────────────────────────────────

function CameraCapture({ label, desc, unit, value, onChange, defaultMode = 'analog' }: {
  label: string; desc: string; unit: string; value: string; onChange: (v: string) => void; defaultMode?: 'analog' | 'digital'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camOn, setCamOn] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [starting, setStarting] = useState(false)
  const [ready, setReady] = useState(false)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrFailed, setOcrFailed] = useState(false)
  const [counterMode, setCounterMode] = useState<'analog' | 'digital'>(defaultMode)

  useEffect(() => {
    if (camOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [camOn])

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  async function openCam() {
    setErr(''); setReady(false); setStarting(true); setOcrFailed(false)
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
    // Auto-OCR: detect number and fill input
    setOcrRunning(true)
    setOcrFailed(false)
    extractNumberFromCanvas(canvas, counterMode).then(detected => {
      if (detected) {
        onChange(detected)
        setOcrFailed(false)
      } else {
        setOcrFailed(true)
      }
    }).finally(() => setOcrRunning(false))
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-800 font-medium">
        {desc}
      </p>

      {/* Toggle analógico / digital */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-slate-400">Tipo de contador:</span>
        <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden text-xs font-medium">
          <button
            onClick={() => setCounterMode('analog')}
            className={cn('px-3 py-1.5 transition-colors',
              counterMode === 'analog'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
            )}
          >
            ⏱ Analógico
          </button>
          <button
            onClick={() => setCounterMode('digital')}
            className={cn('px-3 py-1.5 transition-colors',
              counterMode === 'digital'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
            )}
          >
            🔢 Digital
          </button>
        </div>
      </div>

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
          <button
            onClick={shoot}
            disabled={!ready}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-white border-4 border-gray-200 shadow-2xl flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
          >
            <Camera size={30} className="text-gray-800" />
          </button>
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
            onClick={() => { setPhoto(null); onChange(''); openCam() }}
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

      {ocrFailed && !ocrRunning && photo && (
        <p className="text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2 border border-orange-200 dark:border-orange-800 flex items-center gap-1.5">
          <AlertTriangle size={12} />
          No se detectó el número. Escríbelo manualmente abajo, o repite la foto con mejor luz y encuadre.
        </p>
      )}

      {/* Input del valor — siempre visible, se rellena automáticamente tras la foto */}
      <div className={photo ? 'ring-2 ring-emerald-400 rounded-xl' : ''}>
        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
          {ocrRunning
            ? '🔍 Leyendo número automáticamente...'
            : (photo && value)
            ? '✓ Número detectado — corrige si es necesario'
            : ocrFailed
            ? <span className="text-orange-600 dark:text-orange-400">Escribe el valor manualmente</span>
            : <>Valor del contador — <span className="text-blue-600 dark:text-blue-400">{label}</span> <span className="text-gray-400 font-normal">({unit})</span></>
          }
        </label>
        <div className="relative">
          {ocrRunning && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-700/80 rounded-xl z-10">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Analizando imagen...
              </div>
            </div>
          )}
          <input
            type="number"
            inputMode="numeric"
            step="any" min="0"
            placeholder="Escribe el número o fotografía el contador..."
            className="w-full text-2xl font-mono text-center border-2 border-gray-200 dark:border-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── PDF Generators ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CellDef = any

function pdfHeader(doc: jsPDF, form: WizardForm) {
  const pw = doc.internal.pageSize.getWidth()
  const MARGIN = 4
  doc.setFillColor(0, 0, 0); doc.rect(0, 0, pw, 15, 'F')
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, 32, 15, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(0, 0, 0)
  doc.text('IKEA', 3, 10); doc.setFontSize(7); doc.text('ALCORCÓN', 3, 14)
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text('FICHA DIARIA MANTENIMIENTO PREVENTIVO', pw / 2, 9, { align: 'center' })
  const dayW = 42
  doc.setFillColor(255, 255, 0); doc.rect(pw - dayW, 0, dayW, 15, 'F')
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(14)
  doc.text(form.dia_semana.toUpperCase(), pw - 2, 8, { align: 'right' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('S.', pw - dayW + 2, 13.5); doc.setFontSize(13)
  doc.text(String(form.semana_mes), pw - 2, 13.5, { align: 'right' })
  doc.setFillColor(230, 230, 230); doc.rect(0, 15, pw, 7, 'F')
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(12); doc.setTextColor(0, 0, 0)
  doc.text(`RONDA DE ${form.tipo === 'apertura' ? 'APERTURA' : 'CIERRE'}`, pw / 2, 20.5, { align: 'center' })
  return MARGIN
}

function generateFormularioPDF(form: WizardForm): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  const MARGIN = pdfHeader(doc, form)

  const groups: Record<string, CheckItem[]> = {}
  form.checks.forEach(c => { if (!groups[c.ubicacion]) groups[c.ubicacion] = []; groups[c.ubicacion].push(c) })

  const tableBody: CellDef[][] = []
  Object.entries(groups).forEach(([ubicacion, items]) => {
    items.forEach((c, i) => {
      const row: CellDef[] = []
      if (i === 0) row.push({ content: ubicacion, rowSpan: items.length, styles: { fontStyle: 'bold', valign: 'middle', halign: 'center', fontSize: 7 } })
      row.push({ content: c.descripcion })
      row.push({ content: 'BIEN', styles: c.estado === 'bien' ? { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' } : { fillColor: [255, 255, 255], textColor: [0, 0, 0], halign: 'center' } })
      row.push({ content: 'MAL', styles: c.estado === 'mal' ? { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' } : { fillColor: [255, 255, 255], textColor: [0, 0, 0], halign: 'center' } })
      row.push({ content: c.comentario, styles: c.comentario ? { fillColor: [255, 255, 0], textColor: [0, 0, 0] } : {} })
      tableBody.push(row)
    })
  })

  autoTable(doc, {
    startY: 23,
    head: [[
      { content: 'UBICACIÓN', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
      { content: 'DESCRIPCIÓN', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
      { content: 'CHECK', colSpan: 2, styles: { halign: 'center' } },
      { content: 'COMENTARIOS', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
    ], ['BIEN', 'MAL']],
    body: tableBody,
    styles: { fontSize: 6.5, cellPadding: 0.7, lineColor: [180, 180, 180], lineWidth: 0.1 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 1.0 },
    columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 63 }, 2: { cellWidth: 14 }, 3: { cellWidth: 14 }, 4: { cellWidth: 'auto' } },
    margin: { left: MARGIN, right: MARGIN },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checksY = (doc as any).lastAutoTable.finalY
  autoTable(doc, {
    startY: checksY + 0.5,
    body: [[
      { content: 'REALIZADO POR:', styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } },
      { content: form.nombre.toUpperCase(), styles: { fillColor: [255, 255, 0], fontStyle: 'bold', textColor: [0, 0, 0] } },
      { content: 'Hora Inicio:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255] } },
      { content: form.hora_inicio, styles: { fillColor: [255, 255, 0], fontStyle: 'bold', halign: 'center' } },
      { content: 'Hora Fin:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255] } },
      { content: form.hora_fin, styles: { fillColor: [255, 255, 0], fontStyle: 'bold', halign: 'center' } },
    ]],
    styles: { fontSize: 8, cellPadding: 1.0, lineColor: [180, 180, 180], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 50 }, 2: { cellWidth: 24 }, 3: { cellWidth: 18 }, 4: { cellWidth: 18 }, 5: { cellWidth: 18 } },
    margin: { left: MARGIN, right: MARGIN },
  })

  // Footer: página y fecha
  doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text(`Formulario — ${form.fecha}`, pw - MARGIN, doc.internal.pageSize.getHeight() - 3, { align: 'right' })

  return doc.output('blob')
}

function generateLecturasPDF(form: WizardForm): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  const MARGIN = pdfHeader(doc, form)

  // Realizado por + horas
  autoTable(doc, {
    startY: 23,
    body: [[
      { content: 'REALIZADO POR:', styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } },
      { content: form.nombre.toUpperCase(), styles: { fillColor: [255, 255, 0], fontStyle: 'bold', textColor: [0, 0, 0] } },
      { content: 'Fecha:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255] } },
      { content: form.fecha, styles: { fillColor: [255, 255, 0], fontStyle: 'bold', halign: 'center' } },
      { content: 'Hora Inicio:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255] } },
      { content: form.hora_inicio, styles: { fillColor: [255, 255, 0], fontStyle: 'bold', halign: 'center' } },
      { content: 'Hora Fin:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255] } },
      { content: form.hora_fin, styles: { fillColor: [255, 255, 0], fontStyle: 'bold', halign: 'center' } },
    ]],
    styles: { fontSize: 8, cellPadding: 1.2, lineColor: [180, 180, 180], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 46 }, 2: { cellWidth: 18 }, 3: { cellWidth: 22 }, 4: { cellWidth: 24 }, 5: { cellWidth: 18 }, 6: { cellWidth: 18 }, 7: { cellWidth: 18 } },
    margin: { left: MARGIN, right: MARGIN },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoY = (doc as any).lastAutoTable.finalY

  // Lecturas
  autoTable(doc, {
    startY: infoY + 3,
    head: [['DÍA DEL MES', 'SEMANA', 'DÍA SEMANA', 'ELECTRICIDAD (kWh)', 'AGUA PCI (m³)', 'AGUA COMERCIAL (m³)', 'PCI JOCKEY (arr.)', 'COMPRESOR (arr.)']],
    body: [[
      { content: String(form.dia_mes), styles: { fillColor: [255, 255, 0], fontStyle: 'bold' } },
      { content: `S.${form.semana_mes}`, styles: { fillColor: [255, 255, 0], fontStyle: 'bold' } },
      { content: form.dia_semana, styles: { fillColor: [255, 255, 0], fontStyle: 'bold' } },
      { content: form.electricidad || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold', fontSize: 14 } },
      { content: form.agua_pci || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold', fontSize: 14 } },
      { content: form.agua_comercial || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold', fontSize: 14 } },
      { content: form.pci_jockey || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold', fontSize: 14 } },
      { content: form.compresor || '—', styles: { fillColor: [255, 255, 0], fontStyle: 'bold', fontSize: 14 } },
    ]],
    styles: { fontSize: 9, cellPadding: 3, halign: 'center', lineColor: [180, 180, 180], lineWidth: 0.1 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8, cellPadding: 2 },
    margin: { left: MARGIN, right: MARGIN },
  })

  doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text(`Lecturas — ${form.fecha}`, pw - MARGIN, doc.internal.pageSize.getHeight() - 3, { align: 'right' })

  return doc.output('blob')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
  const toast = useToast()
  const confirm = useConfirm()
  const { data: rondas, setData: setRondas, loading } = useRealtimeTable('rondas', getRondas)
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [histDays, setHistDays] = useState<7 | 30 | 'all'>(7)
  const [editingRonda, setEditingRonda] = useState<RondaEntry | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})

  useEffect(() => {
    getWorkers().then(setWorkers)
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
    let saved: RondaEntry
    try {
      // 1. Save ronda to DB first — this must succeed independently of the PDFs
      saved = await upsertRonda({
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
    } catch (e) {
      console.error('Error guardando ronda:', e)
      const msg = e instanceof Error ? e.message : ''
      toast.error(msg ? `Error al guardar la ronda: ${msg}` : 'Error al guardar la ronda.')
      setSaving(false)
      return
    }

    const withWorker = { ...saved, worker: workers.find(w => w.id === saved.worker_id) }
    setRondas(prev => {
      const exists = prev.some(r => r.id === saved.id)
      return exists ? prev.map(r => r.id === saved.id ? withWorker : r) : [withWorker, ...prev]
    })
    setWizardOn(false)
    toast.success('Ronda guardada correctamente')
    setSaving(false)

    // 2. Generate + upload PDFs best-effort — a failure here must never undo the save above
    try {
      const blobFormulario = generateFormularioPDF(wForm)
      const blobLecturas = generateLecturasPDF(wForm)
      const urlF = await uploadRondaPDF(blobFormulario, `${saved.id}-formulario.pdf`)
      const urlL = await uploadRondaPDF(blobLecturas, `${saved.id}-lecturas.pdf`)
      if (urlF && urlL) await patchRondaObservaciones(saved.id, { pdf_formulario_url: urlF, pdf_lecturas_url: urlL })
    } catch (e) {
      console.error('Error generando/subiendo los PDFs de la ronda:', e)
      toast.error('La ronda se guardó, pero hubo un problema generando o subiendo los PDFs.')
    }
  }

  async function handleDelete(id: number) {
    const ok = await confirm({ title: 'Eliminar ronda', message: '¿Eliminar esta ronda? Se perderán todas sus lecturas.' })
    if (!ok) return
    try {
      await deleteRonda(id)
      setRondas(prev => prev.filter(r => r.id !== id))
      toast.success('Ronda eliminada')
    } catch { toast.error('No se pudo eliminar.') }
  }

  function openEdit(r: RondaEntry) {
    let obs: Record<string, unknown> = {}
    try { obs = JSON.parse(r.observaciones ?? '{}') } catch {}
    setEditForm({
      electricidad: r.lectura_luz != null ? String(r.lectura_luz) : '',
      agua_comercial: r.lectura_agua != null ? String(r.lectura_agua) : '',
      agua_pci: String(obs.agua_pci ?? ''),
      pci_jockey: r.arranques_jockey != null ? String(r.arranques_jockey) : '',
      compresor: r.arranques_compresor != null ? String(r.arranques_compresor) : '',
    })
    setEditingRonda(r)
  }

  async function handleEditSave() {
    if (!editingRonda) return
    setSaving(true)
    try {
      let obs: Record<string, unknown> = {}
      try { obs = JSON.parse(editingRonda.observaciones ?? '{}') } catch {}
      const updated = await upsertRonda({
        ...editingRonda,
        lectura_luz: editForm.electricidad ? Number(editForm.electricidad) : undefined,
        lectura_agua: editForm.agua_comercial ? Number(editForm.agua_comercial) : undefined,
        arranques_jockey: editForm.pci_jockey ? Number(editForm.pci_jockey) : undefined,
        arranques_compresor: editForm.compresor ? Number(editForm.compresor) : undefined,
        observaciones: JSON.stringify({ ...obs, agua_pci: editForm.agua_pci }),
      })
      const withWorker = { ...updated, worker: workers.find(w => w.id === updated.worker_id) }
      setRondas(prev => prev.map(r => r.id === updated.id ? withWorker : r))
      setEditingRonda(null)
      toast.success('Lecturas actualizadas')
    } catch {
      toast.error('Error al guardar los cambios.')
    } finally { setSaving(false) }
  }

  function rondaToForm(r: RondaEntry): WizardForm {
    let obs: Record<string, unknown> = {}
    try { obs = JSON.parse(r.observaciones ?? '{}') } catch {}
    return {
      tipo: r.tipo,
      nombre: (obs.nombre as string) || r.worker?.name || '',
      fecha: r.fecha,
      hora_inicio: r.hora?.substring(0, 5) || '00:00',
      hora_fin: (obs.hora_fin as string) || addHour(r.hora?.substring(0, 5) || '00:00'),
      dia_semana: (obs.dia_semana as string) || '',
      dia_mes: (obs.dia_mes as number) || new Date(r.fecha).getDate(),
      semana_mes: (obs.semana_mes as number) || 1,
      electricidad: r.lectura_luz != null ? String(r.lectura_luz) : '',
      agua_pci: String(obs.agua_pci ?? ''),
      agua_comercial: r.lectura_agua != null ? String(r.lectura_agua) : '',
      pci_jockey: r.arranques_jockey != null ? String(r.arranques_jockey) : '',
      compresor: r.arranques_compresor != null ? String(r.arranques_compresor) : '',
      checks: Array.isArray(obs.checks) ? (obs.checks as CheckItem[]) : DEFAULT_CHECKS.map(c => ({ ...c })),
    }
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
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Semana del año (S.)</label>
            <input type="number" min={1} max={53}
              className="w-full text-center text-lg font-mono border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={wForm.semana_mes}
              onChange={e => setWForm(f => ({ ...f, semana_mes: Number(e.target.value) }))} />
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
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => downloadBlob(generateFormularioPDF(wForm), `ronda-${wForm.tipo}-${wForm.fecha}-formulario.pdf`)}
                className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border-2 border-blue-300 dark:border-blue-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <FileDown size={14} /> PDF Formulario
              </button>
              <button
                onClick={() => downloadBlob(generateLecturasPDF(wForm), `ronda-${wForm.tipo}-${wForm.fecha}-lecturas.pdf`)}
                className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 border-2 border-cyan-300 dark:border-cyan-700 rounded-xl hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
              >
                <FileDown size={14} /> PDF Lecturas
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl transition-colors"
            >
              <Check size={16} /> {saving ? 'Guardando y subiendo PDFs...' : 'Guardar ronda y subir PDFs'}
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
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
          >
            <History size={15} />
            Historial de rondas
            <span className="text-xs text-gray-400">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="flex items-center gap-1 text-xs">
              {([7, 30, 'all'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setHistDays(d)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-medium transition-colors border',
                    histDays === d
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-blue-400'
                  )}
                >
                  {d === 'all' ? 'Todo' : `${d}d`}
                </button>
              ))}
            </div>
          )}
        </div>
        {showHistory && (() => {
          const today = new Date(todayIso()).getTime()
          const filtered = histDays === 'all'
            ? rondas
            : rondas.filter(r => (today - new Date(r.fecha).getTime()) / 86400000 <= histDays)
          if (filtered.length === 0) return (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">
              No hay rondas en los últimos {histDays} días.
            </p>
          )
          return (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden overflow-x-auto shadow-sm">
              <table className="w-full text-xs min-w-[660px]">
                <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                    {['Fecha', 'Tipo', 'Responsable', 'Electr.', 'Agua Com.', 'Agua PCI', 'Jockey', 'Compresor', 'PDFs', ''].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {filtered.map(r => {
                    const cfg = TIPO_CFG[r.tipo]
                    let obs: Record<string, unknown> = {}
                    try { obs = JSON.parse(r.observaciones ?? '{}') } catch {}
                    const urlF = obs.pdf_formulario_url as string | undefined
                    const urlL = obs.pdf_lecturas_url as string | undefined
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-3 py-2 text-gray-600 dark:text-slate-300 whitespace-nowrap">{r.fecha}<br /><span className="text-gray-400 text-[10px]">{r.hora?.substring(0, 5)}</span></td>
                        <td className="px-3 py-2"><span className={cn('font-semibold', cfg.color)}>{cfg.label}</span></td>
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
                        <td className="px-3 py-2 font-mono text-gray-700 dark:text-slate-200">{obs.agua_pci ? String(obs.agua_pci) : '—'}</td>
                        <td className="px-3 py-2 font-mono text-gray-700 dark:text-slate-200">{r.arranques_jockey ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-gray-700 dark:text-slate-200">{r.arranques_compresor ?? '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 flex-wrap">
                            {urlF
                              ? <a href={urlF} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded whitespace-nowrap">Form.</a>
                              : <button onClick={() => downloadBlob(generateFormularioPDF(rondaToForm(r)), `ronda-${r.tipo}-${r.fecha}-formulario.pdf`)} className="text-blue-500 hover:text-blue-700 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded whitespace-nowrap"><FileDown size={9} className="inline mr-0.5" />Form.</button>
                            }
                            {urlL
                              ? <a href={urlL} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-800 text-[10px] font-medium bg-cyan-50 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded whitespace-nowrap">Lect.</a>
                              : <button onClick={() => downloadBlob(generateLecturasPDF(rondaToForm(r)), `ronda-${r.tipo}-${r.fecha}-lecturas.pdf`)} className="text-cyan-600 hover:text-cyan-800 text-[10px] font-medium bg-cyan-50 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded whitespace-nowrap"><FileDown size={9} className="inline mr-0.5" />Lect.</button>
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(r)} title="Editar lecturas" className="text-gray-400 hover:text-blue-500 p-1 rounded transition-colors">
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => handleDelete(r.id)} title="Eliminar ronda" className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>

      {/* Edit dialog */}
      {editingRonda && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800 dark:text-white">Editar lecturas</h3>
              <button onClick={() => setEditingRonda(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Ronda de {TIPO_CFG[editingRonda.tipo].label} · {editingRonda.fecha} · {editingRonda.hora?.substring(0, 5)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'electricidad', label: 'Electricidad', unit: 'kWh' },
                { key: 'agua_comercial', label: 'Agua Comercial', unit: 'm³' },
                { key: 'agua_pci', label: 'Agua PCI', unit: 'm³' },
                { key: 'pci_jockey', label: 'PCI Jockey', unit: 'arr.' },
                { key: 'compresor', label: 'Compresor', unit: 'arr.' },
              ].map(({ key, label, unit }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                    {label} <span className="text-gray-400 font-normal">({unit})</span>
                  </label>
                  <input
                    type="number" step="any" min="0"
                    className="w-full text-sm font-mono text-center border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                    value={editForm[key] ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditingRonda(null)}
                className="flex-1 py-2.5 text-sm text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Check size={14} /> {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
