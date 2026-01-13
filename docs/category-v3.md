# Prompt para agente de código — Selector de iconos (Phosphor) + sugerencia automática

## Contexto
Actualmente las categorías usan **emojis** como “icono”. Queremos sustituirlos por un set **minimalista** con soporte **filled** para estado “seleccionado”, consistente en **web + mobile**.

## Objetivo
1. Añadir un **set fijo de 50 iconos** (Phosphor) para la galería de categorías.
2. Reemplazar el selector/listado actual de **emojis** por estos iconos (en UI y en el modelo de datos).
3. Implementar una función `suggestCategoryIcon(name)` que:
   - Sugiera un icono por defecto en base al **nombre de la categoría**.
   - Si no hay match claro, devuelva **sugerencias** (top N) y la UI muestre una **selección sugerida** (highlight) en el picker.

---

## Guardarraíles
- Mantener la UX actual lo máximo posible (mismo flujo de crear/editar categoría).
- Unificar la experiencia web/móvil (mismos iconos, mismas claves, misma lógica de sugerencia).
- Nada de mezclar librerías de iconos: **solo Phosphor**.
- El estado “seleccionado” en el picker debe ser **filled** (o peso equivalente) sin cambiar tamaño.

---

## Dependencias / Librerías
- Mobile: `phosphor-react-native` (render SVG nativo).
- Web: `@phosphor-icons/react` (o equivalente ya usado en el repo).
- (Opcional y recomendado para sugerencias más finas): `@phosphor-icons/core` para acceder a metadata de iconos (nombre/tags) y hacer matching por tags.

---

## Set de 50 iconos (fuente de verdad)
Crear un módulo compartido (p.ej. `packages/shared/src/icons/categoryIconSet.ts`) con:

### 1) Lista canónica (50)
Usar estas keys (PascalCase) como “id” persistido:

- House
- ShoppingCart
- ForkKnife
- Car
- Bus
- Train
- Airplane
- Ticket
- GasPump
- CreditCard
- Wallet
- Receipt
- PiggyBank
- Bank
- Heart
- FirstAidKit
- Pill
- Stethoscope
- GraduationCap
- BookOpen
- GameController
- FilmSlate
- MusicNotes
- Basketball
- Barbell
- TShirt
- Handbag
- Tag
- Gift
- PawPrint
- Leaf
- Tree
- Lightbulb
- Plug
- WifiHigh
- Phone
- Laptop
- Monitor
- Camera
- Wrench
- Gear
- Hammer
- Scissors
- Broom
- Bed
- Couch
- Storefront
- Buildings
- Briefcase
- UsersThree

### 2) Tipos y helpers
- `type CategoryIconKey = (union literal de las 50 keys)`
- `CATEGORY_ICON_SET: CategoryIconKey[]`
- `isCategoryIconKey(x): x is CategoryIconKey`
- `getCategoryIconComponent(key)`:
  - Web devuelve componente Phosphor React
  - Mobile devuelve componente Phosphor RN
  - (si hace falta) wrapper para props comunes: `size`, `color`, `weight`

---

## Reemplazar emojis por iconos (modelo + UI)

### A) Datos
- Sustituir `emoji` (string) por `iconKey` (CategoryIconKey) en:
  - DTOs
  - tipos compartidos
  - forms (create/edit)
  - persistencia (DB / Supabase si aplica)

**Compatibilidad retro:**
- Si ya hay categorías con emoji:
  - Mantener lectura temporal: si `iconKey` es null y hay `emoji`, mapear a un `iconKey` equivalente en runtime (best-effort).
  - Añadir una migración/backfill si existe acceso a DB:
    - Convertir emojis más comunes a iconKey (🍔→ForkKnife, 🏠→House, 🚗→Car, 💊→Pill, 🛒→ShoppingCart, etc.)
  - Después, eliminar la ruta de emoji si el repo ya no la necesita.

### B) UI
- Reemplazar el selector de emoji por un **IconPicker**:
  - Grid (p.ej. 5–6 columnas móvil, 8–10 web según ancho)
  - “No seleccionado”: `weight="regular"`
  - “Seleccionado”: `weight="fill"` + estado visual (borde o fondo sutil) sin cambiar tamaño
- Donde se renderiza el icono de categoría (lista, tiles, detalle):
  - Usar `iconKey` → componente icono
  - Si legacy emoji: fallback visual temporal (ver compatibilidad retro)

---

## Sugerencia de icono por nombre de categoría

### API
Implementar en shared: `suggestCategoryIcon(inputName: string): { primary: CategoryIconKey; suggestions: CategoryIconKey[]; confidence: "high"|"medium"|"low"; matchedOn?: string }`

### Normalización
- lowercase
- trim
- quitar acentos (normalize NFD + regex diacríticos)
- split por espacios y separadores (`/`, `-`, `_`)

### Matching (orden)
1) **Diccionario de keywords (ES/EN) → iconKey**
   - Ejemplos mínimos (amplía):
     - comida, restaurante, bar, cafe, groceries → ForkKnife / ShoppingCart
     - hogar, casa, alquiler, hipoteca → House / Buildings
     - gasolina, fuel → GasPump
     - coche, auto, car → Car
     - bus, autobus → Bus
     - tren, train → Train
     - viaje, flight, avion → Airplane
     - entradas, ticket, evento → Ticket
     - salud, medico, hospital → FirstAidKit / Stethoscope
     - farmacia, medicamento → Pill
     - suscripcion, subscription, factura → Receipt / CreditCard
     - trabajo, office → Briefcase
     - ropa, clothes → TShirt
     - mascota, pet → PawPrint
     - deporte, gym → Barbell / Basketball
     - tecnologia, internet → WifiHigh / Laptop / Phone
     - regalos → Gift
     - compras → ShoppingCart / Handbag
     - ahorro → PiggyBank / Bank
2) Si está disponible `@phosphor-icons/core`, intentar fuzzy match:
   - comparar tokens del nombre con `tags` / `categories` del icono
   - scoring simple (conteo de coincidencias + bonus por match exacto)
3) Fallback:
   - `primary = Tag` (o `Storefront` si preferís)
   - `suggestions` = un set de “comunes” (House, ShoppingCart, ForkKnife, Car, Receipt, CreditCard)

### UI con sugerencia si confidence != high
- Al abrir el picker:
  - Mostrar la **sugerencia primaria preseleccionada** (highlight)
  - Mostrar una fila “Sugeridos” arriba con `suggestions` (máx 6)
- Si el usuario cambia el icono manualmente, no volver a auto-cambiarlo al teclear (solo sugerir).

---

## Definition of Done
- [ ] Existe un módulo compartido con las 50 keys y helpers (`CategoryIconKey`, `CATEGORY_ICON_SET`, etc.).
- [ ] Emoji picker eliminado/reemplazado por IconPicker en web y móvil.
- [ ] Estado seleccionado usa **filled** (o peso equivalente) de Phosphor.
- [ ] Categorías renderizan el icono por `iconKey` en todas las pantallas (tiles, listas, detalle).
- [ ] `suggestCategoryIcon` implementada con diccionario + fallback, y usada en el flow create/edit.
- [ ] Si no hay match, UI muestra sugeridos y preselección sugerida.
- [ ] Tests:
  - unit tests de `suggestCategoryIcon` con casos ES/EN y acentos
  - snapshot/visual test básico del IconPicker (si el stack lo permite)
- [ ] No se rompe compatibilidad con categorías existentes (o hay migración/backfill).

---

## Notas de implementación
- Importar iconos de forma **estática** (50 es asumible) para evitar dynamic requires raros en RN.
- Asegurar que tamaño y alineación del icono sea consistente entre regular/fill.
- Usar tokens de color existentes: `muted` para no seleccionado, `foreground/primary` para seleccionado.

## Entregables
- PR con:
  - módulo shared de iconos
  - IconPicker web + IconPicker móvil
  - migración/backfill o compat layer
  - función `suggestCategoryIcon` + tests
