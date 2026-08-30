import { useRef, useState } from 'react'
import { Camera, ImagePlus, X, Loader2, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadRepairPhoto } from '@/lib/supabase'

interface Props {
  photos: string[]
  onChange: (photos: string[]) => void
  prefix?: string
  readOnly?: boolean
  maxPhotos?: number
  uploadFn?: (blob: Blob, path: string) => Promise<string | null>
}

async function compressToJpeg(file: File, maxPx = 1920, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width: w, height: h } = img
      if (w > maxPx || h > maxPx) {
        const r = maxPx / Math.max(w, h)
        w = Math.round(w * r); h = Math.round(h * r)
      }
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      c.toBlob(b => b ? resolve(b) : reject(new Error('canvas toBlob failed')), 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = url
  })
}

export default function PhotoUpload({ photos, onChange, prefix = 'photo-', readOnly = false, maxPhotos = 8, uploadFn = uploadRepairPhoto }: Props) {
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const blob = await compressToJpeg(file)
      const path = `${prefix}${Date.now()}.jpg`
      const url = await uploadFn(blob, path)
      if (url) {
        onChange([...photos, url])
      } else {
        alert('No se pudo subir la foto. Comprueba que el bucket de Storage existe y es público.')
      }
    } catch (e) {
      alert(`Error al procesar la foto${e instanceof Error ? `: ${e.message}` : '.'}`)
    } finally {
      setUploading(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {/* Grid de miniaturas */}
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((url, i) => (
            <div
              key={i}
              className="relative rounded-lg overflow-hidden aspect-square group cursor-pointer border border-gray-100 dark:border-slate-700"
              onClick={() => setLightbox(url)}
            >
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onChange(photos.filter((_, j) => j !== i)) }}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Eliminar foto"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Botones añadir */}
      {!readOnly && photos.length < maxPhotos && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => cameraRef.current?.click()}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium rounded-xl border-2 border-dashed transition-colors',
              uploading
                ? 'border-gray-200 dark:border-slate-600 text-gray-300 dark:text-slate-600'
                : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400'
            )}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            {uploading ? 'Subiendo...' : 'Cámara'}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => galleryRef.current?.click()}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium rounded-xl border-2 border-dashed transition-colors',
              uploading
                ? 'border-gray-200 dark:border-slate-600 text-gray-300 dark:text-slate-600'
                : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-500 dark:hover:border-violet-500 dark:hover:text-violet-400'
            )}
          >
            <ImagePlus size={13} />
            Galería
          </button>
          {/* capture="environment" abre la cámara trasera en móvil */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {photos.length === 0 && readOnly && (
        <p className="text-xs text-gray-400 dark:text-slate-500 italic">Sin fotos adjuntas</p>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/92 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/40 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">Toca fuera para cerrar</p>
        </div>
      )}
    </div>
  )
}
