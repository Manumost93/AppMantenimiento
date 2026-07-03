import { useState } from 'react'
import { ShieldCheck, AlertTriangle, Lock, LockOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { analyzeUrl, type UrlAnalysisResult, type SocSeverity } from '@/lib/soc'

const SEVERITY_BANNER: Record<SocSeverity, { bg: string; text: string }> = {
  low: { bg: 'bg-gray-50 dark:bg-slate-700/50', text: 'text-gray-700 dark:text-slate-200' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
  high: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' },
  critical: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
}

export default function UrlAnalyzer() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<UrlAnalysisResult | null>(null)

  function handleAnalyze() {
    if (!url.trim()) return
    setResult(analyzeUrl(url))
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-1.5 block">
          URL a analizar
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="https://ejemplo.com/pagina-sospechosa"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={handleAnalyze} disabled={!url.trim()}>Analizar</Button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5">
          Análisis 100% local: no se abre el enlace ni se envía a ningún servicio externo.
        </p>
      </div>

      {result && (
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className={cn('px-4 py-3 flex items-center justify-between', SEVERITY_BANNER[result.severity].bg)}>
            <div className="flex items-center gap-2">
              {result.severity === 'low'
                ? <ShieldCheck size={18} className={SEVERITY_BANNER[result.severity].text} />
                : <AlertTriangle size={18} className={SEVERITY_BANNER[result.severity].text} />}
              <span className={cn('font-semibold text-sm', SEVERITY_BANNER[result.severity].text)}>
                Riesgo {result.severity === 'low' ? 'bajo' : result.severity === 'medium' ? 'medio' : result.severity === 'high' ? 'alto' : 'crítico'}
              </span>
            </div>
            <span className={cn('text-2xl font-bold', SEVERITY_BANNER[result.severity].text)}>
              {result.score}<span className="text-xs font-normal">/100</span>
            </span>
          </div>

          <div className="p-4 space-y-3 bg-white dark:bg-slate-800">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
              <span>Dominio: <strong className="text-gray-700 dark:text-slate-200">{result.domain}</strong></span>
              <span className="flex items-center gap-1">
                {result.usesHttps
                  ? <><Lock size={12} className="text-emerald-500" /> HTTPS</>
                  : <><LockOpen size={12} className="text-red-500" /> Sin HTTPS</>}
              </span>
            </div>

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
