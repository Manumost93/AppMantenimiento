import { useState, useEffect, useRef } from 'react'
import {
  FolderOpen, Plus, ExternalLink, FileText, Link, Upload,
  Download, Trash2, Image, FileSpreadsheet, File, Search, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { getDocuments, uploadDocumentFile, addDocumentLink, deleteDocument } from '@/lib/supabase'
import type { Document } from '@/types'
import { cn } from '@/lib/utils'

const AREAS = ['General', 'KONE', 'FOOD', 'COMIN/IOM', 'Electricidad', 'Fontanería', 'Climatización', 'Exterior']

function FileIcon({ type, size = 20 }: { type: Document['type']; size?: number }) {
  if (type === 'image') return <Image size={size} className="text-green-500" />
  if (type === 'pdf') return <FileText size={size} className="text-red-500" />
  if (type === 'excel') return <FileSpreadsheet size={size} className="text-emerald-600" />
  if (type === 'word') return <FileText size={size} className="text-blue-500" />
  if (type === 'link') return <Link size={size} className="text-purple-500" />
  return <File size={size} className="text-gray-400" />
}

function FileBg({ type }: { type: Document['type'] }) {
  const bgMap: Record<Document['type'], string> = {
    image: 'bg-green-50 dark:bg-green-900/20',
    pdf: 'bg-red-50 dark:bg-red-900/20',
    excel: 'bg-emerald-50 dark:bg-emerald-900/20',
    word: 'bg-blue-50 dark:bg-blue-900/20',
    link: 'bg-purple-50 dark:bg-purple-900/20',
    file: 'bg-gray-50 dark:bg-slate-700',
  }
  return bgMap[type] || bgMap.file
}

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

type Tab = 'files' | 'links'

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('files')
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<'upload' | 'link'>('upload')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ name: '', url: '', area: 'General', observations: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getDocuments()
      .then(setDocs)
      .catch(() => setError('No se pudieron cargar los documentos.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = docs.filter(d =>
    (activeTab === 'links' ? d.type === 'link' : d.type !== 'link') &&
    (!search || d.name.toLowerCase().includes(search.toLowerCase()) || d.area?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterArea || d.area === filterArea)
  )

  function openUpload() {
    setDialogMode('upload')
    setForm({ name: '', url: '', area: 'General', observations: '' })
    setSelectedFile(null)
    setError('')
    setShowDialog(true)
  }

  function openLink() {
    setDialogMode('link')
    setForm({ name: '', url: '', area: 'General', observations: '' })
    setError('')
    setShowDialog(true)
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file)
    if (!form.name) setForm(f => ({ ...f, name: file.name.replace(/\.[^/.]+$/, '') }))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  async function handleUpload() {
    if (!selectedFile || !form.area) return
    setUploading(true)
    setError('')
    try {
      const doc = await uploadDocumentFile(selectedFile, {
        name: form.name || selectedFile.name,
        area: form.area,
        observations: form.observations || undefined,
      })
      setDocs(prev => [doc, ...prev])
      setShowDialog(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir el archivo.'
      if (msg.includes('bucket') || msg.includes('storage')) {
        setError('El bucket "documents" no está configurado en Supabase Storage. Créalo en: Storage → New Bucket → nombre: "documents" → Public.')
      } else {
        setError(msg)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleAddLink() {
    if (!form.name?.trim() || !form.url?.trim()) return
    setUploading(true)
    setError('')
    try {
      const doc = await addDocumentLink(form.url, {
        name: form.name,
        area: form.area,
        observations: form.observations || undefined,
      })
      setDocs(prev => [doc, ...prev])
      setShowDialog(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el enlace.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`¿Eliminar "${doc.name}"?`)) return
    try {
      await deleteDocument(doc.id, doc.path, doc.type)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
    } catch {
      alert('No se pudo eliminar.')
    }
  }

  function handleDownload(doc: Document) {
    const url = doc.file_url || doc.path
    const a = document.createElement('a')
    a.href = url
    a.download = doc.name
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  return (
    <div className="p-5 space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen size={20} className="text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Documentos y archivos</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">{docs.length} documentos guardados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openLink}>
            <Link size={13} /> Añadir enlace
          </Button>
          <Button size="sm" onClick={openUpload}>
            <Upload size={13} /> Subir archivo
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        {(['files', 'links'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-1.5 text-xs font-medium rounded-md transition-colors',
              activeTab === tab
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            )}
          >
            {tab === 'files' ? '📎 Archivos subidos' : '🔗 Enlaces externos'}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar documento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
          value={filterArea}
          onChange={e => setFilterArea(e.target.value)}
        >
          <option value="">Todas las áreas</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Mensaje de info para links */}
      {activeTab === 'links' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
          Añade aquí los enlaces a tus documentos en SharePoint, OneDrive o cualquier web. Los compañeros podrán abrirlos directamente.
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">Cargando documentos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
          <FolderOpen size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay documentos en esta sección.</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(doc => (
            <Card key={doc.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', FileBg({ type: doc.type }))}>
                    <FileIcon type={doc.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white truncate">{doc.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{doc.area}</span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">{doc.type}</span>
                    </div>
                    {doc.observations && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 truncate">{doc.observations}</p>
                    )}
                    <p className="text-[10px] text-gray-300 dark:text-slate-600 mt-1">
                      {new Date(doc.uploaded_at).toLocaleDateString('es-ES')}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {doc.type === 'link' ? (
                        <a
                          href={doc.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink size={11} /> Abrir
                        </a>
                      ) : (
                        <button
                          onClick={() => handleDownload(doc)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <Download size={11} /> Descargar
                        </button>
                      )}
                      {doc.type === 'image' && doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 text-xs text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20"
                        >
                          <Image size={11} /> Ver
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(doc)}
                        className="px-2.5 py-1 text-xs text-red-500 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog subir archivo */}
      <Dialog
        open={showDialog && dialogMode === 'upload'}
        onClose={() => setShowDialog(false)}
        title="Subir archivo"
        size="sm"
      >
        <div className="p-5 space-y-4">
          {/* Zona de drop */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              dragOver
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-slate-500'
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={28} className="mx-auto mb-2 text-gray-300 dark:text-slate-500" />
            {selectedFile ? (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200">{selectedFile.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{formatBytes(selectedFile.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra un archivo aquí o haz click</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">PDF, imágenes, Excel, Word...</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.xls,.xlsx,.doc,.docx,.txt,.zip"
              onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Nombre del documento</label>
            <input
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Ej: Manual mantenimiento 2025"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Área</label>
            <select
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.area}
              onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
            >
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Observaciones</label>
            <input
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Descripción breve..."
              value={form.observations}
              onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
            />
          </div>
          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={uploading}>Cancelar</Button>
            <Button className="flex-1" onClick={handleUpload} disabled={uploading || !selectedFile}>
              {uploading ? 'Subiendo...' : 'Subir archivo'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog añadir enlace */}
      <Dialog
        open={showDialog && dialogMode === 'link'}
        onClose={() => setShowDialog(false)}
        title="Añadir enlace externo"
        size="sm"
      >
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Nombre del documento *</label>
            <input
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Ej: Manual KONE 2024"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Link size={11} /> URL del documento *
            </label>
            <input
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="https://sharepoint.com/..."
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Área</label>
            <select
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              value={form.area}
              onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
            >
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción</label>
            <input
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
              placeholder="Descripción breve..."
              value={form.observations}
              onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={uploading}>Cancelar</Button>
            <Button className="flex-1" onClick={handleAddLink} disabled={uploading || !form.name?.trim() || !form.url?.trim()}>
              {uploading ? 'Guardando...' : 'Añadir enlace'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
