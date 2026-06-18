import { useState, useEffect } from 'react'
import { Plus, Edit2, Phone, Mail, Search, Trash2, Building2, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { getProviders, upsertProvider, deleteProvider } from '@/lib/supabase'
import type { Provider } from '@/types'
import { cn } from '@/lib/utils'

type ProviderTab = 'all' | 'providers' | 'contacts'
type FormType = 'proveedor' | 'contacto'

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<ProviderTab>('all')
  const [showDialog, setShowDialog] = useState(false)
  const [selected, setSelected] = useState<Provider | null>(null)
  const [form, setForm] = useState<Partial<Provider>>({})
  const [formType, setFormType] = useState<FormType>('proveedor')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProviders().then(setProviders).finally(() => setLoading(false))
  }, [])

  const companyProviders = providers.filter(p => p.area !== 'Contacto')
  const contacts = providers.filter(p => p.area === 'Contacto')

  const filtered = (() => {
    const base =
      tab === 'providers' ? companyProviders :
      tab === 'contacts' ? contacts :
      providers
    return base.filter(p =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      p.area?.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.includes(search) ||
      p.observations?.toLowerCase().includes(search.toLowerCase())
    )
  })()

  function openCreate() {
    setSelected(null)
    const isContactTab = tab === 'contacts'
    setFormType(isContactTab ? 'contacto' : 'proveedor')
    setForm({ active: true, area: isContactTab ? 'Contacto' : '' })
    setShowDialog(true)
  }

  function openEdit(p: Provider) {
    setSelected(p)
    setFormType(p.area === 'Contacto' ? 'contacto' : 'proveedor')
    setForm({ ...p })
    setShowDialog(true)
  }

  function handleTypeChange(t: FormType) {
    setFormType(t)
    setForm(f => ({ ...f, area: t === 'contacto' ? 'Contacto' : '' }))
  }

  async function handleSave() {
    if (!form.name?.trim()) return
    const payload = { ...form, area: formType === 'contacto' ? 'Contacto' : form.area }
    setSaving(true)
    try {
      const saved = await upsertProvider(selected ? { ...payload, id: selected.id } : payload)
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

  if (loading) return <div className="p-5 text-center text-gray-400">Cargando proveedores y contactos...</div>

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Proveedores/Contactos</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {companyProviders.filter(p => p.active).length} proveedores activos · {contacts.length} contactos
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          {tab === 'contacts' ? 'Nuevo contacto' : 'Nuevo proveedor'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700">
        {([
          { key: 'all' as ProviderTab, label: 'Todos', count: providers.length },
          { key: 'providers' as ProviderTab, label: 'Proveedores', count: companyProviders.length },
          { key: 'contacts' as ProviderTab, label: 'Contactos', count: contacts.length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch('') }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {t.label}
            <span className={cn(
              'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
              tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder={tab === 'contacts' ? 'Buscar por nombre o teléfono...' : 'Buscar proveedor, área o contacto...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>{search ? 'Sin resultados.' : tab === 'contacts' ? 'No hay contactos aún.' : 'No hay proveedores aún.'}</p>
          {!search && <Button size="sm" className="mt-3" onClick={openCreate}>Añadir el primero</Button>}
        </div>
      )}

      {/* Contacts — phone book style */}
      {tab === 'contacts' && filtered.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {filtered.map(contact => (
            <div key={contact.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">
                  {contact.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{contact.name}</p>
                {contact.observations && (
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{contact.observations}</p>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-1 mt-0.5 group">
                    <Phone size={11} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{contact.phone}</span>
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => openEdit(contact)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => handleDelete(contact)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Providers/All — mixed card style */}
      {tab !== 'contacts' && filtered.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(provider =>
            provider.area === 'Contacto' ? (
              <div key={provider.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">
                    {provider.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{provider.name}</p>
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">Contacto</Badge>
                  </div>
                  {provider.observations && (
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{provider.observations}</p>
                  )}
                  {provider.phone && (
                    <a href={`tel:${provider.phone}`} className="flex items-center gap-1 mt-0.5">
                      <Phone size={11} className="text-gray-400" />
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{provider.phone}</span>
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openEdit(provider)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(provider)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <Card key={provider.id} className={cn(!provider.active && 'opacity-60')}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{provider.name}</h3>
                        <Badge className={provider.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>
                          {provider.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      {provider.area && provider.area !== 'Contacto' && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-medium">{provider.area}</p>
                      )}
                      {provider.contact_person && (
                        <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">👤 {provider.contact_person}</p>
                      )}
                      {provider.phone && (
                        <a href={`tel:${provider.phone}`} className="flex items-center gap-1 mt-1 hover:text-blue-600">
                          <Phone size={11} className="text-gray-400" />
                          <span className="text-xs text-gray-600 dark:text-slate-400">{provider.phone}</span>
                        </a>
                      )}
                      {provider.email && (
                        <a href={`mailto:${provider.email}`} className="flex items-center gap-1 mt-0.5 hover:text-blue-600">
                          <Mail size={11} className="text-gray-400" />
                          <span className="text-xs text-gray-600 dark:text-slate-400 truncate">{provider.email}</span>
                        </a>
                      )}
                      {provider.observations && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 border-t border-gray-100 dark:border-slate-700 pt-2 line-clamp-2">
                          {provider.observations}
                        </p>
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
            )
          )}
        </div>
      )}

      {/* Dialog */}
      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={selected ? 'Editar' : formType === 'contacto' ? 'Nuevo contacto' : 'Nuevo proveedor'}
        size="sm"
      >
        <div className="p-5 space-y-3">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5">Categoría</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleTypeChange('proveedor')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors',
                  formType === 'proveedor'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                )}
              >
                <Building2 size={13} /> Proveedor
              </button>
              <button
                onClick={() => handleTypeChange('contacto')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors',
                  formType === 'contacto'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                )}
              >
                <Users size={13} /> Contacto
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              {formType === 'contacto' ? 'Nombre *' : 'Nombre empresa *'}
            </label>
            <input
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              placeholder={formType === 'contacto' ? 'Nombre del contacto' : 'Ej: KONE, ION...'}
              value={form.name || ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Teléfono</label>
            <input
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              placeholder="900 123 456"
              inputMode="tel"
              value={form.phone || ''}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>

          {formType === 'proveedor' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Persona de contacto</label>
                <input
                  className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                  placeholder="Nombre del contacto"
                  value={form.contact_person || ''}
                  onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                  placeholder="contacto@empresa.com"
                  value={form.email || ''}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Área relacionada</label>
                <input
                  className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
                  placeholder="Ej: Ascensores, Electricidad..."
                  value={form.area || ''}
                  onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pactive"
                  checked={form.active !== false}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="pactive" className="text-sm text-gray-700 dark:text-slate-300">Proveedor activo</label>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              {formType === 'contacto' ? 'Descripción / Rol' : 'Observaciones'}
            </label>
            <input
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-slate-200"
              placeholder={formType === 'contacto' ? 'Ej: Carnicería, Pescados, Panadería...' : 'Notas adicionales...'}
              value={form.observations || ''}
              onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name?.trim()}>
              {saving ? 'Guardando...' : selected ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
