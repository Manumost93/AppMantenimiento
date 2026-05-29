-- ============================================================
-- IKEA Mantenimiento - Schema SQLite
-- Desarrollado por Manuel Honrado Vega
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ─── Configuración ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ─── Áreas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS areas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT '#6B7280',
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Compañeros ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  role         TEXT,
  color        TEXT NOT NULL DEFAULT '#3B82F6',
  active       INTEGER NOT NULL DEFAULT 1,
  observations TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Proveedores ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  area           TEXT,
  observations   TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Tareas / Eventos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  title               TEXT NOT NULL,
  description         TEXT,
  date                TEXT NOT NULL,
  start_time          TEXT,
  end_time            TEXT,
  area_id             INTEGER REFERENCES areas(id),
  event_type          TEXT NOT NULL DEFAULT 'task',
  provider_id         INTEGER REFERENCES providers(id),
  responsible_id      INTEGER REFERENCES team_members(id),
  priority            TEXT NOT NULL DEFAULT 'medium'
                      CHECK(priority IN ('low','medium','high','urgent')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  estimated_cost      REAL DEFAULT 0,
  real_cost           REAL DEFAULT 0,
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_date       ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority   ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_responsible ON tasks(responsible_id);
CREATE INDEX IF NOT EXISTS idx_tasks_area        ON tasks(area_id);

-- ─── Asignaciones adicionales ────────────────────────────────
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES team_members(id),
  PRIMARY KEY (task_id, member_id)
);

-- ─── Documentos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'PDF',
  path         TEXT NOT NULL,
  area         TEXT,
  task_id      INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  uploaded_at  TEXT NOT NULL DEFAULT (datetime('now')),
  observations TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_task ON documents(task_id);

-- ─── Incidencias KONE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS kone_incidents (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  date                   TEXT NOT NULL,
  elevator               TEXT NOT NULL,
  incident_type          TEXT NOT NULL,
  description            TEXT NOT NULL,
  replaced_part          TEXT,
  external_company       TEXT,
  external_technician    TEXT,
  internal_responsible_id INTEGER REFERENCES team_members(id),
  part_cost              REAL NOT NULL DEFAULT 0,
  labor_cost             REAL NOT NULL DEFAULT 0,
  total_cost             REAL GENERATED ALWAYS AS (part_cost + labor_cost) STORED,
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  priority               TEXT NOT NULL DEFAULT 'medium'
                         CHECK(priority IN ('low','medium','high','urgent')),
  observations           TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kone_date      ON kone_incidents(date);
CREATE INDEX IF NOT EXISTS idx_kone_elevator  ON kone_incidents(elevator);
CREATE INDEX IF NOT EXISTS idx_kone_status    ON kone_incidents(status);

-- ─── COMIN/ION ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comin_ion_jobs (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  date                    TEXT NOT NULL,
  work_requested          TEXT NOT NULL,
  affected_zone           TEXT NOT NULL,
  internal_responsible_id INTEGER REFERENCES team_members(id),
  involves_ion            INTEGER NOT NULL DEFAULT 0,
  external_company        TEXT,
  material_requested      TEXT,
  estimated_time          REAL,
  real_time               REAL,
  estimated_cost          REAL NOT NULL DEFAULT 0,
  real_cost               REAL NOT NULL DEFAULT 0,
  cost_difference         REAL GENERATED ALWAYS AS (real_cost - estimated_cost) STORED,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  priority                TEXT NOT NULL DEFAULT 'medium'
                          CHECK(priority IN ('low','medium','high','urgent')),
  blocked_by_material     INTEGER NOT NULL DEFAULT 0,
  observations            TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── FOOD ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS food_incidents (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  date                    TEXT NOT NULL,
  restaurant_zone         TEXT NOT NULL,
  affected_element        TEXT NOT NULL,
  breakdown_type          TEXT NOT NULL,
  internal_responsible_id INTEGER REFERENCES team_members(id),
  external_company        TEXT,
  material_used           TEXT,
  material_cost           REAL NOT NULL DEFAULT 0,
  repair_cost             REAL NOT NULL DEFAULT 0,
  total_cost              REAL GENERATED ALWAYS AS (material_cost + repair_cost) STORED,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  priority                TEXT NOT NULL DEFAULT 'medium'
                          CHECK(priority IN ('low','medium','high','urgent')),
  observations            TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_food_element ON food_incidents(affected_element);
CREATE INDEX IF NOT EXISTS idx_food_zone    ON food_incidents(restaurant_zone);

-- ─── Reparaciones generales ──────────────────────────────────
CREATE TABLE IF NOT EXISTS general_repairs (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  request_date            TEXT NOT NULL,
  planned_date            TEXT,
  completion_date         TEXT,
  area_id                 INTEGER REFERENCES areas(id),
  description             TEXT NOT NULL,
  responsible_id          INTEGER REFERENCES team_members(id),
  priority                TEXT NOT NULL DEFAULT 'medium'
                          CHECK(priority IN ('low','medium','high','urgent')),
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  materials_needed        TEXT,
  material_cost           REAL NOT NULL DEFAULT 0,
  labor_cost              REAL NOT NULL DEFAULT 0,
  total_cost              REAL GENERATED ALWAYS AS (material_cost + labor_cost) STORED,
  blocked_by_material     INTEGER NOT NULL DEFAULT 0,
  external_company        TEXT,
  observations            TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_repairs_status     ON general_repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_responsible ON general_repairs(responsible_id);
CREATE INDEX IF NOT EXISTS idx_repairs_date        ON general_repairs(request_date);

-- ─── Notas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  task_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES team_members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
