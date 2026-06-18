import { createClient } from '@supabase/supabase-js'
import type {
  TeamMember, Provider, Area, Task, KoneIncident,
  CominIonJob, FoodIncident, GeneralRepair,
  PersonalNote, MaterialRequest, Document,
  WorkerTaskStats, RondaEntry,
} from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Workers (Equipo) ────────────────────────────────────────────────────────

export async function getWorkers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function upsertWorker(worker: Partial<TeamMember>): Promise<TeamMember> {
  const payload = { ...worker }
  delete payload.created_at
  const { data, error } = await supabase
    .from('workers')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteWorker(id: number): Promise<void> {
  const { error } = await supabase.from('workers').delete().eq('id', id)
  if (error) throw error
}

export async function toggleWorkerActive(id: number, active: boolean): Promise<void> {
  const { error } = await supabase.from('workers').update({ active }).eq('id', id)
  if (error) throw error
}

// ─── Auth por PIN ─────────────────────────────────────────────────────────────

export async function verifyPin(workerId: number, pin: string): Promise<boolean> {
  const { data } = await supabase
    .from('workers')
    .select('pin_hash')
    .eq('id', workerId)
    .single()
  if (!data?.pin_hash) return false
  const bcrypt = await import('bcryptjs')
  return bcrypt.compare(pin, data.pin_hash)
}

export async function setWorkerPin(workerId: number, pin: string): Promise<void> {
  const bcrypt = await import('bcryptjs')
  const pin_hash = await bcrypt.hash(pin, 8)
  const { error } = await supabase
    .from('workers')
    .update({ pin_hash })
    .eq('id', workerId)
  if (error) throw error
}

export async function hasPin(workerId: number): Promise<boolean> {
  const { data } = await supabase
    .from('workers')
    .select('pin_hash')
    .eq('id', workerId)
    .single()
  return !!(data?.pin_hash)
}

// ─── Áreas / Secciones ───────────────────────────────────────────────────────

export async function getAreas(): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('*, manager:workers!manager_id(id,name,color)')
    .order('name')
  if (error) throw error
  return (data ?? []).map(a => ({ ...a, manager: a.manager ?? undefined }))
}

export async function upsertArea(area: Partial<Area>): Promise<Area> {
  const payload = { ...area }
  delete payload.manager
  delete payload.created_at
  const { data, error } = await supabase
    .from('areas')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteArea(id: number): Promise<void> {
  const { error } = await supabase.from('areas').delete().eq('id', id)
  if (error) throw error
}

// ─── Proveedores ──────────────────────────────────────────────────────────────

export async function getProviders(): Promise<Provider[]> {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function upsertProvider(provider: Partial<Provider>): Promise<Provider> {
  const payload = { ...provider }
  delete payload.created_at
  const { data, error } = await supabase
    .from('providers')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProvider(id: number): Promise<void> {
  const { error } = await supabase.from('providers').delete().eq('id', id)
  if (error) throw error
}

// ─── Tareas ───────────────────────────────────────────────────────────────────

export async function getTasks(filters?: {
  is_personal?: boolean
  responsible_id?: number
  date_from?: string
  date_to?: string
}): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*, responsible:workers!responsible_id(id,name,color,role)')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })

  if (filters?.is_personal !== undefined)
    query = query.eq('is_personal', filters.is_personal)
  if (filters?.responsible_id)
    query = query.eq('responsible_id', filters.responsible_id)
  if (filters?.date_from)
    query = query.gte('date', filters.date_from)
  if (filters?.date_to)
    query = query.lte('date', filters.date_to)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(t => ({
    ...t,
    responsible: t.responsible ?? undefined,
  }))
}

export async function upsertTask(task: Partial<Task>): Promise<Task> {
  const payload: Record<string, unknown> = {
    ...task,
    updated_at: new Date().toISOString(),
  }
  delete payload.responsible
  delete payload.documents
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('tasks')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTask(id: number): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// ─── KONE ────────────────────────────────────────────────────────────────────

export async function getKoneIncidents(): Promise<KoneIncident[]> {
  const { data, error } = await supabase
    .from('kone_incidents')
    .select('*, internal_responsible:workers!internal_responsible_id(id,name,color)')
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(k => ({
    ...k,
    internal_responsible: k.internal_responsible ?? undefined,
  }))
}

export async function upsertKoneIncident(incident: Partial<KoneIncident>): Promise<KoneIncident> {
  const payload: Record<string, unknown> = { ...incident }
  delete payload.internal_responsible
  delete payload.total_cost
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('kone_incidents')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteKoneIncident(id: number): Promise<void> {
  const { error } = await supabase.from('kone_incidents').delete().eq('id', id)
  if (error) throw error
}

// ─── COMIN/ION ────────────────────────────────────────────────────────────────

export async function getCominIonJobs(): Promise<CominIonJob[]> {
  const { data, error } = await supabase
    .from('comin_ion_jobs')
    .select('*, internal_responsible:workers!internal_responsible_id(id,name,color)')
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(j => ({
    ...j,
    internal_responsible: j.internal_responsible ?? undefined,
  }))
}

export async function upsertCominIonJob(job: Partial<CominIonJob>): Promise<CominIonJob> {
  const payload: Record<string, unknown> = { ...job }
  delete payload.internal_responsible
  delete payload.cost_difference
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('comin_ion_jobs')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCominIonJob(id: number): Promise<void> {
  const { error } = await supabase.from('comin_ion_jobs').delete().eq('id', id)
  if (error) throw error
}

// ─── FOOD ────────────────────────────────────────────────────────────────────

export async function getFoodIncidents(): Promise<FoodIncident[]> {
  const { data, error } = await supabase
    .from('food_incidents')
    .select('*, internal_responsible:workers!internal_responsible_id(id,name,color)')
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(f => ({
    ...f,
    internal_responsible: f.internal_responsible ?? undefined,
  }))
}

export async function upsertFoodIncident(incident: Partial<FoodIncident>): Promise<FoodIncident> {
  const payload: Record<string, unknown> = { ...incident }
  delete payload.internal_responsible
  delete payload.total_cost
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('food_incidents')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFoodIncident(id: number): Promise<void> {
  const { error } = await supabase.from('food_incidents').delete().eq('id', id)
  if (error) throw error
}

// ─── Reparaciones ────────────────────────────────────────────────────────────

export async function getRepairs(): Promise<GeneralRepair[]> {
  const { data, error } = await supabase
    .from('general_repairs')
    .select('*, responsible:workers!responsible_id(id,name,color), area_info:areas!area_id(name)')
    .order('request_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => ({
    ...r,
    responsible: r.responsible ?? undefined,
    area: r.area_info?.name ?? r.area,
  }))
}

export async function upsertRepair(repair: Partial<GeneralRepair>): Promise<GeneralRepair> {
  const payload: Record<string, unknown> = { ...repair }
  delete payload.responsible
  delete payload.area_info
  delete payload.total_cost
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('general_repairs')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRepair(id: number): Promise<void> {
  const { error } = await supabase.from('general_repairs').delete().eq('id', id)
  if (error) throw error
}

// ─── Área Personal ────────────────────────────────────────────────────────────

export async function getPersonalNotes(workerId: number): Promise<PersonalNote[]> {
  const { data, error } = await supabase
    .from('personal_notes')
    .select('*')
    .eq('worker_id', workerId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertPersonalNote(note: Partial<PersonalNote>): Promise<PersonalNote> {
  const payload = { ...note, updated_at: new Date().toISOString() }
  if (!payload.id) delete (payload as Partial<PersonalNote>).id
  const { data, error } = await supabase
    .from('personal_notes')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePersonalNote(id: number): Promise<void> {
  const { error } = await supabase.from('personal_notes').delete().eq('id', id)
  if (error) throw error
}

export async function getMaterialRequests(workerId: number): Promise<MaterialRequest[]> {
  const { data, error } = await supabase
    .from('material_requests')
    .select('*')
    .eq('worker_id', workerId)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMaterialRequest(req: Partial<MaterialRequest>): Promise<MaterialRequest> {
  const payload: Record<string, unknown> = { ...req }
  delete payload.total_price
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('material_requests')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMaterialRequest(id: number): Promise<void> {
  const { error } = await supabase.from('material_requests').delete().eq('id', id)
  if (error) throw error
}

export async function getFavoriteProviders(workerId: number): Promise<Provider[]> {
  const { data, error } = await supabase
    .from('favorite_providers')
    .select('providers(*)')
    .eq('worker_id', workerId)
  if (error) throw error
  return (data ?? []).map(d => d.providers as unknown as Provider).filter(Boolean)
}

export async function addFavoriteProvider(workerId: number, providerId: number): Promise<void> {
  const { error } = await supabase
    .from('favorite_providers')
    .upsert({ worker_id: workerId, provider_id: providerId })
  if (error) throw error
}

export async function removeFavoriteProvider(workerId: number, providerId: number): Promise<void> {
  const { error } = await supabase
    .from('favorite_providers')
    .delete()
    .eq('worker_id', workerId)
    .eq('provider_id', providerId)
  if (error) throw error
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

// ─── Documentos con Supabase Storage ─────────────────────────────────────────
// Nota: Crea un bucket público llamado "documents" en Supabase Storage → Storage → New Bucket

export async function getDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(doc => {
    if (doc.type !== 'link' && doc.path && !doc.path.startsWith('http')) {
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(doc.path)
      return { ...doc, file_url: publicUrl }
    }
    return { ...doc, file_url: doc.path }
  })
}

export async function uploadDocumentFile(
  file: File,
  metadata: { name: string; area: string; observations?: string }
): Promise<Document> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const typeMap: Record<string, string> = {
    pdf: 'pdf', jpg: 'image', jpeg: 'image', png: 'image',
    gif: 'image', webp: 'image', xls: 'excel', xlsx: 'excel',
    doc: 'word', docx: 'word',
  }
  const type = typeMap[ext] || 'file'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${metadata.area}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('documents')
    .insert({
      name: metadata.name,
      type,
      path,
      area: metadata.area,
      observations: metadata.observations,
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) {
    await supabase.storage.from('documents').remove([path])
    throw error
  }
  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
  return { ...data, file_url: publicUrl }
}

export async function addDocumentLink(
  url: string,
  metadata: { name: string; area: string; observations?: string }
): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      name: metadata.name,
      type: 'link',
      path: url,
      area: metadata.area,
      observations: metadata.observations,
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return { ...data, file_url: url }
}

export async function deleteDocument(id: number, path: string, type: string): Promise<void> {
  if (type !== 'link' && !path.startsWith('http')) {
    await supabase.storage.from('documents').remove([path])
  }
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}

// ─── Estadísticas de carga de trabajo ────────────────────────────────────────

export async function getWorkerTaskStats(): Promise<WorkerTaskStats[]> {
  const [{ data: workers }, { data: tasks }] = await Promise.all([
    supabase.from('workers').select('*').eq('active', true).order('name'),
    supabase.from('tasks').select('responsible_id, status').eq('is_personal', false),
  ])
  if (!workers) return []
  const taskList = tasks ?? []
  return (workers as TeamMember[])
    .map(worker => {
      const mine = taskList.filter(t => t.responsible_id === worker.id)
      return {
        worker,
        pending: mine.filter(t => t.status === 'pending').length,
        inprogress: mine.filter(t => t.status === 'inprogress').length,
        blocked: mine.filter(t => t.status === 'blocked').length,
        done: mine.filter(t => t.status === 'done').length,
        total: mine.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
      }
    })
    .filter(s => s.total > 0 || s.done > 0)
    .sort((a, b) => b.total - a.total)
}

// ─── Rondas de apertura/cierre ───────────────────────────────────────────────
// SQL necesario en Supabase:
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

export async function getRondas(fecha?: string): Promise<RondaEntry[]> {
  let query = supabase
    .from('rondas')
    .select('*, worker:workers!worker_id(id,name,color)')
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false })
  if (fecha) query = query.eq('fecha', fecha)
  const { data, error } = await query.limit(60)
  if (error) throw error
  return (data ?? []).map(r => ({ ...r, worker: r.worker ?? undefined }))
}

export async function upsertRonda(ronda: Partial<RondaEntry>): Promise<RondaEntry> {
  const payload = { ...ronda } as Record<string, unknown>
  delete payload.worker
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('rondas')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRonda(id: number): Promise<void> {
  const { error } = await supabase.from('rondas').delete().eq('id', id)
  if (error) throw error
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(today: string) {
  const { data: todayTasks } = await supabase
    .from('tasks')
    .select('*, responsible:workers!responsible_id(id,name,color,role)')
    .eq('date', today)
    .eq('is_personal', false)
    .order('start_time', { ascending: true, nullsFirst: true })

  const { data: monthTasks } = await supabase
    .from('tasks')
    .select('real_cost, status')
    .gte('date', today.substring(0, 7) + '-01')
    .eq('is_personal', false)

  const tasks = todayTasks ?? []
  const month = monthTasks ?? []

  return {
    pending: tasks.filter(t => t.status === 'pending').length,
    inprogress: tasks.filter(t => t.status === 'inprogress').length,
    urgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length,
    done_today: tasks.filter(t => t.status === 'done').length,
    cost_month: month.reduce((s, t) => s + (t.real_cost || 0), 0),
    tasks_today: tasks.map(t => ({ ...t, responsible: t.responsible ?? undefined })),
  }
}

// ─── Gráfico de carga mensual por persona ─────────────────────────────────────

export async function getMonthlyWorkerReport(months = 6): Promise<{
  tasks: { responsible_id: number; status: string; date: string }[]
  workers: TeamMember[]
}> {
  const from = new Date()
  from.setMonth(from.getMonth() - (months - 1))
  from.setDate(1)

  const [{ data: tasks }, { data: workers }] = await Promise.all([
    supabase
      .from('tasks')
      .select('responsible_id, status, date')
      .eq('is_personal', false)
      .gte('date', from.toISOString().split('T')[0])
      .not('responsible_id', 'is', null),
    supabase
      .from('workers')
      .select('id, name, color')
      .eq('active', true)
      .order('name'),
  ])

  return {
    tasks: (tasks ?? []) as { responsible_id: number; status: string; date: string }[],
    workers: (workers ?? []) as TeamMember[],
  }
}
