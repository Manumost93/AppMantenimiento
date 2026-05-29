// ─── Enums ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'inprogress' | 'blocked' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type EventType = 'task' | 'appointment' | 'meeting' | 'provider_visit' | 'maintenance' | 'incident'
export type MaterialStatus = 'pending' | 'ordered' | 'received' | 'cancelled'

// ─── Equipo ───────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: number
  name: string
  role: string
  color: string
  active: boolean
  pin_hash?: string
  observations?: string
  created_at?: string
}

// ─── Proveedores ─────────────────────────────────────────────────────────────

export interface Provider {
  id: number
  name: string
  contact_person?: string
  phone?: string
  email?: string
  area?: string
  observations?: string
  active: boolean
  created_at?: string
}

// ─── Áreas / Secciones ───────────────────────────────────────────────────────

export interface Area {
  id: number
  name: string
  color: string
  description?: string
  manager_id?: number
  manager?: TeamMember
  created_at?: string
}

// ─── Tareas / Eventos ────────────────────────────────────────────────────────

export interface Task {
  id: number
  title: string
  description?: string
  date: string
  start_time?: string
  end_time?: string
  area_id?: number
  area?: string
  event_type: EventType
  provider_id?: number
  provider?: string
  responsible_id?: number
  responsible?: TeamMember
  additional_assignees?: number[]
  priority: TaskPriority
  status: TaskStatus
  estimated_cost?: number
  real_cost?: number
  notes?: string
  is_personal?: boolean
  documents?: Document[]
  created_at: string
  updated_at: string
}

// ─── Documentos ──────────────────────────────────────────────────────────────

export interface Document {
  id: number
  name: string
  type: string
  path: string
  area?: string
  task_id?: number
  uploaded_at: string
  observations?: string
}

// ─── KONE ────────────────────────────────────────────────────────────────────

export interface KoneIncident {
  id: number
  date: string
  elevator: string
  incident_type: string
  description: string
  replaced_part?: string
  external_company?: string
  external_technician?: string
  internal_responsible_id?: number
  internal_responsible?: TeamMember
  part_cost: number
  labor_cost: number
  total_cost: number
  status: TaskStatus
  priority: TaskPriority
  observations?: string
  created_at: string
}

// ─── COMIN/ION ───────────────────────────────────────────────────────────────

export interface CominIonJob {
  id: number
  date: string
  work_requested: string
  affected_zone: string
  internal_responsible_id?: number
  internal_responsible?: TeamMember
  involves_ion: boolean
  external_company?: string
  material_requested?: string
  estimated_time?: number
  real_time?: number
  estimated_cost: number
  real_cost: number
  cost_difference: number
  status: TaskStatus
  priority: TaskPriority
  blocked_by_material: boolean
  observations?: string
  created_at: string
}

// ─── FOOD ────────────────────────────────────────────────────────────────────

export interface FoodIncident {
  id: number
  date: string
  restaurant_zone: string
  affected_element: string
  breakdown_type: string
  internal_responsible_id?: number
  internal_responsible?: TeamMember
  external_company?: string
  material_used?: string
  material_cost: number
  repair_cost: number
  total_cost: number
  status: TaskStatus
  priority: TaskPriority
  observations?: string
  created_at: string
}

// ─── Reparaciones Generales ──────────────────────────────────────────────────

export interface GeneralRepair {
  id: number
  request_date: string
  planned_date?: string
  completion_date?: string
  area_id?: number
  area?: string
  description: string
  responsible_id?: number
  responsible?: TeamMember
  priority: TaskPriority
  status: TaskStatus
  materials_needed?: string
  material_cost: number
  labor_cost: number
  total_cost: number
  blocked_by_material: boolean
  external_company?: string
  observations?: string
  created_at: string
}

// ─── Área personal ───────────────────────────────────────────────────────────

export interface PersonalNote {
  id: number
  worker_id: number
  title: string
  content: string
  color: string
  created_at: string
  updated_at: string
}

export interface MaterialRequest {
  id: number
  worker_id: number
  item_name: string
  quantity: number
  unit_price: number
  total_price: number
  supplier?: string
  status: MaterialStatus
  notes?: string
  requested_at: string
  received_at?: string
}

// ─── Dashboard KPIs ──────────────────────────────────────────────────────────

export interface DashboardStats {
  pending: number
  inprogress: number
  urgent: number
  done_today: number
  cost_month: number
  tasks_today: Task[]
}

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface TaskFilters {
  date?: string
  member_id?: number
  area_id?: number
  status?: TaskStatus
  priority?: TaskPriority
  search?: string
}
