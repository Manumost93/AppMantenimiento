import { useState, useEffect } from 'react'
import { ClipboardCheck, Plus, Trash2, FileDown, Sun, Moon, Zap, Droplets, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { getRondas, upsertRonda, deleteRonda, getWorkers } from '@/lib/supabase'
import type { RondaEntry, TeamMember, TipoRonda } from '@/types'
import { cn, todayIso, getInitials } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── SQL para crear la tabla en Supabase ──────────────────────────────────────
// CREATE TABLE IF NOT EXISTS rondas (
//   id BIGSERIAL PRIMARY KEY,
//   fecha DATE NOT NULL,
//   hora TIME NOT NULL,
//   tipo TEXT NOT NULL CHECK (tipo IN ('apertura', 'cierre')),
//   worker_id BIGINT REFERENCES workers(id),
//   lectura_luz NUMERIC(12,2),
//   lectura_agua NUMERIC(12,2),
//   arranques_jockey INTEGER DEFAULT 0,
//   arranques_compresor INTEGER DEFAULT 0,
//   temperatura NUMERIC(5,1),
//   observaciones TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );

function getCurrentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function formatHora(h: string) {
  return h ? h.substring(0, 5) : '—'
}

const TIPO_CONFIG = {
  apertura: { label: 'Apertura', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
  cierre:   { label: 'Cierre',   icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800' },
}

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-md border border-gray-200 dark:border-slate-600 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold text-lg leading-none"
        >−</button>
        <input
          type="number"
          min="0"
          className="w-16 text-center text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
          value={value}
          onChange={e => onChange(Math.max(0, Number(e.target.value)))}
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-md border border-gray-200 dark:border-slate-600 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold text-lg leading-none"
        >+</button>
      </div>
    </div>
  )
}

export default function RondasPage() {
  const { worker } = useAuth()
  const [rondas, setRondas] = useState<RondaEntry[]>([])
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedFecha, setSelectedFecha] = useState(todayIso())
  const [dbError, setDbError] = useState(false)

  const [form, setForm] = useState<Partial<RondaEntry>>({
    fecha: todayIso(),
    hora: getCurrentTime(),
    tipo: 'apertura',
    worker_id: worker?.id,
    lectura_luz: undefined,
    lectura_agua: undefined,
    arranques_jockey: 0,
    arranques_compresor: 0,
    temperatura: undefined,
    observaciones: '',
  })

  useEffect(() => {
    Promise.all([getRondas(), getWorkers()])
      .then(([r, w]) => { setRondas(r); setWorkers(w) })
      .catch(() => setDbError(true))
      .finally(() => setLoading(false))
  }, [])

  async function reloadForDate(fecha: string) {
    setSelectedFecha(fecha)
    getRondas(fecha).then(setRondas).catch(() => setDbError(true))
  }

  function openCreate(tipo: TipoRonda) {
    setForm({
      fecha: selectedFecha,
      hora: getCurrentTime(),
      tipo,
      worker_id: worker?.id,
      lectura_luz: undefined,
      lectura_agua: undefined,
      arranques_jockey: 0,
      arranques_compresor: 0,
      temperatura: undefined,
      observaciones: '',
    })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.fecha || !form.hora || !form.tipo) return
    setSaving(true)
    try {
      const saved = await upsertRonda(form)
      const withWorker = { ...saved, worker: workers.find(w => w.id === saved.worker_id) }
      setRondas(prev => [withWorker, ...prev.filter(r => r.id !== saved.id)])
      setShowDialog(false)
    } catch {
      alert('Error al guardar. Asegúrate de haber creado la tabla "rondas" en Supabase (ver comentario en supabase.ts).')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta ronda?')) return
    try {
      await deleteRonda(id)
      setRondas(prev => prev.filter(r => r.id !== id))
    } catch {
      alert('No se pudo eliminar.')
    }
  }

  function exportPdf() {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text('Rondas de Apertura y Cierre', 14, 18)
    doc.setFontSize(10)
    doc.text(`Fecha: ${selectedFecha}`, 14, 26)
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 32)

    const rows = rondas.map(r => [
      r.fecha,
      formatHora(r.hora),
      TIPO_CONFIG[r.tipo].label,
      r.worker?.name || '—',
      r.lectura_luz != null ? `${r.lectura_luz} kWh` : '—',
      r.lectura_agua != null ? `${r.lectura_agua} m³` : '—',
      String(r.arranques_jockey ?? 0),
      String(r.arranques_compresor ?? 0),
      r.temperatura != null ? `${r.temperatura} °C` : '—',
      r.observaciones || '—',
    ])

    autoTable(doc, {
      startY: 38,
      head: [['Fecha', 'Hora', 'Tipo', 'Responsable', 'Luz', 'Agua', 'Jockey', 'Compresor', 'Temp.', 'Obs.']],
      body: rows,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 64, 175] },
    })

    doc.save(`rondas-${selectedFecha}.pdf`)
  }

  const rondasFecha = rondas.filter(r => r.fecha === selectedFecha)
  const apertura = rondasFecha.filter(r => r.tipo === 'apertura')
  const cierre   = rondasFecha.filter(r => r.tipo === 'cierre')

  return (
    <div className="p-5 space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} className="text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Rondas de apertura y cierre</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Lecturas diarias de contadores e instalaciones</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={rondas.length === 0}>
            <FileDown size={13} /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* Aviso si la tabla no existe */}
      {dbError && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 dark:text-amber-300">
            <p className="font-semibold mb-1">La tabla "rondas" aún no existe en Supabase.</p>
            <p className="text-xs">Ejecuta el SQL que aparece como comentario en <code>src/lib/supabase.ts</code> en el editor SQL de tu proyecto Supabase para crearla.</p>
          </div>
        </div>
      )}

      {/* Selector de fecha + botones */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Fecha de la ronda</label>
          <input
            type="date"
            className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={selectedFecha}
            onChange={e => reloadForDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={() => openCreate('apertura')} className="bg-amber-500 hover:bg-amber-600">
            <Sun size={13} /> Registrar apertura
          </Button>
          <Button size="sm" onClick={() => openCreate('cierre')} className="bg-indigo-600 hover:bg-indigo-700">
            <Moon size={13} /> Registrar cierre
          </Button>
        </div>
      </div>

      {/* Cards resumen del día */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">Cargando rondas...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['apertura', 'cierre'] as TipoRonda[]).map(tipo => {
            const cfg = TIPO_CONFIG[tipo]
            const Icon = cfg.icon
            const list = tipo === 'apertura' ? apertura : cierre
            const last = list[0]

            return (
              <Card key={tipo} className={cn('border-2', cfg.border)}>
                <CardContent className="pt-4">
                  <div className={cn('flex items-center gap-2 mb-4 pb-3 border-b', tipo === 'apertura' ? 'border-amber-100 dark:border-amber-900/30' : 'border-indigo-100 dark:border-indigo-900/30')}>
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', cfg.bg)}>
                      <Icon size={18} className={cfg.color} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 dark:text-white">Ronda de {cfg.label}</h3>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{list.length} registro{list.length !== 1 ? 's' : ''} hoy</p>
                    </div>
                    <button
                      onClick={() => openCreate(tipo)}
                      className={cn('ml-auto flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                        tipo === 'apertura'
                          ? 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                          : 'text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                      )}
                    >
                      <Plus size={11} /> Añadir
                    </button>
                  </div>

                  {!last ? (
                    <div className="text-center py-6 text-gray-300 dark:text-slate-600">
                      <p className="text-sm">Sin registro para hoy</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Último registro */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {last.worker && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                              style={{ backgroundColor: last.worker.color }}>
                              {getInitials(last.worker.name)}
                            </div>
                          )}
                          <span className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                            {last.worker?.name || 'Sin asignar'} — {formatHora(last.hora)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {last.lectura_luz != null && (
                          <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">
                            <Zap size={13} className="text-yellow-500 shrink-0" />
                            <div>
                              <p className="text-[10px] text-gray-500 dark:text-slate-400">Luz</p>
                              <p className="text-sm font-bold text-gray-800 dark:text-white">{last.lectura_luz} kWh</p>
                            </div>
                          </div>
                        )}
                        {last.lectura_agua != null && (
                          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                            <Droplets size={13} className="text-blue-500 shrink-0" />
                            <div>
                              <p className="text-[10px] text-gray-500 dark:text-slate-400">Agua</p>
                              <p className="text-sm font-bold text-gray-800 dark:text-white">{last.lectura_agua} m³</p>
                            </div>
                          </div>
                        )}
                        {last.arranques_jockey != null && (
                          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-500 dark:text-slate-400">Arranques jockey</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-white">{last.arranques_jockey}</p>
                          </div>
                        )}
                        {last.arranques_compresor != null && (
                          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-500 dark:text-slate-400">Arranques compresor</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-white">{last.arranques_compresor}</p>
                          </div>
                        )}
                        {last.temperatura != null && (
                          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-500 dark:text-slate-400">Temperatura</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-white">{last.temperatura} °C</p>
                          </div>
                        )}
                      </div>

                      {last.observaciones && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2 mt-2">
                          {last.observaciones}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Historial del día */}
                  {list.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 space-y-1">
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Registros anteriores de hoy</p>
                      {list.slice(1).map(r => (
                        <div key={r.id} className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                          <span>{formatHora(r.hora)} — {r.worker?.name || '—'}</span>
                          <button onClick={() => handleDelete(r.id)} className="text-gray-300 dark:text-slate-600 hover:text-red-500 ml-2">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Historial completo */}
      {rondas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Historial de rondas</h3>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                <tr>
                  {['Fecha', 'Hora', 'Tipo', 'Responsable', 'Luz (kWh)', 'Agua (m³)', 'Jockey', 'Compresor', 'Temp.', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {rondas.map(r => {
                  const cfg = TIPO_CONFIG[r.tipo]
                  const Icon = cfg.icon
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">{r.fecha}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">{formatHora(r.hora)}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn('flex items-center gap-1 text-xs font-medium', cfg.color)}>
                          <Icon size={11} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.worker ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                              style={{ backgroundColor: r.worker.color }}>
                              {r.worker.name[0]}
                            </div>
                            <span className="text-xs text-gray-700 dark:text-slate-300">{r.worker.name.split(' ')[0]}</span>
                          </div>
                        ) : <span className="text-xs text-gray-400 dark:text-slate-500">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-slate-200 font-mono">{r.lectura_luz ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-slate-200 font-mono">{r.lectura_agua ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-slate-200 font-mono">{r.arranques_jockey ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-slate-200 font-mono">{r.arranques_compresor ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-slate-200 font-mono">{r.temperatura != null ? `${r.temperatura}°` : '—'}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => handleDelete(r.id)} className="p-1 text-gray-300 dark:text-slate-600 hover:text-red-500 rounded">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog nuevo registro */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={`Nueva ronda de ${form.tipo ? TIPO_CONFIG[form.tipo].label : ''}`} size="md">
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha</label>
              <input type="date" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                value={form.fecha || todayIso()}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Hora</label>
              <input type="time" className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                value={form.hora || ''}
                onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo de ronda</label>
              <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                value={form.tipo || 'apertura'}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoRonda }))}>
                <option value="apertura">Apertura</option>
                <option value="cierre">Cierre</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Responsable</label>
              <select className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
                value={form.worker_id || ''}
                onChange={e => setForm(f => ({ ...f, worker_id: e.target.value ? Number(e.target.value) : undefined }))}>
                <option value="">Sin asignar</option>
                {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          {/* Lecturas de contadores */}
          <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Lecturas de contadores</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Zap size={11} className="text-yellow-500" /> Lectura luz (kWh)
                </label>
                <input type="number" step="0.01" min="0" placeholder="—"
                  className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-600 dark:text-white"
                  value={form.lectura_luz ?? ''}
                  onChange={e => setForm(f => ({ ...f, lectura_luz: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Droplets size={11} className="text-blue-500" /> Lectura agua (m³)
                </label>
                <input type="number" step="0.01" min="0" placeholder="—"
                  className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-600 dark:text-white"
                  value={form.lectura_agua ?? ''}
                  onChange={e => setForm(f => ({ ...f, lectura_agua: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Counter
                label="Arranques bomba jockey"
                value={form.arranques_jockey ?? 0}
                onChange={v => setForm(f => ({ ...f, arranques_jockey: v }))}
              />
              <Counter
                label="Arranques compresor"
                value={form.arranques_compresor ?? 0}
                onChange={v => setForm(f => ({ ...f, arranques_compresor: v }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Temperatura (°C)</label>
              <input type="number" step="0.1" placeholder="—"
                className="w-40 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-600 dark:text-white"
                value={form.temperatura ?? ''}
                onChange={e => setForm(f => ({ ...f, temperatura: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Observaciones</label>
            <textarea
              rows={3}
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none dark:bg-slate-700 dark:text-white"
              placeholder="Incidencias, anomalías, notas..."
              value={form.observaciones || ''}
              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-slate-700">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar ronda'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
