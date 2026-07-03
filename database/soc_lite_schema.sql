-- =============================================================================
-- SOC Lite — Fase 5: persistencia de casos en Supabase
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. No modifica ninguna tabla existente — solo añade 5 tablas nuevas.
--
-- Nota: case_type usa 'event' (no 'security_event') para que coincida
-- exactamente con el tipo SocCaseType ya usado en el frontend desde la
-- Fase 1 (src/lib/soc.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS soc_cases (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  case_type       TEXT NOT NULL
                  CHECK(case_type IN ('url','email','file','event')),
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK(status IN ('open','reviewing','closed','false_positive')),
  severity        TEXT NOT NULL DEFAULT 'low'
                  CHECK(severity IN ('low','medium','high','critical')),
  description     TEXT,
  reported_by_id  BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  assigned_to_id  BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_soc_cases_status   ON soc_cases(status);
CREATE INDEX IF NOT EXISTS idx_soc_cases_type     ON soc_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_soc_cases_severity ON soc_cases(severity);
CREATE INDEX IF NOT EXISTS idx_soc_cases_created  ON soc_cases(created_at);

CREATE TABLE IF NOT EXISTS soc_url_analysis (
  id                  BIGSERIAL PRIMARY KEY,
  case_id             BIGINT NOT NULL REFERENCES soc_cases(id) ON DELETE CASCADE,
  url                 TEXT NOT NULL,
  domain              TEXT,
  uses_https          BOOLEAN NOT NULL DEFAULT false,
  has_ip_address      BOOLEAN NOT NULL DEFAULT false,
  url_length          INTEGER,
  suspicious_keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  risk_score          INTEGER NOT NULL DEFAULT 0 CHECK(risk_score BETWEEN 0 AND 100),
  severity            TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  recommendation      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soc_url_case ON soc_url_analysis(case_id);

CREATE TABLE IF NOT EXISTS soc_email_analysis (
  id                  BIGSERIAL PRIMARY KEY,
  case_id             BIGINT NOT NULL REFERENCES soc_cases(id) ON DELETE CASCADE,
  sender              TEXT,
  subject             TEXT,
  -- Extracto, no el cuerpo completo del correo (evita guardar contenido sensible innecesario)
  body_excerpt        TEXT CHECK(char_length(body_excerpt) <= 500),
  extracted_links     TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  suspicious_keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  has_attachments     BOOLEAN NOT NULL DEFAULT false,
  attachment_names    TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  risk_score          INTEGER NOT NULL DEFAULT 0 CHECK(risk_score BETWEEN 0 AND 100),
  severity            TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  recommendation      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soc_email_case ON soc_email_analysis(case_id);

CREATE TABLE IF NOT EXISTS soc_file_analysis (
  id             BIGSERIAL PRIMARY KEY,
  case_id        BIGINT NOT NULL REFERENCES soc_cases(id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,
  file_extension TEXT,
  file_size      BIGINT,
  mime_type      TEXT,
  sha256_hash    TEXT,
  storage_path   TEXT,
  risk_score     INTEGER NOT NULL DEFAULT 0 CHECK(risk_score BETWEEN 0 AND 100),
  severity       TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  recommendation TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soc_file_case ON soc_file_analysis(case_id);

CREATE TABLE IF NOT EXISTS soc_security_events (
  id              BIGSERIAL PRIMARY KEY,
  case_id         BIGINT NOT NULL REFERENCES soc_cases(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  affected_area   TEXT,
  affected_system TEXT,
  source          TEXT,
  details         TEXT,
  risk_score      INTEGER NOT NULL DEFAULT 0 CHECK(risk_score BETWEEN 0 AND 100),
  severity        TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soc_events_case ON soc_security_events(case_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Mismo modelo que el resto de la app: acceso completo con la anon key
-- (app interna de equipo, sin Supabase Auth ni roles a nivel de BD).

ALTER TABLE soc_cases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE soc_url_analysis    ENABLE ROW LEVEL SECURITY;
ALTER TABLE soc_email_analysis  ENABLE ROW LEVEL SECURITY;
ALTER TABLE soc_file_analysis   ENABLE ROW LEVEL SECURITY;
ALTER TABLE soc_security_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'soc_cases','soc_url_analysis','soc_email_analysis','soc_file_analysis','soc_security_events'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "anon_all_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END
$$;
