-- =============================================================================
-- Tienda Goya — tareas pendientes por planta
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. Solo añade 1 tabla nueva — no modifica ninguna tabla existente.
-- 4. Después, crea el bucket de Storage a mano (Storage → New bucket):
--      nombre: goya-photos · público: sí
--    Este script ya incluye la política de Storage necesaria para poder
--    subir fotos a ese bucket.
-- =============================================================================

CREATE TABLE IF NOT EXISTS goya_tasks (
  id               BIGSERIAL PRIMARY KEY,
  floor            INT NOT NULL,
  title            TEXT NOT NULL,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'inprogress', 'done')),
  responsible_id   BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  photos           TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_by_id    BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goya_tasks_floor  ON goya_tasks(floor);
CREATE INDEX IF NOT EXISTS idx_goya_tasks_status ON goya_tasks(status);

ALTER TABLE goya_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_goya_tasks" ON goya_tasks FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── STORAGE: bucket "goya-photos" ─────────────────────────────────────────
CREATE POLICY "anon_all_goya_photos_objects"
ON storage.objects FOR ALL TO anon
USING (bucket_id = 'goya-photos') WITH CHECK (bucket_id = 'goya-photos');
