# Codex Task: Rediseño de pantalla de Inicio — Finnon

## Contexto

Esta tarea modifica la pantalla de **Inicio** (Home) en ambas plataformas (web Next.js + mobile React Native/Expo) para implementar dos cambios de diseño:

1. **Fusionar Calendario + Programados** en un solo widget
2. **Reemplazar el widget de Objetivo + la timeline de último/próximo** por un widget fusionado **Proyecto + Objetivo**

El wireframe de referencia está en el archivo `finnon-home-v2.jsx` (artifact React interactivo). **Hay que ser fiel al wireframe** en estructura, jerarquía visual, colores y comportamiento.

---

## Arquitectura existente (NO cambiar)

### Patrón de datos

El Home actual usa **fetch imperativo + estado local + derivados memoizados**. NO hay store global ni React Query para esta pantalla. Mantener este patrón:

**Mobile (`index.tsx`):**
- `useState` + `useEffect` para fetch de datos (dependiente de sesión, usuario, `useIsFocused`, mes visible)
- `selectedAccountId` viene de `AuthContext` (persistido en AsyncStorage)
- Todos los derivados se calculan con `useMemo`
- Los datos se refrescan por foco de pantalla y cambios de período

**Web:**
- `page.tsx` (Server Component): consulta Supabase en cada request (cuentas, movimientos, obligaciones, goal) y pasa props al cliente
- `HomePageClient.tsx` (Client Component): NO fetchea, solo gestiona estado de interacción (vista semana/mes, período, día seleccionado) y derivados con `useMemo`

### Componentes

Mixto: algunos componentes viven en `@poleursus/shared`, otros son específicos por plataforma. Seguir el mismo patrón que los componentes existentes en Home. Si un componente nuevo es lógica pura o un tipo compartido, va en shared. Si es UI específica de plataforma, va en la plataforma correspondiente.

### Tabla de proyectos

La tabla `projects` **ya existe en Supabase**. Los campos relevantes para esta tarea son:

```
projects:
  id: uuid
  account_id: uuid (FK cuenta compartida)
  name: text
  emoji: text
  target_amount: numeric
  monthly_commitment: numeric (nullable)
  priority: integer (1 = más importante)
  status: enum (active, completed, paused, cancelled)
  created_at: timestamp
```

La tabla `project_contributions` puede no existir aún. Para esta tarea **no se necesita** — el progreso (`total_saved`) se derivará del balance acumulado o de los datos disponibles.

---

## Cambio 1: Fusionar Calendario + Programados

### Qué eliminar

- **Eliminar la sección "Programados"** como bloque separado (el card independiente con la lista de gastos programados)

### Qué modificar

El widget de **Calendario** existente se extiende para incluir el siguiente evento programado. La estructura final del widget es:

```
┌─────────────────────────────────────┐
│ Calendario                Semana Mes│
│                                     │
│    ‹  23 feb – 1 mar  ›            │
│                                     │
│  LUN MAR MIÉ JUE VIE SÁB DOM      │
│  23  24  ●25  26  27  28   1       │
│              •                •     │
│                                     │
│  Ingresos +€0  Gastos -€45  Neto   │
│─────────────────────────────────────│
│  MIÉRCOLES, 25 DE FEBRERO           │
│  ↓ Mapfre seguro                    │
│    Transporte            -€45,00    │
│─────────────────────────────────────│
│  PRÓXIMO PROGRAMADO    Ver todos →  │
│  ⏱ Spotify                          │
│    28 feb · Ocio         -€10,99    │
└─────────────────────────────────────┘
```

### Comportamiento

**Día seleccionado:**
- Al tocar/clicar un día del calendario, se muestran los movimientos de ese día (ya existe esta funcionalidad)
- Si no hay movimientos: mostrar "No hay movimientos este día."

**Próximo programado:**
- Mostrar el **siguiente evento programado posterior al día seleccionado** (no el día siguiente del calendario literalmente)
- Si el día seleccionado es el 25, y el siguiente programado es el 28, mostrar el del 28
- Si no hay eventos programados futuros en el período visible, no mostrar la sección
- El icono del próximo programado usa color `accentWarm` (#FFB74D) con icono ⏱ para diferenciarlo visualmente de los movimientos del día
- **"Ver todos →"**: enlace a la vista completa de programados (misma navegación que el "Ver todos →" actual del bloque de Programados)

**Dots en el calendario:**
- Los días con movimientos registrados o programados muestran un dot debajo del número
- Color del dot: `danger` (#FF6B6B) para el día no seleccionado, `primary` (#5B8DFF) para el día seleccionado

### Datos

- **Movimientos del día:** ya disponibles en el estado actual (`transactions` filtradas por fecha)
- **Próximo programado:** ya disponibles en el estado actual (`obligations` / movimientos programados). Filtrar por `date > selectedDate` y tomar el primero ordenado por fecha

---

## Cambio 2: Widget fusionado Proyecto + Objetivo

### Qué eliminar

- **Eliminar el widget de timeline "Último / Próximo"** (el card que muestra el último movimiento a la izquierda, HOY en el centro, y el próximo movimiento a la derecha)
- **Eliminar el widget de "Objetivo"** como bloque independiente

### Qué añadir

Un nuevo widget fusionado que combina el proyecto con prioridad #1 y el estado del objetivo mensual. Este widget **reemplaza ambos bloques eliminados**.

### Estructura del widget — Estado: Proyecto activo

```
┌─────────────────────────────────────┐
│ 🏰 Eurodisney          Ver detalle →│
│     €1.850 de €6.000                │
│                                     │
│ ████████░░░░░░░░░░░░                │
│ 31%                    📅 abril 2027│
│─────────────────────────────────────│
│ ✓ Vas bien · Ahorrar €500 en feb   │
│                                     │
│ ████████████████████████████░░  │   │
│ €1.372 ahorrado        de €500     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Este mes acercas Eurodisney un  │ │
│ │ 6% más. Sigue así para cumplir  │ │
│ │ el objetivo.                    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Estructura del widget — Estado: Sin proyectos

```
┌─────────────────────────────────────┐
│              ✨                      │
│       ¿Tenéis un sueño?            │
│    Cread vuestro primer proyecto    │
│    y empezad a acercarlo.           │
│                                     │
│        [ Crear proyecto ]           │
└─────────────────────────────────────┘
```

### Estructura del widget — Estado: Proyecto #1 completado

```
┌─────────────────────────────────────┐
│              🏰                      │
│    ¡Eurodisney conseguido!          │
│    Habéis ahorrado €6.000           │
│    en 14 meses                      │
│              🎉                      │
│                                     │
│        [ Ver proyecto → ]           │
└─────────────────────────────────────┘
```

Fondo: `accentDim` con borde `rgba(74,234,177,0.25)`.

### Estructura del widget — Estado: Todos los proyectos completados

```
┌─────────────────────────────────────┐
│              🌟                      │
│    ¡Habéis cumplido todos           │
│    vuestros proyectos!              │
│    ¿Cuál es el siguiente sueño?    │
│                                     │
│        [ Nuevo proyecto ]           │
└─────────────────────────────────────┘
```

### Lógica de estados

Determinar el estado del widget con esta prioridad:

```typescript
function getProjectWidgetState(projects: Project[], goal: Goal | null) {
  const activeProjects = projects
    .filter(p => p.status === 'active')
    .sort((a, b) => a.priority - b.priority);
  
  const completedProjects = projects.filter(p => p.status === 'completed');
  
  if (activeProjects.length === 0 && completedProjects.length === 0) {
    return { state: 'empty' };
  }
  
  if (activeProjects.length === 0 && completedProjects.length > 0) {
    // Mostrar el último completado como celebración
    const lastCompleted = completedProjects
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
    return { state: 'all_done', project: lastCompleted };
  }
  
  // Hay proyectos activos: mostrar el de prioridad #1
  const topProject = activeProjects[0];
  
  // Comprobar si hay algún recién completado que celebrar
  // (completado en los últimos 7 días — mostrar celebración temporalmente)
  const recentlyCompleted = completedProjects.find(p => {
    const daysSinceCompletion = (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCompletion <= 7;
  });
  
  if (recentlyCompleted) {
    return { state: 'completed', project: recentlyCompleted };
  }
  
  return { state: 'active', project: topProject, goal };
}
```

### Datos necesarios

**Para el proyecto (parte superior del widget):**

```typescript
// Consulta: proyecto activo con prioridad #1 de la cuenta
const { data: topProject } = await supabase
  .from('projects')
  .select('*')
  .eq('account_id', accountId)
  .eq('status', 'active')
  .order('priority', { ascending: true })
  .limit(1)
  .single();

// Campos derivados (client-side):
const totalSaved = topProject.total_saved ?? 0; // Si existe campo acumulado
const progress = totalSaved / topProject.target_amount;
const remaining = topProject.target_amount - totalSaved;
const monthsLeft = topProject.monthly_commitment > 0 
  ? remaining / topProject.monthly_commitment 
  : null;
const estimatedDate = monthsLeft 
  ? new Date(Date.now() + monthsLeft * 30.44 * 24 * 60 * 60 * 1000) 
  : null;
```

**Para el objetivo (parte inferior del widget):**
- Reutilizar la misma consulta/datos del objetivo mensual que ya existe en Home
- El goal actual (`goal.target_amount`, progreso mensual, etc.) se muestra integrado

**Para la lista de todos los proyectos (determinar estado):**

```typescript
const { data: allProjects } = await supabase
  .from('projects')
  .select('id, status, priority, updated_at, name, emoji, target_amount')
  .eq('account_id', accountId)
  .in('status', ['active', 'completed']);
```

### Fetch e integración con el patrón existente

**Mobile:**
Añadir un `useEffect` para cargar los proyectos, siguiendo el mismo patrón que las otras queries:

```typescript
// Junto a los otros useEffect de carga de datos
useEffect(() => {
  if (!selectedAccountId || !session) return;
  
  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('account_id', selectedAccountId)
      .in('status', ['active', 'completed']);
    
    setProjects(data ?? []);
  };
  
  fetchProjects();
}, [selectedAccountId, session, isFocused]);

// Derivado con useMemo
const projectWidgetState = useMemo(() => {
  return getProjectWidgetState(projects, goal);
}, [projects, goal]);
```

**Web:**
Añadir la consulta de proyectos en `page.tsx` (Server Component) y pasar el resultado como prop a `HomePageClient.tsx`:

```typescript
// En page.tsx, junto a las otras consultas
const { data: projects } = await supabase
  .from('projects')
  .select('*')
  .eq('account_id', accountId)
  .in('status', ['active', 'completed']);

// Pasar a HomePageClient
<HomePageClient 
  // ...props existentes
  projects={projects ?? []}
/>
```

---

## Paleta de colores de referencia

Usar los tokens de diseño existentes en el proyecto. Si alguno no existe, crearlo siguiendo la convención actual:

| Token | Hex | Uso |
|-------|-----|-----|
| bg | #1A1A1A | Fondo principal |
| bgCard | #242424 | Fondo de cards |
| bgInput | #1E1E1E | Fondo de inputs, barras de progreso vacías, bloques de texto secundario |
| primary | #5B8DFF | Acento principal, links, barra de progreso proyecto |
| primaryDim | rgba(91,141,255,0.15) | Fondo de badges, selección de día |
| accent | #4AEAB1 | Positivo, completado, porcentaje, barra de objetivo |
| accentDim | rgba(74,234,177,0.12) | Fondo del estado completado |
| accentWarm | #FFB74D | Próximo programado, estados sin plan |
| danger | #FF6B6B | Gastos, dots de movimientos |
| text | #FAFAF8 | Texto principal |
| textMuted | #9E9E9E | Texto secundario |
| textDim | #666 | Texto terciario, labels |
| border | #333 | Bordes de cards, separadores |

---

## Layout final de la pantalla de Inicio (móvil)

```
Balance del mes (€1.372,06 — Febrero de 2026)
    ↓
Calendario unificado
  ├── Navegación semana/mes
  ├── Grid de días con dots
  ├── Resumen semanal (ingresos/gastos/neto)
  ├── ── separador ──
  ├── Movimientos del día seleccionado
  ├── ── separador ──
  └── Próximo programado + "Ver todos →"
    ↓
Widget Proyecto + Objetivo (fusionado)
  ├── Proyecto prioritario (emoji, nombre, progreso, fecha)
  ├── ── separador ──
  └── Objetivo mensual (estado, barra, ahorrado, copy motivacional)
```

**Desktop (web):** mantener la disposición en dos columnas si ya existe. El calendario unificado ocupa la columna izquierda, el widget Proyecto + Objetivo ocupa la columna derecha. La timeline de último/próximo y el bloque de Programados desaparecen en ambas vistas.

---

## Navegación y acciones

| Elemento | Acción |
|----------|--------|
| "Ver detalle →" en el proyecto | Navegar a `/proyectos/{id}` (web) o pantalla de detalle de proyecto (mobile) |
| "Ver todos →" en próximo programado | Navegar a la vista de programados (misma ruta/pantalla que el "Ver todos →" actual) |
| "Crear proyecto" (estado vacío) | Navegar a la pantalla de creación de proyecto |
| "Nuevo proyecto" (todos completados) | Navegar a la pantalla de creación de proyecto |
| "Ver proyecto →" (completado) | Navegar al detalle del proyecto completado |
| Día del calendario | Seleccionar día y mostrar sus movimientos (comportamiento existente) |

---

## Tipografía

Usar **DM Sans** como fuente principal (ya en uso en el proyecto). Pesos:

- Números grandes (balance, cantidades): 800
- Títulos de sección: 700
- Labels activos: 600
- Texto normal: 500/400
- Texto secundario: 400

---

## Checklist de validación

Antes de dar la tarea por terminada, verificar:

- [ ] La timeline "Último / Próximo" ha sido eliminada en ambas plataformas
- [ ] El bloque "Programados" como sección independiente ha sido eliminado en ambas plataformas
- [ ] El calendario muestra el próximo evento programado tras el día seleccionado
- [ ] "Ver todos →" dentro del calendario navega a la lista completa de programados
- [ ] El widget fusionado muestra el proyecto con prioridad #1 + objetivo mensual
- [ ] Los 4 estados del widget funcionan: activo, sin proyectos, completado, todos completados
- [ ] El CTA de "Crear proyecto" / "Nuevo proyecto" navega correctamente
- [ ] "Ver detalle →" navega al detalle del proyecto
- [ ] El patrón de datos NO ha cambiado (no se ha introducido store global ni React Query)
- [ ] Mobile: datos se refrescan por foco de pantalla
- [ ] Web: consulta de proyectos se hace en Server Component
- [ ] Colores, tipografía y espaciado son fieles al wireframe `finnon-home-v2.jsx`
- [ ] Funciona en ambas plataformas (web + mobile)
- [ ] No hay regresiones en funcionalidad existente del calendario
