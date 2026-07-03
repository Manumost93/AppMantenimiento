// Edge / Data Center Lite — utilidades compartidas entre EdgeAssetsPage y EdgeOpsDashboardPage

import {
  Server, Boxes, Network, ShieldCheck, Router as RouterIcon, BatteryCharging, Plug, Wind,
  Thermometer, Droplets, Camera, KeyRound, Zap, Fuel, Cpu, Siren, Cable, type LucideIcon,
} from 'lucide-react'
import type { EdgeAsset, EdgeAssetType, EdgeAssetCriticality, EdgeAssetStatus } from '@/types'

export const ASSET_TYPE_META: Record<EdgeAssetType, { label: string; icon: LucideIcon }> = {
  rack: { label: 'Rack', icon: Boxes },
  edge_server: { label: 'Servidor Edge', icon: Server },
  switch: { label: 'Switch', icon: Network },
  firewall: { label: 'Firewall', icon: ShieldCheck },
  router: { label: 'Router', icon: RouterIcon },
  ups: { label: 'SAI / UPS', icon: BatteryCharging },
  pdu: { label: 'PDU', icon: Plug },
  hvac: { label: 'HVAC / Climatización', icon: Wind },
  temperature_sensor: { label: 'Sensor de temperatura', icon: Thermometer },
  humidity_sensor: { label: 'Sensor de humedad', icon: Droplets },
  cctv: { label: 'CCTV', icon: Camera },
  access_control: { label: 'Control de accesos', icon: KeyRound },
  electrical_panel: { label: 'Cuadro eléctrico', icon: Zap },
  generator: { label: 'Generador', icon: Fuel },
  bms_controller: { label: 'Controlador BMS', icon: Cpu },
  pci_panel: { label: 'Panel PCI', icon: Siren },
  network_cabinet: { label: 'Armario de red', icon: Cable },
}

export const CRITICALITY_META: Record<EdgeAssetCriticality, { label: string; className: string; color: string }> = {
  low: { label: 'Baja', className: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300', color: '#6B7280' },
  medium: { label: 'Media', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', color: '#F59E0B' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', color: '#F97316' },
  critical: { label: 'Crítica', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', color: '#DC2626' },
}

export const STATUS_META: Record<EdgeAssetStatus, { label: string; className: string; color: string }> = {
  operational: { label: 'Operativo', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', color: '#10B981' },
  warning: { label: 'Aviso', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', color: '#F59E0B' },
  offline: { label: 'Offline', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', color: '#EF4444' },
  maintenance: { label: 'Mantenimiento', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', color: '#3B82F6' },
}

export function isUpcomingCheck(dateStr?: string): boolean {
  if (!dateStr) return false
  const in7Days = new Date()
  in7Days.setDate(in7Days.getDate() + 7)
  return new Date(dateStr) <= in7Days
}

export function isOverdueCheck(dateStr?: string): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date(new Date().toDateString())
}

export interface RackRisk {
  rack: string
  assets: EdgeAsset[]
  score: number
  reasons: string[]
}

// Heurística simple de riesgo por rack, calculada en frontend a partir del
// estado/criticidad de los activos que contiene — sin IA, fácil de explicar.
export function computeRackRisk(assets: EdgeAsset[]): RackRisk[] {
  const byRack = new Map<string, EdgeAsset[]>()
  for (const a of assets) {
    if (!a.rack) continue
    byRack.set(a.rack, [...(byRack.get(a.rack) ?? []), a])
  }
  return Array.from(byRack.entries())
    .map(([rack, list]) => {
      let score = 0
      const reasons: string[] = []
      const critical = list.filter(a => a.criticality === 'critical').length
      const offline = list.filter(a => a.status === 'offline').length
      const warning = list.filter(a => a.status === 'warning').length
      const maintenance = list.filter(a => a.status === 'maintenance').length
      if (critical > 0) { score += critical * 20; reasons.push(`${critical} activo(s) crítico(s)`) }
      if (offline > 0) { score += offline * 30; reasons.push(`${offline} offline`) }
      if (warning > 0) { score += warning * 15; reasons.push(`${warning} en aviso`) }
      if (maintenance > 0) { score += maintenance * 10; reasons.push(`${maintenance} en mantenimiento`) }
      return { rack, assets: list, score: Math.min(100, score), reasons }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
}
