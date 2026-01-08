# Prompt de código — Categorías v2: “Add Category” directo + Catálogo + Drilldown a transacciones con filtro de fecha

## Contexto
Ya existe backend/lógica para categorías (y probablemente un primer CRUD básico). Queremos pulir el flujo para que:
1) La acción **“Add Category”** no muestre pantallas intermedias: abre **directamente** el wizard de creación.
2) Exista un punto estable en el menú llamado **“Categorías”** donde el usuario vea todas las categorías y pueda entrar al **detalle** para ver transacciones relacionadas con **filtros de fecha**.

La UX debe ser consistente entre **web** y **mobile** (mismo wording, misma jerarquía; cambia solo el layout/patrón: panel lateral en web, bottom sheet / screen en mobile).

---

## Objetivo
- Reducir fricción al crear categorías (1 intención = 1 acción).
- Convertir categorías en una herramienta para “entender el mes” (drilldown + rango de fechas).
- Reutilizar lógica y copy desde `packages/shared`, evitando acoplar a librerías de i18n concretas.

---

## Alcance

### A) Add Category → Wizard directo
- En el menú “Añadir” (web + mobile), al pulsar **Add Category**:
  - Abrir **directamente** el wizard de creación (sin pantallas puente).
  - Web: patrón **panel** (no overlay dramático).
  - Mobile: patrón **bottom sheet** o pantalla ligera, manteniendo continuidad (sin “modal del sistema”).

**Campos mínimos del wizard (v1):**
- `name` (requerido)
- `type` (`income` | `expense`) (requerido)
- `icon_id` (opcional si ya existe; recomendado mantenerlo si ya está en Prompt 07)

CTA:
- “Guardar categoría” (disabled si `name` vacío)

Al guardar:
- Cerrar panel/sheet
- Refrescar listado de categorías (y cualquier selector de categorías en transacciones)
- Mostrar feedback sobrio (toast/snackbar si existe)

---

### B) Menú: “Categorías” (listado)
Añadir un botón/entrada en el menú principal (o donde tenga sentido en tu navegación actual) llamado **“Categorías”**.

Pantalla (o panel) de listado:
- Mostrar todas las categorías de la **cuenta activa**
- Cada item: icono + nombre (y si es barato: `type` o un subtítulo)
- Estado vacío:
  - Texto: “Aún no hay categorías.”
  - CTA: “Crear categoría” → abre el wizard directo (mismo flujo que Add Category)

---

### C) Detalle de categoría → transacciones filtradas por fecha
Desde el listado, al seleccionar una categoría:
- Mostrar una vista de **Detalle de categoría** con:
  - Header: icono + nombre
  - Acciones (si ya existen en tu CRUD): editar / eliminar (opcionales en v1 si ya están implementadas)

**Sección: Filtro de fecha**
- Debe permitir ver transacciones asociadas a esa categoría filtrando por rango de fechas.
- Reutiliza el patrón ya existente en “Movimientos/Transactions”:
  - Default: **Mes actual**
  - Control mínimo recomendado:
    - Navegación de mes: anterior / siguiente
    - Opción de seleccionar un mes concreto (date picker) si ya existe en web
- Evitar inventar un segundo sistema de filtros: usa el mismo concepto (mes actual y rango derivado).

**Sección: Lista de transacciones**
- Mostrar lista de transacciones que cumplan:
  - `account_id` = cuenta activa
  - `category_id` = categoría seleccionada
  - `date` dentro del rango (derivado del filtro)
- Orden por fecha desc
- Reutiliza el mismo componente de item de transacción si existe (para consistencia).

**Resumen (nice-to-have si es fácil):**
- Total del rango (suma de `amount_minor` en la moneda base o display actual)

---

## Reutilización en shared (obligatorio)
### 1) Copy unificado
Todos los textos nuevos deben vivir en `packages/shared`:
- “Categorías”
- “Nueva categoría”
- “Guardar categoría”
- “Crear categoría”
- “Aún no hay categorías.”
- “No hay movimientos en este rango.”
- Labels de filtro: “Mes actual”, etc. (si aplica)

**Importante:** `shared` NO debe depender de ninguna librería i18n concreta.
- Expón un objeto/shape neutro (ej. `copy.esES.categories.title`) o una función pura.
- Mobile/Web consumen ese copy con su sistema actual.

### 2) Lógica de fechas (reutilizable)
Crea/extrae utilidades en `packages/shared` para:
- Calcular rango del mes visible (`startOfMonth`, `endOfMonth`)
- Avanzar/retroceder mes
- (Si existe) formateo de etiqueta “Enero 2026” de manera consistente

---

## Backend / Data layer (preferencia)
Evita duplicar queries:
- Si ya existe una función `listTransactions(...)`, extiéndela con filtros opcionales:
  - `category_id?: string`
  - `date_from?: string`
  - `date_to?: string`
- Asegura que el filtrado ocurre en query (no filtres todo en cliente).

---

## Guardarraíles (importante)
- Cambios mínimos: no refactor masivo de navegación.
- Nada de colores “para jerarquía”: jerarquía por **espaciado y tipografía**.
- Panel/bottom sheet **sin overlay** si es posible.
- Animaciones funcionales, sin rebotes.
- Respeta safe area en mobile.
- Mantén consistencia con la guía de tokens de color (usa `color.action.primary`, `color.text.*`, etc. No hardcode).

---

## Definition of Done (DoD)
1. **Add Category** en “Añadir” abre **directamente** el wizard (web + mobile).
2. Existe entrada **“Categorías”** en el menú y navega a listado (web + mobile).
3. Listado muestra categorías de la cuenta activa y tiene estado vacío con CTA a crear.
4. Al click/tap en una categoría → vista detalle que muestra transacciones relacionadas.
5. El detalle permite filtrar por fecha (mínimo: mes actual + prev/next; opcional: selector).
6. Lógica de fechas + copy viven en `packages/shared` y se consumen desde web/mobile sin acoplar shared a i18n.
7. No rompe `pnpm lint` / `pnpm typecheck` y los flujos existentes de transacciones.

---

## Checklist de implementación (sugerida)

### Shared
- [ ] Añadir keys de copy para categorías
- [ ] Añadir utils de fecha/mes para filtros
- [ ] Extender tipos: `TransactionFilters` (si existen) con `category_id` + `date_from/to`

### Web
- [ ] Añadir item “Categorías” en navegación
- [ ] Crear `CategoriesPage` (listado)
- [ ] Crear `CategoryDetailPage` (o panel) con filtro + lista
- [ ] Integrar “Add Category” → abre panel wizard directo

### Mobile
- [ ] Añadir item “Categorías” en navegación (según patrón actual)
- [ ] Crear pantalla listado categorías
- [ ] Crear pantalla/bottom sheet detalle categoría (o screen normal si encaja mejor)
- [ ] Integrar “Add Category” → bottom sheet wizard directo (sin pantalla intermedia)

---

## Notas para el agente
- Antes de crear componentes nuevos, busca si ya existe:
  - CRUD categorías (Prompt 07)
  - Selector de mes / filtro de transacciones
  - Componentes de lista de transacciones
  - Componentes de panel en web y bottom sheet en mobile
- Reutiliza primero, crea después.
