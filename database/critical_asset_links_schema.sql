-- =============================================================================
-- Vincular reparaciones/incidencias de otros módulos a Activos Críticos
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. Solo añade 1 columna opcional (nullable) a 4 tablas existentes — no borra
--    ni modifica ningún dato actual, no rompe nada.
-- =============================================================================

ALTER TABLE general_repairs ADD COLUMN IF NOT EXISTS critical_asset_id BIGINT REFERENCES critical_assets(id) ON DELETE SET NULL;
ALTER TABLE kone_incidents  ADD COLUMN IF NOT EXISTS critical_asset_id BIGINT REFERENCES critical_assets(id) ON DELETE SET NULL;
ALTER TABLE bms_incidents   ADD COLUMN IF NOT EXISTS critical_asset_id BIGINT REFERENCES critical_assets(id) ON DELETE SET NULL;
ALTER TABLE food_incidents  ADD COLUMN IF NOT EXISTS critical_asset_id BIGINT REFERENCES critical_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_general_repairs_critical_asset ON general_repairs(critical_asset_id);
CREATE INDEX IF NOT EXISTS idx_kone_incidents_critical_asset  ON kone_incidents(critical_asset_id);
CREATE INDEX IF NOT EXISTS idx_bms_incidents_critical_asset   ON bms_incidents(critical_asset_id);
CREATE INDEX IF NOT EXISTS idx_food_incidents_critical_asset  ON food_incidents(critical_asset_id);
