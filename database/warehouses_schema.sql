-- =============================================================================
-- Almacenes Mantenimiento — inventario interactivo
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. Solo añade 3 tablas nuevas — no modifica ninguna tabla existente.
-- 4. Después, crea el bucket de Storage a mano (Storage → New bucket):
--      nombre: warehouse-photos · público: sí
--    IMPORTANTE (lección aprendida con el modelo 3D del edificio): marcar
--    el bucket como "Public" solo permite LEER los archivos, no subirlos.
--    Este script ya incluye la política de Storage necesaria para poder
--    subir fotos — no hace falta añadir nada más a mano.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouses (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  location   TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouse_sections (
  id           BIGSERIAL PRIMARY KEY,
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  photos       TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouse_items (
  id            BIGSERIAL PRIMARY KEY,
  section_id    BIGINT NOT NULL REFERENCES warehouse_sections(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  quantity      NUMERIC NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'uds',
  notes         TEXT,
  photos        TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_by_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_sections_warehouse ON warehouse_sections(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_section      ON warehouse_items(section_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Mismo modelo que el resto de la app: acceso completo con la anon key.

ALTER TABLE warehouses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_items    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_warehouses"         ON warehouses         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_warehouse_sections" ON warehouse_sections FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_warehouse_items"    ON warehouse_items    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── STORAGE: bucket "warehouse-photos" ───────────────────────────────────
-- Crea el bucket a mano en el dashboard (Storage → New bucket → público),
-- y luego ejecuta esto para poder subir archivos a él:

CREATE POLICY "anon_all_warehouse_photos_objects"
ON storage.objects FOR ALL TO anon
USING (bucket_id = 'warehouse-photos') WITH CHECK (bucket_id = 'warehouse-photos');
