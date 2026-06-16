# IKEA Mantenimiento — Gestión de Equipo v2.0

**Aplicación web progresiva (PWA) para la gestión interna del equipo de mantenimiento de IKEA.**
Funciona en cualquier dispositivo: móvil, tablet y escritorio. Instalable en la pantalla de inicio del móvil sin necesidad de tienda de apps.

---

## Autoría y propiedad

| | |
|---|---|
| **Aplicación** | IKEA Mantenimiento |
| **Desarrollado por** | **Manuel Honrado Vega** |
| **Versión** | 2.0.0 |
| **Año** | 2025 |
| **Uso** | Interno · Equipo de Mantenimiento IKEA |

---

## Acceso a la aplicación

| Entorno | URL |
|---|---|
| **Producción (Vercel)** | *(URL de Vercel del proyecto)* |
| **Base de datos** | Supabase (online, gestionada en Render) |
| **Autenticación** | PIN por trabajador |

---

## ¿Qué incluye la aplicación?

### Módulos principales
- **Dashboard** — Vista general del día con KPIs, tareas y **carga de trabajo por persona**
- **Calendario** — Calendario compartido del equipo con vistas mes/semana/lista
- **Mi Área Personal** — Notas personales y solicitudes de material
- **Reparaciones** — Gestión de reparaciones generales con detalle completo al pulsar
- **Rondas de apertura y cierre** — Registro diario de lecturas de contadores *(nuevo en v2)*
- **KONE / Ascensores** — Seguimiento de incidencias con ascensores
- **COMIN / ION** — Trabajos de decoración e infraestructura
- **FOOD / Restaurante** — Incidencias del área de restaurante

### Gestión
- **Equipo** — Gestión de trabajadores con roles y PINs
- **Proveedores** — Base de datos de empresas externas
- **Documentos** — Subida de archivos (PDF, imágenes, Excel…) y enlaces externos *(nuevo en v2)*
- **Informes** — Exportación a PDF *(solo admin)*
- **Configuración** *(solo admin)*

### Características transversales
- **Modo oscuro** — Toggle en el header, se recuerda entre sesiones *(nuevo en v2)*
- **Notificaciones push** — Alerta en tiempo real cuando te asignan una tarea *(nuevo en v2)*
- **PWA instalable** — En móvil: "Añadir a pantalla de inicio" para usarla como app nativa
- **Funciona offline** — Las rutas y la UI se sirven aunque no haya conexión (datos en caché)

---

## Novedades v2.0

### 🌙 Modo oscuro
Toggle sol/luna en el header. Detecta automáticamente la preferencia del sistema. Persiste en `localStorage`.

### 🔔 Notificaciones push
Campana en el header. Cuando alguien te asigna una tarea, recibes:
- Notificación visual en la campana (con contador)
- Notificación nativa del sistema si tienes el permiso concedido
- Funciona gracias a **Supabase Realtime** (requiere activar Realtime en la tabla `tasks` en el dashboard de Supabase)

### 📁 Documentos con subida real de archivos
- Subida de archivos por drag & drop o selector
- Soporte: PDF, imágenes (JPG/PNG/WebP), Excel, Word, archivos genéricos
- Los archivos se guardan en **Supabase Storage** (bucket `documents`)
- Vista previa de imágenes, descarga directa
- Los enlaces a SharePoint/OneDrive siguen funcionando como antes

### 👥 Carga de trabajo por persona en Dashboard
Nueva sección en el Dashboard con una card por cada miembro activo del equipo:
- Número de tareas activas (con código de color: verde/amarillo/rojo)
- Barra de progreso de tareas completadas
- Desglose por estado: Pendiente / En curso / Bloqueada / Finalizada

### 👁️ Detalle de reparaciones al pulsar
Hacer click en cualquier fila de Reparaciones abre un panel de detalle completo:
- Toda la información, fechas, costes desglosados, responsable, materiales
- Botones de editar y eliminar desde el mismo panel

### 📊 Rondas de apertura y cierre (/rondas)
Nueva sección para registrar las rondas diarias de mantenimiento:
- Dos tipos: Apertura y Cierre
- Campos: fecha/hora auto-rellenada, responsable, lectura luz (kWh), agua (m³), arranques bomba jockey (+/-), arranques compresor (+/-), temperatura, observaciones
- Historial en tabla
- **Export PDF** del día con todos los datos

---

## Pasos necesarios en Supabase tras actualizar

> Solo necesitas hacer esto una vez.

### 1. Crear bucket para documentos
En tu proyecto Supabase → **Storage** → **New bucket**
- Nombre: `documents`
- Marcar como **Public**

### 2. Crear tabla de rondas
En Supabase → **SQL Editor** → ejecutar:

```sql
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
```

### 3. Activar Realtime en tabla tasks (para notificaciones)
En Supabase → **Database** → **Replication** → habilitar la tabla `tasks`

---

## Para desarrollar en local

```powershell
cd "C:\Users\myjho\OneDrive\Escritorio\IkeaMantenimiento\AppMantenimiento-main"
npm install
npm run dev
```

Variables de entorno necesarias (`.env`):
```
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Build y despliegue
```powershell
npm run build
```
El despliegue es automático en **Vercel** al hacer push a `master`.

---

## Tecnología

| Componente | Tecnología |
|---|---|
| Framework | React 18 + TypeScript |
| Estilos | Tailwind CSS (con dark mode) |
| Build | Vite 5 |
| Backend / DB | Supabase (PostgreSQL + Storage + Realtime) |
| Autenticación | PIN hasheado con bcryptjs |
| Calendario | FullCalendar 6 |
| PDF | jsPDF + autotable |
| PWA | vite-plugin-pwa + Workbox |
| Despliegue | Vercel (auto-deploy desde GitHub) |

---

## Estructura del proyecto

```
AppMantenimiento/
├── src/
│   ├── App.tsx                      ← Rutas, providers (Theme, Notifications, Auth)
│   ├── contexts/
│   │   ├── AuthContext.tsx           ← Autenticación por PIN
│   │   ├── ThemeContext.tsx          ← Modo oscuro (nuevo v2)
│   │   └── NotificationsContext.tsx  ← Notificaciones Realtime (nuevo v2)
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx               ← Toggle oscuro + campana notificaciones
│   │   └── ui/                      ← Card, Dialog, Button (con dark mode)
│   ├── pages/
│   │   ├── DashboardPage.tsx        ← + carga de trabajo por persona
│   │   ├── CalendarPage.tsx
│   │   ├── RepairsPage.tsx          ← + detalle al pulsar fila
│   │   ├── DocumentsPage.tsx        ← reescrita: subida + enlaces
│   │   ├── RondasPage.tsx           ← NUEVA: apertura/cierre
│   │   └── ...resto de páginas
│   ├── lib/
│   │   ├── supabase.ts              ← Todas las funciones de DB + Storage
│   │   └── utils.ts
│   └── types/index.ts               ← + RondaEntry, WorkerTaskStats, Document
├── database/
│   ├── schema.sql
│   └── supabase_schema.sql
├── public/icons/
├── tailwind.config.js               ← darkMode: 'class'
├── vite.config.ts                   ← PWA config
└── vercel.json
```

---

## 🚀 Próximos pasos — v2.1 (pendiente para próxima sesión)

### 📸 OCR con cámara del móvil para rondas ← PRIORIDAD

**Objetivo:** El técnico abre la sección Rondas desde el móvil, apunta la cámara al contador, y la app lee el número automáticamente y lo introduce en el campo correspondiente.

**Plan de implementación:**
1. Manuel pasa la plantilla Excel con las columnas exactas que usa actualmente para las rondas
2. Se mapean los campos del Excel a los campos de la app (ya preparados: luz, agua, jockey, compresor…)
3. Se integra **OCR en el navegador** con Tesseract.js (gratis, funciona offline) o Google Cloud Vision API (más preciso, de pago)
4. La app usa `getUserMedia` para activar la cámara trasera del móvil
5. Se captura la imagen, se recorta la zona del display del contador, y se extrae el número
6. El número se introduce automáticamente en el campo correspondiente
7. El usuario confirma o corrige si hay error
8. Al guardar, se puede descargar en **PDF formateado** siguiendo exactamente la plantilla Excel proporcionada

**Lo que necesito de Manuel:**
- La plantilla Excel con las columnas, formato y disposición exactos
- Ejemplos de fotos de los contadores (para calibrar el OCR)

**Resultado esperado:**
- Leer el valor → confirmar → guardar → descargar PDF con el formato de la plantilla original pero con los datos del día

---

### Otras mejoras propuestas para v2.1

#### 🔄 Vista de detalle en CalendarPage mejorada
El dialog de detalle de tarea del calendario es funcional pero básico. Mejorar con:
- Mostrar archivos adjuntos vinculados a la tarea
- Cambio de estado directamente desde el detalle (sin abrir el formulario de edición completo)
- Indicador visual de si hay notas/comentarios

#### 📊 Página de Informes mejorada
La página de Informes actual es básica. Propuestas:
- Gráfico de barras de tareas por estado (últimos 30 días)
- Gráfico de costes por área
- Top 5 reparaciones más caras del mes
- Export de todo a PDF en un solo click

#### 🔔 Notificaciones push completas (cuando la app está cerrada)
Las notificaciones actuales funcionan cuando la PWA está abierta. Para recibirlas con la app cerrada se necesita:
- Implementar Web Push con claves VAPID
- Una Supabase Edge Function que envíe la notificación al dispositivo
- El dispositivo guarda su `PushSubscription` en una tabla de Supabase

#### 📋 Panel de incidencias activas del día
Un resumen visible en el Dashboard de todas las incidencias KONE, FOOD y COMIN/ION sin resolver, agrupadas por urgencia. Actualmente cada módulo está separado.

#### 🏷️ Etiquetas / Tags en tareas
Permitir añadir etiquetas personalizadas a las tareas para filtrado cruzado (ej: "preventivo", "correctivo", "contratista", "pendiente presupuesto").

#### 📱 Mejora de dark mode en páginas no actualizadas
Las páginas KONE, FOOD, COMIN/ION, TeamPage, ProvidersPage, MyAreaPage, SettingsPage, LoginPage y ReportsPage aún no tienen clases `dark:` completas. Se pueden actualizar en la siguiente sesión.

#### 🗓️ Historial de rondas por mes
En la página de Rondas, añadir un selector de mes para ver el historial completo y generar el PDF mensual de todas las rondas de ese mes.

---

## Hoja de ruta completa

| Versión | Estado | Descripción |
|---|---|---|
| v1.0 | ✅ Completado | PWA con Supabase, todos los módulos básicos |
| v2.0 | ✅ Completado | Dark mode, notificaciones, documentos, rondas, workload |
| v2.1 | 🔄 Pendiente | OCR con cámara para rondas + PDF con plantilla Excel |
| v2.2 | 📋 Planificado | Mejoras de informes, notificaciones push completas |
| v3.0 | 💡 Idea | App nativa React Native si se necesita más acceso al hardware |

---

*Desarrollado por Manuel Honrado Vega — IKEA Mantenimiento v2.0.0 · 2025*
