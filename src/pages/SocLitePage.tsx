import { useState } from 'react'
import {
  ShieldAlert, Link2, Mail, FileWarning, AlertTriangle, FolderSearch,
  Plus, Inbox, Flame, CheckCircle2, ArrowLeft,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { getSocCases } from '@/lib/supabase'
import UrlAnalyzer from '@/components/UrlAnalyzer'
import EmailAnalyzer from '@/components/EmailAnalyzer'
import FileTriageAnalyzer from '@/components/FileTriageAnalyzer'
import SecurityEventForm from '@/components/SecurityEventForm'
import { SEVERITY_META, STATUS_META, type SocCaseType } from '@/lib/soc'
import { PageLoading } from '@/components/Skeleton'

type AnalysisView = 'picker' | SocCaseType

const ANALYZER_TITLES: Record<SocCaseType, string> = {
  url: 'Analizar URL',
  email: 'Analizar correo',
  file: 'Revisar archivo',
  event: 'Registrar evento de seguridad',
}

const TYPE_META: Record<SocCaseType, { label: string; icon: typeof Link2 }> = {
  url: { label: 'Enlace', icon: Link2 },
  email: { label: 'Correo', icon: Mail },
  file: { label: 'Archivo', icon: FileWarning },
  event: { label: 'Evento', icon: ShieldAlert },
}

const TABS: { key: 'all' | SocCaseType; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'url', label: 'URLs' },
  { key: 'email', label: 'Correos' },
  { key: 'file', label: 'Archivos' },
  { key: 'event', label: 'Eventos' },
]

const NEW_ANALYSIS_OPTIONS: { type: SocCaseType; label: string; description: string; icon: typeof Link2 }[] = [
  { type: 'url', label: 'Analizar URL', description: 'Revisión estática de un enlace sospechoso', icon: Link2 },
  { type: 'email', label: 'Analizar correo', description: 'Revisión de remitente, asunto y contenido', icon: Mail },
  { type: 'file', label: 'Revisar archivo', description: 'Triage de metadatos de un archivo o documento', icon: FileWarning },
  { type: 'event', label: 'Registrar evento de seguridad', description: 'Incidente físico o lógico de mantenimiento/IT', icon: ShieldAlert },
]

export default function SocLitePage() {
  const toast = useToast()
  const { data: cases, loading } = useRealtimeTable('soc_cases', getSocCases)
  const [activeTab, setActiveTab] = useState<'all' | SocCaseType>('all')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [analysisView, setAnalysisView] = useState<AnalysisView>('picker')

  const filtered = activeTab === 'all' ? cases : cases.filter(c => c.case_type === activeTab)

  const kpis = [
    { label: 'Casos abiertos', value: cases.filter(c => c.status === 'open').length, icon: <Inbox size={18} />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' },
    { label: 'Casos críticos', value: cases.filter(c => c.severity === 'critical').length, icon: <Flame size={18} />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800' },
    { label: 'Enlaces analizados', value: cases.filter(c => c.case_type === 'url').length, icon: <Link2 size={18} />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800' },
    { label: 'Correos revisados', value: cases.filter(c => c.case_type === 'email').length, icon: <Mail size={18} />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800' },
    { label: 'Archivos revisados', value: cases.filter(c => c.case_type === 'file').length, icon: <FolderSearch size={18} />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30', border: 'border-teal-200 dark:border-teal-800' },
    { label: 'Eventos de seguridad', value: cases.filter(c => c.case_type === 'event').length, icon: <AlertTriangle size={18} />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800' },
  ]

  function handlePickAnalysis(type: SocCaseType) {
    setAnalysisView(type)
  }

  function closeNewDialog() {
    setShowNewDialog(false)
    setAnalysisView('picker')
  }

  function handleCaseSaved() {
    closeNewDialog()
    toast.success('Caso guardado en SOC Lite.')
  }

  if (loading) return <PageLoading kpis={6} rows={5} />

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert size={18} className="text-blue-600 dark:text-blue-400" />
            SOC Lite
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Análisis defensivo de enlaces, correos, archivos y eventos de seguridad
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNewDialog(true)}>
          <Plus size={14} />
          Nuevo análisis
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <Card key={kpi.label} className={cn('border', kpi.border)}>
            <CardContent className="pt-4 pb-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', kpi.bg, kpi.color)}>
                {kpi.icon}
              </div>
              <div className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map(tab => {
          const count = tab.key === 'all' ? cases.length : cases.filter(c => c.case_type === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                activeTab === tab.key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
              )}
            >
              {tab.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Listado de casos */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Caso</th>
                <th className="px-4 py-2.5 font-semibold">Tipo</th>
                <th className="px-4 py-2.5 font-semibold">Severidad</th>
                <th className="px-4 py-2.5 font-semibold">Estado</th>
                <th className="px-4 py-2.5 font-semibold">Fecha</th>
                <th className="px-4 py-2.5 font-semibold">Responsable</th>
                <th className="px-4 py-2.5 font-semibold">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const TypeIcon = TYPE_META[c.case_type].icon
                return (
                  <tr key={c.id} className="border-t border-gray-100 dark:border-slate-700">
                    <td className="px-4 py-3 text-gray-800 dark:text-white font-medium max-w-xs">{c.title}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                        <TypeIcon size={13} />
                        {TYPE_META[c.case_type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={SEVERITY_META[c.severity].className}>{SEVERITY_META[c.severity].label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_META[c.status].className}>{STATUS_META[c.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap">{c.assigned_to?.name ?? 'Sin asignar'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 max-w-xs">{c.description}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 dark:text-slate-500">
                    <CheckCircle2 size={22} className="mx-auto mb-2 opacity-40" />
                    {cases.length === 0 ? 'Todavía no hay casos registrados' : 'Sin casos en esta categoría'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: elegir tipo de análisis, o analizador seleccionado */}
      <Dialog
        open={showNewDialog}
        onClose={closeNewDialog}
        title={analysisView === 'picker' ? 'Nuevo análisis' : ANALYZER_TITLES[analysisView]}
        size={analysisView === 'picker' ? 'md' : 'lg'}
      >
        {analysisView === 'picker' ? (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NEW_ANALYSIS_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.type}
                  onClick={() => handlePickAnalysis(opt.type)}
                  className="flex flex-col items-start gap-2 p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{opt.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setAnalysisView('picker')}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-5 pt-4"
            >
              <ArrowLeft size={13} />
              Volver
            </button>
            {analysisView === 'url' && <UrlAnalyzer onCaseSaved={handleCaseSaved} />}
            {analysisView === 'email' && <EmailAnalyzer onCaseSaved={handleCaseSaved} />}
            {analysisView === 'file' && <FileTriageAnalyzer onCaseSaved={handleCaseSaved} />}
            {analysisView === 'event' && <SecurityEventForm onCaseSaved={handleCaseSaved} />}
          </div>
        )}
      </Dialog>
    </div>
  )
}
