-- Añadir campo is_admin a la tabla workers
ALTER TABLE workers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Para hacer a alguien admin, ejecuta esto con su nombre:
-- UPDATE workers SET is_admin = true WHERE name = 'Tu Nombre';
