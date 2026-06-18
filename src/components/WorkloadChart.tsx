import { useMemo } from 'react'
import type { TeamMember } from '@/types'
import { cn } from '@/lib/utils'

interface RawTask {
  responsible_id: number
  status: string
  date: string
}

interface Props {
  tasks: RawTask[]
  workers: TeamMember[]
  months?: number
}

function getLast(n: number) {
  const result = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
      year: d.getFullYear(),
    })
  }
  return result
}

export default function WorkloadChart({ tasks, workers, months = 6 }: Props) {
  const monthList = useMemo(() => getLast(months), [months])

  // Para cada trabajador y mes: total de tareas asignadas y completadas
  const matrix = useMemo(() =>
    workers.map(w => ({
      worker: w,
      months: monthList.map(m => {
        const mine = tasks.filter(t => t.responsible_id === w.id && t.date.startsWith(m.key))
        return {
          ...m,
          total: mine.length,
          done: mine.filter(t => t.status === 'done').length,
          active: mine.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
        }
      }),
      totalDone: tasks.filter(t => t.responsible_id === w.id && t.status === 'done').length,
      totalAll: tasks.filter(t => t.responsible_id === w.id).length,
    })).filter(r => r.totalAll > 0),
  [tasks, workers, monthList])

  // Máximos para escalar los ejes
  const maxMonthTotal = useMemo(() =>
    Math.max(...matrix.flatMap(r => r.months.map(m => m.total)), 1),
  [matrix])

  // Completadas por mes (suma de todos los trabajadores)
  const monthTotals = useMemo(() =>
    monthList.map(m => ({
      ...m,
      perWorker: matrix.map(r => ({
        worker: r.worker,
        done: r.months.find(wm => wm.key === m.key)?.done ?? 0,
      })).filter(pw => pw.done > 0),
      total: matrix.reduce((s, r) => s + (r.months.find(wm => wm.key === m.key)?.done ?? 0), 0),
    })),
  [matrix, monthList])

  const maxMonthDone = useMemo(() =>
    Math.max(...monthTotals.map(m => m.total), 1),
  [monthTotals])

  if (matrix.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">
        No hay datos suficientes para mostrar el gráfico.
      </div>
    )
  }

  // Altura del SVG del gráfico de barras verticales
  const svgH = 160
  const svgPadBottom = 24
  const svgPadTop = 12
  const chartH = svgH - svgPadBottom - svgPadTop
  const barAreaW = 52  // ancho por mes en px

  return (
    <div className="space-y-6">

      {/* ── 1. Tareas completadas por mes (barras verticales agrupadas) ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Tareas completadas — últimos {months} meses
        </p>
        <div className="overflow-x-auto pb-1">
          <svg
            width={monthList.length * barAreaW + 32}
            height={svgH}
            className="block"
          >
            {/* Líneas guía horizontales */}
            {[0.25, 0.5, 0.75, 1].map(pct => {
              const y = svgPadTop + chartH * (1 - pct)
              return (
                <g key={pct}>
                  <line
                    x1={28} x2={monthList.length * barAreaW + 28}
                    y1={y} y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.08}
                    strokeDasharray="3,3"
                  />
                  <text
                    x={24} y={y + 4}
                    textAnchor="end"
                    fontSize={9}
                    fill="currentColor"
                    opacity={0.4}
                  >
                    {Math.round(maxMonthDone * pct)}
                  </text>
                </g>
              )
            })}

            {/* Barras por mes */}
            {monthTotals.map((m, mi) => {
              const x0 = 28 + mi * barAreaW
              const nWorkers = m.perWorker.length
              const barW = Math.min(12, (barAreaW - 12) / Math.max(nWorkers, 1))
              const gap = nWorkers > 1 ? (barAreaW - 12 - nWorkers * barW) / (nWorkers - 1) : 0
              const groupW = nWorkers * barW + (nWorkers - 1) * gap
              const startX = x0 + (barAreaW - groupW) / 2

              return (
                <g key={m.key}>
                  {m.perWorker.map((pw, wi) => {
                    const barH = Math.max((pw.done / maxMonthDone) * chartH, pw.done > 0 ? 2 : 0)
                    const bx = startX + wi * (barW + gap)
                    const by = svgPadTop + chartH - barH
                    return (
                      <g key={pw.worker.id}>
                        <rect
                          x={bx} y={by}
                          width={barW} height={barH}
                          fill={pw.worker.color}
                          rx={2}
                          opacity={0.85}
                        />
                        {pw.done > 0 && barH > 14 && (
                          <text
                            x={bx + barW / 2} y={by + barH - 4}
                            textAnchor="middle"
                            fontSize={8}
                            fill="#fff"
                            fontWeight="600"
                          >
                            {pw.done}
                          </text>
                        )}
                      </g>
                    )
                  })}
                  {/* Total sobre las barras */}
                  {m.total > 0 && (
                    <text
                      x={x0 + barAreaW / 2} y={svgPadTop + chartH - (m.total / maxMonthDone) * chartH - 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill="currentColor"
                      opacity={0.6}
                      fontWeight="600"
                    >
                      {m.total}
                    </text>
                  )}
                  {/* Label del mes */}
                  <text
                    x={x0 + barAreaW / 2}
                    y={svgH - 6}
                    textAnchor="middle"
                    fontSize={10}
                    fill="currentColor"
                    opacity={0.6}
                    fontWeight="500"
                  >
                    {m.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Leyenda de trabajadores */}
        <div className="flex gap-3 flex-wrap mt-2">
          {matrix.map(({ worker }) => (
            <div key={worker.id} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: worker.color }} />
              <span className="text-[11px] text-gray-500 dark:text-slate-400">
                {worker.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Carga total por persona (barras horizontales) ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Carga de trabajo — últimos {months} meses
        </p>
        <div className="space-y-2">
          {matrix
            .sort((a, b) => b.totalAll - a.totalAll)
            .map(({ worker, totalAll, totalDone }) => {
              const pctDone = totalAll > 0 ? (totalDone / totalAll) * 100 : 0
              const pctActive = 100 - pctDone
              return (
                <div key={worker.id} className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: worker.color }}
                  >
                    {worker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  {/* Nombre */}
                  <span className="w-20 text-xs font-medium text-gray-700 dark:text-slate-300 truncate shrink-0">
                    {worker.name.split(' ')[0]}
                  </span>
                  {/* Barra */}
                  <div className="flex-1 h-5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                      className="h-full rounded-l-full transition-all"
                      style={{
                        width: `${pctDone}%`,
                        backgroundColor: worker.color,
                        opacity: 1,
                      }}
                      title={`${totalDone} completadas`}
                    />
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pctActive}%`,
                        backgroundColor: worker.color,
                        opacity: 0.25,
                      }}
                      title={`${totalAll - totalDone} en curso / pendientes`}
                    />
                  </div>
                  {/* Números */}
                  <div className="text-right shrink-0 w-16">
                    <span className="text-xs font-bold" style={{ color: worker.color }}>
                      {totalDone}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">
                      /{totalAll}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-blue-500" />
            <span className="text-[11px] text-gray-500 dark:text-slate-400">Completadas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-blue-200 dark:bg-blue-900" />
            <span className="text-[11px] text-gray-500 dark:text-slate-400">Activas / Pendientes</span>
          </div>
        </div>
      </div>

      {/* ── 3. Tabla resumen por mes ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Detalle — completadas por persona y mes
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-slate-300 w-28">Persona</th>
                {monthList.map(m => (
                  <th key={m.key} className="text-center py-2 px-2 font-semibold text-gray-600 dark:text-slate-300 capitalize">
                    {m.label}
                  </th>
                ))}
                <th className="text-center py-2 px-2 font-semibold text-gray-600 dark:text-slate-300">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {matrix.map(({ worker, months: workerMonths, totalDone }) => (
                <tr key={worker.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: worker.color }}
                      />
                      <span className="font-medium text-gray-700 dark:text-slate-300 truncate">
                        {worker.name.split(' ')[0]}
                      </span>
                    </div>
                  </td>
                  {workerMonths.map(m => (
                    <td key={m.key} className="text-center py-2 px-2">
                      {m.done > 0 ? (
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold text-white',
                          )}
                          style={{ backgroundColor: worker.color, opacity: 0.7 + (m.done / maxMonthTotal) * 0.3 }}
                        >
                          {m.done}
                        </span>
                      ) : (
                        <span className="text-gray-200 dark:text-slate-700">—</span>
                      )}
                    </td>
                  ))}
                  <td className="text-center py-2 px-2">
                    <span className="font-bold text-gray-800 dark:text-slate-100">{totalDone}</span>
                  </td>
                </tr>
              ))}
              {/* Fila de totales */}
              <tr className="bg-gray-50 dark:bg-slate-800/60 font-semibold">
                <td className="py-2 px-3 text-gray-600 dark:text-slate-300">Total</td>
                {monthList.map(m => {
                  const t = matrix.reduce((s, r) => s + (r.months.find(wm => wm.key === m.key)?.done ?? 0), 0)
                  return (
                    <td key={m.key} className="text-center py-2 px-2 text-gray-700 dark:text-slate-200">
                      {t || '—'}
                    </td>
                  )
                })}
                <td className="text-center py-2 px-2 text-gray-800 dark:text-slate-100">
                  {matrix.reduce((s, r) => s + r.totalDone, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
