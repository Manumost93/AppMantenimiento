import { openDB, type IDBPDatabase } from 'idb'
import { supabase } from './supabase'

const DB_NAME = 'ikea-mant-v1'
const DB_VERSION = 1

interface SyncQueueItem {
  id?: number
  table: string
  action: 'upsert' | 'delete'
  payload: unknown
  queued_at: number
}

let _db: IDBPDatabase | null = null

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const stores = ['tasks', 'workers', 'providers', 'areas', 'personal_notes', 'material_requests']
      for (const name of stores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
      }
    },
  })
  return _db
}

export async function cacheAll(store: string, items: unknown[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(store, 'readwrite')
  await tx.store.clear()
  for (const item of items) {
    await tx.store.put(item)
  }
  await tx.done
}

export async function getCached<T>(store: string): Promise<T[]> {
  const db = await getDB()
  return (await db.getAll(store)) as T[]
}

export async function enqueueSync(item: Omit<SyncQueueItem, 'id' | 'queued_at'>): Promise<void> {
  const db = await getDB()
  await db.add('sync_queue', { ...item, queued_at: Date.now() })
}

export async function processSyncQueue(): Promise<void> {
  if (!navigator.onLine) return
  const db = await getDB()
  const queue: SyncQueueItem[] = await db.getAll('sync_queue')
  for (const op of queue) {
    try {
      if (op.action === 'upsert') {
        await supabase.from(op.table).upsert(op.payload as Record<string, unknown>)
      } else if (op.action === 'delete') {
        const row = op.payload as { id: number }
        await supabase.from(op.table).delete().eq('id', row.id)
      }
      if (op.id !== undefined) await db.delete('sync_queue', op.id)
    } catch {
      // Keep failed ops in queue to retry next time
    }
  }
}

export async function getPendingSyncCount(): Promise<number> {
  const db = await getDB()
  return db.count('sync_queue')
}

// Register online listener to auto-process queue
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processSyncQueue().catch(() => null)
  })
}
