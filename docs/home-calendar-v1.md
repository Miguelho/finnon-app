Añadir efecto visual a la hora de ver mes. En lugar de mostrar un panel deslizante en web escritorio o un "bottom sheet"  en web movil o app movil para mostrar el calendario de mes, me gustaría que el propio calendario se extendiera en la misma pantalla, respetando el layout para que el comportamiento al hacer click sea le mismo, los elementos circundantes no se muevan.


# Prompt para Agente de Código — Calendario “Semana → Mes” inline + DayMarker (composición por tipo)

## Contexto
En Finnon, el calendario es un apoyo (no la home). Queremos que en **web (CSS Grid)** y **móvil (React Native Views)** el calendario se muestre por defecto en **modo Semana**, y al pulsar **“Ver mes”** se **expanda en la misma pantalla** con un efecto premium:
- **Sin panel lateral**
- **Sin bottom sheet**
- **Sin mover el layout** (los elementos circundantes no se reflowean)

Además, cada día debe mostrar un indicador de actividad por **composición**: **ingreso / gasto / pendiente**, con un **badge numérico** + **barrita de 3 segmentos** proporcional.

---

## Objetivo
1) Implementar `CalendarCard` con:
   - `WeekView` siempre visible (altura fija)
   - `MonthOverlay` absoluto que se revela encima al abrir mes
   - Transición suave (reveal) y cierre consistente (mismo gesto en todas las plataformas)
2) Implementar `DayMarker` agregado:
   - Número total de movimientos del día (con `9+` o `10+`)
   - Barrita 3 segmentos (income/expense/pending) proporcional
3) Unificar comportamiento y copy:
   - Botón toggle: `Ver mes` ↔ `Ver semana` + chevron rota
   - Tap fuera cierra, y en web `Esc` cierra
4) Remate visual (premium):
   - “Semana anclada”: al abrir mes, la semana actual queda visualmente alineada
   - (Opcional pero recomendado) Ghost morph de **1 marker** (día seleccionado) de semana → mes

---

## Alcance por plataforma

### Web (Next.js + CSS Grid)
- Layout en `CalendarCard` con `position: relative` y `MonthOverlay` absoluto
- Reveal con `clip-path` (preferible) o fallback `height + overflow:hidden`
- Medición DOM para ghost morph (si se implementa)
- Soporte `prefers-reduced-motion`

### Mobile (Expo + React Native)
- `MonthOverlay` como `Animated/Reanimated.View` absoluto, `overflow: hidden`
- Reveal por animación de `height` + `opacity` + micro `translateY`
- Medición con `measureInWindow` (si ghost morph)
- Respetar safe-area y scroll (no bottom sheet)

---

## Requisitos UI/UX (no negociables)
- **No reflow**: el `CalendarCard` mantiene siempre la altura de semana
- **Mes se superpone**, no empuja cards de abajo
- **Sin scrim oscuro**. Si hace falta foco: micro elevación + (opcional) desaturación/opacity leve del contenido inferior
- **Accesibilidad**:
  - No depender solo del color: número + tooltip/label con desglose
  - Web: `Esc` cierra, foco razonable
  - `prefers-reduced-motion` (web) y reduce motion (móvil) → animación mínima o nula

---

## Componentes a crear/modificar

### 1) `DayMarker`
Props:
- `total: number`
- `incomeCount: number`
- `expenseCount: number`
- `pendingCount: number`
- `variant: 'week' | 'month'`
- `isSelected?: boolean`
- `isToday?: boolean`
- `onPress? / onHover?` (según plataforma)

UI:
- Badge con número:
  - `total == 0` => no render
  - `total >= 10` => mostrar `9+` (o `10+`, elegir y aplicar consistente)
- Barrita de 3 segmentos proporcional:
  - `w_i = income/total`, `w_g = expense/total`, `w_p = pending/total`
  - Si count > 0, garantizar `minWidth` visual (2px) para que no desaparezca
- Tooltip/label:
  - “Ingresos: X · Gastos: Y · Pendientes: Z”

### 2) `WeekView` (grid 7 columnas, 1 fila)
- Celdas: día + `DayMarker`
- Tap día => selecciona día (state lift a CalendarCard)
- Debe exponer refs/handles para medir markers si ghost morph

### 3) `MonthOverlay` (grid 7 columnas, 5–6 filas)
- Absoluto dentro de `CalendarCard`
- Visible cuando `mode==='month'`
- Reveal animation
- Tap día => selecciona día (y mantiene overlay abierto)
- Debe exponer handles para medir markers (si ghost morph)

### 4) `CalendarCard`
State:
- `mode: 'week' | 'month'` (default week)
- `selectedDate`
- `currentMonth` (para overlay)
- `isAnimating` (opcional para bloquear spam taps)

Layout:
- Header: título (mes/año si aplica) + toggle `Ver mes/Ver semana` + chevron
- Body: contenedor con altura fija (week height)
- UnderlayShield: capa transparente para bloquear interacción debajo cuando el mes está abierto

Interacciones:
- Toggle button: abre/cierra mes
- Click-away:
  - Web: document listener (solo cuando open)
  - Móvil: tap fuera (zona del shield) cierra
- Web: `Esc` cierra

---

## Animación (spec exacta)

### Reveal (Week → Month)
Web recomendado:
- `clip-path: inset(0 0 100% 0 round R)` → `inset(0 0 0 0 round R)`
- `opacity 0 → 1`
- `transform translateY(0) → translateY(-2px)` (micro lift)
Duración:
- open: 200ms ease-out
- close: 160ms ease-in/out

RN recomendado:
- `height` animada (desde weekHeight a monthHeightMaxVisible) con `overflow: hidden`
- `opacity` 0→1
- `translateY` 0→-2

### Semana anclada (alineación)
Cuando abre mes:
- Calcula la fila del mes donde cae la semana que contiene `selectedDate`
- Ajusta `MonthGrid` con `translateY` para que esa fila quede alineada con la fila de semana (misma y)
- Si es complejo, fallback aceptable:
  - No alinear matemáticamente, pero mantener week row visible arriba + reveal hacia abajo

### (Opcional) Ghost morph del DayMarker seleccionado (recomendado)
Para rematar sin volverte loco: animar SOLO el marker del `selectedDate`.

Web:
1) Medir rect del marker en WeekView (source)
2) Medir rect del marker en MonthOverlay (target) (overlay montado pero invisible)
3) Renderizar ghost marker absoluto en layer superior posicionado en source
4) Abrir overlay (reveal)
5) Animar ghost con `transform: translate(dx, dy)` + (opcional) `scale 1 → 0.95`
6) Al finalizar, ocultar ghost

RN:
- Igual concepto con `measureInWindow` y `Animated/Reanimated` `translateX/Y`

Respetar reduce motion: si activo, sin ghost, sin animaciones.

---

## Datos
Asegurar que cada día tiene un resumen:
- `total`
- `incomeCount`
- `expenseCount`
- `pendingCount`

Crear helper:
- `getDaySummary(date): { total, incomeCount, expenseCount, pendingCount }`

---

## Tareas de implementación (paso a paso)

### A) Web
1) Crear `DayMarker.tsx` con badge + barrita (Tailwind/shadcn tokens existentes; no hardcodear colores “raros”)
2) Implementar `WeekView.tsx` usando CSS Grid 7 columnas
3) Implementar `MonthOverlay.tsx`:
   - `position:absolute; top:0; left:0; width:100%`
   - `z-index` alto
   - `clip-path` reveal + `pointer-events` según open
4) Implementar `CalendarCard.tsx`:
   - state `mode`, `selectedDate`, `currentMonth`
   - header toggle + chevron
   - click-away + `Esc`
   - UnderlayShield para bloquear interacción debajo (sin scrim)
5) (Opcional) Ghost morph para marker seleccionado:
   - layer absoluto
   - medición con `getBoundingClientRect`
   - animación con `requestAnimationFrame`
6) Tests manuales:
   - no reflow, no jumps
   - open/close repetido rápido no rompe
   - mobile web viewport no corta overlay (si hace falta, overlay con maxHeight + scroll interno)

### B) Mobile (RN)
1) Crear `DayMarker.native.tsx`:
   - Views + texto
   - barra 3 segmentos con `flex` proporcional + `minWidth` si count>0
2) Implementar `WeekView.native.tsx` (row con 7 celdas)
3) Implementar `MonthOverlay.native.tsx`:
   - `position:'absolute'`
   - `overflow:'hidden'`
   - `Animated/Reanimated` para `height/opacity/translateY`
4) Implementar `CalendarCard.native.tsx`:
   - toggle
   - shield transparente para tap fuera
   - bloquear scroll si está dentro de ScrollView (prop `scrollEnabled={!isMonthOpen}`)
5) (Opcional) Ghost morph del marker seleccionado:
   - `measureInWindow` source/target
   - `Animated.View` absoluto con `translateX/Y`
6) Verificar safe-area bottom + no tap-through

---

## Criterios de aceptación (DoD)
- [ ] En web y móvil, al pulsar “Ver mes” el calendario se expande **inline** sin mover el resto del layout
- [ ] `MonthOverlay` se superpone y no hay panel/bottom sheet
- [ ] `DayMarker` muestra:
  - número total (con regla de 9+/10+)
  - barrita proporcional 3 segmentos (income/expense/pending)
- [ ] Click-away y `Esc` cierran en web; tap fuera cierra en móvil
- [ ] Reduce motion: sin animaciones llamativas
- [ ] No hay scrim oscuro; elevación mínima
- [ ] No hay tap-through al contenido inferior cuando el mes está abierto

---

## Notas de implementación
- Elegir una convención global: `9+` vs `10+` y aplicarla en todas las plataformas.
- En días con 0 movimientos, no renderizar marker.
- Si el mes overlay no cabe en viewport:
  - usar `maxHeight` + scroll interno del overlay (no scroll de la pantalla).
- Mantener tokens y estilos consistentes con el design system existente.

---

## Entregables
- PR con:
  - `CalendarCard` (web + native)
  - `WeekView` (web + native)
  - `MonthOverlay` (web + native)
  - `DayMarker` (web + native)
  - helpers de datos `getDaySummary`
  - (opcional) ghost morph seleccionado (web + native)
- Capturas/GIF antes/después del efecto (web desktop + web móvil + app)
