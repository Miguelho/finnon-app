# Tarea — Carousel de Insights en tab Objetivo (Web + Mobile)

## Objetivo
En la pantalla “Objetivo”, renderizar los insights como un **carousel**.
Cada item del carousel sigue esta estructura vertical:
1) Zona superior: **Icono SVG** (o stack de iconos de categorías)
2) Zona inferior: **Texto del insight con datos**

## Requisitos UI
- Slide layout:
  - Icono centrado arriba con `InsightIconSlot` de altura fija
  - Texto abajo, alineado a la izquierda, máx 3 líneas con ellipsis
- Alto del carousel fijo para evitar saltos en swipe
- Indicador de páginas (dots) discreto
- No autoplay
- En web: permitir drag/wheel; en móvil swipe nativo
- Mostrar “peek” del siguiente item en web (1.1 items) si es fácil con el componente actual

## Iconografía (v1: 3 insights)
1) `forecast`:
   - SVG monoline: delta/arrow/sparkline
   - estado: positive si forecast >= target; negative si forecast < target; neutral si no hay datos
2) `mom_expense` (mes vs mes anterior):
   - SVG monoline de comparación (dos barras || + caret up/down)
   - estado: negative si gasto sube; positive si baja; neutral si no hay comparación
3) `top_categories`:
   - Renderizar hasta 4 iconos de categorías (grid 2x2 o row wrap)
   - Fallback a inicial si no existe icono
   - Orden por gasto desc

## Shared ViewModel
Crear `InsightViewModel` en `@poleursus/shared`:
- id: 'forecast' | 'mom_expense' | 'top_categories'
- iconKind: 'svg' | 'category-icons'
- status: 'positive' | 'negative' | 'neutral'
- body: string (texto ya formateado)
- svgName?: 'delta' | 'compare'
- categories?: Array<{ categoryId, iconName?, fallbackLetter?, colorToken? }>

La función `computeGoalInsights(...)` debe devolver un array estable de 0–3 insights según datos disponibles.

## Implementación
- Crear componente compartible `InsightsCarousel` (si ya hay un carousel, reutilizarlo)
- Crear `InsightSlide` genérico:
  - `renderIcon(viewModel)`
  - `renderBody(viewModel.body)`
- Asegurar consistencia de tamaños:
  - iconSlot: 56dp/px aprox
  - category icon chip: 28–32
- Tokens: usar colores de estado solo en un detalle del icono (no todo el icono).

## Definition of Done
- Carousel funcional en web + mobile, sin saltos de altura
- 3 tipos de insight renderizados con su iconografía
- Ellipsis y layout correctos en pantallas pequeñas
- No introduce librerías nuevas si ya hay carousel utilizable

# Update — InsightsCarousel (Web con chevrones)

## Objetivo
En la pantalla “Objetivo”, la visualización de insights será un carousel:
- Mobile: swipe (como ya estaba planteado).
- Web: navegación **por click** con **chevrones sutiles** a izquierda/derecha (no swipe).

## UI del slide (estructura fija)
Cada slide renderiza:
1) Zona superior: Icono (SVG monoline o stack de iconos de categorías)
2) Zona inferior: Texto del insight con datos

Layout:
- IconSlot con altura fija (p.ej. 64px) para evitar saltos.
- Texto: max 3 líneas, ellipsis, alineado a la izquierda.
- El slide debe mantener altura estable siempre.

## Web carousel behavior
- Muestra 1 slide a la vez (v1).
- Controles:
  - Botón chevron izquierdo: prev
  - Botón chevron derecho: next
  - Opcional: dots discretos (si ya existe componente)
- Estados:
  - Deshabilitar prev en index 0
  - Deshabilitar next en último index
  - No ocultar botones disabled (para evitar reflow)
- Accesibilidad:
  - Usar <button> real
  - aria-label: "Insight anterior" / "Insight siguiente"
  - Soporte teclado: ArrowLeft / ArrowRight cuando el carousel tiene foco
  - Contenido del slide con aria-live="polite"

## Estilo de chevrones (sutil pero usable)
- Hit area ~32–36px mínimo
- Icono 16–18px
- Opacidad baja por defecto; en hover/focus aumenta
- Disabled: opacidad más baja y cursor default
- Colocar centrados verticalmente respecto al carrusel, sin tapar el texto (si se superpone, cuidar padding)

## Implementación recomendada (web)
- Contenedor con overflow hidden
- Track horizontal con transform: translateX(-index * 100%)
- Transición 200–250ms (ease-out)
- Mantener width: 100% por slide

## Definition of Done
- Web: chevrons funcionales, estados disabled correctos, sin saltos de altura
- Keyboard nav funcionando
- Slide mantiene la estructura icono arriba + texto abajo
