-- ============================================================
-- IKEA Mantenimiento - Datos iniciales de ejemplo
-- Desarrollado por Manuel Honrado Vega
-- ============================================================

-- Configuración inicial
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('app_name',      'IKEA Mantenimiento'),
  ('creator',       'Manuel Honrado Vega'),
  ('version',       '1.0.0'),
  ('user_role',     'admin'),
  ('db_initialized','true');

-- Áreas
INSERT OR IGNORE INTO areas (id, name, color) VALUES
  (1, 'KONE / Ascensores',  '#EF4444'),
  (2, 'FOOD / Restaurante',  '#F97316'),
  (3, 'COMIN / ION',         '#8B5CF6'),
  (4, 'Electricidad',        '#10B981'),
  (5, 'Fontanería',          '#3B82F6'),
  (6, 'Climatización',       '#06B6D4'),
  (7, 'General',             '#6B7280'),
  (8, 'Exterior / Parking',  '#84CC16');

-- Compañeros de equipo
INSERT OR IGNORE INTO team_members (id, name, role, color, active) VALUES
  (1, 'Carlos López',   'Técnico Senior',      '#3B82F6', 1),
  (2, 'María García',   'Electricidad',        '#10B981', 1),
  (3, 'Juan Martínez',  'Fontanería',          '#F59E0B', 1),
  (4, 'Ana Rodríguez',  'KONE / Ascensores',   '#EF4444', 1),
  (5, 'Pedro Sánchez',  'Mantenimiento Gral.', '#8B5CF6', 1),
  (6, 'Luis Fernández', 'Climatización',       '#06B6D4', 1),
  (7, 'Elena Díaz',     'FOOD / Restaurante',  '#F97316', 1);

-- Proveedores
INSERT OR IGNORE INTO providers (id, name, contact_person, phone, area, active) VALUES
  (1, 'KONE',              'Miguel Torres',   '900 123 456', 'Ascensores',        1),
  (2, 'ION',               'Sara Pérez',      '912 345 678', 'Decoración',        1),
  (3, 'COMIN',             'Roberto García',  '915 678 901', 'Decoración',        1),
  (4, 'PCI Sistemas',      'Laura Martín',    '916 789 012', 'Contra incendios',  1),
  (5, 'Climatec',          'David Sánchez',   '917 890 123', 'Climatización',     1),
  (6, 'Electra Pro',       'Ana Fernández',   '918 901 234', 'Electricidad',      1),
  (7, 'AquaFix',           'Carlos Ruiz',     '919 012 345', 'Fontanería',        1),
  (8, 'MantenimientoXXI',  'Isabel López',    '911 234 567', 'General',           1);

-- Tareas de ejemplo para hoy
INSERT OR IGNORE INTO tasks (id, title, description, date, start_time, end_time, area_id, event_type, responsible_id, priority, status, estimated_cost) VALUES
  (1,  'Revisión cuadro eléctrico zona caja',     'Revisión completa del cuadro eléctrico',   date('now'), '08:00', '10:00', 4, 'task',           1, 'high',   'inprogress', 0),
  (2,  'Reparación puerta almacén logístico',     'Puerta seccional no cierra correctamente', date('now'), '11:00', '12:30', 7, 'task',           1, 'medium', 'pending',    120),
  (3,  'Coordinación visita ION',                 'Coordinar retirada decoración temporada',  date('now'), '14:30', '15:30', 3, 'provider_visit', 1, 'medium', 'pending',    0),
  (4,  'Cambio fluorescentes zona textil',        'Sustitución de 4 fluorescentes',           date('now'), '08:30', '09:30', 4, 'task',           2, 'low',    'done',       45),
  (5,  'Revisión inst. eléctrica restaurante',    'Revisión periódica por incidencia',        date('now'), '10:00', '12:00', 2, 'task',           2, 'high',   'inprogress', 0),
  (6,  'URGENTE: Fuga de agua en restaurante',   'Fuga activa bajo fregadero cocina',        date('now'), '07:30', NULL,    2, 'incident',       3, 'urgent', 'inprogress', 200),
  (7,  'Cambio grifo servicios planta baja',      'Grifo deteriorado en servicios clientes',  date('now'), '13:00', '14:00', 5, 'task',           3, 'medium', 'pending',    80),
  (8,  'Revisión ascensor A1 - KONE',             'Revisión mensual obligatoria con KONE',    date('now'), '10:00', '11:30', 1, 'maintenance',    4, 'high',   'inprogress', 350),
  (9,  'Mantenimiento mensual ascensor B2',       'Mantenimiento preventivo mensual',         date('now'), '12:00', '13:30', 1, 'maintenance',    4, 'medium', 'pending',    280),
  (10, 'Pintado pared zona muebles',              'Retoque de pintura por golpe transpaleta', date('now'), '09:00', '11:00', 7, 'task',           5, 'low',    'pending',    30),
  (11, 'Reparación carrito de compra #247',       'Rueda bloqueada del carrito 247',          date('now'), '11:30', '12:00', 7, 'task',           5, 'low',    'done',       15),
  (12, 'Inspección general zona almacén',         'Recorrido de inspección por almacén',      date('now'), '14:00', '15:30', 7, 'task',           5, 'medium', 'inprogress', 0),
  (13, 'Revisión climatización sala descanso',    'AC no enfría. Pendiente de pieza.',        date('now'), '09:00', '10:00', 6, 'task',           6, 'high',   'blocked',    180),
  (14, 'Mantenimiento filtros AC showroom',       'Limpieza y sustitución de filtros',        date('now'), '11:00', '13:00', 6, 'maintenance',    6, 'medium', 'pending',    60),
  (15, 'URGENTE: Cámara frigorífica averiada',   'Temperatura incorrecta. Producto en riesgo.', date('now'), '07:00', NULL, 2, 'incident',      7, 'urgent', 'inprogress', 500),
  (16, 'Revisión extractores cocina',             'Revisión sistema extracción humos',        date('now'), '15:00', '16:30', 2, 'maintenance',    7, 'high',   'pending',    120);

-- Incidencias KONE de ejemplo
INSERT OR IGNORE INTO kone_incidents (id, date, elevator, incident_type, description, external_company, external_technician, internal_responsible_id, part_cost, labor_cost, status, priority) VALUES
  (1, date('now'), 'Ascensor A1', 'Revisión mensual', 'Revisión mensual obligatoria', 'KONE', 'Miguel Torres', 4, 0, 350, 'inprogress', 'high'),
  (2, date('now','-3 days'), 'Ascensor B2', 'Avería puerta', 'Puerta no cierra en planta 1', 'KONE', 'Luis Vega', 4, 180, 220, 'done', 'high'),
  (3, date('now','-5 days'), 'Escalera mecánica 1', 'Parada emergencia', 'Objeto atrapado en escalera', 'KONE', 'Carlos Díaz', 4, 0, 150, 'done', 'urgent');
