-- =============================================================================
-- Logística — apartado privado (solo Manuel Honrado)
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. Solo añade 2 tablas nuevas — no modifica ninguna tabla existente.
-- =============================================================================
-- IMPORTANTE sobre privacidad: al igual que el resto de la app, la RLS de
-- Supabase queda abierta (anon_all) — la privacidad de esta sección es solo
-- de interfaz (oculta del menú y bloqueada por nombre de trabajador dentro
-- de la propia página), no un cifrado real a nivel de base de datos.

-- Configuración: qué áreas (de la tabla "areas" ya existente) cuentan como
-- "Logística" — cualquier tarea o reparación marcada con esas áreas en los
-- módulos compartidos aparece automáticamente en el apartado privado.
CREATE TABLE IF NOT EXISTS logistica_config (
  id               INT PRIMARY KEY DEFAULT 1,
  tracked_area_ids INT[] NOT NULL DEFAULT '{}'::INT[],
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT logistica_config_singleton CHECK (id = 1)
);
INSERT INTO logistica_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Activos del Registro de Activos que Manuel decide "vigilar" desde Logística
-- (para ver su histórico de averías/costes reunido en un solo sitio).
CREATE TABLE IF NOT EXISTS logistica_assets (
  id                BIGSERIAL PRIMARY KEY,
  critical_asset_id BIGINT NOT NULL REFERENCES critical_assets(id) ON DELETE CASCADE,
  notes             TEXT,
  created_by_id     BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (critical_asset_id)
);

ALTER TABLE logistica_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_logistica_config" ON logistica_config FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_logistica_assets" ON logistica_assets FOR ALL TO anon USING (true) WITH CHECK (true);
