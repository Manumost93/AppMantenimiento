// Sensores simulados para Edge / Data Center Lite (Fase 9).
// Todo es simulación: no hay integración con hardware real. Las lecturas se
// generan desde la propia app (botón "Simular lectura"), con reglas simples
// y explicables, no con IA ni modelos predictivos.

import {
  Thermometer, Droplets, Zap, BatteryCharging, Wind, Network, DoorOpen, Camera, type LucideIcon,
} from 'lucide-react'
import type { EdgeAssetType, EdgeAssetCriticality } from '@/types'

export type SensorType =
  | 'temperature' | 'humidity' | 'power_consumption' | 'ups_status'
  | 'hvac_status' | 'network_status' | 'door_status' | 'cctv_status'

export type SensorStatus = 'normal' | 'warning' | 'critical'

export interface SensorReading {
  id: number
  asset_id: number
  sensor_type: SensorType
  value: number
  unit?: string
  status: SensorStatus
  recorded_at: string
}

export const SENSOR_TYPE_META: Record<SensorType, { label: string; unit: string; icon: LucideIcon; isBoolean: boolean }> = {
  temperature: { label: 'Temperatura', unit: '°C', icon: Thermometer, isBoolean: false },
  humidity: { label: 'Humedad', unit: '%', icon: Droplets, isBoolean: false },
  power_consumption: { label: 'Consumo eléctrico', unit: 'kW', icon: Zap, isBoolean: false },
  ups_status: { label: 'Estado SAI', unit: '', icon: BatteryCharging, isBoolean: true },
  hvac_status: { label: 'Estado HVAC', unit: '', icon: Wind, isBoolean: true },
  network_status: { label: 'Conectividad', unit: '', icon: Network, isBoolean: true },
  door_status: { label: 'Puerta técnica', unit: '', icon: DoorOpen, isBoolean: true },
  cctv_status: { label: 'CCTV', unit: '', icon: Camera, isBoolean: true },
}

export const STATUS_META: Record<SensorStatus, { label: string; className: string }> = {
  normal: { label: 'Normal', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  warning: { label: 'Aviso', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  critical: { label: 'Crítico', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const BOOLEAN_LABELS: Record<SensorType, [string, string]> = {
  temperature: ['', ''],
  humidity: ['', ''],
  power_consumption: ['', ''],
  ups_status: ['Red eléctrica', 'En batería'],
  hvac_status: ['Operativo', 'Fallo'],
  network_status: ['Online', 'Offline'],
  door_status: ['Cerrada', 'Abierta'],
  cctv_status: ['Operativo', 'Offline'],
}

// Qué tipos de sensor tienen sentido para cada tipo de activo
export const ASSET_TYPE_SENSOR_MAP: Partial<Record<EdgeAssetType, SensorType[]>> = {
  rack: ['temperature'],
  edge_server: ['temperature', 'power_consumption', 'network_status'],
  switch: ['temperature', 'network_status'],
  firewall: ['network_status'],
  router: ['network_status'],
  ups: ['ups_status', 'power_consumption'],
  pdu: ['power_consumption'],
  hvac: ['hvac_status', 'temperature', 'humidity'],
  temperature_sensor: ['temperature'],
  humidity_sensor: ['humidity'],
  cctv: ['cctv_status'],
  access_control: ['door_status'],
  electrical_panel: ['power_consumption'],
  generator: ['power_consumption'],
  bms_controller: ['network_status'],
  pci_panel: ['network_status'],
  network_cabinet: ['temperature', 'network_status'],
}

export function formatSensorValue(type: SensorType, value: number): string {
  const meta = SENSOR_TYPE_META[type]
  if (meta.isBoolean) return BOOLEAN_LABELS[type][value === 1 ? 1 : 0]
  return `${value}${meta.unit}`
}

// Reglas de evaluación — fijas y explicables, tal como se pidió:
// temp >27 aviso / >30 crítico · humedad >70 aviso / >80 crítico
// SAI en batería = crítico · red offline = crítico
// puerta abierta fuera de horario (22:00-06:00) = crítico, en horario = aviso
// CCTV offline = crítico si el activo es de criticidad alta/crítica, si no aviso
export function evaluateSensorStatus(
  type: SensorType,
  value: number,
  assetCriticality?: EdgeAssetCriticality
): SensorStatus {
  switch (type) {
    case 'temperature':
      if (value > 30) return 'critical'
      if (value > 27) return 'warning'
      return 'normal'
    case 'humidity':
      if (value > 80) return 'critical'
      if (value > 70) return 'warning'
      return 'normal'
    case 'ups_status':
      return value === 1 ? 'critical' : 'normal'
    case 'network_status':
      return value === 1 ? 'critical' : 'normal'
    case 'hvac_status':
      return value === 1 ? 'warning' : 'normal'
    case 'door_status': {
      if (value !== 1) return 'normal'
      const hour = new Date().getHours()
      return (hour < 6 || hour >= 22) ? 'critical' : 'warning'
    }
    case 'cctv_status': {
      if (value !== 1) return 'normal'
      return (assetCriticality === 'critical' || assetCriticality === 'high') ? 'critical' : 'warning'
    }
    default:
      return 'normal'
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// Genera un valor plausible (sesgado a normal, con posibilidad ocasional de
// aviso/crítico) — para simular una ronda de lecturas sin hardware real.
export function generateSimulatedValue(type: SensorType): number {
  switch (type) {
    case 'temperature': return round1(18 + Math.random() * 16) // 18–34 ºC
    case 'humidity': return round1(30 + Math.random() * 55) // 30–85 %
    case 'power_consumption': return round1(0.3 + Math.random() * 4.5) // 0.3–4.8 kW
    case 'ups_status': return Math.random() < 0.12 ? 1 : 0
    case 'hvac_status': return Math.random() < 0.1 ? 1 : 0
    case 'network_status': return Math.random() < 0.06 ? 1 : 0
    case 'door_status': return Math.random() < 0.15 ? 1 : 0
    case 'cctv_status': return Math.random() < 0.08 ? 1 : 0
    default: return 0
  }
}
