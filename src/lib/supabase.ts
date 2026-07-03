import { createClient } from '@supabase/supabase-js'
import type {
  TeamMember, Provider, Area, Task, KoneIncident, KoneMonthlyCheck,
  CominIonJob, FoodIncident, GeneralRepair,
  PersonalNote, MaterialRequest, Document,
  WorkerTaskStats, RondaEntry, SecurityIncident, Meeting, WasteRequest,
  AuditLog, EdgeAsset, EdgeAssetRepair,
} from '@/types'
import type {
  SocCaseRecord, SocUrlAnalysisRecord, SocEmailAnalysisRecord,
  SocFileAnalysisRecord, SocSecurityEventRecord, SocStats,
} from '@/lib/soc'
import type { SensorReading } from '@/lib/edgeSensors'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Audit Log (Fase 6) ────────────────────────────────────────────────────
// SQL: database/audit_log_schema.sql
//
// "Fire and forget": nunca lanza error ni bloquea la acción que la llama.
// Si el registro de auditoría falla, la operación real (login, guardar un
// caso SOC, etc.) debe completarse igual — auditar nunca puede romper nada.

export async function createAuditLog(entry: {
  user_id?: number
  user_name?: string
  action: string
  module: string
  entity_type?: string
  entity_id?: number
  description?: string
  severity?: AuditLog['severity']
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({ severity: 'info', ...entry })
  } catch {
    // silencioso a propósito
  }
}

export async function getAuditLogs(limit = 300): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

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
  delete payload.photos  // handled separately via patchRepairPhotos
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

// ─── Fotos de reparaciones (bucket: repair-photos, público) ──────────────────
// SQL requerido (ejecutar una vez en Supabase SQL Editor):
//   ALTER TABLE general_repairs ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'::TEXT[];
//   ALTER TABLE cbre_jobs       ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'::TEXT[];
// Storage: Dashboard → Storage → New bucket "repair-photos" (Public: ON)

export async function uploadRepairPhoto(blob: Blob, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('repair-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error || !data) return null
    const { data: { publicUrl } } = supabase.storage.from('repair-photos').getPublicUrl(data.path)
    return publicUrl
  } catch { return null }
}

export async function patchRepairPhotos(id: number, photos: string[]): Promise<void> {
  await supabase.from('general_repairs').update({ photos }).eq('id', id)
}

export async function patchCbreJobPhotos(id: number, photos: string[]): Promise<void> {
  await supabase.from('cbre_jobs').update({ photos }).eq('id', id)
}

export async function uploadRondaPDF(pdfBlob: Blob, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('ronda-pdfs')
      .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true })
    if (error || !data) return null
    const { data: { publicUrl } } = supabase.storage
      .from('ronda-pdfs')
      .getPublicUrl(data.path)
    return publicUrl
  } catch {
    return null
  }
}

export async function patchRondaObservaciones(id: number, extra: Record<string, unknown>): Promise<void> {
  const { data } = await supabase.from('rondas').select('observaciones').eq('id', id).single()
  let obs: Record<string, unknown> = {}
  try { obs = JSON.parse(data?.observaciones ?? '{}') } catch {}
  await supabase.from('rondas').update({ observaciones: JSON.stringify({ ...obs, ...extra }) }).eq('id', id)
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

// ─── Seguridad / Incidencias ─────────────────────────────────────────────────

export async function getSecurityIncidents(): Promise<SecurityIncident[]> {
  const { data, error } = await supabase
    .from('security_incidents')
    .select('*, internal_responsible:workers!internal_responsible_id(id,name,color)')
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(s => ({
    ...s,
    internal_responsible: s.internal_responsible ?? undefined,
  }))
}

export async function upsertSecurityIncident(incident: Partial<SecurityIncident>): Promise<SecurityIncident> {
  const payload: Record<string, unknown> = { ...incident }
  delete payload.internal_responsible
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('security_incidents')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSecurityIncident(id: number): Promise<void> {
  const { error } = await supabase.from('security_incidents').delete().eq('id', id)
  if (error) throw error
}

// ─── KONE Revisiones Mensuales ────────────────────────────────────────────────
// SQL: CREATE TABLE IF NOT EXISTS kone_monthly_checks (
//   id BIGSERIAL PRIMARY KEY,
//   year INTEGER NOT NULL,
//   month INTEGER NOT NULL,
//   equipment_id TEXT NOT NULL,
//   equipment_type TEXT NOT NULL,
//   status TEXT NOT NULL DEFAULT 'ok',
//   notes TEXT,
//   worker_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
//   updated_at TIMESTAMPTZ DEFAULT NOW(),
//   UNIQUE(year, month, equipment_id)
// );
// ALTER TABLE kone_monthly_checks ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "public_access" ON kone_monthly_checks FOR ALL USING (true);

export async function getKoneMonthlyChecks(year: number, month: number): Promise<KoneMonthlyCheck[]> {
  const { data, error } = await supabase
    .from('kone_monthly_checks')
    .select('*, worker:workers!worker_id(id,name,color)')
    .eq('year', year)
    .eq('month', month)
  if (error) throw error
  return (data ?? []).map(c => ({ ...c, worker: c.worker ?? undefined }))
}

export async function upsertKoneMonthlyCheck(
  year: number, month: number,
  equipment_id: string, equipment_type: string,
  status: string, notes?: string, worker_id?: number
): Promise<KoneMonthlyCheck> {
  const { data, error } = await supabase
    .from('kone_monthly_checks')
    .upsert(
      { year, month, equipment_id, equipment_type, status, notes, worker_id, updated_at: new Date().toISOString() },
      { onConflict: 'year,month,equipment_id' }
    )
    .select('*, worker:workers!worker_id(id,name,color)')
    .single()
  if (error) throw error
  return { ...data, worker: data.worker ?? undefined }
}

export async function deleteKoneMonthlyCheck(id: number): Promise<void> {
  const { error } = await supabase.from('kone_monthly_checks').delete().eq('id', id)
  if (error) throw error
}

// ─── Reset PINs ───────────────────────────────────────────────────────────────

export async function resetAllWorkerPins(): Promise<void> {
  const { error } = await supabase.from('workers').update({ pin_hash: '' })
  if (error) throw error
}

// ─── Residuos / Contenedores ─────────────────────────────────────────────────

export async function getWasteRequests(): Promise<WasteRequest[]> {
  const { data, error } = await supabase
    .from('waste_requests')
    .select('*, created_by:workers!created_by_id(id,name,color)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => ({ ...r, created_by: r.created_by ?? undefined }))
}

export async function upsertWasteRequest(req: Partial<WasteRequest>): Promise<WasteRequest> {
  const payload: Record<string, unknown> = { ...req }
  delete payload.created_by
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('waste_requests')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteWasteRequest(id: number): Promise<void> {
  const { error } = await supabase.from('waste_requests').delete().eq('id', id)
  if (error) throw error
}

// ─── Reuniones ───────────────────────────────────────────────────────────────

export async function getMeetings(department?: string): Promise<Meeting[]> {
  let query = supabase
    .from('meetings')
    .select('*, created_by:workers!created_by_id(id,name,color)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (department) query = query.eq('department', department)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(m => ({
    ...m,
    agenda: Array.isArray(m.agenda) ? m.agenda : [],
    created_by: m.created_by ?? undefined,
  }))
}

export async function upsertMeeting(meeting: Partial<Meeting>): Promise<Meeting> {
  const payload: Record<string, unknown> = { ...meeting }
  delete payload.created_by
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('meetings')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return { ...data, agenda: Array.isArray(data.agenda) ? data.agenda : [] }
}

export async function deleteMeeting(id: number): Promise<void> {
  const { error } = await supabase.from('meetings').delete().eq('id', id)
  if (error) throw error
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

// ─── CBRE ─────────────────────────────────────────────────────────────────────

import type { CbreJob, BmsEquipment, BmsIncident } from '@/types'

export async function getCbreJobs(): Promise<CbreJob[]> {
  const { data } = await supabase
    .from('cbre_jobs')
    .select('*, responsible:workers(id,name,color,role)')
    .order('due_date', { ascending: true, nullsFirst: false })
  return (data ?? []) as CbreJob[]
}

export async function upsertCbreJob(job: Partial<CbreJob>): Promise<CbreJob> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, responsible, photos, ...payload } = job as CbreJob & { responsible?: unknown }
  const { data, error } = await supabase
    .from('cbre_jobs')
    .upsert({ ...payload, ...(id ? { id } : {}), updated_at: new Date().toISOString() })
    .select('*, responsible:workers(id,name,color,role)')
    .single()
  if (error) throw error
  return data as CbreJob
}

export async function deleteCbreJob(id: number): Promise<void> {
  await supabase.from('cbre_jobs').delete().eq('id', id)
}

// ─── BMS / IndoorClima ────────────────────────────────────────────────────────

export async function getBmsEquipment(): Promise<BmsEquipment[]> {
  const { data } = await supabase
    .from('bms_equipment')
    .select('*')
    .eq('active', true)
    .order('zone', { ascending: true })
    .order('name', { ascending: true })
  return (data ?? []) as BmsEquipment[]
}

export async function upsertBmsEquipment(eq: Partial<BmsEquipment>): Promise<BmsEquipment> {
  const { id, ...payload } = eq
  const { data, error } = await supabase
    .from('bms_equipment')
    .upsert({ ...payload, ...(id ? { id } : {}) })
    .select('*')
    .single()
  if (error) throw error
  return data as BmsEquipment
}

export async function deleteBmsEquipment(id: number): Promise<void> {
  await supabase.from('bms_equipment').update({ active: false }).eq('id', id)
}

export async function getBmsIncidents(equipmentId?: number): Promise<BmsIncident[]> {
  let q = supabase
    .from('bms_incidents')
    .select('*, equipment:bms_equipment(id,name,zone), reported_by:workers(id,name,color)')
    .order('created_at', { ascending: false })
  if (equipmentId) q = q.eq('equipment_id', equipmentId)
  const { data } = await q
  return (data ?? []) as BmsIncident[]
}

export async function upsertBmsIncident(inc: Partial<BmsIncident>): Promise<BmsIncident> {
  const { id, equipment, reported_by, ...payload } = inc as BmsIncident & { equipment?: unknown; reported_by?: unknown }
  const { data, error } = await supabase
    .from('bms_incidents')
    .upsert({ ...payload, ...(id ? { id } : {}) })
    .select('*, equipment:bms_equipment(id,name,zone), reported_by:workers(id,name,color)')
    .single()
  if (error) throw error
  return data as BmsIncident
}

export async function deleteBmsIncident(id: number): Promise<void> {
  await supabase.from('bms_incidents').delete().eq('id', id)
}

export async function updateBmsEquipmentStatus(id: number, status: BmsEquipment['status']): Promise<void> {
  await supabase.from('bms_equipment').update({ status }).eq('id', id)
}

// ─── SOC Lite (Fase 5) ─────────────────────────────────────────────────────
// SQL: database/soc_lite_schema.sql

const SOC_CASE_SELECT = '*, reported_by:workers!reported_by_id(id,name,color), assigned_to:workers!assigned_to_id(id,name,color)'

export async function getSocCases(): Promise<SocCaseRecord[]> {
  const { data, error } = await supabase
    .from('soc_cases')
    .select(SOC_CASE_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(c => ({
    ...c,
    reported_by: c.reported_by ?? undefined,
    assigned_to: c.assigned_to ?? undefined,
  })) as SocCaseRecord[]
}

export async function getSocCaseById(id: number): Promise<SocCaseRecord | null> {
  const { data, error } = await supabase
    .from('soc_cases')
    .select(SOC_CASE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    reported_by: data.reported_by ?? undefined,
    assigned_to: data.assigned_to ?? undefined,
  } as SocCaseRecord
}

export async function createSocCase(payload: Partial<SocCaseRecord>): Promise<SocCaseRecord> {
  const { id, reported_by, assigned_to, ...insertPayload } = payload as SocCaseRecord
  const { data, error } = await supabase
    .from('soc_cases')
    .insert(insertPayload)
    .select(SOC_CASE_SELECT)
    .single()
  if (error) throw error
  const result = {
    ...data,
    reported_by: data.reported_by ?? undefined,
    assigned_to: data.assigned_to ?? undefined,
  } as SocCaseRecord
  createAuditLog({
    user_id: result.reported_by_id,
    user_name: result.reported_by?.name,
    action: 'soc_case_created',
    module: 'soc_lite',
    entity_type: 'soc_case',
    entity_id: result.id,
    description: `Caso SOC creado (${result.case_type}): ${result.title}`,
    severity: result.severity === 'critical' || result.severity === 'high' ? 'warning' : 'info',
  })
  return result
}

export async function updateSocCaseStatus(id: number, status: SocCaseRecord['status']): Promise<SocCaseRecord> {
  const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'closed') payload.closed_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('soc_cases')
    .update(payload)
    .eq('id', id)
    .select(SOC_CASE_SELECT)
    .single()
  if (error) throw error
  const result = {
    ...data,
    reported_by: data.reported_by ?? undefined,
    assigned_to: data.assigned_to ?? undefined,
  } as SocCaseRecord
  if (status === 'closed') {
    createAuditLog({
      action: 'soc_case_closed',
      module: 'soc_lite',
      entity_type: 'soc_case',
      entity_id: result.id,
      description: `Caso SOC cerrado: ${result.title}`,
    })
  }
  return result
}

export async function createUrlAnalysis(payload: Omit<SocUrlAnalysisRecord, 'id' | 'created_at'>): Promise<SocUrlAnalysisRecord> {
  const { data, error } = await supabase.from('soc_url_analysis').insert(payload).select().single()
  if (error) throw error
  return data as SocUrlAnalysisRecord
}

export async function createEmailAnalysis(payload: Omit<SocEmailAnalysisRecord, 'id' | 'created_at'>): Promise<SocEmailAnalysisRecord> {
  const { data, error } = await supabase.from('soc_email_analysis').insert(payload).select().single()
  if (error) throw error
  return data as SocEmailAnalysisRecord
}

export async function createFileAnalysis(payload: Omit<SocFileAnalysisRecord, 'id' | 'created_at'>): Promise<SocFileAnalysisRecord> {
  const { data, error } = await supabase.from('soc_file_analysis').insert(payload).select().single()
  if (error) throw error
  return data as SocFileAnalysisRecord
}

const SOC_SECURITY_EVENT_SELECT = '*, affected_asset:edge_assets(id,name)'

export async function createSecurityEvent(payload: Omit<SocSecurityEventRecord, 'id' | 'created_at'>): Promise<SocSecurityEventRecord> {
  const { data, error } = await supabase
    .from('soc_security_events')
    .insert(payload)
    .select(SOC_SECURITY_EVENT_SELECT)
    .single()
  if (error) throw error
  return { ...data, affected_asset: data.affected_asset ?? undefined } as SocSecurityEventRecord
}

// Fase 11: eventos de seguridad con su activo enlazado (si tiene)
export async function getSecurityEvents(): Promise<SocSecurityEventRecord[]> {
  const { data, error } = await supabase
    .from('soc_security_events')
    .select(SOC_SECURITY_EVENT_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(e => ({ ...e, affected_asset: e.affected_asset ?? undefined })) as SocSecurityEventRecord[]
}

export async function getSocStats(): Promise<SocStats> {
  const { data, error } = await supabase.from('soc_cases').select('status, severity, case_type')
  if (error) throw error
  const cases = data ?? []
  return {
    openCases: cases.filter(c => c.status === 'open').length,
    criticalCases: cases.filter(c => c.severity === 'critical').length,
    urlsAnalyzed: cases.filter(c => c.case_type === 'url').length,
    emailsReviewed: cases.filter(c => c.case_type === 'email').length,
    filesReviewed: cases.filter(c => c.case_type === 'file').length,
    securityEvents: cases.filter(c => c.case_type === 'event').length,
  }
}

// ─── Edge / Data Center Lite (Fase 7) ──────────────────────────────────────
// SQL: database/edge_assets_schema.sql

const EDGE_ASSET_SELECT = '*, provider:providers(id,name,phone)'

export async function getEdgeAssets(): Promise<EdgeAsset[]> {
  const { data, error } = await supabase
    .from('edge_assets')
    .select(EDGE_ASSET_SELECT)
    .order('name')
  if (error) throw error
  return (data ?? []).map(a => ({ ...a, provider: a.provider ?? undefined })) as EdgeAsset[]
}

export async function upsertEdgeAsset(asset: Partial<EdgeAsset>): Promise<EdgeAsset> {
  const { provider, created_at, ...payload } = asset as EdgeAsset & { provider?: unknown; created_at?: unknown }
  const isNew = !asset.id
  const { data, error } = await supabase
    .from('edge_assets')
    .upsert({ ...payload, updated_at: new Date().toISOString() })
    .select(EDGE_ASSET_SELECT)
    .single()
  if (error) throw error
  const result = { ...data, provider: data.provider ?? undefined } as EdgeAsset
  createAuditLog({
    action: isNew ? 'edge_asset_created' : 'edge_asset_updated',
    module: 'edge_assets',
    entity_type: 'edge_asset',
    entity_id: result.id,
    description: `Activo ${isNew ? 'creado' : 'actualizado'}: ${result.name}`,
    severity: result.criticality === 'critical' ? 'warning' : 'info',
  })
  return result
}

export async function deleteEdgeAsset(id: number, name: string): Promise<void> {
  const { error } = await supabase.from('edge_assets').delete().eq('id', id)
  if (error) throw error
  createAuditLog({
    action: 'edge_asset_deleted',
    module: 'edge_assets',
    entity_type: 'edge_asset',
    entity_id: id,
    description: `Activo eliminado: ${name}`,
    severity: 'warning',
  })
}

// ─── Sensores simulados (Fase 9) ────────────────────────────────────────────
// SQL: database/edge_sensor_readings_schema.sql
// Todo simulado — sin integración con hardware real.

export async function getEdgeSensorReadings(limit = 500): Promise<SensorReading[]> {
  const { data, error } = await supabase
    .from('edge_sensor_readings')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as SensorReading[]
}

export async function createSensorReading(reading: Omit<SensorReading, 'id' | 'recorded_at'>): Promise<SensorReading> {
  const { data, error } = await supabase
    .from('edge_sensor_readings')
    .insert(reading)
    .select()
    .single()
  if (error) throw error
  if (data.status !== 'normal') {
    createAuditLog({
      action: 'sensor_reading_alert',
      module: 'edge_sensors',
      entity_type: 'edge_sensor_reading',
      entity_id: data.id,
      description: `Lectura simulada en estado ${data.status}: ${reading.sensor_type} (activo #${reading.asset_id})`,
      severity: data.status === 'critical' ? 'critical' : 'warning',
    })
  }
  return data as SensorReading
}

// ─── Historial de reparaciones por activo (v3.2) ───────────────────────────
// SQL: database/edge_asset_repairs_schema.sql
// Independiente de edge_assets.repair_cost, que se mantiene sin cambios.

export async function getEdgeAssetRepairs(assetId: number): Promise<EdgeAssetRepair[]> {
  const { data, error } = await supabase
    .from('edge_asset_repairs')
    .select('*, created_by:workers(id,name,color)')
    .eq('asset_id', assetId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => ({ ...r, created_by: r.created_by ?? undefined })) as EdgeAssetRepair[]
}

export async function createEdgeAssetRepair(repair: Omit<EdgeAssetRepair, 'id' | 'total_cost' | 'created_at' | 'created_by'>): Promise<EdgeAssetRepair> {
  const { data, error } = await supabase
    .from('edge_asset_repairs')
    .insert(repair)
    .select('*, created_by:workers(id,name,color)')
    .single()
  if (error) throw error
  const result = { ...data, created_by: data.created_by ?? undefined } as EdgeAssetRepair
  createAuditLog({
    user_id: repair.created_by_id,
    action: 'edge_asset_repair_logged',
    module: 'edge_assets',
    entity_type: 'edge_asset',
    entity_id: repair.asset_id,
    description: `Reparación registrada (${result.total_cost}€): ${repair.description}`,
  })
  return result
}
