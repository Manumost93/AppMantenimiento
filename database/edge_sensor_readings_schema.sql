-- =============================================================================
-- Edge / Data Center Lite — Fase 9: sensores simulados
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. No modifica ninguna tabla existente — solo añade 1 tabla nueva.
--
-- IMPORTANTE: todo esto es simulación. No hay integración con hardware ni
-- sensores reales — las lecturas se generan desde la propia app (botón
-- "Simular lectura"), igual que los datos de ejemplo de Activos Críticos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS edge_sensor_readings (
  id          BIGSERIAL PRIMARY KEY,
  asset_id    BIGINT NOT NULL REFERENCES edge_assets(id) ON DELETE CASCADE,
  sensor_type TEXT NOT NULL
              CHECK(sensor_type IN (
                'temperature', 'humidity', 'power_consumption', 'ups_status',
                'hvac_status', 'network_status', 'door_status', 'cctv_status'
              )),
  value       NUMERIC NOT NULL,
  unit        TEXT,
  status      TEXT NOT NULL DEFAULT 'normal'
              CHECK(status IN ('normal', 'warning', 'critical')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_sensor_readings_asset    ON edge_sensor_readings(asset_id);
CREATE INDEX IF NOT EXISTS idx_edge_sensor_readings_type     ON edge_sensor_readings(sensor_type);
CREATE INDEX IF NOT EXISTS idx_edge_sensor_readings_recorded ON edge_sensor_readings(recorded_at DESC);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Mismo modelo que el resto de la app: acceso completo con la anon key.

ALTER TABLE edge_sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_edge_sensor_readings" ON edge_sensor_readings FOR ALL TO anon USING (true) WITH CHECK (true);
