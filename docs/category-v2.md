Unificar estilo de “Category Tile” con “Transaction Tile” + menú hamburguesa
Contexto

En Finnon ya existe un tile de transacción con un estilo visual y jerarquía correctos. El tile de categoría actualmente se percibe distinto (componentes/espaciados/controles), y quiero que se iguale al patrón de transacciones para coherencia visual y de interacción.

Además, cada categoría debe tener un botón tipo “hamburguesa / kebab” (⋮) que abra un menú de opciones.

Principios a respetar: jerarquía por espacio y tipografía, no por color; continuidad visual; animaciones sutiles y funcionales; sin overlays dramáticos. 

ux-approach

 

design-principles

Objetivo

Refactor del componente CategoryTile para que use el mismo layout, spacing, tipografía y “feel” que el TransactionTile.

Añadir botón de menú (⋮) en el tile de categoría con acciones mínimas:

Editar categoría

Eliminar categoría

(Opcional si ya existe) Ver transacciones de esa categoría / Filtrar por categoría

Alcance (Web + Mobile)

Web (Next.js): menú tipo dropdown/popover anclado al botón (⋮).

Mobile (React Native / Expo): menú tipo bottom sheet o ActionSheet equivalente, manteniendo continuidad (sin overlays agresivos). 

ux-approach

 

design-principles

Requisitos de UI/UX

Reutilizar patrón de TransactionTile:

Misma altura base aproximada

Mismo padding horizontal/vertical

Misma alineación del contenido principal (título + metadata si aplica)

Misma “densidad” visual (no introducir nuevos adornos)

Menú (⋮):

Ubicado en el extremo derecho del tile, alineado verticalmente al centro

Área táctil mínima (44x44 en mobile)

Accesible con aria-label / accessibilityLabel

Color:

Usar solo tokens semánticos existentes (nada hardcoded) 

color-guide

No crear tokens nuevos

Animación:

Sutil, sin rebotes (si hay) y rápida (100–200ms aprox.), sin llamar la atención 

ux-approach

 

design-principles

Requisitos técnicos

Localiza TransactionTile y extrae lo que sea reusable:

Layout base (container, spacing, alineaciones)

Tipos (props)

Subcomponentes comunes (por ejemplo TileContainer, TileTitle, TileMeta, etc.)

Refactor CategoryTile:

Debe renderizarse con la misma estructura base que TransactionTile.

Evitar duplicar estilos: si TransactionTile usa styles.tile, CategoryTile debe usar el mismo o un shared Tile.

Menú de acciones

Crear un componente reusable: TileMenuButton o OverflowMenuButton

Web:

Popover/Dropdown anclado al botón

Cerrar al hacer click fuera / ESC

Mobile:

Bottom sheet / ActionSheet con opciones

Cerrar al seleccionar acción o al swipe down

Acciones

“Editar”: abre el flow existente (modal/pantalla) de editar categoría si ya existe; si no existe, crea el mínimo necesario sin expandir alcance.

“Eliminar”: confirma (confirm dialog / alert) y ejecuta borrado; manejar loading + error.

“Ver/Filtrar” (opcional): navegar o aplicar filtro si ya existe infraestructura.

Estados

Loading/disabled si una acción está en progreso

Errores: toast/snackbar con copy sobrio

Tests / QA mínimo

Snapshot o test de render básico (si tenéis infra)

Verificar que el menú abre/cierra y dispara callbacks

Definition of Done

CategoryTile es indistinguible en patrón respecto a TransactionTile (misma estructura base, alineación, spacing).

Cada categoría muestra botón (⋮) y las opciones funcionan (editar/eliminar, y opcional filtrar).

No hay colores hardcoded: solo tokens (color.*) 

color-guide

Mobile usa un patrón tipo bottom sheet / action sheet sin overlay dramático 

ux-approach

 

design-principles

Accesibilidad OK (labels + hit area).

No se introducen cambios colaterales en otras pantallas.

Entregables (lista de cambios esperada)

CategoryTile refactor (web + mobile o shared)

Nuevo componente reusable para menú overflow (web + mobile)

Wiring de acciones (edit/delete) con confirmación y feedback

Ajustes de estilos para compartir base con TransactionTile