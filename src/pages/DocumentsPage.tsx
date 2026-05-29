import { useState } from 'react'
import { FolderOpen, Plus, ExternalLink, FileText, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

interface DocLink {
  id: number
  name: string
  url: string
  area: string
  description?: string
}

const AREAS = ['General', 'KONE', 'FOOD', 'COMIN/ION', 'Electricidad', 'Fontanería', 'Climatización', 'Exterior']

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocLink[]>([
    { id: 1, name: 'Manual de procedimientos KONE', url: 'https://sharepoint.com/...', area: 'KONE', description: 'Manual actualizado 2024' },
    { id: 2, name: 'Normativa contra incendios', url: 'https://sharepoint.com/...', area: 'General', description: 'PCI - Revisión 2024' },
  ])
  const [search, setSearch] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [form, setForm] = useState<Partial<DocLink>>({ area: 'General' })

  const filtered = docs.filter(d =>
    (!search || d.name.toLowerCase().includes(search.toLowerCase())) &&
    (!filterArea || d.area === filterArea)
  )

  function handleSave() {
    if (!form.name?.trim() || !form.url?.trim()) return
    setDocs(prev => [...prev, { id: Date.now(), name: form.name!, url: form.url!, area: form.area || 'General', description: form.description }])
    setShowDialog(false)
    setForm({ area: 'General' })
  }

  function handleDelete(id: number) {
    if (confirm('¿Eliminar este enlace?')) setDocs(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen size={20} className="text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-gray-900">Documentos y enlaces</h2>
            <p className="text-xs text-gray-500">Accesos directos a documentos en SharePoint, OneDrive, etc.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setForm({ area: 'General' }); setShowDialog(true) }}>
          <Plus size={14} />Añadir enlace
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        💡 Añade aquí los enlaces a tus documentos en SharePoint, OneDrive o cualquier web. Los compañeros podrán abrirlos directamente.
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <input className="w-full pl-4 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Buscar documento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="">Todas las áreas</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay documentos añadidos.</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(doc => (
            <Card key={doc.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <FileText size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{doc.name}</h3>
                    <span className="text-xs text-blue-600 font-medium">{doc.area}</span>
                    {doc.description && <p className="text-xs text-gray-400 mt-1">{doc.description}</p>}
                    <div className="flex gap-2 mt-2">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink size={11} />
                        Abrir
                      </a>
                      <button onClick={() => handleDelete(doc.id)} className="px-2.5 py-1 text-xs text-red-500 border border-red-200 rounded-md hover:bg-red-50">
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title="Añadir enlace a documento" size="sm">
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del documento *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ej: Manual KONE 2024"
              value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><Link size={11} />URL del documento *</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="https://sharepoint.com/..."
              value={form.url || ''} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Área</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.area || 'General'} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Descripción breve..."
              value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={!form.name?.trim() || !form.url?.trim()}>Añadir</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
