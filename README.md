# IKEA Mantenimiento — Gestión de Equipo v2.1

**Aplicación web progresiva (PWA) para la gestión interna del equipo de mantenimiento de IKEA.**  
Funciona en cualquier dispositivo: móvil, tablet y escritorio. Instalable en la pantalla de inicio sin necesidad de tienda de apps.

---

## Autoría y propiedad

| | |
|---|---|
| **Aplicación** | IKEA Mantenimiento |
| **Desarrollado por** | **Manuel Honrado Vega** |
| **Versión** | 2.1.0 |
| **Año** | 2025 |
| **Uso** | Interno · Equipo de Mantenimiento IKEA Alcorcón |

---

## Acceso

| Entorno | URL |
|---|---|
| **Producción (Vercel)** | *(URL de Vercel del proyecto)* |
| **Base de datos** | Supabase (PostgreSQL + Storage + Realtime) |
| **Autenticación** | PIN de 6 dígitos por trabajador (hasheado con bcrypt) |

---

## Módulos disponibles

### Principal
- **Dashboard** — KPIs del día, tareas urgentes, carga de trabajo por persona y gráfico mensual
- **Calendario** — Calendario compartido del equipo con vistas mes/semana/lista (lista por defecto en móvil)
- **Mi Área Personal** — Notas personales y solicitudes de material por trabajador

### Trabajo diario
- **Reparaciones** — Gestión de reparaciones generales con detalle completo
- **Rondas** — Registro de apertura y cierre con lecturas de contadores y export PDF
- **Reuniones** — Guión de reuniones por departamento, orden del día con checklist y descarga de acta en PDF
- **Residuos / Contenedores** — Avisos de vaciado urgente, contenedor extra y previsión de carga con seguimiento de estado

### Áreas técnicas
- **Seguridad** — Incidencias de alarmas, CCTV, PCI, control de accesos, cerrajería y puertas RF
- **KONE / Ascensores** — Seguimiento de incidencias con ascensores
- **COMIN / ION** — Trabajos de decoración e infraestructura con export PDF para externos
- **FOOD / Restaurante** — Incidencias del área de restaurante

### Gestión
- **Equipo** — Gestión de trabajadores con roles y PINs
- **Proveedores / Contactos** — Agenda completa con 51 contactos y proveedores externos
- **Documentos** — Subida de archivos (PDF, imágenes, Excel…) y enlaces externos
- **Informes** — Estadísticas y gráficos *(solo admin)*
- **Configuración** — Secciones, PIN, seguridad *(solo admin)*

### Características transversales
- **Modo oscuro** — Toggle en el header, persiste entre sesiones
- **Notificaciones push** — Alerta en tiempo real cuando te asignan una tarea
- **PWA instalable** — "Añadir a pantalla de inicio" para usarla como app nativa
- **Actualización automática** — Banner de "Nueva versión disponible" al desplegar cambios
- **Banner offline** — Aviso visible cuando no hay conexión
- **Navegación móvil** — Barra inferior con acceso rápido a Calendario, Dashboard, Mi Área, Rondas y Menú

---

## Tablas Supabase necesarias

Ejecutar en **SQL Editor** si no existen:

```sql
-- Rondas
CREATE TABLE IF NOT EXISTS rondas (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('apertura', 'cierre')),
  worker_id BIGINT REFERENCES workers(id),
  lectura_luz NUMERIC(12,2),
  lectura_agua NUMERIC(12,2),
  arranques_jockey INTEGER DEFAULT 0,
  arranques_compresor INTEGER DEFAULT 0,
  temperatura NUMERIC(5,1),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rondas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_access" ON rondas FOR ALL USING (true);

-- Seguridad
CREATE TABLE IF NOT EXISTS security_incidents (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  zone TEXT NOT NULL,
  incident_type TEXT NOT NULL DEFAULT 'other',
  internal_responsible_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  external_company TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  resolution TEXT,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_access" ON security_incidents FOR ALL USING (true);

-- Reuniones
CREATE TABLE IF NOT EXISTS meetings (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TEXT,
  department TEXT NOT NULL DEFAULT 'general',
  participants TEXT,
  agenda JSONB DEFAULT '[]',
  notes TEXT,
  created_by_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_access" ON meetings FOR ALL USING (true);

-- Residuos / Contenedores
CREATE TABLE IF NOT EXISTS waste_requests (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'pickup',
  zone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  resolved_at DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE waste_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_access" ON waste_requests FOR ALL USING (true);
```

### Activar Realtime (notificaciones)
Supabase → **Database** → **Replication** → habilitar la tabla `tasks`

### Bucket de documentos
Supabase → **Storage** → **New bucket** → nombre: `documents` → marcar como Public

---

## Desarrollo local

```powershell
npm install
npm run dev
```

Variables de entorno (`.env`):
```
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

```powershell
npm run build   # build de producción
```

Despliegue automático en **Vercel** al hacer push a `main`.

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Framework | React 18 + TypeScript |
| Estilos | Tailwind CSS (dark mode: class) |
| Build | Vite 5 + lazy loading por página |
| Backend / DB | Supabase (PostgreSQL + Storage + Realtime) |
| Autenticación | PIN de 6 dígitos hasheado con bcryptjs |
| Calendario | FullCalendar 6 |
| PDF | jsPDF + jspdf-autotable |
| PWA | vite-plugin-pwa + Workbox |
| Despliegue | Vercel (auto-deploy desde GitHub) |

---

## Estructura del proyecto

```
src/
├── App.tsx                        ← Rutas lazy + Suspense + UpdatePrompt
├── contexts/
│   ├── AuthContext.tsx             ← PIN 6 dígitos + bcrypt
│   ├── ThemeContext.tsx            ← Modo oscuro
│   └── NotificationsContext.tsx   ← Realtime push
├── components/
│   ├── Layout.tsx                 ← Banner offline + BottomNav
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── BottomNav.tsx              ← Navegación móvil inferior
│   ├── UpdatePrompt.tsx           ← Banner actualización PWA
│   ├── ConfirmDialog.tsx          ← Dialog de confirmación personalizado
│   ├── Skeleton.tsx               ← Componentes de carga animados
│   └── ui/                        ← Card, Dialog (bottom-sheet en móvil), Button
├── pages/
│   ├── DashboardPage.tsx
│   ├── CalendarPage.tsx           ← Vista lista en móvil
│   ├── RepairsPage.tsx
│   ├── RondasPage.tsx
│   ├── MeetingsPage.tsx           ← Nuevo v2.1
│   ├── WastePage.tsx              ← Nuevo v2.1
│   ├── SecurityPage.tsx           ← Nuevo v2.1
│   ├── KonePage.tsx
│   ├── CominIonPage.tsx
│   ├── FoodPage.tsx
│   ├── ProvidersPage.tsx          ← Proveedores + Contactos
│   ├── DocumentsPage.tsx
│   ├── MyAreaPage.tsx
│   ├── ReportsPage.tsx
│   ├── SettingsPage.tsx
│   └── LoginPage.tsx
├── lib/
│   ├── supabase.ts                ← CRUD completo de todas las tablas
│   └── utils.ts
└── types/index.ts
```

---

## Hoja de ruta

| Versión | Estado | Descripción |
|---|---|---|
| v1.0 | ✅ | PWA con Supabase, todos los módulos básicos |
| v2.0 | ✅ | Dark mode, notificaciones, documentos, rondas, workload |
| v2.1 | ✅ | Seguridad, Reuniones, Residuos, lazy loading, PIN 6 dígitos, responsive móvil |
| v2.2 | 📋 | Mejoras de informes, búsqueda global, notificaciones push con app cerrada |

---

*Desarrollado por Manuel Honrado Vega — IKEA Mantenimiento v2.1.0 · 2025*
