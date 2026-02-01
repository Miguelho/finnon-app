# Prompt para Agente de Código — Home: Balance Hero (Acordeón) + Semana / Ver mes inline (sin reflow)

## Contexto
App de finanzas Finnon. En Home (Inicio) queremos:
- Unificar el “estado” en un solo bloque principal (Balance).
- Eliminar las cards separadas de **Ingresos** y **Gastos** (quedarán dentro del desglose del Balance).
- Mantener la columna derecha con calendario **Semana** como apoyo y el link **Ver mes** (expansión inline sin mover layout).
- “Pendiente” incluye **dos cosas**:
  1) **Programado (con fecha)**: recurrentes/futuros.
  2) **Sin fecha** (“a deber / a cobrar” sin fecha).

## Objetivo
1) Rediseñar el Home web para que el bloque superior izquierdo sea un **Balance Hero** con acordeón:
   - Colapsado: número grande (Balance hoy) + chips compactos.
   - Expandido: desglose claro en **Real / Programado / Sin fecha**, y dentro de cada uno **A cobrar / A pagar / Neto**.
   - Chevron que rota/cambia dirección según abierto/cerrado.
2) Eliminar del layout las cards “Ingresos” y “Gastos” (ya no se renderizan).
3) Mantener (o ajustar) “Próximos 7/14/30” para que represente **Programado** (por rango) y quede coherente con chips del Balance.
4) Mantener el calendario “Semana” a la derecha y su panel de detalle del día.

> Nota: aplica este cambio en app y web.

---

## Reglas UX (no negociables)
- Un único número protagonista en Home: **Balance hoy**.
- No duplicar cifras con “Resumen del mes”.
- “Fin de mes (estimado)” se calcula **solo con Programado** (con fecha).
- “Exposición total” incluye **Programado + Sin fecha**.
- Sin “Pendiente” genérico: usar etiquetas **Real**, **Programado**, **Sin fecha**, **A cobrar**, **A pagar**, **Neto**.
- Chevron visible y coherente:
  - cerrado: chevron apuntando hacia abajo (o derecha)
  - abierto: chevron apuntando hacia arriba (o abajo invertido)
  - animación suave (rotación 180°).

---

## Cambios en UI — Home (columna izquierda)

### A) Eliminar cards separadas
- Remover completamente las cards de **Ingresos** y **Gastos** del Home.
- Los valores se mostrarán dentro del acordeón del Balance.

### B) Crear componente `BalanceHeroAccordion`
Ubicación: arriba de la columna izquierda (donde hoy está “Resumen del mes” y cards).

#### Estado colapsado (default)
- Título: `Balance hoy`
- Número grande: `€{balanceToday}`
- Fila de chips compactos (1 línea, wrap si no cabe):
  1) `Real (mes) {netRealMonth}`
  2) `Programado ({range}d) {netScheduledRange}`
  3) `Sin fecha {netNoDateTotal}`
- En el header, a la derecha:
  - Texto sutil `Ver desglose` (opcional)
  - Chevron (rotatable)

**Comportamiento:**
- Click en header o chevron => toggle expand/collapse
- Mantener accesibilidad: `button` o `aria-expanded`

#### Estado expandido
Mostrar 3 secciones, cada una con 2 columnas (A cobrar / A pagar) y una fila de neto:

**Sección 1 — Real**
- A cobrar: €{realReceivable}  (ingresos reales)
- A pagar:  €{realPayable}     (gastos reales)
- Neto:     €{realNet}

**Sección 2 — Programado (con fecha)**
- A cobrar: €{scheduledReceivableRange}
- A pagar:  €{scheduledPayableRange}
- Neto:     €{scheduledNetRange}
- Mini lista top 3 items (solo si existe):
  - `{date}: {name} {amount}`
  - Máx 3, con “Ver todos” enlazando a Movimientos filtrado por rango/estado.

**Sección 3 — Sin fecha**
- A cobrar: €{noDateReceivable}
- A pagar:  €{noDatePayable}
- Neto:     €{noDateNet}
- Mini lista top 3 items (si existe):
  - `{name} {amount}`
  - CTA secundario: `Poner fecha` (abre flujo de edición o navegación a pantalla adecuada)
  - CTA secundario: `Marcar como saldado` (si existe)

**Footer de métricas (debajo de las 3 secciones)**
- `Fin de mes (estimado): €{balanceEndOfMonthEstimated}`
  - Def: `balanceToday + scheduledNetMonthRemaining` (o `+ scheduledNetRange` si no hay “resto de mes”; elegir criterio y documentarlo)
- `Exposición total: €{exposureTotal}`
  - Def: `balanceToday + scheduledNetTotalOpen + noDateNet`
  - Nota pequeña: “Incluye sin fecha”

> IMPORTANTE: Define con claridad qué representa `Programado` en el acordeón:
> - Opción recomendada: el acordeón usa el **mismo rango** que el toggle 7/14/30 (para coherencia inmediata).
> - Si también necesitas “Programado resto de mes” para fin de mes, calcula ambos: `scheduledNetRange` y `scheduledNetRestOfMonth`, y usa el segundo solo para “Fin de mes (estimado)”.

---

## Datos / Cálculos requeridos

### Definiciones
- **Real**: movimientos ya registrados (pagados/cobrados).
- **Programado**: movimientos pendientes con fecha futura (recurrentes/planificados) dentro de una ventana (7/14/30).
- **Sin fecha**: obligaciones/cobros pendientes sin fecha.

### Valores a calcular (mínimo)
- `balanceToday`
- `realReceivable`, `realPayable`, `realNet`
- `scheduledReceivableRange`, `scheduledPayableRange`, `scheduledNetRange`
- `noDateReceivable`, `noDatePayable`, `noDateNet`
- `exposureTotal = balanceToday + scheduledNetRange + noDateNet` (si range = ventana actual)
- `balanceEndOfMonthEstimated`:
  - Si existe cálculo “resto de mes”: `balanceToday + scheduledNetRestOfMonth`
  - Si no, usar `balanceToday + scheduledNetRange` y etiqueta: “Estimación (próx. {range} días)” (preferible a mentir)

### Reglas de signo / presentación
- Mantener formato `€` y separadores locales.
- Colorear:
  - positivo (verde) / negativo (rojo) solo en cifras clave (netos).
- “A pagar” (gastos) se muestra como positivo o negativo según convención actual del proyecto (mantener consistencia con Movimientos).

---

## Integración con toggle 7/14/30
- El toggle existente (en “Próximos”) controla una variable `rangeDays`.
- `BalanceHeroAccordion` debe usar **el mismo `rangeDays`** para:
  - Chip “Programado ({range}d)”
  - Sección “Programado (con fecha)”
  - Cálculos `scheduled*Range`

---

## Cambios de layout (Home)
- Reemplazar el bloque “Resumen del mes” + cards Ingresos/Gastos por `BalanceHeroAccordion`.
- Mantener “Próximos” debajo.
- Ajustar spacing para que el hero no quede demasiado alto (colapsado debe ser compacto).

---

## Chevron / Animación / Accesibilidad
- Usar un icono chevron (lucide o el set ya existente).
- Rotación 180° con transición 150–200ms.
- `aria-expanded`, `aria-controls` y `button` clickable.
- Click en toda la cabecera del bloque (hit area grande).

---

## Tareas técnicas (paso a paso)
1) Crear componente `BalanceHeroAccordion` en `components/home/BalanceHeroAccordion.tsx`
2) Implementar lógica de `isOpen` (state) y `rangeDays` (prop).
3) Implementar helpers de cálculo en `lib/finance/summary.ts` (o donde corresponda):
   - funciones puras, testeables.
4) Integrar en Home:
   - eliminar cards Ingresos/Gastos
   - reemplazar con BalanceHeroAccordion
5) Conectar con datos reales del store/query (lo que ya uses).
6) Asegurar coherencia visual con tokens/tailwind actuales.
7) Pruebas:
   - con datos vacíos (sin programado / sin fecha)
   - con ambos presentes
   - con valores grandes
   - toggle 7/14/30 actualiza chips y desglose

---

## Criterios de aceptación (DoD)
- [ ] No existe en Home la cifra “Resumen del mes” duplicada
- [ ] No existen las cards separadas de Ingresos/Gastos
- [ ] Balance hoy es el único número grande protagonista
- [ ] Acordeón funciona con chevron que cambia/rota según estado
- [ ] El desglose muestra Real / Programado / Sin fecha con A cobrar / A pagar / Neto
- [ ] “Fin de mes (estimado)” y “Exposición total” respetan definiciones (con nota si aplica)
- [ ] Toggle 7/14/30 actualiza Programado en hero y en Próximos
- [ ] Accesible: `aria-expanded`, keyboard friendly
