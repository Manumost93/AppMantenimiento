-- =============================================================================
-- Inventario de carros planos + códigos QR
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. Solo añade 1 tabla nueva — no modifica ninguna tabla existente.
-- 4. Después, crea el bucket de Storage a mano (Storage → New bucket):
--      nombre: cart-photos · público: sí
--    Este script ya incluye la política de Storage necesaria para subir fotos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS carts (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'damaged', 'maintenance', 'retired')),
  location      TEXT,
  notes         TEXT,
  photos        TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_by_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_carts" ON carts FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_cart_photos_objects"
ON storage.objects FOR ALL TO anon
USING (bucket_id = 'cart-photos') WITH CHECK (bucket_id = 'cart-photos');
