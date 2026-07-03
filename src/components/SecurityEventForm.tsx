import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createSocCase, createSecurityEvent, getEdgeAssets } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { SECURITY_EVENT_TYPES, SEVERITY_META, SEVERITY_MIDPOINT, type SocSeverity } from '@/lib/soc'
import type { EdgeAsset } from '@/types'

const SEVERITIES: SocSeverity[] = ['low', 'medium', 'high', 'critical']

export default function SecurityEventForm({ onCaseSaved }: { onCaseSaved?: () => void }) {
  const { worker } = useAuth()
  const toast = useToast()
  const [assets, setAssets] = useState<EdgeAsset[]>([])
  const [eventType, setEventType] = useState(SECURITY_EVENT_TYPES[0])
  const [affectedAssetId, setAffectedAssetId] = useState<number | ''>('')
  const [affectedArea, setAffectedArea] = useState('')
  const [affectedSystem, setAffectedSystem] = useState('')
  const [source, setSource] = useState('')
  const [details, setDetails] = useState('')
  const [severity, setSeverity] = useState<SocSeverity>('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getEdgeAssets().then(setAssets)
  }, [])

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'text-xs font-medium text-gray-600 dark:text-slate-300 mb-1.5 block'

  async function handleSave() {
    setSaving(true)
    try {
      const socCase = await createSocCase({
        title: `Evento de seguridad: ${eventType}`,
        case_type: 'event',
        status: 'open',
        severity,
        description: details || undefined,
        reported_by_id: worker?.id,
      })
      await createSecurityEvent({
        case_id: socCase.id,
        event_type: eventType,
        affected_asset_id: affectedAssetId || undefined,
        affected_area: affectedArea || undefined,
        affected_system: affectedSystem || undefined,
        source: source || undefined,
        details: details || undefined,
        risk_score: SEVERITY_MIDPOINT[severity],
        severity,
      })
      onCaseSaved?.()
    } catch {
      toast.error('No se pudo registrar el evento. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className={labelClass}>Tipo de evento</label>
        <select value={eventType} onChange={e => setEventType(e.target.value)} className={inputClass}>
          {SECURITY_EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className={labelClass}>Activo afectado (opcional)</label>
        <select value={affectedAssetId} onChange={e => setAffectedAssetId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
          <option value="">Sin vincular a un activo</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Área afectada</label>
          <input type="text" value={affectedArea} onChange={e => setAffectedArea(e.target.value)} placeholder="ej: sala técnica planta 1" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Sistema afectado</label>
          <input type="text" value={affectedSystem} onChange={e => setAffectedSystem(e.target.value)} placeholder="ej: control de accesos" className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Origen</label>
        <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="ej: sensor, guardia, cámara 4..." className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Detalles</label>
        <textarea
          value={details}
          onChange={e => setDetails(e.target.value)}
          rows={4}
          placeholder="Describe lo ocurrido..."
          className={cn(inputClass, 'resize-none')}
        />
      </div>

      <div>
        <label className={labelClass}>Severidad</label>
        <div className="flex gap-2 flex-wrap">
          {SEVERITIES.map(s => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                severity === s
                  ? SEVERITY_META[s].className + ' border-transparent ring-2 ring-offset-1 ring-blue-400 dark:ring-offset-slate-800'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              )}
            >
              {SEVERITY_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm">
        <Save size={14} />
        {saving ? 'Registrando...' : 'Registrar evento'}
      </Button>
      <p className="text-[11px] text-gray-400 dark:text-slate-500">
        Registro manual — no se realiza ningún escaneo real de red ni de sistemas.
      </p>
    </div>
  )
}
