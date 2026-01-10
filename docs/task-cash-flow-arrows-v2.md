# Prompt para agente de código — Refactor `CashFlowArrows` (layout vertical + estilos de flecha)

## Contexto
Tenemos un componente `CashFlowArrows` que hoy muestra **Ingresos / Balance / Gastos** en horizontal con flechas proporcionales.  
Quiero **cambiar la disposición** y **mejorar el aspecto visual** de las flechas manteniendo el look&feel de Finnon (sobrio, limpio, consistente en web + móvil).

## Objetivo UX
- Las flechas pasan a estar **una debajo de la otra** (columna izquierda).
- El **Balance** queda **a la derecha**, alineado a la derecha y visualmente estable.
- Si **no hay ingresos** o **no hay gastos**, **no se muestra esa flecha** (ni su fila).
- Si **no hay ingresos y no hay gastos**, la columna izquierda desaparece y queda solo el balance (sin huecos raros).

## Nueva disposición (layout)
Estructura general (conceptual):

- Contenedor principal: `Row`
  - **LeftColumn** (vertical)
    - `IncomeRow` (opcional si income != 0)
    - `ExpenseRow` (opcional si expense != 0)
  - **BalanceColumn** (siempre)
    - `BalanceLabel + BalanceValue`

### Reglas de alineación
- `BalanceColumn` debe quedar **a la derecha** y centrada verticalmente respecto a lo que exista en LeftColumn.
- LeftColumn debe tener `gap` consistente (p.ej. 12).
- No debe “bailar” el balance cuando aparece/desaparece una flecha: el balance es un bloque independiente.

## Lógica de visibilidad (hard requirement)
- `showIncome = incomeMinor !== 0`
- `showExpense = expenseMinor !== 0`
- Renderiza filas solo si corresponde.
- El cálculo de escalado de ancho debe seguir funcionando si solo existe una flecha:
  - `maxValue = max(abs(incomeMinor), abs(expenseMinor))`
  - si `maxValue == 0` → no render de flechas (solo balance).

## Estilos de flecha (3 opciones)
Implementar 3 formatos de flecha y dejarlo preparado para elegir uno por defecto (sin reescribir el componente en el futuro).

### Requisito de implementación
- Preferir **SVG** para que sea consistente en Web + React Native.
- Crear un `ArrowStyle` (enum o union type) en `@poleursus/shared`:
  - `"chevron"` (Opción A)
  - `"taper"` (Opción B)
  - `"capsuleNotch"` (Opción C)

#### Opción A — Chevron (default recomendado)
- Línea fina con punta tipo “>” (stroke), elegante.
- Punta con `stroke-linecap: round` y `stroke-linejoin: round`.
- El ancho total de flecha sigue siendo proporcional (solo cambia el “head”).

#### Opción B — Taper
- Cuerpo que se afina hacia la punta (path).
- Se percibe como “flujo” sin usar gradientes.

#### Opción C — Capsule + Notch
- Cuerpo tipo píldora (`rounded`) con un pequeño notch/corte al final para sugerir dirección.
- Minimalista y “tool-like”.

### Color / tokens
- Cuerpo de flecha: `colors.text.secondary` (o token equivalente).
- Acento sutil SOLO en la punta o detalle final:
  - ingresos: `colors.state.positive`
  - gastos: `colors.state.negative`
- Evitar barras chillones / emojis / gradientes.

## API del componente (propuesta)
Extender `CashFlowArrowsProps`:
- `arrowStyle?: ArrowStyle` (default `"chevron"`)
- `showDirectionalAccent?: boolean` (default `true`)  // si queremos apagar acento fácil

Mantener inputs actuales (income, expense, balance, etc.) sin romper contratos si ya se usa en varias pantallas.

## Tareas técnicas
1. **Refactor layout**
   - Cambiar a 2 columnas: LeftColumn (vertical) + BalanceColumn (derecha).
   - Ajustar spacing para web y RN con el mismo “ritmo” (tokens / shared styles si existen).

2. **Condicional de render por cero**
   - Ocultar fila de ingresos si income==0.
   - Ocultar fila de gastos si expense==0.
   - Si ambos 0 → no render de LeftColumn.

3. **Sistema de estilos de flecha**
   - Crear `ArrowStyle` en shared.
   - Crear componente `CashFlowArrow` (o similar) que reciba:
     - `direction: "left" | "right"`
     - `widthPx`
     - `style: ArrowStyle`
     - `accentColor?`
   - Implementar las 3 variantes con SVG.

4. **Compatibilidad Web + Mobile**
   - Asegurar que en RN se use `react-native-svg` (ya está).
   - En web, usar SVG inline (o el wrapper que ya exista). Nada de hacks divergentes si se puede evitar.

5. **Accesibilidad**
   - Añadir `aria-label` / `accessibilityLabel` a cada fila (p.ej. “Ingresos: +X”, “Gastos: -Y”).
   - No depender solo del color para la distinción (texto ya ayuda).

## Definition of Done
- [ ] Flechas apiladas verticalmente y balance a la derecha, en web y móvil.
- [ ] Si income==0 o expense==0 no se muestra esa flecha (ni su contenedor).
- [ ] Si ambos 0, solo se ve el balance, sin huecos.
- [ ] Implementadas las 3 opciones de flecha (`chevron`, `taper`, `capsuleNotch`) y seleccionables por prop.
- [ ] Default: `chevron`.
- [ ] No se rompen pantallas existentes; no hay cambios colaterales fuera del componente y su styling inmediato.
- [ ] Tests mínimos:
  - unit/snapshot del render con: (income>0, expense>0), (solo income), (solo expense), (ambos 0).
- [ ] Revisión visual rápida en light/dark.

## Notas / Guardarraíles
- No rediseñar la pantalla entera: solo este componente.
- Mantener la filosofía visual: limpio, poco ruido, consistente.
- Evitar introducir dependencias nuevas salvo que sea estrictamente necesario.
