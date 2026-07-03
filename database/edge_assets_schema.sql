-- =============================================================================
-- Edge / Data Center Lite — Fase 7: inventario de activos críticos
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. No modifica ninguna tabla existente — solo añade 1 tabla nueva.
-- =============================================================================

CREATE TABLE IF NOT EXISTS edge_assets (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  asset_type       TEXT NOT NULL
                   CHECK(asset_type IN (
                     'rack','edge_server','switch','firewall','router','ups','pdu','hvac',
                     'temperature_sensor','humidity_sensor','cctv','access_control',
                     'electrical_panel','generator','bms_controller','pci_panel','network_cabinet'
                   )),
  location         TEXT,
  rack             TEXT,
  rack_unit        TEXT,
  criticality      TEXT NOT NULL DEFAULT 'medium'
                   CHECK(criticality IN ('low','medium','high','critical')),
  status           TEXT NOT NULL DEFAULT 'operational'
                   CHECK(status IN ('operational','warning','offline','maintenance')),
  provider_id      BIGINT REFERENCES providers(id) ON DELETE SET NULL,
  ip_address       TEXT,
  serial_number    TEXT,
  last_check_date  DATE,
  next_check_date  DATE,
  -- Coste acumulado de reparación/mantenimiento del activo (petición del usuario, fuera del plan original)
  repair_cost      NUMERIC NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_assets_type       ON edge_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_edge_assets_status      ON edge_assets(status);
CREATE INDEX IF NOT EXISTS idx_edge_assets_criticality ON edge_assets(criticality);
CREATE INDEX IF NOT EXISTS idx_edge_assets_next_check  ON edge_assets(next_check_date);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Mismo modelo que el resto de la app: acceso completo con la anon key.

ALTER TABLE edge_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_edge_assets" ON edge_assets FOR ALL TO anon USING (true) WITH CHECK (true);
