-- =============================================================================
-- Edge / Data Center Lite — v3.2: historial de reparaciones por activo
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. No modifica edge_assets ni ninguna tabla existente — solo añade
--    1 tabla nueva. El campo edge_assets.repair_cost se queda tal cual.
-- =============================================================================

CREATE TABLE IF NOT EXISTS edge_asset_repairs (
  id             BIGSERIAL PRIMARY KEY,
  asset_id       BIGINT NOT NULL REFERENCES edge_assets(id) ON DELETE CASCADE,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  description    TEXT NOT NULL,
  material_cost  NUMERIC NOT NULL DEFAULT 0,
  labor_cost     NUMERIC NOT NULL DEFAULT 0,
  total_cost     NUMERIC GENERATED ALWAYS AS (material_cost + labor_cost) STORED,
  created_by_id  BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_asset_repairs_asset ON edge_asset_repairs(asset_id);
CREATE INDEX IF NOT EXISTS idx_edge_asset_repairs_date  ON edge_asset_repairs(date);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Mismo modelo que el resto de la app: acceso completo con la anon key.

ALTER TABLE edge_asset_repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_edge_asset_repairs" ON edge_asset_repairs FOR ALL TO anon USING (true) WITH CHECK (true);
