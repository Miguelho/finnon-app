# Prompt para agente de código — Home v2 (Marca + Month Map calendar)

## Rol
Eres un agente de código senior. Implementa un rediseño de Home manteniendo el enfoque “diseño silencioso”, continuidad visual y tokens semánticos. No propongas features nuevas fuera de alcance.

Referencia de principios:
- Sin overlays dramáticos; panel como extensión natural (web panel lateral / móvil bottom sheet). :contentReference[oaicite:17]{index=17}
- Jerarquía por tamaño y espacio, no por color. :contentReference[oaicite:18]{index=18}
- Usar SIEMPRE tokens de color (no hex directos). :contentReference[oaicite:19]{index=19}
- La Home debe ayudar a entender el mes en curso. :contentReference[oaicite:20]{index=20}

---

## Objetivo
Rehacer la pantalla Home para que:
1) Refuerce marca Finnon (icono + wordmark coherentes).
2) Corrija jerarquía tipográfica (pesos y tamaños consistentes).
3) Convierta el “Balance” en un bloque central interpretativo (Flow Arrows).
4) Unifique “This month / Upcoming obligations / Next X days” en un **calendario interactivo** (Month Map).
5) Mantenga “Actividad reciente” con el mismo estilo actual.
6) Mantenga UX idéntica en web/móvil: mismo flujo, distinto layout (panel lateral vs bottom sheet).

---

## Scope (lo que SÍ hay que hacer)
### A) Sistema de marca (v1 mínimo)
1) Crear componente `FinnonMark`:
   - Base: cuadrado sólido.
   - Añadir un recorte/notch interno simple (SVG o view con borderRadius + cut).
   - Variantes: `size="sm|md|lg"`, `mode="iconOnly|iconWordmark"`.
2) Reemplazar placeholder actual del cuadrado negro por `FinnonMark`.

### B) Tipografía: eliminar pesos aleatorios
1) Definir un set de estilos tipográficos compartidos (en `shared` si aplica):
   - `display`, `h2`, `h3`, `body`, `meta`.
2) Regla:
   - Solo 1 cifra “display” por bloque (Balance neto).
   - Totales secundarios siempre en `body` o `meta`.

### C) Nuevo bloque “Cash Flow Arrows”
1) Crear componente `CashFlowArrows`:
   - Inputs: `incomeTotal`, `expenseTotal`, `netBalance`, `rangeDays`.
   - Render:
     - Dos flechas enfrentadas + labels
     - Centro: cifra neta (display)
     - Los totales in/out en texto secundario
2) Evitar charts tipo pie/donut.
3) Color:
   - Texto por tokens `color.text.*`
   - Si `netBalance < 0`, cifra neta con `color.state.negative`. :contentReference[oaicite:21]{index=21}

### D) Month Map (Calendario interactivo)
1) Crear componente `MonthMap`:
   - Muestra mes actual (grid semanas).
   - Cada día renderiza marcadores de eventos (máx 3 + “+N”).
2) Tipos de evento (4):
   - one-off income
   - one-off expense
   - recurring income/expense
   - obligation (paid/pending)
3) Colores:
   - Obligación pagada: `color.action.primary` (azul). :contentReference[oaicite:22]{index=22}
   - Obligación pendiente: introducir token nuevo `color.state.warning` (ámbar suave) en light/dark.
     - Es el ÚNICO token nuevo permitido.
4) Interacción:
   - Click/tap en día abre detalle.
   - Sin overlay oscuro. :contentReference[oaicite:23]{index=23}

### E) Day Detail Panel (layout adaptativo)
1) Crear componente `DayDetailPanel` con el MISMO contenido en todas las plataformas:
   - Resumen del día (net + income + expense)
   - Lista de obligaciones del día (con CTA contextual)
   - Recurrentes del día
   - Transacciones puntuales
2) Implementación por plataforma:
   - Mobile (app + web móvil): bottom sheet con snap points 40%/80%.
   - Web desktop: panel lateral derecho persistente.
3) Cierre:
   - Mobile: swipe + botón close discreto.
   - Web: botón close o “X” discreta.

### F) Integración del selector “Next X days (7/14/30)”
1) Mantener control 7/14/30.
2) Cambia:
   - el cálculo/escala de `CashFlowArrows` (suma de in/out en próximos N días),
   - y una indicación sutil en Month Map (highlight del rango futuro, sin colorear agresivo).

### G) Mantener “Actividad reciente”
- No rediseñar la lista; solo ajustar tipografía si hace falta para alinearla con el sistema.

---

## Guardrails (no hacer)
- No introducir overlays dramáticos, blur ni tintes estéticos. :contentReference[oaicite:24]{index=24} :contentReference[oaicite:25]{index=25}
- No añadir gradients decorativos.
- No introducir más colores/tokens (solo `color.state.warning`).
- No crear un dashboard denso (evitar “todo en una pantalla”). :contentReference[oaicite:26]{index=26}
- No romper navegación ni flujos existentes: cambios mínimos necesarios.

---

## Implementación técnica (orientativa, sin re-arquitectura)
1) Datos:
   - Reutilizar queries existentes de transacciones/obligaciones/recurrentes.
   - Crear agregadores:
     - `getEventsForMonth(month)` → `CalendarEvent[]`
     - `getSummaryForDay(date)` → `DaySummary`
     - `getFlowForRange(days)` → `{ income, expense, net }`
2) Shared:
   - Copy y labels en `shared` (móvil y web mismos strings).
   - Tokens: seguir guía existente; añadir `color.state.warning`. :contentReference[oaicite:27]{index=27}
3) Responsive:
   - Breakpoint para decidir panel lateral vs bottom sheet.
   - La experiencia es la misma: solo cambia el contenedor.

---

## Criterios de aceptación (Definition of Done)
1) La Home muestra:
   - `FinnonMark` real + wordmark.
   - `CashFlowArrows` con net protagonista.
   - `MonthMap` con markers y click por día.
   - `DayDetailPanel` abre sin overlay (bottom sheet móvil / panel lateral desktop).
   - Selector 7/14/30 afecta al flujo y al rango.
   - “Actividad reciente” se ve como antes.
2) Tipografía consistente: no hay “bold aleatorio”.
3) Colores solo por tokens; único token nuevo: `color.state.warning`.
4) Web y móvil comparten UX (mismo contenido, misma interacción, layout adaptado). :contentReference[oaicite:28]{index=28}
