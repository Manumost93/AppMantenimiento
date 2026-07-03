# IKEA Mantenimiento — Facility Tech & SmartOps Platform (v3.0)

**Aplicación web progresiva (PWA) real, en uso diario por el equipo de mantenimiento de IKEA Alcorcón**, que centraliza tareas de mantenimiento, incidencias, documentación, proveedores y operaciones internas. Funciona en cualquier dispositivo — móvil, tablet y escritorio — e instalable en la pantalla de inicio sin tienda de apps.

Desde 2026 se está evolucionando de forma incremental hacia una plataforma **SmartOps**: un módulo de **SOC Lite** con análisis defensivo local de enlaces, correos y archivos sospechosos, y un módulo **Edge / Data Center Lite** con inventario de activos críticos, monitorización simulada, cálculo de riesgo por activo y trazabilidad de eventos de seguridad — pensado para demostrar habilidades de Smart Building, Edge Computing y Data Center Operations.

No es una demo ni un proyecto de prueba: es la aplicación real que usa el equipo cada día, evolucionada por fases pequeñas y probadas, sin interrumpir su funcionamiento.

---

## Autoría y propiedad

| | |
|---|---|
| **Aplicación** | IKEA Mantenimiento |
| **Desarrollado por** | **Manuel Honrado Vega** |
| **Versión** | 3.0.0 |
| **Año** | 2026 |
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
- **Dashboard** — KPIs del día, tareas urgentes, carga de trabajo por persona y gráfico mensual. **Actualización automática** en tiempo real.
- **Calendario** — Calendario compartido del equipo con vistas mes/semana/lista (lista por defecto en móvil). **Actualización automática** en tiempo real.
- **Mi Área Personal** — Tareas personales, notas sticky, proveedores favoritos y solicitudes de material por trabajador

### Trabajo diario
- **Reparaciones** — Gestión de reparaciones con fotos adjuntas (cámara + galería), cálculo automático de costes y export PDF
- **Rondas** — Registro de apertura y cierre con lecturas de contadores (OCR para contadores digitales y analógicos), historial 7/30 días/todo, edición de lecturas y export PDF
- **Reuniones** — Guión de reuniones por departamento, orden del día con checklist y descarga de acta en PDF
- **Residuos / Contenedores** — Avisos de vaciado urgente, contenedor extra y previsión de carga

### Áreas técnicas
- **Seguridad** — Incidencias de alarmas, CCTV, PCI, control de accesos, cerrajería y puertas RF
- **KONE / Ascensores** — Revisiones mensuales de 23 equipos + incidencias con cálculo automático de costes
- **COMIN / IOM** — Trabajos de decoración e infraestructura con export PDF para externos
- **FOOD / Restaurante** — Incidencias del área de restaurante
- **CBRE** — Trabajos asignados al servicio FM (CBRE) con fotos adjuntas, countdown de vencimiento y costes estimado/real
- **BMS / Indoor Clima** — Monitorización de equipos de climatización (AHU, FCU, chillers, calderas…) con estados y alertas en tiempo real

### Gestión
- **Equipo** — Gestión de trabajadores con roles y PINs
- **Proveedores / Contactos** — Agenda completa con proveedores y contactos externos
- **Documentos** — Subida de archivos (PDF, imágenes, Excel…) y enlaces externos por área
- **Informes** — Estadísticas y gráficos de costes *(solo admin)*
- **Configuración** — Secciones, PIN, seguridad *(solo admin)*

### SmartOps — Operaciones críticas y seguridad defensiva

- **SOC Lite** — Registro y análisis defensivo de incidentes de seguridad, 100% local (nada se envía a servicios externos):
  - **Analizador de URLs** — HTTPS, IP en vez de dominio, acortadores, suplantación de marca, palabras habituales en phishing → score 0-100 y recomendación
  - **Analizador de correos** — remitente, lenguaje de urgencia/presión, peticiones de datos sensibles, enlaces y adjuntos peligrosos
  - **Triage de archivos** — metadatos (extensión, tamaño, tipo MIME), hash SHA-256 (Web Crypto API nativa del navegador), detección de doble extensión disfrazada — sin ejecutar ni subir el archivo a ningún sitio
  - **Registro de eventos de seguridad** — físicos o lógicos, con severidad y activo afectado opcional
  - Todos los casos se persisten en Supabase y quedan trazados en el **Audit Log**
- **Edge / Data Center Lite** — Inventario y operación de infraestructura crítica (racks, servidores edge, switches, firewalls, SAI, HVAC, CCTV, control de accesos, cuadros eléctricos, generadores...):
  - **Activos Críticos** — CRUD completo, coste de reparación por activo, filtros por tipo/estado/criticidad
  - **Dashboard EdgeOps** — KPIs, gráficas (por tipo, estado, ubicación, severidad) y evolución mensual de eventos, derivado al 100% de datos reales ya persistidos
  - **Monitorización** — sensores simulados (temperatura, humedad, consumo eléctrico, SAI, red, puertas técnicas, CCTV) con reglas de alerta fijas y explicables — sin hardware real conectado
  - **Risk Score** — puntuación 0-100 por activo, calculada en frontend a partir de 6 factores (criticidad, estado, revisiones de mantenimiento, lecturas de sensores recientes, eventos de seguridad vinculados al activo, proveedor asignado)
- **Audit Log** — Trazabilidad de acciones importantes (creación/cierre de casos SOC, altas/bajas de activos críticos), solo visible para administradores

> Todo el análisis de SOC Lite es **estático y defensivo**: no hay escaneo de redes reales, no se ejecutan archivos, no se abren URLs automáticamente y no se envían datos a servicios de terceros. La monitorización de sensores es **simulada**: no hay integración con hardware.

### Características transversales
- **Actualización automática en tiempo real** — Todos los módulos se actualizan al instante cuando otro compañero hace cambios. Sin necesidad de recargar la página.
- **Notificaciones toast** — Feedback visual inmediato en todas las acciones (guardar, eliminar, completar) sin bloquear la pantalla
- **Diálogos de confirmación** — Confirmación contextual para eliminar registros (en lugar de alertas del navegador)
- **Cálculo automático de costes** — En Reparaciones y KONE el coste total se calcula automáticamente al introducir material + mano de obra
- **Fotos adjuntas** — Reparaciones y CBRE permiten adjuntar hasta 8 fotos (cámara trasera o galería) con compresión automática
- **Skeleton loaders** — Indicadores de carga animados consistentes en todas las páginas
- **Modo oscuro** — Toggle en el header, persiste entre sesiones
- **Notificaciones push** — Alerta en tiempo real cuando te asignan una tarea
- **PWA instalable** — "Añadir a pantalla de inicio" para usarla como app nativa
- **Actualización automática** — Banner de "Nueva versión disponible" al desplegar cambios
- **Banner offline** — Aviso visible cuando no hay conexión
- **Navegación móvil** — Barra inferior con acceso rápido a Calendario, Dashboard, Mi Área, Rondas y Menú

---

## Historial de versiones

### v3.0.0 (2026)
**Evolución SmartOps — SOC Lite + Edge / Data Center Lite**

- **SOC Lite** — Página nueva con KPIs, tabs por tipo de caso y tabla de casos. Analizadores de URL, correo y archivo con triage local (hash SHA-256 vía Web Crypto API, sin dependencias nuevas). Registro manual de eventos de seguridad. Persistencia completa en Supabase (`soc_cases` + tablas de detalle por tipo de análisis).
- **Edge / Data Center Lite** — Inventario de activos críticos (17 tipos, criticidad, estado, coste de reparación) con CRUD completo y datos de ejemplo cargables desde la propia app (sin tocar SQL). Dashboard EdgeOps con gráficas SVG/CSS puras, sin librería de charting. Sensores simulados con reglas de alerta fijas (temperatura, humedad, SAI, red, puertas, CCTV). Risk Score por activo con 6 factores explicables, sin IA.
- **Audit Log** — Trazabilidad "fire and forget" (nunca bloquea la acción que audita), conectada a la creación/cierre de casos SOC y altas/bajas de activos críticos.
- Eventos de seguridad vinculables a un activo concreto (`affected_asset_id`), usados por el Risk Score para un cálculo preciso por activo en vez de una aproximación genérica.
- Roadmap de 12 fases implementado de forma incremental: cada fase se probó de forma aislada antes de pasar a la siguiente, sin tocar ningún módulo existente salvo rutas y menú.

### v2.3.0 (2025)
**Realtime, UX y calidad**

- **Tiempo real en toda la app** — Hook `useRealtimeTable` con suscripciones Supabase Realtime en todos los módulos: `tasks`, `general_repairs`, `cbre_jobs`, `security_incidents`, `kone_incidents`, `comin_ion_jobs`, `food_incidents`, `bms_equipment`, `bms_incidents`, `rondas`, `meetings`, `waste_requests`. El Dashboard suscribe a `tasks` + `general_repairs` para refrescar los KPIs automáticamente.
- **Sistema de notificaciones toast** — Nuevo contexto `ToastContext` que reemplaza los 35+ `alert()` de la aplicación. Tipos: success (verde), error (rojo), warning (ámbar), info (azul). Auto-dismiss en 4 s (errores en 6 s). Apilable hasta 5 mensajes. Ahora cada acción exitosa muestra confirmación visual.
- **Diálogos de confirmación globales** — Nuevo contexto `ConfirmContext` que reemplaza los 16+ `confirm()` del navegador. Usa el componente `ConfirmDialog` ya existente con mensajes contextuales por módulo.
- **Cálculo automático de costes** — En Reparaciones (`material_cost + labor_cost`) y KONE (`part_cost + labor_cost`) el `total_cost` se actualiza en tiempo real al teclear. En el formulario de Reparaciones aparece un resumen azul del total estimado.
- **Skeleton loaders consistentes** — Nuevo componente `PageLoading` en `Skeleton.tsx`. Añadido a 10 páginas: Reparaciones, Seguridad, COMIN/IOM, FOOD, Reuniones, CBRE, BMS, Calendario, Proveedores, Dashboard.
- **Toasts de éxito** — Además de los errores, las acciones exitosas muestran feedback: "Reparación creada", "Ronda guardada correctamente", "Tarea completada", etc.

### v2.2.0 (2025)
**Fotos, Rondas mejoradas y nuevos módulos**

- **Fotos en Reparaciones** — Componente `PhotoUpload` con cámara trasera y galería. Compresión automática a JPEG (1920px max, 82%). Lightbox de visualización. Hasta 8 fotos por reparación. Almacenamiento en bucket Supabase `repair-photos`.
- **Fotos en CBRE** — Mismo sistema de fotos en el módulo CBRE.
- **Rondas mejoradas** — OCR a 4× resolución con binarización Otsu y fallback PSM8 para baja confianza. Historial filtrable por 7 días / 30 días / todo. Edición de lecturas desde el historial. Regeneración de PDF local cuando no hay URL en Storage. Indicador de OCR fallido con mensaje de advertencia naranja.
- **Módulo CBRE** — Trabajos FM con tipos (tarea/reparación/PM), countdown de vencimiento con badges (rojo si vencido, ámbar si quedan <7 días), fotos, costes estimado vs real.
- **Módulo BMS / Indoor Clima** — Inventario de equipos de climatización con estados animados (pulse para parado, ping para alarma), incidencias técnicas y cambio rápido de estado.
- **Columna Agua PCI** — Añadida al historial de Rondas.

### v2.1.0 (2025)
**Seguridad, Reuniones, Residuos y responsive móvil**

- Módulo Seguridad (antiintrusión, PCI, CCTV, accesos, emergencias, cerrajería, puertas RF)
- Módulo Reuniones (actas por departamento, checklist de puntos, export PDF)
- Módulo Residuos / Contenedores (flujo pending→requested→resolved)
- Lazy loading en todas las rutas (reduce bundle inicial ~40%)
- PIN de 6 dígitos hasheado con bcrypt
- Vista lista en móvil para el calendario
- Barra de navegación inferior

### v2.0.0 (2025)
- Modo oscuro (toggle persistente)
- Notificaciones push (Supabase Realtime)
- Módulo Documentos (upload + enlaces)
- Módulo Rondas con OCR básico
- Gráfico de carga de trabajo mensual (WorkloadChart)

### v1.0.0 (2025)
- PWA con Supabase, módulos básicos (Calendario, Dashboard, Reparaciones, KONE, COMIN/IOM, FOOD, Equipo, Proveedores, Informes, Configuración, Mi Área)

---

## Configuración Supabase necesaria

### Tablas SQL (ejecutar en SQL Editor si no existen)

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

-- Fotos en reparaciones y CBRE (si no existen las columnas)
ALTER TABLE general_repairs ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE cbre_jobs       ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'::TEXT[];
```

### SQL de SmartOps (ejecutar en orden, carpeta `database/`)

| Fase | Archivo | Qué añade |
|---|---|---|
| SOC Lite | `soc_lite_schema.sql` | `soc_cases`, `soc_url_analysis`, `soc_email_analysis`, `soc_file_analysis`, `soc_security_events` |
| Audit Log | `audit_log_schema.sql` | `audit_logs` |
| Edge Assets | `edge_assets_schema.sql` | `edge_assets` |
| Sensores simulados | `edge_sensor_readings_schema.sql` | `edge_sensor_readings` |
| Vínculo evento↔activo | `edge_security_events_link.sql` | columna `affected_asset_id` en `soc_security_events` |

Todas siguen el mismo patrón que el resto del proyecto: `CREATE TABLE IF NOT EXISTS`, `CHECK` constraints en vez de enums de Postgres, y RLS `anon_all_*` (acceso completo con la anon key — app interna de equipo, sin roles a nivel de base de datos). No modifican ninguna tabla existente.

### Activar Realtime

Supabase → **Database** → **Replication** → habilitar todas las tablas que necesiten tiempo real:
`tasks`, `general_repairs`, `cbre_jobs`, `security_incidents`, `kone_incidents`, `comin_ion_jobs`, `food_incidents`, `bms_equipment`, `bms_incidents`, `rondas`, `meetings`, `waste_requests`, `soc_cases`, `edge_assets`, `audit_logs`

### Buckets de Storage

| Bucket | Visibilidad | Uso |
|---|---|---|
| `documents` | Público | Documentos subidos desde el módulo Documentos |
| `repair-photos` | Público | Fotos de Reparaciones y CBRE |
| `ronda-pdfs` | Público | PDFs generados por las Rondas |

---

## Desarrollo local

```powershell
npm install
npm run dev
```

Variables de entorno (`.env` — **nunca subir al repositorio**):
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
| OCR | Tesseract.js (lectura de contadores) |
| PWA | vite-plugin-pwa + Workbox |
| Despliegue | Vercel (auto-deploy desde GitHub) |
| Hash de archivos (SOC Lite) | Web Crypto API nativa del navegador — sin librería |

El módulo SmartOps (SOC Lite + Edge/Data Center Lite) no añadió ninguna dependencia nueva al proyecto — todo el análisis, las gráficas y el hash de archivos se implementaron con lo que ya había disponible.

---

## Estructura del proyecto

```
src/
├── App.tsx                        ← Rutas lazy + ToastProvider + ConfirmProvider
├── contexts/
│   ├── AuthContext.tsx             ← PIN 6 dígitos + bcrypt
│   ├── ThemeContext.tsx            ← Modo oscuro
│   ├── NotificationsContext.tsx   ← Realtime push
│   ├── ToastContext.tsx            ← Sistema de notificaciones toast (v2.3)
│   └── ConfirmContext.tsx          ← Diálogos de confirmación globales (v2.3)
├── hooks/
│   └── useRealtimeTable.ts         ← Hook de suscripción Supabase Realtime (v2.3)
├── components/
│   ├── Layout.tsx                 ← Banner offline + BottomNav
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── BottomNav.tsx              ← Navegación móvil inferior
│   ├── UpdatePrompt.tsx           ← Banner actualización PWA
│   ├── ConfirmDialog.tsx          ← Dialog de confirmación personalizado
│   ├── PhotoUpload.tsx            ← Subida de fotos con cámara/galería (v2.2)
│   ├── Skeleton.tsx               ← PageLoading, SkeletonCard, SkeletonTable, SkeletonKpis
│   ├── UrlAnalyzer.tsx            ← Analizador de URLs (v3.0)
│   ├── EmailAnalyzer.tsx          ← Analizador de correos (v3.0)
│   ├── FileTriageAnalyzer.tsx     ← Triage de archivos + hash SHA-256 (v3.0)
│   ├── SecurityEventForm.tsx      ← Registro de eventos de seguridad (v3.0)
│   └── ui/                        ← Card, Dialog (bottom-sheet en móvil), Button, Badge
├── pages/
│   ├── DashboardPage.tsx          ← Realtime en tasks + general_repairs
│   ├── CalendarPage.tsx           ← Realtime en tasks
│   ├── RepairsPage.tsx            ← Fotos + auto-coste + Realtime
│   ├── RondasPage.tsx             ← OCR mejorado + historial + edición + Realtime
│   ├── MeetingsPage.tsx           ← Realtime en meetings
│   ├── WastePage.tsx              ← Realtime en waste_requests
│   ├── SecurityPage.tsx           ← Realtime en security_incidents
│   ├── KonePage.tsx               ← Auto-coste + Realtime en kone_incidents
│   ├── CominIonPage.tsx           ← Realtime en comin_ion_jobs
│   ├── FoodPage.tsx               ← Realtime en food_incidents
│   ├── CBREPage.tsx               ← Fotos + countdown vencimiento + Realtime
│   ├── BmsPage.tsx                ← Equipos + incidencias + Realtime (doble tabla)
│   ├── ProvidersPage.tsx
│   ├── DocumentsPage.tsx
│   ├── MyAreaPage.tsx
│   ├── ReportsPage.tsx
│   ├── SettingsPage.tsx
│   ├── LoginPage.tsx
│   ├── SocLitePage.tsx            ← SOC Lite: KPIs, tabs, tabla de casos (v3.0)
│   ├── EdgeAssetsPage.tsx         ← Inventario de activos + Risk Score (v3.0)
│   ├── EdgeOpsDashboardPage.tsx   ← Dashboard EdgeOps (v3.0)
│   ├── EdgeMonitoringPage.tsx     ← Sensores simulados (v3.0)
│   └── AuditLogPage.tsx           ← Audit Log, solo admin (v3.0)
├── lib/
│   ├── supabase.ts                ← CRUD completo + uploadRepairPhoto + patchRepairPhotos
│   ├── utils.ts
│   ├── soc.ts                     ← Tipos + analyzeUrl/analyzeEmail/analyzeFile (v3.0)
│   ├── edgeAssets.ts               ← Tipos compartidos + computeRackRisk() (v3.0)
│   ├── edgeSensors.ts              ← Reglas de sensores + generador simulado (v3.0)
│   └── edgeRisk.ts                 ← calculateEdgeAssetRisk() (v3.0)
└── types/index.ts                 ← 25+ modelos de datos (GeneralRepair con photos[], EdgeAsset, AuditLog, etc.)
```

---

## Habilidades demostradas

Este proyecto es real, usado a diario, y sirve como muestra práctica de:

- **Frontend**: React 18, TypeScript, arquitectura de componentes, gestión de estado, formularios, tablas/filtros/dashboards sin librerías pesadas
- **Backend / datos**: Supabase (PostgreSQL, Realtime, Storage), diseño de modelos de datos, RLS, CRUD real sobre una base de datos en producción
- **Seguridad defensiva**: SOC Lite (análisis estático de URLs/correos/archivos, reglas explicables, sin IA ni escaneo ofensivo), trazabilidad con Audit Log
- **Facility Management / Smart Building**: mantenimiento preventivo, gestión de proveedores e incidencias en un entorno real (IKEA Alcorcón)
- **Edge Computing / Data Center Operations**: inventario de activos críticos, monitorización ambiental simulada, cálculo de riesgo por activo
- **Automatización y análisis de riesgo**: reglas de scoring propias (URL, correo, archivo, Risk Score de activos), sin dependencias externas
- **PWA**: aplicación instalable, funcionamiento offline básico, actualización automática
- **Despliegue**: Vercel con auto-deploy desde GitHub
- **Documentación y trabajo por fases**: roadmap incremental de 12 fases, cada una con SQL propuesto, probada de forma aislada y sin romper producción

## Capturas recomendadas

Para presentar el proyecto (README, portfolio, LinkedIn), las vistas que mejor lo representan son: Dashboard principal, SOC Lite (listado de casos + un analizador con resultado), Dashboard EdgeOps (KPIs y gráficas), y una tarjeta de Activos Críticos con su Risk Score. *(Pendiente de añadir capturas reales — no incluidas aquí para no usar datos de producción.)*

---

## Hoja de ruta

| Versión | Estado | Descripción |
|---|---|---|
| v1.0 | ✅ | PWA con Supabase, todos los módulos básicos |
| v2.0 | ✅ | Dark mode, notificaciones, documentos, rondas, workload |
| v2.1 | ✅ | Seguridad, Reuniones, Residuos, lazy loading, PIN 6 dígitos, responsive móvil |
| v2.2 | ✅ | Fotos en Reparaciones/CBRE, Rondas mejoradas (OCR+historial+edición), módulos CBRE y BMS |
| v2.3 | ✅ | Tiempo real en toda la app, sistema toast, confirm global, auto-coste, skeleton loaders |
| v2.4 | 📋 | Fotos en FOOD/Seguridad/KONE, export PDF en más módulos, búsqueda global |
| v3.0 | ✅ | SOC Lite (analizadores + eventos), Edge/Data Center Lite (activos, dashboard, sensores, Risk Score), Audit Log |
| v3.1 | 📋 | Integrar Audit Log en login (correcto/fallido) — pendiente por ser el flujo más sensible de la app |
| v3.2 | 📋 | Historial de costes de reparación por activo (tabla dedicada, en vez del campo acumulado actual) |

---

*Desarrollado por Manuel Honrado Vega — IKEA Mantenimiento v3.0.0 · 2026*
