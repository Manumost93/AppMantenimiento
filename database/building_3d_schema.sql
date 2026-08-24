-- =============================================================================
-- Modelo 3D del edificio — Fase 1: plantas y marcadores
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. Solo añade 2 tablas nuevas — no modifica ninguna tabla existente.
-- 4. Después, crea el bucket de Storage a mano (Storage → New bucket):
--      nombre: building-plans · público: sí
--    (igual que ya hiciste con "documents" y "repair-photos")
-- =============================================================================

CREATE TABLE IF NOT EXISTS building_floors (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  floor_order    INT NOT NULL,
  plan_image_url TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS building_markers (
  id                BIGSERIAL PRIMARY KEY,
  floor_id          BIGINT NOT NULL REFERENCES building_floors(id) ON DELETE CASCADE,
  critical_asset_id BIGINT REFERENCES critical_assets(id) ON DELETE CASCADE,
  edge_asset_id     BIGINT REFERENCES edge_assets(id) ON DELETE CASCADE,
  label             TEXT,
  note_text         TEXT,
  pos_x             NUMERIC NOT NULL CHECK (pos_x >= 0 AND pos_x <= 1),
  pos_y             NUMERIC NOT NULL CHECK (pos_y >= 0 AND pos_y <= 1),
  created_by_id     BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (CASE WHEN critical_asset_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN edge_asset_id     IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN label             IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_building_floors_order        ON building_floors(floor_order);
CREATE INDEX IF NOT EXISTS idx_building_markers_floor       ON building_markers(floor_id);
CREATE INDEX IF NOT EXISTS idx_building_markers_critical    ON building_markers(critical_asset_id);
CREATE INDEX IF NOT EXISTS idx_building_markers_edge        ON building_markers(edge_asset_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Mismo modelo que el resto de la app: acceso completo con la anon key.

ALTER TABLE building_floors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_building_floors"  ON building_floors  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_building_markers" ON building_markers FOR ALL TO anon USING (true) WITH CHECK (true);
