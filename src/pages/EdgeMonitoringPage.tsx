import { useState, useEffect } from 'react'
import { Activity, Sparkles, CheckCircle2, AlertTriangle, ShieldAlert, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/contexts/ToastContext'
import { getEdgeAssets, getEdgeSensorReadings, createSensorReading } from '@/lib/supabase'
import type { EdgeAsset } from '@/types'
import { cn } from '@/lib/utils'
import { PageLoading } from '@/components/Skeleton'
import {
  SENSOR_TYPE_META, STATUS_META, ASSET_TYPE_SENSOR_MAP,
  evaluateSensorStatus, generateSimulatedValue, formatSensorValue,
  type SensorReading, type SensorType, type SensorStatus,
} from '@/lib/edgeSensors'

interface SensorCard {
  asset: EdgeAsset
  sensorType: SensorType
  reading: SensorReading
}

function SensorStatusCard({ card, onClick }: { card: SensorCard; onClick: () => void }) {
  const meta = SENSOR_TYPE_META[card.sensorType]
  const Icon = meta.icon
  return (
    <Card onClick={onClick}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              card.reading.status === 'critical' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
              card.reading.status === 'warning' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
              'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400')}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{card.asset.name}</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">{meta.label}</p>
            </div>
          </div>
          <Badge className={STATUS_META[card.reading.status].className}>{STATUS_META[card.reading.status].label}</Badge>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-xl font-bold text-gray-800 dark:text-slate-100">
            {formatSensorValue(card.sensorType, card.reading.value)}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1">
            <Clock size={10} />
            {new Date(card.reading.recorded_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function ReadingsHistoryChart({ readings, sensorType }: { readings: SensorReading[]; sensorType: SensorType }) {
  const meta = SENSOR_TYPE_META[sensorType]
  const sorted = [...readings].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
  const barColor: Record<SensorStatus, string> = {
    normal: 'bg-emerald-500', warning: 'bg-amber-500', critical: 'bg-red-500',
  }

  if (meta.isBoolean) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {sorted.map(r => (
          <div key={r.id} className="flex flex-col items-center gap-1" title={new Date(r.recorded_at).toLocaleString('es-ES')}>
            <div className={cn('w-4 h-4 rounded-full', barColor[r.status])} />
          </div>
        ))}
      </div>
    )
  }

  const maxVal = Math.max(...sorted.map(r => r.value), 1)
  const maxBarPx = 90
  return (
    <div className="flex items-end gap-2" style={{ height: maxBarPx + 32 }}>
      {sorted.map(r => {
        const h = Math.max((r.value / maxVal) * maxBarPx, 4)
        return (
          <div key={r.id} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-[18px]">
            <span className="text-[9px] font-semibold text-gray-500 dark:text-slate-400">{r.value}</span>
            <div className={cn('w-full max-w-[22px] rounded-t transition-all', barColor[r.status])} style={{ height: h }} />
            <span className="text-[9px] text-gray-400 dark:text-slate-500">
              {new Date(r.recorded_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function EdgeMonitoringPage() {
  const toast = useToast()
  const [assets, setAssets] = useState<EdgeAsset[]>([])
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [selected, setSelected] = useState<{ assetId: number; sensorType: SensorType } | null>(null)

  function loadAll() {
    return Promise.all([getEdgeAssets(), getEdgeSensorReadings()]).then(([a, r]) => {
      setAssets(a)
      setReadings(r)
    })
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false))
  }, [])

  async function handleSimulateRound() {
    if (assets.length === 0) {
      toast.info('Da de alta activos en "Activos Críticos" primero.')
      return
    }
    setSimulating(true)
    try {
      for (const asset of assets) {
        const sensorTypes = ASSET_TYPE_SENSOR_MAP[asset.asset_type] ?? []
        for (const sensorType of sensorTypes) {
          const value = generateSimulatedValue(sensorType)
          const status = evaluateSensorStatus(sensorType, value, asset.criticality)
          await createSensorReading({
            asset_id: asset.id,
            sensor_type: sensorType,
            value,
            unit: SENSOR_TYPE_META[sensorType].unit || undefined,
            status,
          })
        }
      }
      await loadAll()
      toast.success('Ronda de lecturas simulada')
    } catch {
      toast.error('Error al simular lecturas. Puede que se hayan creado algunas.')
    } finally {
      setSimulating(false)
    }
  }

  if (loading) return <PageLoading kpis={3} rows={5} />

  // Última lectura por (activo, tipo de sensor) — readings ya viene ordenado desc por recorded_at
  const latestByPair = new Map<string, SensorReading>()
  for (const r of readings) {
    const key = `${r.asset_id}-${r.sensor_type}`
    if (!latestByPair.has(key)) latestByPair.set(key, r)
  }
  const assetsById = new Map(assets.map(a => [a.id, a]))
  const cards: SensorCard[] = Array.from(latestByPair.values())
    .map(reading => {
      const asset = assetsById.get(reading.asset_id)
      return asset ? { asset, sensorType: reading.sensor_type, reading } : null
    })
    .filter((c): c is SensorCard => c !== null)
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, normal: 2 }
      return order[a.reading.status] - order[b.reading.status]
    })

  const kpis = [
    { label: 'Normal', value: cards.filter(c => c.reading.status === 'normal').length, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'En aviso', value: cards.filter(c => c.reading.status === 'warning').length, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Críticos', value: cards.filter(c => c.reading.status === 'critical').length, icon: ShieldAlert, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' },
  ]

  const selectedHistory = selected
    ? readings.filter(r => r.asset_id === selected.assetId && r.sensor_type === selected.sensorType).slice(0, 10)
    : []
  const selectedAsset = selected ? assetsById.get(selected.assetId) : null

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity size={18} className="text-blue-600 dark:text-blue-400" />
            Monitorización
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Sensores simulados — temperatura, humedad, consumo, SAI, red, puertas y CCTV
          </p>
        </div>
        <Button size="sm" onClick={handleSimulateRound} disabled={simulating}>
          <Sparkles size={14} />
          {simulating ? 'Simulando...' : 'Simular ronda de lecturas'}
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>Todavía no hay lecturas de sensores.</p>
          <p className="text-xs mt-1">Pulsa "Simular ronda de lecturas" para generar la primera.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {kpis.map(kpi => {
              const Icon = kpi.icon
              return (
                <Card key={kpi.label} className="border border-gray-200 dark:border-slate-700">
                  <CardContent className="pt-4 pb-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', kpi.bg, kpi.color)}>
                      <Icon size={18} />
                    </div>
                    <div className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{kpi.label}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {cards.map(card => (
              <SensorStatusCard
                key={`${card.asset.id}-${card.sensorType}`}
                card={card}
                onClick={() => setSelected({ assetId: card.asset.id, sensorType: card.sensorType })}
              />
            ))}
          </div>
        </>
      )}

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selectedAsset?.name ?? ''} · ${SENSOR_TYPE_META[selected.sensorType].label}` : ''}
        size="md"
      >
        <div className="p-5">
          {selected && selectedHistory.length > 0 ? (
            <ReadingsHistoryChart readings={selectedHistory} sensorType={selected.sensorType} />
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500">Sin histórico suficiente.</p>
          )}
        </div>
      </Dialog>
    </div>
  )
}
