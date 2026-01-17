# Feature #13 — Formulario “Añadir”: Top 3 categorías (histórico) + “Ver otras”
## Contexto
En el formulario de “Añadir” (transacción), al seleccionar categoría:
- Mostrar **3 botones** con las **categorías más utilizadas** por el usuario **en la cuenta activa**, calculadas por **histórico completo**.
- Incluir acción **“Ver otras”** que **revela el selector completo** (dropdown/lista).

## Objetivo
Reducir fricción: elegir categoría frecuente en 1 tap, sin perder acceso al listado completo.

## Alcance
- Web (Next.js) + Mobile (Expo / React Native).
- Aplica al formulario de **Add Transaction**.
- Top 3 **depende del tipo de movimiento**: si es gasto, top de categorías de gasto; si es ingreso, top de categorías de ingreso.

---

## UX / UI — Comportamiento
### Vista inicial
- Bajo el campo “Categoría”, renderizar:
  - **3 botones (pills)** con categorías top (si hay menos, mostrar las que existan).
  - Acción **“Ver otras”** (texto + chevron).
- Tap en pill:
  - Actualiza `form.categoryId`.
  - Marca pill activa de forma sutil.

### “Ver otras”
- Tap en “Ver otras” muestra selector completo (el existente):
  - Web: dropdown o panel inline (sin overlay agresivo).
  - Mobile: navegar a selector / abrir sheet según patrón actual.
- Al seleccionar desde el selector completo:
  - Actualiza `form.categoryId`.
  - Si coincide con top 3, pill correspondiente se marca activa.

### Edge cases
- 0 categorías: mostrar estado vacío (y CTA “Crear categoría” si existe en este flujo).
- 1–2 categorías: mostrar solo las disponibles.
- No reordenar top 3 “en caliente” dentro de la misma sesión del formulario para evitar saltos de UI.

---

## Lógica de datos — Top 3 por histórico completo
### Definición (v1)
- Top por **número de transacciones** en la **cuenta activa**.
- Filtro por `transactionType` del formulario:
  - `expense` => top de categorías tipo gasto
  - `income`  => top de categorías tipo ingreso
- Ventana temporal: **SIN filtro** (histórico completo).

### Algoritmo
Inputs: `activeAccountId`, `transactionType`

1) Obtener topCategoryIds (máximo 3):
   - Contar transacciones por `category_id`
   - WHERE `account_id = activeAccountId`
   - AND `type = transactionType`
   - GROUP BY `category_id`
   - ORDER BY `count(*) DESC`
   - LIMIT 3

2) Fetch de detalles de categoría para esos ids (name, icon, etc.)

3) Fallbacks:
   - Si devuelve < 3:
     - completar con categorías del tipo correspondiente (de la tabla `categories`)
       - WHERE `account_id = activeAccountId` (o scope equivalente)
       - AND `type = transactionType`
       - ORDER BY `created_at DESC` (o name ASC)
       - excluyendo las ya incluidas
       - hasta tener 3 (o las que existan)

> Nota: si el cliente no soporta bien group-by, crear **RPC SQL** en Supabase o endpoint server-side para: `get_top_categories(account_id, tx_type, limit)`.

### Performance
- Cache en memoria por `accountId + transactionType` con TTL (ej. 5 min).
- Invalidar cache cuando:
  - Se crea una transacción (del tipo correspondiente) en esa cuenta.
  - Cambia la cuenta activa.
- Opcional (nice): actualización optimista local del ranking SIN reordenar la UI en el formulario abierto (solo impacta próxima apertura).

---

## Implementación — Componentes
### Shared (si aplica)
Crear `TopCategorySelector`:
Props:
- `topCategories: Category[]` (0..3)
- `selectedCategoryId?: string`
- `onSelect(categoryId: string): void`
- `onOpenAll(): void`

Render:
- Pills con icono + nombre (si hay icono)
- “Ver otras” (action/link)

Accesibilidad:
- Web: `aria-pressed`
- Mobile: `accessibilityRole="button"` + `accessibilityState={{ selected: true }}`

### Integración Web
- Insertar debajo del control actual de categoría.
- “Ver otras” toggles el dropdown/listado existente.

### Integración Mobile
- Insertar debajo del control actual de categoría.
- “Ver otras” abre el selector existente (screen/sheet).

---

## Estado del formulario
- Fuente de verdad: `form.categoryId`
- Selección desde pills y desde selector completo actualiza el mismo estado.
- UI refleja selección si `selectedCategoryId` coincide con un pill.

---

## Tests / QA
1) 0 categorías => estado vacío correcto, sin crash.
2) 2 categorías, 0 transacciones => 2 pills por fallback + “Ver otras”.
3) >3 categorías con transacciones => top 3 por count desc.
4) Cambiar tipo (income/expense) => recalcula top 3 y pills cambian.
5) Crear transacción => invalida cache y en la próxima apertura se refleja.

---

## Criterios de aceptación
- Se muestran hasta 3 categorías top por cuenta activa y por tipo de movimiento (ingreso/gasto).
- “Ver otras” muestra el selector completo actual.
- Seleccionar categoría funciona desde ambos caminos y se refleja de forma consistente.
- Sin hardcode de colores: usar tokens semánticos compartidos.
- No rompe flujo actual de creación de transacciones.
