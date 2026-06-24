import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Carga datos de `fetchFn` y se suscribe a cambios en `table` via Supabase Realtime.
 * Cualquier INSERT/UPDATE/DELETE en la tabla dispara un refetch automático.
 * Devuelve `setData` para que los optimistic updates de cada página sigan funcionando.
 */
export function useRealtimeTable<T>(
  table: string,
  fetchFn: () => Promise<T[]>
): { data: T[]; setData: Dispatch<SetStateAction<T[]>>; loading: boolean } {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fetchFn)
  fnRef.current = fetchFn

  useEffect(() => {
    let active = true

    fnRef.current()
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })

    const channel = supabase
      .channel(`rt-${table}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table }, () => {
        if (!active) return
        fnRef.current().then(d => { if (active) setData(d) }).catch(() => {})
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [table]) // fnRef siempre actualizado, table nunca cambia — sin ciclos

  return { data, setData, loading }
}
