# Refactor: Resumen de Movimientos — Balance héroe + barra de proporción dinámica

## Contexto

La pantalla de Movimientos actualmente muestra 3 cards apilados (Ingresos, Gastos, Balance) que ocupan ~60% de la pantalla visible en mobile. Hay que reemplazarlos por un resumen compacto que combine un balance héroe con una barra de proporción visual que muestra confirmados vs pendientes.

**Referencia visual:** Adjuntar `finnon-movimientos-final.html` — 3 estados: sin filtro, con filtro activo, y tooltip abierto.

**Principio clave:** El resumen es dinámico. Cuando el usuario aplica filtros (categoría, comercio, tipo ingreso/gasto), el balance héroe, la barra de proporción y los labels se recalculan mostrando solo los movimientos filtrados. Todo el cálculo es client-side.

---

## Estructura del componente

Reemplazar los 3 cards actuales (Ingresos, Gastos, Balance) por un solo componente `MovementsSummary` que recibe los movimientos filtrados y calcula todo internamente.

### Jerarquía visual (de arriba a abajo):

```
1. Balance héroe (centrado, grande)
2. Barra de proporción + icono ⓘ
3. Labels: ingresos total/confirmados a la izquierda, gastos total/confirmados a la derecha
```

---

## 1. Balance héroe

Centrado horizontalmente.

- **Label:** "BALANCE" — font-size 11px, uppercase, letter-spacing 0.5px, color `text-tertiary`, weight 500
- **Importe:** font-size 30px, weight 700, letter-spacing -1px, color `text-primary`
  - Si el balance es negativo: color `expense-text`
  - Si es positivo: color `text-primary` (negro)
- **Subtexto:** "{importe confirmado} confirmado" — font-size 12px, color `text-tertiary`

### Cálculo:
```
balance = suma(ingresos filtrados) - suma(gastos filtrados)
balance_confirmado = suma(ingresos confirmados filtrados) - suma(gastos confirmados filtrados)
```

Margin-bottom: 14px.

---

## 2. Barra de proporción con opacidad

### Layout:
Fila horizontal con la barra (flex: 1) y un botón ⓘ a la derecha (20x20px).

### La barra:
- Height: 10px
- Border-radius: 100px (extremos redondeados)
- Gap de 2px entre el lado de ingresos y el de gastos
- Cada lado es un flex container con dos segmentos internos:

```
[████ confirmado ░░░░ pendiente] [████ confirmado ░░░░ pendiente]
       INGRESOS                          GASTOS
```

### Colores de los segmentos:

| Segmento | Color |
|----------|-------|
| Ingresos confirmado (sólido) | `income-solid` — un verde medio-intenso (ej. #6abb7b) |
| Ingresos pendiente (suave) | `income-pending` — verde claro/pastel (ej. #c8e6cd) |
| Gastos confirmado (sólido) | `expense-solid` — rojo medio-intenso (ej. #e07a68) |
| Gastos pendiente (suave) | `expense-pending` — rojo claro/pastel (ej. #f8d7cf) |

Añadir estos 4 tokens al theme si no existen.

### Proporciones — Cálculo:

**Proporción entre lados (ingresos vs gastos):**
```
total = abs(suma_ingresos) + abs(suma_gastos)
flex_ingresos = abs(suma_ingresos) / total * 100
flex_gastos = abs(suma_gastos) / total * 100
```

**Proporción dentro de cada lado (confirmado vs pendiente):**
```
// Para ingresos:
flex_confirmado = abs(ingresos_confirmados) / abs(total_ingresos) * 100
flex_pendiente = 100 - flex_confirmado

// Para gastos:
flex_confirmado = abs(gastos_confirmados) / abs(total_gastos) * 100
flex_pendiente = 100 - flex_confirmado
```

### Casos especiales:
- **Solo gastos (ingresos = 0):** La barra es 100% roja con border-radius completo (100px en todos los lados). No mostrar el lado verde.
- **Solo ingresos (gastos = 0):** La barra es 100% verde con border-radius completo. No mostrar el lado rojo.
- **Sin movimientos:** No mostrar la barra. Mostrar un texto tipo "Sin movimientos en este periodo".
- **Border-radius:** El lado izquierdo (ingresos) tiene border-radius `100px 0 0 100px`. El lado derecho (gastos) `0 100px 100px 0`. Si solo hay un lado, usar `100px` completo.

### Recálculo dinámico:
Cada vez que cambian los filtros activos (categoría, comercio, tipo, periodo), recalcular las proporciones y aplicar transición CSS suave en los flex values (transition: flex 0.3s ease). Esto crea un efecto visual donde la barra se "reajusta" al filtrar.

---

## 3. Icono ⓘ y Tooltip

### Icono:
- 20x20px, circular
- Border: 1.5px solid `border`
- Texto "i" centrado, font-size 11px, weight 600, color `text-tertiary`
- Hover: border `text-tertiary`, color `text-secondary`
- Al tocar/clickar: muestra tooltip

### Tooltip:
- Posición: absoluto, debajo del icono a la derecha (right: 0, top: calc(100% + 8px))
- Background: `accent` (negro/oscuro)
- Color: blanco
- Padding: 10px 14px
- Border-radius: `radius-sm`
- Ancho: 220px
- Box-shadow: 0 8px 24px rgba(0,0,0,0.2)
- Arrow: pseudo-element rotado 45° arriba a la derecha

### Contenido del tooltip:
Dos filas:
1. [barra sólida corta] "Color sólido = confirmado"
2. [barra suave corta] "Color suave = pendiente"

Las barras del tooltip son mini-rectángulos de 10x6px con border-radius 3px.

### Comportamiento:
- Tap en ⓘ → toggle tooltip (show/hide)
- Tap fuera del tooltip → cerrar
- No se cierra al hacer scroll (se mantiene si está abierto)

---

## 4. Labels debajo de la barra

Dos columnas, flex space-between:

**Columna izquierda (ingresos):**
- Total: font-size 14px, weight 700, color `income`
- Confirmados: "{importe} confirmados" — font-size 11px, color `text-tertiary`

**Columna derecha (gastos), align right:**
- Total: font-size 14px, weight 700, color `expense`
- Confirmados: "{importe} confirmados" — font-size 11px, color `text-tertiary`

**Cuando hay filtro y solo hay un tipo (ej. solo gastos):**
- Columna izquierda: total + confirmados del tipo que existe
- Columna derecha: "N movimientos" (font-size 13px, color `text-tertiary`)

---

## 5. Recálculo dinámico con filtros

Este es el comportamiento más importante. El componente `MovementsSummary` debe reaccionar a los filtros activos.

### Inputs del componente:
```typescript
interface MovementsSummaryProps {
  movements: Movement[]; // Ya filtrados por el componente padre
}
```

El componente padre (la pantalla de Movimientos) es responsable de aplicar los filtros y pasar los movimientos filtrados. `MovementsSummary` solo calcula y renderiza.

### Cálculos internos (client-side, useMemo):
```typescript
const summary = useMemo(() => {
  const incomes = movements.filter(m => m.type === 'income');
  const expenses = movements.filter(m => m.type === 'expense');

  const totalIncome = sum(incomes, 'amount');
  const totalExpense = sum(expenses, 'amount');
  const confirmedIncome = sum(incomes.filter(m => m.status === 'confirmed'), 'amount');
  const confirmedExpense = sum(expenses.filter(m => m.status === 'confirmed'), 'amount');

  const balance = totalIncome - totalExpense;
  const confirmedBalance = confirmedIncome - confirmedExpense;

  const total = totalIncome + totalExpense;
  const incomeRatio = total > 0 ? (totalIncome / total) * 100 : 0;
  const expenseRatio = total > 0 ? (totalExpense / total) * 100 : 0;

  const incomeConfirmedRatio = totalIncome > 0 ? (confirmedIncome / totalIncome) * 100 : 0;
  const expenseConfirmedRatio = totalExpense > 0 ? (confirmedExpense / totalExpense) * 100 : 0;

  return {
    balance, confirmedBalance,
    totalIncome, totalExpense,
    confirmedIncome, confirmedExpense,
    incomeRatio, expenseRatio,
    incomeConfirmedRatio, expenseConfirmedRatio,
    hasIncome: totalIncome > 0,
    hasExpense: totalExpense > 0,
    isEmpty: movements.length === 0,
    movementCount: movements.length,
  };
}, [movements]);
```

### Transición visual al cambiar filtros:
Aplicar `transition: flex 0.3s ease` a los elementos `.bar-side` y `.bar-segment-*` para que al cambiar los ratios la barra se anime suavemente. Esto da feedback visual de que el resumen se ha recalculado.

---

## 6. Lo que NO cambia

- **Selector de periodo** (Semana/Mes/Trimestre/Año): se mantiene exactamente igual, arriba del resumen.
- **"Recurrentes →"**: se mantiene como link a la derecha, debajo del resumen.
- **"Por registrar"**: se mantiene como card amber debajo de recurrentes.
- **Barra de búsqueda y filtros**: se mantienen exactamente igual.
- **Agrupación Pendientes/Realizados**: se mantiene igual.

---

## Tokens de color nuevos

Añadir al theme si no existen:

| Token | Valor | Uso |
|-------|-------|-----|
| income-solid | #6abb7b | Barra: ingresos confirmados |
| income-pending | #c8e6cd | Barra: ingresos pendientes |
| expense-solid | #e07a68 | Barra: gastos confirmados |
| expense-pending | #f8d7cf | Barra: gastos pendientes |

Los tokens existentes (`income`, `expense`, `text-primary`, `text-tertiary`, `accent`, `border`, etc.) se usan para el resto.

---

## Notas de implementación

1. **Client-side only:** Todo el cálculo de proporciones es client-side con `useMemo`. No añadir queries nuevas al backend.
2. **El componente padre filtra, el hijo calcula:** `MovementsSummary` recibe `movements` ya filtrados. No conoce los filtros activos.
3. **Eliminar los 3 cards actuales** (Ingresos, Gastos, Balance) y reemplazar por `MovementsSummary`.
4. **Ambas plataformas:** Implementar en web (Next.js) y mobile (React Native). En React Native la barra se puede hacer con `View` + flex. El tooltip puede ser un `Modal` o `Pressable` con absolute positioning.
5. **Animación de la barra:** En web usar CSS transitions. En React Native usar `Animated` o `LayoutAnimation` para el cambio de flex.
6. **Formateo de moneda:** Usar el mismo helper de formateo que ya existe en la app. Respetar la moneda de la cuenta (EUR en este caso).
