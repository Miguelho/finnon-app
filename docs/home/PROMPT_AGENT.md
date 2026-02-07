# Prompt: Integrar nueva pantalla de Inicio en Finnon

## Contexto

Finnon es una app web de finanzas personales (React + Tailwind). Estoy rediseñando la pantalla de Inicio ("Home"). Adjunto los componentes React con Tailwind ya maquetados y un wireframe HTML de referencia (`finnon-inicio-v3.html`). Tu trabajo es integrarlos en el codebase existente, adaptándote a las convenciones del proyecto.

## Referencia visual

El archivo `finnon-inicio-v3.html` es el wireframe interactivo de referencia. Ábrelo en el navegador para entender el diseño. Tiene:
- Toggle "Con datos / Estado vacío" para ver ambos estados
- Calendario con toggle Semana/Mes
- Dropdown de notificaciones (clic en el sobre del nav)
- Responsive (reduce el viewport para ver el mobile bottom nav)

**El diseño del wireframe es la fuente de verdad visual. Si algo en los componentes React no coincide con el wireframe, el wireframe gana.**

## Arquitectura de la pantalla

La pantalla de Inicio responde a: **"¿Qué necesito saber y hacer esta semana?"**

### Layout
- Desktop: 2 columnas — `1fr 340px`
- Tablet (<900px): 1 columna
- Mobile (<640px): 1 columna con bottom tab nav

### Orden de componentes (de arriba a abajo)
1. **BalanceHeader** — Balance neto del mes de la cuenta activa (centrado)
2. **Columna izquierda:**
   - **Timeline** — Último movimiento ← Hoy → Próximo movimiento
   - **Calendar** — Calendario semanal (default) con toggle a mensual. Incluye detalle del día seleccionado
3. **Columna derecha:**
   - **ObjectiveCard** — Indicador del objetivo mensual con barra de progreso, mensaje contextual y racha
   - **ProgrammedCard** — Próximos 3 movimientos programados con "Ver todos →"

### Estados vacíos
- Si no tiene movimientos: la columna izquierda muestra un `EmptyStateCard` con CTA "Añadir movimiento"
- Si no tiene objetivo: la columna derecha muestra un `EmptyStateCard` con CTA "Crear objetivo"
- Cada empty state es independiente (puede haber movimientos pero no objetivo, o viceversa)

### Navbar (cambios globales)
- Añadir un botón **"+ Añadir"** prominente en el nav. Estilo: `bg-gray-900 text-white rounded-full px-4 py-1.5 font-semibold text-sm`. En móvil (<640px), mostrar solo el icono "+" sin texto.
- Añadir un **NotificationDropdown** (icono de sobre con badge). Al hacer clic, despliega un dropdown con actividad de otros usuarios de la cuenta. Cada notificación tiene un CTA "Ver →" que navega a la pantalla de Movimientos.
- En móvil, el nav se convierte en un **bottom tab bar** fijo con: Inicio, Movimientos, botón "+" central elevado, Objetivo, Tu Cuenta.

## Componentes proporcionados

Están en la carpeta `finnon-components/`. Son componentes presentacionales con las props documentadas en JSDoc:

| Archivo | Descripción |
|---|---|
| `HomePage.jsx` | Componente padre que orquesta todo |
| `BalanceHeader.jsx` | Balance del mes |
| `Timeline.jsx` | Último ← Hoy → Próximo |
| `Calendar.jsx` | Calendario semana/mes con detalle de día |
| `ObjectiveCard.jsx` | Objetivo con progreso y racha |
| `ProgrammedCard.jsx` | Próximos 3 programados |
| `EmptyStateCard.jsx` | Estado vacío genérico |
| `NotificationDropdown.jsx` | Sobre con dropdown en nav |
| `utils.js` | Funciones de formato (moneda, fechas) |

## Instrucciones de integración

### 1. Analiza el codebase primero
- Revisa la estructura de carpetas, convenciones de naming, y cómo están organizados los demás componentes y páginas.
- Identifica el sistema de routing (React Router, Next.js, etc.).
- Identifica el state management (Context, Redux, Zustand, etc.).
- Identifica si hay un design system o componentes compartidos (botones, cards, etc.) que debas reutilizar.
- Revisa si ya existe un archivo de utilidades de formato similar a `utils.js`.

### 2. Adapta los componentes al codebase
- Renombra archivos y componentes según las convenciones del proyecto (kebab-case, PascalCase, etc.).
- Si el proyecto usa TypeScript, convierte los componentes a `.tsx` y añade tipos/interfaces para las props.
- Si el proyecto tiene un design system con componentes compartidos (Card, Button, etc.), úsalos en lugar de los divs con Tailwind directo. Mantén el diseño visual del wireframe.
- Si `utils.js` tiene funciones duplicadas con utilidades existentes, usa las del proyecto.
- Adapta las clases de Tailwind si el proyecto usa un theme extendido (colores custom, etc.), pero **respeta los valores visuales del wireframe** (colores, spacing, tipografía).

### 3. Conecta con datos reales
Los componentes esperan props que deben venir de tu store/API. Necesitas:

```
// Datos necesarios para HomePage
{
  account: {
    monthlyBalance: number,    // Balance neto del mes
    currentMonth: string,      // "Febrero 2026"
  },
  lastMovement: {              // Último mov registrado (o null)
    name: string,
    amount: number,
    date: string | Date,
  },
  nextMovement: {              // Próximo mov con fecha futura (o null)
    name: string,
    amount: number,
    date: string | Date,
  },
  weekData: {
    days: [{
      date: string,
      dayLabel: string,        // "Lun", "Mar", etc.
      dayNumber: number,
      isToday: boolean,
      dots: [{ type: "income" | "expense" }],
    }],
    period: string,            // "3 – 9 feb"
    netIncome: string,
    netExpense: string,
    net: string,
  },
  monthData: {
    days: [{
      date: string,
      dayNumber: number,
      isToday: boolean,
      isOtherMonth: boolean,
      dots: [{ type: "income" | "expense" }],
    }],
    period: string,            // "Febrero 2026"
  },
  objective: {                 // null si no tiene
    status: "on-track" | "at-risk" | "off-track",
    statusLabel: string,
    description: string,
    current: number,
    target: number,
    progressPercent: number,
    expectedPercent: number,
    message: string,           // Puede incluir <strong> tags
    streak: [{ hit: boolean }],
  },
  programmed: [{               // Array de programados, el componente corta a 3
    id: string,
    name: string,
    amount: number,
    dateLabel: string,         // "12 feb"
  }],
  notifications: [{            // Para el NotificationDropdown
    id: string,
    userInitial: string,
    userName: string,
    count: number,
    timeAgo: string,
  }],
}
```

### 4. Routing y navegación
- La pantalla debe montarse en la ruta de Inicio existente (probablemente `/` o `/inicio`).
- Los callbacks de navegación:
  - `onNavigateMovements` → `/movimientos`
  - `onNavigateObjective` → `/objetivo`
  - `onNavigateProgrammed` → `/movimientos?filter=programmed` (o el equivalente en tu sistema de filtros)
  - `onAddMovement` → abrir el flujo de añadir movimiento (modal, nueva ruta, etc.)
  - `onCreateObjective` → `/objetivo/crear` o el flujo que tengas

### 5. Elimina contenido obsoleto de Inicio
La pantalla de Inicio actual tiene componentes que se han eliminado del rediseño:
- **Sección "Próximos"** con barras de ingresos/gastos → eliminada
- **Actividad reciente** (lista de movimientos) → eliminada (vive en Tu Cuenta y Movimientos)
- **Desglose Real / Programado / Sin fecha** → eliminada de Inicio (mover a Tu Cuenta si no está ahí)
- **FAB flotante "Añadir"** → reemplazado por botón en navbar

### 6. Fuente tipográfica
El wireframe usa `DM Sans` (body) y `DM Mono` (importes). Si el proyecto ya tiene fuentes definidas, mantén las del proyecto. Si no las tiene configuradas, añádelas:
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
```
Y configura en `tailwind.config.js`:
```js
fontFamily: {
  sans: ['DM Sans', ...defaultTheme.fontFamily.sans],
  mono: ['DM Mono', ...defaultTheme.fontFamily.mono],
}
```

## Checklist final

Antes de dar por terminada la integración, verifica:

- [ ] La pantalla con datos muestra: Balance → Timeline → Calendario (semana default) → Objetivo → Programados
- [ ] Toggle semana/mes funciona en el calendario
- [ ] Seleccionar un día muestra el detalle de movimientos de ese día
- [ ] El estado vacío sin movimientos muestra el CTA correcto
- [ ] El estado vacío sin objetivo muestra el CTA correcto
- [ ] El botón "Añadir" está en el navbar y funciona
- [ ] El dropdown de notificaciones abre/cierra correctamente y el CTA navega
- [ ] En tablet (<900px) los componentes se apilan en 1 columna
- [ ] En móvil (<640px) aparece el bottom tab nav con el "+" central
- [ ] Los imports no rompen — no hay dependencias faltantes
- [ ] Las clases de Tailwind se resuelven correctamente (no hay clases custom sin definir)
- [ ] El formato de moneda usa formato europeo (punto miles, coma decimales)
