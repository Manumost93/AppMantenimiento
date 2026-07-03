-- =============================================================================
-- Edge / Data Center Lite — Fase 11: vincular eventos de seguridad a activos
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. No crea tablas nuevas — solo añade una columna a soc_security_events
--    (creada en la Fase 5) para poder enlazar un evento a un activo
--    concreto de Edge / Data Center Lite.
-- =============================================================================

ALTER TABLE soc_security_events
  ADD COLUMN IF NOT EXISTS affected_asset_id BIGINT REFERENCES edge_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_soc_security_events_asset ON soc_security_events(affected_asset_id);
