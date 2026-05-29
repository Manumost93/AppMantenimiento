import { createClient } from '@supabase/supabase-js'
import type {
  TeamMember, Provider, Area, Task, KoneIncident,
  CominIonJob, FoodIncident, GeneralRepair,
  PersonalNote, MaterialRequest,
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
