import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { getEdgeAssets } from '@/lib/supabase'
import type { EdgeAsset } from '@/types'
import { ASSET_TYPE_META } from '@/lib/edgeAssets'
import { cn } from '@/lib/utils'

// Selector con búsqueda para vincular un marcador del modelo 3D a un activo
// de Activos Edge (racks, cuadros eléctricos, UPS, HVAC...). Mismo patrón
// que CriticalAssetPicker.tsx.

export default function EdgeAssetPicker({ value, onChange }: {
  value?: number
  onChange: (id: number | undefined) => void
}) {
  const [assets, setAssets] = useState<EdgeAsset[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getEdgeAssets().then(setAssets).catch(() => {})
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = assets.find(a => a.id === value)
  const filtered = query.trim()
    ? assets.filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        (a.location ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50)
    : assets.slice(0, 50)

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:text-white"
          placeholder="Buscar activo edge por nombre o ubicación..."
          value={open ? query : (selected ? selected.name : '')}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={e => setQuery(e.target.value)}
        />
        {selected && !open && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
            title="Quitar vínculo"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg">
          {value && (
            <button
              type="button"
              onClick={() => { onChange(undefined); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700"
            >
              Quitar vínculo
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500">Sin resultados.</p>
          ) : (
            filtered.map(a => {
              const meta = ASSET_TYPE_META[a.asset_type]
              const Icon = meta.icon
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => { onChange(a.id); setOpen(false); setQuery('') }}
                  className={cn(
                    'w-full flex items-center gap-2 text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700',
                    a.id === value && 'bg-blue-50 dark:bg-blue-900/30'
                  )}
                >
                  <Icon size={12} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700 dark:text-slate-300 truncate">{a.name}</span>
                  <span className="text-gray-400 dark:text-slate-500 shrink-0">· {meta.label}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
