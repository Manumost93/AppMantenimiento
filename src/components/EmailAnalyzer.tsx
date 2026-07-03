import { useState } from 'react'
import { ShieldCheck, AlertTriangle, Link2, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { analyzeEmail, type EmailAnalysisResult, SEVERITY_BANNER, SEVERITY_LABEL_ES } from '@/lib/soc'

export default function EmailAnalyzer() {
  const [sender, setSender] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [hasAttachments, setHasAttachments] = useState(false)
  const [attachmentNames, setAttachmentNames] = useState('')
  const [result, setResult] = useState<EmailAnalysisResult | null>(null)

  const canAnalyze = subject.trim() !== '' || body.trim() !== '' || sender.trim() !== ''

  function handleAnalyze() {
    if (!canAnalyze) return
    setResult(analyzeEmail({ sender, subject, body, hasAttachments, attachmentNames }))
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'text-xs font-medium text-gray-600 dark:text-slate-300 mb-1.5 block'

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Remitente</label>
          <input type="text" value={sender} onChange={e => setSender(e.target.value)} placeholder="nombre@dominio.com" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Asunto</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del correo" className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Cuerpo del correo</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={5}
          placeholder="Pega aquí el contenido del correo sospechoso..."
          className={cn(inputClass, 'resize-none')}
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-slate-300 cursor-pointer w-fit">
          <input type="checkbox" checked={hasAttachments} onChange={e => setHasAttachments(e.target.checked)} className="rounded" />
          Tiene adjuntos
        </label>
        {hasAttachments && (
          <input
            type="text"
            value={attachmentNames}
            onChange={e => setAttachmentNames(e.target.value)}
            placeholder="nombres separados por coma, ej: factura.exe, nomina.zip"
            className={cn(inputClass, 'mt-2')}
          />
        )}
      </div>

      <Button onClick={handleAnalyze} disabled={!canAnalyze} className="w-full sm:w-auto">Analizar</Button>
      <p className="text-[11px] text-gray-400 dark:text-slate-500">
        Análisis 100% local: el contenido no se envía a ningún servicio externo ni se guarda todavía.
      </p>

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

            {result.links.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Link2 size={12} /> Enlaces encontrados
                </p>
                <ul className="space-y-1">
                  {result.links.map((l, i) => (
                    <li key={i} className="text-xs text-gray-500 dark:text-slate-400 truncate">{l}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.suspiciousAttachments.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1.5">
                  <Paperclip size={12} /> Adjuntos sospechosos
                </p>
                <ul className="space-y-1">
                  {result.suspiciousAttachments.map((a, i) => (
                    <li key={i} className="text-xs text-red-500 dark:text-red-400">{a}</li>
                  ))}
                </ul>
              </div>
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
