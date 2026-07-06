-- =============================================================================
-- Registro de Activos Críticos (CAFM real) — inventario, reparaciones y acceso restringido
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. No modifica ninguna tabla existente salvo añadir 1 columna a "workers".
-- 4. Después de ejecutar esto, ejecuta "critical_assets_seed.sql" para cargar
--    los ~450 activos reales del CSV.
-- =============================================================================

CREATE TABLE IF NOT EXISTS critical_assets (
  id                       BIGSERIAL PRIMARY KEY,
  asset_code               TEXT NOT NULL UNIQUE,        -- "A-10365"
  organization             TEXT,
  unit_id                  TEXT,
  classification_code      TEXT,
  classification_name      TEXT,
  description              TEXT NOT NULL,
  end_date                 DATE,
  replacement_cost         NUMERIC NOT NULL DEFAULT 0,
  status                   TEXT,
  criticality               SMALLINT,                    -- escala IKEA 1-5 (1 = más crítico)
  condition                SMALLINT,                    -- estado actual 1-5
  installation_date        DATE,
  manufacturer             TEXT,
  model                    TEXT,
  additional_info_1        TEXT,
  additional_info_2        TEXT,
  additional_info_3        TEXT,
  parent_asset_code        TEXT,                         -- referencia blanda a otro asset_code
  location_code            TEXT,
  location_description     TEXT,
  -- Campos para fases futuras (vida útil, alarmas, PMs) — nullable, no bloquean el import
  estimated_lifespan_years NUMERIC,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_critical_assets_classification ON critical_assets(classification_name);
CREATE INDEX IF NOT EXISTS idx_critical_assets_criticality     ON critical_assets(criticality);
CREATE INDEX IF NOT EXISTS idx_critical_assets_location        ON critical_assets(location_description);

CREATE TABLE IF NOT EXISTS critical_asset_repairs (
  id             BIGSERIAL PRIMARY KEY,
  asset_id       BIGINT NOT NULL REFERENCES critical_assets(id) ON DELETE CASCADE,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  description    TEXT NOT NULL,
  material_cost  NUMERIC NOT NULL DEFAULT 0,
  labor_cost     NUMERIC NOT NULL DEFAULT 0,
  total_cost     NUMERIC GENERATED ALWAYS AS (material_cost + labor_cost) STORED,
  created_by_id  BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_critical_asset_repairs_asset ON critical_asset_repairs(asset_id);

-- ─── Contraseña adicional de acceso a esta sección (independiente del PIN normal) ──
-- Fila única (id fijo a 1). Se rellena desde la propia app la primera vez que
-- alguien con permiso entra (evita tener que hashear una contraseña a mano en SQL).
CREATE TABLE IF NOT EXISTS critical_registry_access (
  id               SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  passphrase_hash  TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Permiso nuevo, distinto de is_admin, solo para quien puede ver este registro ──
ALTER TABLE workers ADD COLUMN IF NOT EXISTS can_view_asset_registry BOOLEAN NOT NULL DEFAULT false;
UPDATE workers SET can_view_asset_registry = true WHERE name IN ('Manuel Honrado Vega', 'PATRÓN');

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Mismo modelo que el resto de la app: acceso completo con la anon key.
-- La restricción real (solo Manuel y PATRÓN) es a nivel de aplicación
-- (Sidebar + pantalla de acceso denegado + contraseña adicional), no de Postgres.

ALTER TABLE critical_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_asset_repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_registry_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_critical_assets" ON critical_assets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_critical_asset_repairs" ON critical_asset_repairs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_critical_registry_access" ON critical_registry_access FOR ALL TO anon USING (true) WITH CHECK (true);
