# Prompt para agente de código — TransactionTile (identidad unificada de items)

## Objetivo
Re-diseñar e implementar **un único componente de lista** para transacciones (web + mobile) que:
- “respire” (menos ruido visual, más jerarquía por espacio/alineación)
- use **tokens semánticos** (sin colores hardcodeados)
- reduzca acciones “gritonas” (Eliminar deja de ser un botón grande persistente)
- mantenga **misma entidad** visual en móvil, navegador móvil y desktop (cambiando solo densidad)

## Contexto actual (problemas a resolver)
- El item actual está “apilado”: icono + texto + importe + avatar + botón Eliminar compiten.
- Cards con borde/sombra dentro de listas → sensación pesada.
- “Eliminar” ocupa atención permanente.
- Móvil/web difieren en patrones.

## Guardarraíles
- No refactor masivo: limita cambios al componente de item y su lista contenedora.
- No inventar paleta: **usar tokens existentes**.
- Mantener funcionalidad: ver detalle/editar (si existe), borrar, mostrar creador.

---

## Especificación de diseño (componente único)
### Layout: 3 zonas (siempre igual)
**Row** con:
1) `Leading` (izquierda): icono de categoría en “badge” suave (contenedor).
2) `Content` (centro): comercio + meta (fecha y notas).
3) `Trailing` (derecha): importe (arriba) + avatar + botón “…” (abajo).

### Jerarquía tipográfica
- Comercio: 16px / semibold
- Importe: 16px / semibold (alineado a la derecha)
- Meta (fecha, notas, categoría): 13–14px / regular
- Notas: **máx 1 línea** (truncate). Si no hay notas, solo fecha.

### Color (solo por intención, usando tokens)
- Fondos:
  - Pantalla/lista: `color.bg.primary`
  - Badge icono: `color.bg.secondary` (default) y/o `color.action.secondary` (pressed/selected)
- Texto:
  - Principal: `color.text.primary`
  - Secundario: `color.text.secondary`
  - Muted: `color.text.muted`
- Separadores: `color.state.neutral`
- Importes:
  - Ingreso: `color.state.positive`
  - Gasto: `color.state.negative`
  - Detalle sutil: el signo “-” y la divisa pueden ir en `color.text.muted` y los dígitos en state color.

### States
- Default: sin sombra pesada
- Pressed: fondo suave `color.action.secondary` (sin overlays)
- Hover (web): opcional, mismo tratamiento que pressed pero más sutil
- Focus (web): outline accesible (sin inventar color)

---

## Comportamiento de acciones
- Eliminar **no** es botón persistente grande dentro del item.
- Acciones pasan a:
  - Botón `…` (siempre visible) → menú con:
    - “Editar” (si existe)
    - “Eliminar”
  - (Opcional si ya lo tenéis fácil) swipe left en móvil para revelar “Eliminar”.
- Mantener borrado confirmable si ya existía confirmación; si no, añade confirm simple (alert sheet) para evitar taps accidentales.

---

## Contrato del componente (API)
Crear `TransactionTile` con una API común:

```ts
type TransactionTileProps = {
  transaction: {
    id: string
    merchant: string
    category?: { id: string; name: string; icon: string }
    notes?: string | null
    date: string | Date
    amount: number // signed o separado por type; decide pero consistente
    currency: string // "EUR" etc.
    createdBy?: { initial: string } // (avatar letra)
    accountName?: string // opcional, si aplica en web
    type?: "income" | "expense" // si lo tenéis
  }
  density?: "comfortable" | "compact" // default: comfortable
  onPress?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  showAccountName?: boolean // default false, web puede true si hay espacio
}


Notas:

El componente debe ser usable en web y mobile con el mismo contrato.

density ajusta padding/altura y tamaño del badge/icono.

Implementación — Web (Next.js)

Sustituir el item actual por TransactionTile.

Lista:

Eliminar sombras pesadas y “cards” redundantes.

Usar separadores 1px color.state.neutral entre items.

Contenedor con color.bg.primary.

Truncado:

Comercio: 1 línea.

Meta: 1 línea (line-clamp: 1).

Menú …:

Usar el componente de menú que ya tengáis (Radix, Headless UI, etc.).

Accesible con teclado (tab + enter + escape).

Hover:

Opcional: mostrar … solo en hover en desktop. Si complica, dejar siempre visible.

Implementación — Mobile (React Native / Expo)

Sustituir el item actual por TransactionTile.

Estilos:

Quitar botones grandes internos (“Eliminar”).

Mantener layout 3 zonas con flexDirection: "row".

Truncado:

numberOfLines={1} en merchant y meta.

Menú …:

Usar ActionSheet / BottomSheet ligero (el que ya tengáis).

Items: Editar (si existe), Eliminar (destructivo).

(Opcional) Swipe:

Solo si ya tenéis infraestructura (gesture handler).

Si no, no lo metas ahora: el menú … cumple.

Detalles visuales (medidas)

comfortable:

paddingVertical: 12–14

paddingHorizontal: 14–16

gap leading/content: 12

badge: 36x36, radio 10–12

avatar: 24x24

compact:

paddingVertical: 10–12

badge: 32x32

Separador: 1px

Formateo de importe (sutil pero claro)

Alineado a la derecha.

Ejemplo gasto:

“-” y “€” en color.text.muted

“129,00” en color.state.negative

Ejemplo ingreso:

“€” en color.text.muted

“2,00” en color.state.positive

Usar el formateador de moneda existente (o Intl.NumberFormat).

Accesibilidad

Toda la fila debe ser “tappable/clickable” para ver detalle (si aplica).

Botón … con label accesible (“Más acciones”).

Menú con opción destructiva marcada como tal.

Estados focus visibles en web.


Acciones de TransactionTile (web + mobile) con libs reales del repo

## Contexto (stack actual)
- Mobile (Expo): NO hay librería de action sheet / bottom sheet instalada.
- Web (Next): ya usa Radix (`react-dialog`, `react-alert-dialog`, `react-select`), Tailwind, lucide.

## Objetivo
Implementar el patrón de acciones del nuevo `TransactionTile`:
- Sustituir el botón grande “Eliminar” por un botón `…` (kebab).
- `…` abre un menú con acciones:
  - Editar (si existe)
  - Eliminar (destructiva)
- Confirmar eliminación.

---

# Web — Implementación (Radix)
## 1) Dependencia
Añadir:
- `@radix-ui/react-dropdown-menu`

## 2) UI
En `TransactionTile` (web), en el trailing:
- Botón icono `…` (lucide `MoreHorizontal` o similar).
- Menú Radix DropdownMenu anclado al botón:
  - Item “Editar” (si `onEdit` existe)
  - Item “Eliminar” (destructivo)

## 3) Confirmación
Al pulsar “Eliminar”:
- Abrir confirmación usando el Radix `@radix-ui/react-alert-dialog` (ya existe en deps).
- Si confirma:
  - llamar a `onDelete(transaction.id)`
  - cerrar dialog
  - (opcional) usar `sonner` para toast “Eliminado” o “Error”.

## 4) Accesibilidad
- `aria-label="Más acciones"` en el botón `…`.
- Focus visible (usar clases tailwind ya existentes).
- `DropdownMenu` navegable con teclado (Radix lo da).

---

# Mobile — Implementación (Expo Action Sheet)
## 1) Dependencias
Instalar:
- `@expo/react-native-action-sheet`

## 2) Wiring global
En el root de la app (probablemente `app/_layout.tsx` o el entry layout de expo-router):
- Envolver el árbol con `<ActionSheetProvider>`.

## 3) UI del menú
En `TransactionTile` (mobile), botón `…` abre ActionSheet:
- Opciones: ["Editar", "Eliminar", "Cancelar"] (si `onEdit` existe)
  - Si no existe `onEdit`: ["Eliminar", "Cancelar"]
- `cancelButtonIndex` correcto
- `destructiveButtonIndex` para “Eliminar”

## 4) Confirmación
Cuando el usuario elige “Eliminar”:
- Mostrar `Alert.alert(...)` con botones:
  - Cancelar
  - Eliminar (style: "destructive")
- Si confirma:
  - llamar `onDelete(transaction.id)`.

## 5) Estados / feedback
- Mientras se borra, deshabilitar el botón `…` o mostrar loading (si hay estado disponible).
- Si falla, mostrar `Alert` simple con error.

---

# DoD
- Web: `…` usa Radix DropdownMenu y confirm usa Radix AlertDialog.
- Mobile: `…` abre ActionSheet y confirm usa Alert.
- “Eliminar” ya no aparece como botón grande persistente.
- Misma estructura del tile en web y mobile; solo cambia el mecanismo de menú.

Definition of Done

Existe TransactionTile con el contrato definido y se usa en:

Web (desktop y navegador móvil)

App móvil

Lista sin sombras pesadas; separadores sutiles.

Acciones: “Eliminar” ya no es botón grande persistente; está en menú … (y/o swipe opcional).

Solo tokens de color (sin hex hardcode).

Truncados correctos (comercio/meta) sin solaparse con importe/acciones.

Visualmente consistente entre plataformas (mismo layout, cambia solo densidad/espacio).