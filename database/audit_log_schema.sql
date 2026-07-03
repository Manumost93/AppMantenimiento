-- =============================================================================
-- Audit Log — Fase 6: trazabilidad de acciones importantes
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. No modifica ninguna tabla existente — solo añade 1 tabla nueva.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  -- Copia del nombre en el momento del evento (se conserva aunque el worker cambie o se borre)
  user_name   TEXT,
  action      TEXT NOT NULL,
  module      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   BIGINT,
  description TEXT,
  severity    TEXT NOT NULL DEFAULT 'info'
              CHECK(severity IN ('info','warning','critical')),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module  ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user    ON audit_logs(user_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Mismo modelo que el resto de la app: acceso completo con la anon key.

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_audit_logs" ON audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
