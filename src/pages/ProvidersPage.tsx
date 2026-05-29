import { useState, useEffect } from 'react'
import { Plus, Edit2, Phone, Mail, Search, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { getProviders, upsertProvider, deleteProvider } from '@/lib/supabase'
import type { Provider } from '@/types'
import { cn } from '@/lib/utils'

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<Provider | null>(null)
  const [form, setForm] = useState<Partial<Provider>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProviders().then(setProviders).finally(() => setLoading(false))
  }, [])

  const filtered = providers.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
    p.area?.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setSelected(null)
    setForm({ active: true })
    setShowDialog(true)
  }

  function openEdit(p: Provider) {
    setSelected(p)
    setForm({ ...p })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.name?.trim()) return
    setSaving(true)
    try {
      const saved = await upsertProvider(selected ? { ...form, id: selected.id } : form)
      setProviders(prev => selected
        ? prev.map(p => p.id === selected.id ? saved : p)
        : [...prev, saved]
      )
      setShowDialog(false)
    } catch {
      alert('Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Provider) {
    if (!confirm(`¿Eliminar ${p.name}?`)) return
    try {
      await deleteProvider(p.id)
      setProviders(prev => prev.filter(x => x.id !== p.id))
    } catch {
      alert('No se pudo eliminar.')
    }
  }

  if (loading) return <div className="p-5 text-center text-gray-400">Cargando proveedores...</div>

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">Proveedores y empresas externas</h2>
          <p className="text-xs text-gray-500">{providers.filter(p => p.active).length} activos</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Nuevo proveedor
        </Button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Buscar proveedor, contacto o área..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && !loading ? (
        <div className="text-center py-12 text-gray-400">
          <p>{search ? 'Sin resultados.' : 'No hay proveedores aún.'}</p>
          {!search && <Button size="sm" className="mt-3" onClick={openCreate}>Añadir el primero</Button>}
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(provider => (
            <Card key={provider.id} className={cn(!provider.active && 'opacity-60')}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900 text-sm">{provider.name}</h3>
                      <Badge className={provider.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>
                        {provider.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    {provider.area && <p className="text-xs text-blue-600 mt-0.5 font-medium">{provider.area}</p>}
                    {provider.contact_person && <p className="text-xs text-gray-600 mt-1">👤 {provider.contact_person}</p>}
                    {provider.phone && (
                      <a href={`tel:${provider.phone}`} className="flex items-center gap-1 mt-1 hover:text-blue-600">
                        <Phone size={11} className="text-gray-400" />
                        <span className="text-xs text-gray-600">{provider.phone}</span>
                      </a>
                    )}
                    {provider.email && (
                      <a href={`mailto:${provider.email}`} className="flex items-center gap-1 mt-0.5 hover:text-blue-600">
                        <Mail size={11} className="text-gray-400" />
                        <span className="text-xs text-gray-600 truncate">{provider.email}</span>
                      </a>
                    )}
                    {provider.observations && (
                      <p className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-2 line-clamp-2">{provider.observations}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button onClick={() => openEdit(provider)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(provider)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={selected ? 'Editar proveedor' : 'Nuevo proveedor'} size="sm">
        <div className="p-5 space-y-3">
          {[
            { label: 'Nombre empresa *', key: 'name', placeholder: 'Ej: KONE, ION...' },
            { label: 'Persona de contacto', key: 'contact_person', placeholder: 'Nombre del contacto' },
            { label: 'Teléfono', key: 'phone', placeholder: '900 123 456' },
            { label: 'Email', key: 'email', placeholder: 'contacto@empresa.com' },
            { label: 'Área relacionada', key: 'area', placeholder: 'Ej: Ascensores, Electricidad...' },
            { label: 'Observaciones', key: 'observations', placeholder: 'Notas adicionales...' },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder={field.placeholder}
                value={(form as Record<string, string>)[field.key] || ''}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="pactive" checked={form.active !== false}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
            <label htmlFor="pactive" className="text-sm text-gray-700">Proveedor activo</label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name?.trim()}>
              {saving ? 'Guardando...' : selected ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
