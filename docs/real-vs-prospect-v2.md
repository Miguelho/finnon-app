# Feature 9 (v2) — Real vs Pendiente con “chip contextual” (sin duplicar cifras)

## Contexto
Ya existe la implementación previa de “Real vs Pendiente” (agregaciones y cálculo de pendientes a partir de transacciones futuras).  
Ahora cambiamos el enfoque UI: **NO mostrar dos cifras**. Se mostrará **un único número principal** y, solo si hay pendiente, el usuario podrá revelar un **chip contextual** con el importe total pendiente.

## Objetivo UX
- Mostrar **un número principal** (gasto/ingreso/balance según pantalla) sin duplicados.
- Si **pending_total == 0** → no se muestra nada extra.
- Si **pending_total > 0** → aparece un affordance sutil (click/tap) que **revela** un chip contextual: `Incluye {X} pendiente`.
- El chip se comporta como “popover/chip contextual”: aparece al click/tap y se oculta al:
  - click fuera
  - second click en el trigger
  - (mobile) swipe/back opcional o tap fuera

## Decisión de producto (importante)
- El **número principal** mostrado debe ser el que ya mostrábamos como “Real” (a día de hoy), para alinear con “pagado/cobrado”.
  - Gasto principal = `expense_real`
  - Ingreso principal = `income_real`
  - Balance principal = `balance_today`
- El chip muestra el **total pendiente del periodo**:
  - `pending_expense` para gastos, `pending_income` para ingresos.
  - Si el componente es de balance, mostrar **impacto neto pendiente** o dos chips (evitar esto en v1). Para v1: **solo chips en cards de Gastos e Ingresos**.

## Reglas de negocio (ya existentes)
- Pendiente = transacciones con `date > today` dentro del mes seleccionado.
- Real = transacciones con `date <= today` dentro del mes seleccionado.

---

## Alcance
### Web (Next.js)
- En el resumen/Home donde hoy se renderizan “Gastos” e “Ingresos” (y/o insights carousel):
  - Sustituir “Real vs Pendiente” por:
    - Label: `Gastos`
    - Value: `expense_real` (formateado)
    - Trigger sutil (solo si pending > 0): `Ver pendiente` (texto pequeño) o icono `info`/`sparkle` neutro.
    - Al click: aparece chip contextual `Incluye {expense_pending} pendiente`.
  - Igual para `Ingresos`.

### Mobile (Expo/React Native)
- Mismo patrón:
  - Un número principal.
  - Si pending > 0, un trigger sutil (icono i o texto “Pendiente”).
  - Al tap: mostrar chip contextual (overlay pequeño anclado al elemento o “toast/chip” flotante cercano).

---

## Especificación UI
### Estados
1. `pending == 0`:
   - Render: label + value únicamente.
   - No trigger, no espacio reservado.
2. `pending > 0`:
   - Render: label + value + trigger discreto (no protagonista).
   - Interaction: click/tap -> chip aparece.
   - Accessibility: trigger focusable, `aria-expanded`, `aria-controls` en web.

### Contenido del chip
- Texto exacto: `Incluye {formattedPending} pendiente`
- Formateo: moneda de la cuenta, mismo formatter que el resumen.
- No mostrar decimales si el formatter actual los omite.

### Visual (tokens)
- Chip: estilo “muted/neutral” (no warning):
  - background: `--muted` o equivalente
  - text: `--muted-foreground`
  - border: sutil (si aplica)
- Trigger:
  - sin color agresivo; usar `muted-foreground`
  - tamaño tipografía menor que el value
- No introducir colores nuevos.

---

## Implementación técnica

### Data
Reutilizar el summary que ya existe (del feature anterior):
- `expense_real_minor`, `expense_pending_minor`
- `income_real_minor`, `income_pending_minor`
- (balance se mantiene como antes; no aplicar chip en balance en v1)

**No cambiar la query**, solo el consumo y render.

### Componentes (propuesta)
Crear un componente reutilizable cross-platform (si compartís UI) o dos equivalentes:

#### Web: `SummaryValueWithPendingChip`
Props:
- `label: string`
- `valueFormatted: string`
- `pendingFormatted?: string` (undefined si 0)
- `pendingMinor?: number` (para condition)
- `chipText?: string` (default: `Incluye {pending} pendiente`)
- `id?: string` (para aria)

Comportamiento:
- si `pendingMinor <= 0` → no render trigger ni chip.
- si `pendingMinor > 0`:
  - render trigger
  - al click: toggle `open`
  - chip como Popover (Radix Popover si ya usáis shadcn) o tooltip clickable.
  - cerrar con click fuera y ESC.

#### Mobile: `SummaryValueWithPendingChip`
- misma API conceptual
- implementación con:
  - `Pressable` como trigger
  - `Modal` transparente pequeño / `Popover` si hay librería / `react-native-paper` tooltip si existe
  - cerrar tap fuera

### Tracking (opcional)
- Evento: `pending_chip_opened` con `{type: "income"|"expense", pending_minor}`
(Implementar solo si ya tenéis analytics).

---

## Casos borde
- Pending muy grande: chip no debe romper layout (max-width + wrap).
- Usuario cambia de mes: pending puede ser 0 → el trigger desaparece sin “saltos” raros.
- Timezone: usar el `today` ya estandarizado en la app (no recalcular en el componente).

---

## Plan de tareas
1. Localizar los componentes actuales que renderizan Real/Pendiente y reemplazar por el nuevo patrón:
   - Web: Home summary card(s)
   - Mobile: Home summary card(s)
2. Implementar `SummaryValueWithPendingChip` (web + mobile).
3. Wirear datos:
   - value = `_real`
   - pending = `_pending`
4. Añadir tests:
   - Unit: `pending==0` no muestra trigger
   - Unit: `pending>0` muestra trigger y al click muestra chip con el importe correcto
   - E2E (si existe): tap y close outside.

---

## Definition of Done
- En Home (web + mobile), Gastos e Ingresos muestran **solo una cifra principal**.
- Si `pending == 0` no existe trigger ni chip.
- Si `pending > 0`, el usuario puede click/tap y ver chip `Incluye X pendiente`.
- El chip se cierra al click fuera / segundo click (web) y tap fuera (mobile).
- No se rompe el layout en pantallas pequeñas.
- No se introducen nuevos colores fuera del sistema de tokens existente.
