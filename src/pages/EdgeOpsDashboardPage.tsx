import { useState, useEffect } from 'react'
import {
  Activity, Layers, AlertTriangle, WifiOff, Wrench, CloudFog, CalendarX, ShieldAlert, Boxes,
  History, ShieldQuestion, CalendarClock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getEdgeAssets, getSocCases, getAuditLogs, getSecurityEvents } from '@/lib/supabase'
import type { EdgeAsset, AuditLog } from '@/types'
import { SEVERITY_META as SOC_SEVERITY_META, type SocCaseRecord } from '@/lib/soc'
import { ASSET_TYPE_META, CRITICALITY_META, STATUS_META, isOverdueCheck, computeRackRisk } from '@/lib/edgeAssets'
import { PageLoading } from '@/components/Skeleton'

const STATUS_BAR_COLOR: Record<string, string> = {
  operational: 'bg-emerald-500', warning: 'bg-amber-500', offline: 'bg-red-500', maintenance: 'bg-blue-500',
}
const SEVERITY_BAR_COLOR: Record<string, string> = {
  low: 'bg-gray-400', medium: 'bg-amber-500', high: 'bg-orange-500', critical: 'bg-red-500',
}
const CRITICALITY_BAR_COLOR: Record<string, string> = {
  low: 'bg-gray-400', medium: 'bg-amber-500', high: 'bg-orange-500', critical: 'bg-red-600',
}

function lastMonths(n: number) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
    }
  })
}

function BarRow({ label, count, max, colorClass }: { label: string; count: number; max: number; colorClass: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 text-xs text-gray-600 dark:text-slate-300 truncate shrink-0">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-bold text-gray-700 dark:text-slate-200 shrink-0">{count}</span>
    </div>
  )
}

export default function EdgeOpsDashboardPage() {
  const [assets, setAssets] = useState<EdgeAsset[]>([])
  const [events, setEvents] = useState<SocCaseRecord[]>([])
  const [assetByCaseId, setAssetByCaseId] = useState<Map<number, string>>(new Map())
  const [alerts, setAlerts] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getEdgeAssets(), getSocCases(), getAuditLogs(), getSecurityEvents()])
      .then(([a, cases, logs, secEvents]) => {
        setAssets(a)
        setEvents(cases.filter(c => c.case_type === 'event'))
        setAlerts(logs.filter(l => l.module === 'edge_assets' && (l.severity === 'warning' || l.severity === 'critical')))
        setAssetByCaseId(new Map(
          secEvents.filter(e => e.affected_asset).map(e => [e.case_id, e.affected_asset!.name])
        ))
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading kpis={8} rows={5} />

  const rackRisks = computeRackRisk(assets)
  const environmentalTypes = ['temperature_sensor', 'humidity_sensor', 'hvac']

  const kpis = [
    { label: 'Activos totales', value: assets.length, icon: Layers, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Activos críticos', value: assets.filter(a => a.criticality === 'critical').length, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' },
    { label: 'Offline', value: assets.filter(a => a.status === 'offline').length, icon: WifiOff, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' },
    { label: 'En mantenimiento', value: assets.filter(a => a.status === 'maintenance').length, icon: Wrench, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' },
    { label: 'Alertas ambientales', value: assets.filter(a => environmentalTypes.includes(a.asset_type) && a.status === 'warning').length, icon: CloudFog, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30' },
    { label: 'Preventivos vencidos', value: assets.filter(a => isOverdueCheck(a.next_check_date)).length, icon: CalendarX, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Eventos abiertos', value: events.filter(e => e.status === 'open').length, icon: ShieldAlert, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/30' },
    { label: 'Racks en riesgo', value: rackRisks.filter(r => r.score >= 50).length, icon: Boxes, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  ]

  const typeCounts = Object.entries(ASSET_TYPE_META)
    .map(([type, meta]) => ({ type, label: meta.label, count: assets.filter(a => a.asset_type === type).length }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
  const maxTypeCount = Math.max(...typeCounts.map(t => t.count), 1)

  const statusCounts = Object.entries(STATUS_META)
    .map(([status, meta]) => ({ status, label: meta.label, count: assets.filter(a => a.status === status).length }))
  const maxStatusCount = Math.max(...statusCounts.map(s => s.count), 1)

  const locations = Array.from(new Set(assets.map(a => a.location).filter(Boolean))) as string[]
  const locationCounts = locations
    .map(loc => {
      const list = assets.filter(a => a.location === loc)
      const order = { critical: 3, high: 2, medium: 1, low: 0 } as const
      const topCriticality = list.reduce((top, a) => order[a.criticality] > order[top] ? a.criticality : top, 'low' as EdgeAsset['criticality'])
      return { location: loc, count: list.length, topCriticality }
    })
    .sort((a, b) => b.count - a.count)
  const maxLocationCount = Math.max(...locationCounts.map(l => l.count), 1)

  const severityCounts = Object.entries(SOC_SEVERITY_META)
    .map(([sev, meta]) => ({ severity: sev, label: meta.label, count: events.filter(e => e.severity === sev).length }))
  const maxSeverityCount = Math.max(...severityCounts.map(s => s.count), 1)

  const monthlyCounts = lastMonths(6).map(m => ({ ...m, count: events.filter(e => e.created_at.startsWith(m.key)).length }))
  const maxMonthCount = Math.max(...monthlyCounts.map(m => m.count), 1)
  const maxBarPx = 90

  const criticalOffline = assets.filter(a => a.criticality === 'critical' && a.status === 'offline')
  const upcomingMaintenance = [...assets]
    .filter(a => a.next_check_date)
    .sort((a, b) => (a.next_check_date! < b.next_check_date! ? -1 : 1))
    .slice(0, 6)
  const recentEvents = events.slice(0, 5)
  const topRackRisks = rackRisks.slice(0, 5)

  return (
    <div className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity size={18} className="text-blue-600 dark:text-blue-400" />
          Dashboard EdgeOps
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Estado de la infraestructura crítica — derivado de los activos y eventos reales
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {assets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>Todavía no hay activos registrados en Edge / Data Center Lite.</p>
          <p className="text-xs mt-1">Ve a Activos Críticos para darlos de alta (o usar "Cargar ejemplos").</p>
        </div>
      ) : (
        <>
          {/* Gráficas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Activos por tipo</p>
                <div className="space-y-2">
                  {typeCounts.map(t => (
                    <BarRow key={t.type} label={t.label} count={t.count} max={maxTypeCount} colorClass="bg-blue-500" />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Activos por estado</p>
                <div className="space-y-2">
                  {statusCounts.map(s => (
                    <BarRow key={s.status} label={s.label} count={s.count} max={maxStatusCount} colorClass={STATUS_BAR_COLOR[s.status]} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Criticidad por ubicación</p>
                {locationCounts.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500">Sin ubicaciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {locationCounts.map(l => (
                      <BarRow key={l.location} label={l.location} count={l.count} max={maxLocationCount} colorClass={CRITICALITY_BAR_COLOR[l.topCriticality]} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Eventos de seguridad por severidad</p>
                {events.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500">Sin eventos de seguridad registrados todavía.</p>
                ) : (
                  <div className="space-y-2">
                    {severityCounts.map(s => (
                      <BarRow key={s.severity} label={s.label} count={s.count} max={maxSeverityCount} colorClass={SEVERITY_BAR_COLOR[s.severity]} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Evolución mensual */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Evolución mensual de eventos de seguridad</p>
              <div className="flex items-end gap-2" style={{ height: maxBarPx + 32 }}>
                {monthlyCounts.map(m => {
                  const h = m.count > 0 ? Math.max((m.count / maxMonthCount) * maxBarPx, 6) : 2
                  return (
                    <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                      {m.count > 0 && <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400">{m.count}</span>}
                      <div className="w-full max-w-[32px] bg-blue-500 dark:bg-blue-600 rounded-t transition-all" style={{ height: h }} />
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">{m.label}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Listados */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <WifiOff size={13} /> Activos críticos offline
                </p>
                {criticalOffline.length === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Ninguno — todo lo crítico está operativo.</p>
                ) : (
                  <ul className="space-y-2">
                    {criticalOffline.map(a => (
                      <li key={a.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-slate-300 truncate">{a.name}</span>
                        <Badge className={STATUS_META.offline.className}>{STATUS_META.offline.label}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <CalendarClock size={13} /> Próximos mantenimientos
                </p>
                {upcomingMaintenance.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500">Sin revisiones programadas.</p>
                ) : (
                  <ul className="space-y-2">
                    {upcomingMaintenance.map(a => (
                      <li key={a.id} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-gray-700 dark:text-slate-300 truncate">{a.name}</span>
                        <span className={cn('shrink-0', isOverdueCheck(a.next_check_date) ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-slate-400')}>
                          {new Date(a.next_check_date! + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <History size={13} /> Últimas alertas
                </p>
                {alerts.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500">Sin alertas recientes.</p>
                ) : (
                  <ul className="space-y-2">
                    {alerts.slice(0, 6).map(l => (
                      <li key={l.id} className="text-xs">
                        <p className="text-gray-700 dark:text-slate-300 truncate">{l.description}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500">
                          {new Date(l.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Boxes size={13} /> Racks con mayor riesgo
                </p>
                {topRackRisks.length === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Sin racks en riesgo detectado.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {topRackRisks.map(r => (
                      <li key={r.rack} className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700 dark:text-slate-300">Rack {r.rack}</span>
                          <span className="font-bold text-red-600 dark:text-red-400">{r.score}/100</span>
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-slate-500">{r.reasons.join(' · ')}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <ShieldQuestion size={13} /> Eventos de seguridad recientes
                </p>
                {recentEvents.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500">Sin eventos de seguridad registrados todavía.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentEvents.map(e => (
                      <li key={e.id} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-gray-700 dark:text-slate-300 truncate">
                          {e.title}
                          {assetByCaseId.has(e.id) && (
                            <span className="text-gray-400 dark:text-slate-500"> · {assetByCaseId.get(e.id)}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={SOC_SEVERITY_META[e.severity].className}>{SOC_SEVERITY_META[e.severity].label}</Badge>
                          <span className="text-gray-400 dark:text-slate-500">
                            {new Date(e.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
