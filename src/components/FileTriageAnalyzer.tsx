import { useRef, useState } from 'react'
import { ShieldCheck, AlertTriangle, FileWarning, Hash, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  analyzeFile, computeSha256, formatFileSize,
  type FileAnalysisResult, SEVERITY_BANNER, SEVERITY_LABEL_ES,
} from '@/lib/soc'

// Solo lee metadatos y calcula el hash localmente (Web Crypto API).
// El archivo nunca se ejecuta, ni se abre, ni se sube a ningún sitio.
const MAX_HASH_SIZE = 100 * 1024 * 1024 // 100 MB

export default function FileTriageAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [hashing, setHashing] = useState(false)
  const [result, setResult] = useState<FileAnalysisResult | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setResult(null)
    setHash(null)
    if (f && f.size <= MAX_HASH_SIZE) {
      setHashing(true)
      computeSha256(f)
        .then(setHash)
        .catch(() => setHash(null))
        .finally(() => setHashing(false))
    }
  }

  function handleAnalyze() {
    if (!file) return
    setResult(analyzeFile({ fileName: file.name, fileSize: file.size, mimeType: file.type }))
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <input ref={inputRef} type="file" onChange={handleFileChange} className="hidden" />
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl text-gray-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
        >
          <Upload size={22} />
          <span className="text-sm font-medium">{file ? 'Seleccionar otro archivo' : 'Seleccionar archivo a revisar'}</span>
        </button>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5">
          El archivo no se ejecuta, no se abre ni se sube a ningún sitio — solo se leen sus metadatos localmente.
        </p>
      </div>

      {file && (
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-2 bg-gray-50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <FileWarning size={16} className="text-gray-400 dark:text-slate-500 shrink-0" />
            <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{file.name}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span>Tamaño: <strong className="text-gray-700 dark:text-slate-200">{formatFileSize(file.size)}</strong></span>
            <span>Tipo MIME: <strong className="text-gray-700 dark:text-slate-200">{file.type || 'desconocido'}</strong></span>
            <span className="col-span-2">Modificado: <strong className="text-gray-700 dark:text-slate-200">{new Date(file.lastModified).toLocaleString('es-ES')}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 pt-1">
            <Hash size={12} className="shrink-0" />
            {hashing ? 'Calculando hash SHA-256...' : hash ? <span className="font-mono break-all">{hash}</span> : 'Hash no disponible (archivo demasiado grande)'}
          </div>
          <Button onClick={handleAnalyze} size="sm" className="mt-1">Analizar</Button>
        </div>
      )}

      {result && (
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className={cn('px-4 py-3 flex items-center justify-between', SEVERITY_BANNER[result.severity].bg)}>
            <div className="flex items-center gap-2">
              {result.severity === 'low'
                ? <ShieldCheck size={18} className={SEVERITY_BANNER[result.severity].text} />
                : <AlertTriangle size={18} className={SEVERITY_BANNER[result.severity].text} />}
              <span className={cn('font-semibold text-sm', SEVERITY_BANNER[result.severity].text)}>
                Riesgo {SEVERITY_LABEL_ES[result.severity]}
              </span>
            </div>
            <span className={cn('text-2xl font-bold', SEVERITY_BANNER[result.severity].text)}>
              {result.score}<span className="text-xs font-normal">/100</span>
            </span>
          </div>

          <div className="p-4 space-y-3 bg-white dark:bg-slate-800">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Extensión: <strong className="text-gray-700 dark:text-slate-200">{result.extension}</strong>
            </p>

            {result.reasons.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-1.5">Motivos detectados</p>
                <ul className="space-y-1">
                  {result.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-slate-300 flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-slate-400">No se detectaron señales de riesgo evidentes.</p>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2.5">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-0.5">Recomendación</p>
              <p className="text-xs text-blue-600 dark:text-blue-300">{result.recommendation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
