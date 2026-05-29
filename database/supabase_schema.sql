-- =============================================================================
-- IKEA MANTENIMIENTO - Schema Supabase (PostgreSQL)
-- Desarrollado por Manuel Honrado Vega
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a supabase.com, crea un proyecto gratuito
-- 2. En el panel: SQL Editor → New query
-- 3. Pega todo este contenido y ejecuta (Run)
-- =============================================================================

-- ─── TABLAS PRINCIPALES ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workers (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  role         TEXT DEFAULT '',
  color        TEXT NOT NULL DEFAULT '#3B82F6',
  active       BOOLEAN NOT NULL DEFAULT true,
  pin_hash     TEXT NOT NULL DEFAULT '',
  observations TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS areas (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT '#6B7280',
  description TEXT,
  manager_id  BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS providers (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  area           TEXT,
  observations   TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id             BIGSERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  date           DATE NOT NULL,
  start_time     TIME,
  end_time       TIME,
  area_id        BIGINT REFERENCES areas(id) ON DELETE SET NULL,
  event_type     TEXT NOT NULL DEFAULT 'task'
                 CHECK(event_type IN ('task','appointment','meeting','provider_visit','maintenance','incident')),
  provider_id    BIGINT REFERENCES providers(id) ON DELETE SET NULL,
  responsible_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  priority       TEXT NOT NULL DEFAULT 'medium'
                 CHECK(priority IN ('low','medium','high','urgent')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  estimated_cost NUMERIC DEFAULT 0,
  real_cost      NUMERIC DEFAULT 0,
  notes          TEXT,
  is_personal    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_date        ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_responsible ON tasks(responsible_id);
CREATE INDEX IF NOT EXISTS idx_tasks_personal    ON tasks(is_personal, responsible_id);
CREATE INDEX IF NOT EXISTS idx_tasks_area        ON tasks(area_id);

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id   BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id BIGINT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, worker_id)
);

CREATE TABLE IF NOT EXISTS kone_incidents (
  id                      BIGSERIAL PRIMARY KEY,
  date                    DATE NOT NULL,
  elevator                TEXT NOT NULL,
  incident_type           TEXT NOT NULL,
  description             TEXT NOT NULL,
  replaced_part           TEXT,
  external_company        TEXT,
  external_technician     TEXT,
  internal_responsible_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  part_cost               NUMERIC NOT NULL DEFAULT 0,
  labor_cost              NUMERIC NOT NULL DEFAULT 0,
  total_cost              NUMERIC GENERATED ALWAYS AS (part_cost + labor_cost) STORED,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  priority                TEXT NOT NULL DEFAULT 'medium'
                          CHECK(priority IN ('low','medium','high','urgent')),
  observations            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kone_date   ON kone_incidents(date);
CREATE INDEX IF NOT EXISTS idx_kone_status ON kone_incidents(status);

CREATE TABLE IF NOT EXISTS comin_ion_jobs (
  id                      BIGSERIAL PRIMARY KEY,
  date                    DATE NOT NULL,
  work_requested          TEXT NOT NULL,
  affected_zone           TEXT NOT NULL,
  internal_responsible_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  involves_ion            BOOLEAN NOT NULL DEFAULT false,
  external_company        TEXT,
  material_requested      TEXT,
  estimated_time          NUMERIC,
  real_time               NUMERIC,
  estimated_cost          NUMERIC NOT NULL DEFAULT 0,
  real_cost               NUMERIC NOT NULL DEFAULT 0,
  cost_difference         NUMERIC GENERATED ALWAYS AS (real_cost - estimated_cost) STORED,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  priority                TEXT NOT NULL DEFAULT 'medium'
                          CHECK(priority IN ('low','medium','high','urgent')),
  blocked_by_material     BOOLEAN NOT NULL DEFAULT false,
  observations            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS food_incidents (
  id                      BIGSERIAL PRIMARY KEY,
  date                    DATE NOT NULL,
  restaurant_zone         TEXT NOT NULL,
  affected_element        TEXT NOT NULL,
  breakdown_type          TEXT NOT NULL,
  internal_responsible_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  external_company        TEXT,
  material_used           TEXT,
  material_cost           NUMERIC NOT NULL DEFAULT 0,
  repair_cost             NUMERIC NOT NULL DEFAULT 0,
  total_cost              NUMERIC GENERATED ALWAYS AS (material_cost + repair_cost) STORED,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  priority                TEXT NOT NULL DEFAULT 'medium'
                          CHECK(priority IN ('low','medium','high','urgent')),
  observations            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS general_repairs (
  id                  BIGSERIAL PRIMARY KEY,
  request_date        DATE NOT NULL,
  planned_date        DATE,
  completion_date     DATE,
  area_id             BIGINT REFERENCES areas(id) ON DELETE SET NULL,
  description         TEXT NOT NULL,
  responsible_id      BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  priority            TEXT NOT NULL DEFAULT 'medium'
                      CHECK(priority IN ('low','medium','high','urgent')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','inprogress','blocked','done','cancelled')),
  materials_needed    TEXT,
  material_cost       NUMERIC NOT NULL DEFAULT 0,
  labor_cost          NUMERIC NOT NULL DEFAULT 0,
  total_cost          NUMERIC GENERATED ALWAYS AS (material_cost + labor_cost) STORED,
  blocked_by_material BOOLEAN NOT NULL DEFAULT false,
  external_company    TEXT,
  observations        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repairs_status      ON general_repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_responsible ON general_repairs(responsible_id);
CREATE INDEX IF NOT EXISTS idx_repairs_date        ON general_repairs(request_date);

-- ─── TABLAS ÁREA PERSONAL ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS personal_notes (
  id         BIGSERIAL PRIMARY KEY,
  worker_id  BIGINT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL DEFAULT '#FEF9C3',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_worker ON personal_notes(worker_id);

CREATE TABLE IF NOT EXISTS material_requests (
  id           BIGSERIAL PRIMARY KEY,
  worker_id    BIGINT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  item_name    TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  unit_price   NUMERIC NOT NULL DEFAULT 0,
  total_price  NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  supplier     TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK(status IN ('pending','ordered','received','cancelled')),
  notes        TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_materials_worker ON material_requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_materials_status ON material_requests(status);

CREATE TABLE IF NOT EXISTS favorite_providers (
  worker_id   BIGINT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  PRIMARY KEY (worker_id, provider_id)
);

-- ─── ROW LEVEL SECURITY (acceso público con anon key - app interna) ──────────

ALTER TABLE workers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kone_incidents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comin_ion_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_incidents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_repairs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_providers ENABLE ROW LEVEL SECURITY;

-- Permitir acceso completo con anon key (app interna de equipo)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workers','areas','providers','tasks','task_assignees',
    'kone_incidents','comin_ion_jobs','food_incidents','general_repairs',
    'personal_notes','material_requests','favorite_providers'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "anon_all_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END
$$;

-- ─── DATOS INICIALES DE EJEMPLO ──────────────────────────────────────────────
-- Descomenta y modifica con los datos reales de tu equipo

/*
INSERT INTO areas (name, color, description) VALUES
  ('KONE / Ascensores',    '#3B82F6', 'Mantenimiento de ascensores y escaleras mecánicas'),
  ('FOOD / Restaurante',   '#F59E0B', 'Incidencias del área de restauración'),
  ('COMIN / ION',          '#8B5CF6', 'Trabajos de decoración y señalización'),
  ('Electricidad',         '#EAB308', 'Instalaciones eléctricas'),
  ('Fontanería',           '#06B6D4', 'Instalaciones de agua y saneamiento'),
  ('Climatización',        '#10B981', 'Sistemas HVAC y ventilación'),
  ('General',              '#6B7280', 'Trabajos generales'),
  ('Exterior / Parking',   '#64748B', 'Zona exterior y aparcamiento');

INSERT INTO providers (name, contact_person, phone, email, area) VALUES
  ('KONE España',          'Servicio KONE',     '900 100 200', 'servicio@kone.es',         'KONE / Ascensores'),
  ('ION Decoración',       'Contacto ION',      '91 234 5678', 'info@ion.es',               'COMIN / ION'),
  ('COMIN',                'Contacto COMIN',    '91 345 6789', 'info@comin.es',             'COMIN / ION'),
  ('PCI Sistemas',         'PCI Sistemas',      '91 456 7890', 'info@pci.es',               'General'),
  ('Climatec',             'Servicio Climatec', '91 567 8901', 'servicio@climatec.es',      'Climatización'),
  ('Electra Pro',          'Electra Pro',       '91 678 9012', 'info@electrapro.es',        'Electricidad'),
  ('AquaFix',              'AquaFix',           '91 789 0123', 'info@aquafix.es',           'Fontanería'),
  ('MantenimientoXXI',     'Mant XXI',          '91 890 1234', 'info@mantenimientoxxi.es',  'General');

INSERT INTO workers (name, role, color) VALUES
  ('Carlos López',   'Electricidad',  '#3B82F6'),
  ('María García',   'Fontanería',    '#10B981'),
  ('Juan Martínez',  'KONE',          '#F59E0B'),
  ('Ana Rodríguez',  'Climatización', '#8B5CF6'),
  ('Pedro Sánchez',  'General',       '#EF4444'),
  ('Luis Fernández', 'COMIN/ION',     '#F97316'),
  ('Elena Díaz',     'FOOD',          '#EC4899');
*/
