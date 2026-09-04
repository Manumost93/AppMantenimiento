-- =============================================================================
-- Almacenes Mantenimiento — inventario de racking del taller
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com → SQL Editor → New query
-- 2. Pega todo este contenido y ejecuta (Run)
-- 3. Solo añade 1 columna opcional a "warehouses" — no borra ni modifica
--    ningún dato actual (tus almacenes existentes quedan como
--    kind='warehouse' automáticamente).
-- =============================================================================
-- Reutiliza las mismas tablas de almacenes (warehouses/warehouse_sections/
-- warehouse_items): un "racking" es, a efectos de datos, un almacén con
-- kind='rack' — mismo modelo de secciones/artículos con cantidad+unidad+fotos,
-- solo cambia cómo se dibuja (vista frontal en vez de plano de planta).

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'warehouse';
ALTER TABLE warehouses ADD CONSTRAINT warehouses_kind_check CHECK (kind IN ('warehouse', 'rack'));
