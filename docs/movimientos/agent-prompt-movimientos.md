# Prompt para Agente de Código — Pantalla Movimientos (Finnon)

## Contexto del proyecto

Finnon es una aplicación de finanzas personales para parejas, compañeros de piso e individuos. Stack: React Native (Expo managed workflow), Expo Router, TypeScript, Zustand, Supabase, Tailwind CSS (NativeWind). La app comparte código mediante el módulo `@poleursus/shared`.

## Qué necesito

Implementar la pantalla **Movimientos** siguiendo el wireframe y la especificación de componentes adjuntos. Esta pantalla es el one-stop para gestionar movimientos: buscar, filtrar, registrar recurrentes y revisar transacciones.

## Archivos de referencia

1. **`movimientos-redesign-v2.html`** — Wireframe interactivo con la estructura visual exacta, interacciones de filtros, búsqueda y registro de recurrentes. Ábrelo en un navegador para ver el comportamiento.
2. **`movimientos-components.ts`** — Especificación técnica con interfaces TypeScript, árbol de componentes, design tokens, shape del store Zustand y flujo de datos.

## Arquitectura de la pantalla

La pantalla tiene esta jerarquía de secciones, de arriba a abajo:

### 1. Navegación de mes
- Flechas prev/next para navegar entre meses
- Label con mes y año actual
- Botón de calendario para seleccionar un mes específico (date picker nativo)
- Link a pantalla de Recurrentes (navegación con Expo Router)

### 2. Resumen (3 tarjetas)
- **Ingresos**: total del mes (incluyendo pendientes) + subtítulo "X confirmados"
- **Gastos**: total del mes (incluyendo pendientes) + subtítulo "X confirmados"  
- **Balance**: total del mes + subtítulo "X actual" (solo confirmados)
- Cada tarjeta tiene borde izquierdo de 3px con color semántico (verde/rojo/negro)
- Los totales se calculan client-side desde el array de movimientos

### 3. Recurrentes por registrar (condicional)
- **Solo aparece cuando hay recurrentes sin registrar este mes**
- Color púrpura (#7C5CFC) para diferenciarse de pendientes y realizados
- Header con icono 🔄, label "Por registrar", count, botón colapsar/expandir
- Lista de RecurrentCard, cada uno con: icono categoría, nombre, meta (categoría · subcategoría · fecha), importe, botón "Registrar"
- Botón "Registrar todos (N)" al final
- **Comportamiento de registro**: al pulsar "Registrar":
  - Animar la card hacia la derecha con fade out
  - Crear un Movement nuevo a partir del template
  - Si la fecha del movimiento <= hoy → status: 'confirmed' → aparece en grupo Realizados
  - Si la fecha del movimiento > hoy → status: 'pending' → aparece en grupo Pendientes
  - Actualizar el count y el botón "Registrar todos"
  - Cuando no queden recurrentes, ocultar toda la sección con animación

### 4. Búsqueda y filtros

#### Barra de búsqueda
- Input con icono de lupa a la izquierda
- Placeholder: "Buscar movimiento, comercio, importe..."
- **Comportamiento de búsqueda global**: cuando el usuario escribe texto:
  1. El selector de mes se oculta con animación (opacity 0, height 0)
  2. Aparece un banner azul: "🔍 Mostrando resultados de todos los meses" con botón ✕ para salir
  3. La lista de movimientos busca en TODOS los meses, no solo el seleccionado
  4. Los resultados mantienen la agrupación Pendientes/Realizados
- Al limpiar la búsqueda: volver a vista con mes seleccionado
- Badge "Búsqueda global" dentro del input (derecha) visible cuando tiene texto o focus

#### Chips de filtro (fila horizontal)
- **Ingresos** (count), **Gastos** (count) — toggle on/off
- Separador visual (línea vertical 1px)
- **Categoría** — dropdown con búsqueda interna, opciones dinámicas por cuenta
- **Comercio** — dropdown con búsqueda interna, opciones dinámicas por cuenta
- Los chips activos cambian a fondo negro con texto blanco
- Los dropdowns son multi-select con checkmarks

#### Tags de filtros activos
- Aparecen debajo de los chips solo cuando hay filtros activos
- Cada tag: fondo azul claro, texto azul, botón ✕ para quitar
- Botón "Limpiar todo" al final

### 5. Grupo Pendientes (condicional)
- Solo aparece en el mes actual o futuros (no en meses pasados)
- Header: dot ámbar + "PENDIENTES" + count + importe neto
- Movimientos agrupados por fecha con separadores ("26 de febrero", etc.)
- Filas con fondo ámbar (#FFF8E6), borde ámbar (#F5D990)
- Importes con opacidad reducida (0.7) para diferenciar de confirmados
- **No tienen botón de acción** — son solo informativos

### 6. Grupo Realizados
- Siempre presente
- Header: dot verde + "REALIZADOS" + count + importe neto
- Movimientos agrupados por fecha con separadores
- Filas con fondo blanco, borde gris
- Importes a opacidad completa

### Fila de movimiento (MovementRow)
- Grid de 3 columnas: [icono 36px] [info flexible] [importe + badges]
- Icono: emoji de categoría en cuadrado redondeado (8px radius)
- Info: nombre del comercio (14px, medium) + categoría · subcategoría (12px, gris)
- Importe: verde para ingresos, rojo para gastos
- Badge de usuario: círculo de 20px con inicial del email
- Al pulsar: navegar al detalle del movimiento

## Design tokens

Usar estos colores exactos (definidos en el archivo de componentes):
- Background: #FAFAFA
- Surface: #FFFFFF  
- Income green: #22A06B / bg #E6F9F0
- Expense red: #DE350B / bg #FFF0E6
- Pending amber: #E2850A / bg #FFF8E6 / border #F5D990
- Recurrent purple: #7C5CFC / bg #F3F0FF / border #D4CCFF
- Accent blue: #0065FF / bg #E6F0FF
- Text primary: #1A1A1A
- Text secondary: #6B6B6B
- Text tertiary: #9B9B9B

Tipografía: DM Sans. Border radius: 8/12/16/999px.

## Store Zustand

Crear un store `useMovementsStore` con:

```typescript
interface MovementsStore {
  selectedMonth: { month: number; year: number };
  filters: MovementFilter;
  isSearchMode: boolean;
  isRecurrentSectionCollapsed: boolean;
  
  setMonth: (month: number, year: number) => void;
  toggleTypeFilter: (type: 'income' | 'expense') => void;
  setCategoryFilter: (categoryIds: string[]) => void;
  setMerchantFilter: (merchantNames: string[]) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  registerRecurrent: (templateId: string) => Promise<void>;
  registerAllRecurrents: () => Promise<void>;
  toggleRecurrentCollapse: () => void;
}
```

Los datos derivados (filteredMovements, groupedByStatus, summary, unregisteredRecurrents) se calculan como selectores, NO se almacenan en el store.

## Queries Supabase

- Movimientos del mes: `movements` table filtrado por `account_id`, `date` entre primer y último día del mes
- Búsqueda global: `movements` table filtrado por `account_id` + `ilike` en `title`, `category_name`, `subcategory`
- Recurrentes sin registrar: `recurring_templates` table donde no existe un `movement` con `recurring_template_id` = template.id para el mes actual
- Registro: INSERT en `movements` + UPDATE en template (o crear registro en tabla de tracking mensual)

## Restricciones técnicas

- No usar librerías externas pesadas para animaciones. Usar `react-native-reanimated` si ya está en el proyecto, si no, `Animated` nativo.
- Los dropdowns de filtro en mobile deben ser bottom sheets (no dropdowns flotantes como en web).
- El componente debe funcionar tanto en la app móvil (React Native) como en web (Next.js) si se usa el módulo compartido. Si la implementación es solo para mobile, indicar qué partes necesitarían adaptación para web.
- Preferir cálculos client-side para summary y filtrado (evitar queries adicionales a Supabase por cada cambio de filtro).

## Criterios de aceptación

1. La pantalla muestra correctamente las tres secciones: Recurrentes por registrar, Pendientes, Realizados
2. Registrar un recurrente lo mueve al grupo correcto con animación
3. La búsqueda es global y oculta el selector de mes
4. Los filtros de tipo (chips) y los dropdowns de categoría/comercio funcionan combinados
5. El resumen muestra totales proyectados Y confirmados
6. La sección de recurrentes desaparece cuando no hay pendientes
7. En meses pasados, no aparece el grupo Pendientes ni la sección de Recurrentes
8. Los colores, tipografía y espaciado coinciden con el wireframe

## Archivos esperados como entregable

- `screens/MovementsScreen.tsx` — Pantalla principal
- `components/movements/SummaryCards.tsx`
- `components/movements/RecurrentSection.tsx`
- `components/movements/SearchBar.tsx`
- `components/movements/FilterRow.tsx`
- `components/movements/DropdownFilter.tsx` (o `BottomSheetFilter.tsx` para mobile)
- `components/movements/MovementGroup.tsx`
- `components/movements/MovementRow.tsx`
- `components/movements/DateSeparator.tsx`
- `stores/useMovementsStore.ts`
- `hooks/useMovements.ts` (queries Supabase)
- `types/movements.ts` (interfaces del archivo de componentes)
