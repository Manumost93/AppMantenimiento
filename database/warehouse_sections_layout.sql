-- =============================================================================
-- Almacenes Mantenimiento — plano visual de secciones
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. Solo añade 4 columnas opcionales (nullable) a warehouse_sections — no
--    borra ni modifica ningún dato actual, no rompe nada.
-- =============================================================================

ALTER TABLE warehouse_sections ADD COLUMN IF NOT EXISTS pos_x  NUMERIC;
ALTER TABLE warehouse_sections ADD COLUMN IF NOT EXISTS pos_y  NUMERIC;
ALTER TABLE warehouse_sections ADD COLUMN IF NOT EXISTS width  NUMERIC;
ALTER TABLE warehouse_sections ADD COLUMN IF NOT EXISTS height NUMERIC;
