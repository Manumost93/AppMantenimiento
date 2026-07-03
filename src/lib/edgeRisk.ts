// Risk Score de activos críticos (Fase 10). Cálculo simple en frontend,
// sin IA ni modelos predictivos — una suma de factores explicables.
// No se guarda en base de datos: se recalcula cada vez con los datos vigentes.

import type { EdgeAsset, EdgeAssetCriticality } from '@/types'
import { severityFromScore } from '@/lib/soc'
import { isOverdueCheck, isUpcomingCheck } from '@/lib/edgeAssets'
import type { SensorReading } from '@/lib/edgeSensors'

export interface EdgeAssetRisk {
  score: number
  severity: EdgeAssetCriticality
  reasons: string[]
}

const CRITICALITY_POINTS: Record<EdgeAssetCriticality, number> = {
  low: 5, medium: 15, high: 25, critical: 35,
}

const STATUS_POINTS: Record<EdgeAsset['status'], number> = {
  operational: 0, warning: 15, maintenance: 10, offline: 30,
}

const CRITICALITY_LABEL: Record<EdgeAssetCriticality, string> = {
  low: 'baja', medium: 'media', high: 'alta', critical: 'crítica',
}

const STATUS_LABEL: Record<EdgeAsset['status'], string> = {
  operational: 'operativo', warning: 'en aviso', maintenance: 'en mantenimiento', offline: 'offline',
}

export function getRecentReadingsForAsset(readings: SensorReading[], assetId: number, days = 7): SensorReading[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return readings.filter(r => r.asset_id === assetId && new Date(r.recorded_at).getTime() >= cutoff)
}

// Factores (0-100, capado):
// 1. Criticidad del activo            2. Estado actual
// 3. Revisión vencida / próxima       4. Alertas de sensores recientes (7 días)
// 5. Eventos de seguridad abiertos    6. Sin proveedor asignado (si es crítico/alto)
export function calculateEdgeAssetRisk(
  asset: EdgeAsset,
  recentReadings: SensorReading[],
  openSecurityEventsCount: number
): EdgeAssetRisk {
  let score = 0
  const reasons: string[] = []

  score += CRITICALITY_POINTS[asset.criticality]
  reasons.push(`Criticidad ${CRITICALITY_LABEL[asset.criticality]}`)

  score += STATUS_POINTS[asset.status]
  if (asset.status !== 'operational') reasons.push(`Estado ${STATUS_LABEL[asset.status]}`)

  if (isOverdueCheck(asset.next_check_date)) {
    score += 15
    reasons.push('Revisión de mantenimiento vencida')
  } else if (isUpcomingCheck(asset.next_check_date)) {
    score += 5
    reasons.push('Próxima revisión en menos de 7 días')
  }

  const criticalReadings = recentReadings.filter(r => r.status === 'critical').length
  const warningReadings = recentReadings.filter(r => r.status === 'warning').length
  if (criticalReadings > 0) {
    score += Math.min(criticalReadings * 10, 20)
    reasons.push(`${criticalReadings} lectura(s) de sensor en crítico (últimos 7 días)`)
  }
  if (warningReadings > 0) {
    score += Math.min(warningReadings * 5, 10)
    reasons.push(`${warningReadings} lectura(s) de sensor en aviso (últimos 7 días)`)
  }

  // Eventos de seguridad abiertos vinculados a este activo (Fase 11:
  // soc_security_events.affected_asset_id)
  if (openSecurityEventsCount > 0) {
    score += Math.min(openSecurityEventsCount * 15, 30)
    reasons.push(`${openSecurityEventsCount} evento(s) de seguridad abiertos sobre este activo`)
  }

  if (!asset.provider_id && (asset.criticality === 'critical' || asset.criticality === 'high')) {
    score += 10
    reasons.push('Sin proveedor de mantenimiento asignado')
  }

  score = Math.min(100, Math.round(score))
  return { score, severity: severityFromScore(score), reasons }
}
