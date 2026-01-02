“Transactions Screen: Mobile aligned to Web”
Contexto

Tenemos un monorepo con:

apps/web (Next.js) como referencia de UI/UX y estilos

apps/mobile (Expo / React Native) con una pantalla de transacciones que hoy diverge

packages/shared para reutilizar lógica y recursos (tipos, utilidades, i18n copies, iconografía)

Problema actual:

En mobile el filtro por mes es solo “anterior/siguiente”, mientras que web usa date picker.

Mobile no sigue la guía visual (hay botones de colores, emojis).

Faltan acciones consistentes en items (editar/eliminar).

Objetivo:

Alinear la pantalla de transacciones de mobile a la versión web en interacción y look&feel, sin duplicar lógica.

Objetivo (Outcome)

Month filter unificado: navegación por mes con botones anterior/siguiente + date picker opcional para saltos grandes.

Look&feel idéntico a Web: sin botones de colores ni “UI llamativa”; jerarquía por espacio/tipografía, color solo para estado/acción. 

design-principles

Sustituir emojis por iconos SVG (categorías) con un set común en packages/shared.

Acciones en items: click/tap en transacción/categoría abre edición. Eliminar el botón visible de “editar” si existe (o cualquier CTA redundante).

Definition of Done (Criterios de aceptación)
A. Month filter (comportamiento)

Se muestra un “Month navigator” con:

Botón Mes anterior

Texto central con el mes actual (ej. “Enero 2026”)

Botón Mes siguiente

Además, existe una acción secundaria para abrir un date picker (mes/año) para saltar rápido.

El estado del mes seleccionado afecta a:

Query de transacciones

Totales/resumen (si existe)

Estado vacío

B. UI alineada a web (estilo)

Se eliminan botones de colores, fondos llamativos y cualquier “decoración” no funcional.

Se usan tokens semánticos (no hex directos). 

color-guide

Jerarquía: tamaño/espaciado > color. Color solo para acciones y estados. 

design-principles

Nada de overlays dramáticos / modales agresivos. Si hay sheet/panel: continuidad visual (preferir sin overlay). 

ux-approach

C. Iconografía

Se eliminan emojis de categorías (lista y cualquier otro sitio en la pantalla).

Se implementan SVG icons para categorías:

Fuente de verdad: packages/shared/icons/*

En mobile se renderizan con un componente CategoryIcon (mismo icon_id que web).

Si falta un icono: fallback a un icono neutro (no emoji).

D. Interacción lista (editar)

Tap sobre item de transacción abre el flujo de editar transacción (sheet/pantalla según patrón actual del proyecto).

Tap sobre item de categoría (si aparece en esta pantalla) abre editar categoría.

Eliminar botones redundantes de editar en cada fila (si existen).

Guardrails (No negociables)

Reutilización:

La lógica de mes (helpers de fechas, parseo YYYY-MM, labels) debe ir a packages/shared.

Los iconos de categorías viven en packages/shared.

Tokens de color:

Prohibido hardcodear colores.

Usar tokens de Finnon — Color Tokens (v1) 

color-guide

Diseño silencioso:

Evitar UI “fintech”, saturada o con colores de categoría como protagonista. 

finnon_mkt

No romper navegación ni lógica de datos:

Solo refactor UI + interacción; no cambiar schema ni queries salvo lo necesario para soportar el month picker.

Accesibilidad:

Botones con hit-area suficiente, labels para screen readers, estados disabled claros.

Plan de implementación (pasos concretos)

Auditar Web como referencia

Identificar componentes equivalentes: MonthPicker/MonthNavigator, TransactionRow, CategoryRow, spacing, typography.

Crear/extraer en packages/shared

shared/date/month.ts:

toMonthKey(date) => 'YYYY-MM'

addMonths(monthKey, delta)

formatMonthLabel(monthKey, locale)

shared/icons/categories/* + shared/icons/CategoryIcon.tsx:

API: <CategoryIcon iconId size tone />

Mobile UI: Month Navigator + Date Picker

UI principal: anterior / label / siguiente

Acción secundaria: icono/calendario → abre picker (mes/año)

Picker: si RN no soporta mes/año nativo consistente, implementar un modal/sheet simple con:

selector de año + lista 12 meses

sin overlay dramático (o el mínimo), animación sutil 

ux-approach

Refactor estilos mobile

Sustituir estilos locales por tokens (mapeados a theme light/dark).

Eliminar botones con color “categoría”, chips chillones, etc.

Lista: click-to-edit

TransactionRow completo clickable → openEditTransaction(id)

CategoryRow clickable → openEditCategory(id)

Eliminar botón “editar” por fila si existe.

QA

Cambiar mes mantiene consistencia (incluye cambio rápido con picker).

Dark/light mode correcto.

No emojis en ningún punto.

Sin hardcoded colors.

Entregables

PR con:

Componentes nuevos/ajustados en apps/mobile para Transactions screen

Helpers de fechas + iconos SVG en packages/shared

Reemplazo de emojis por icon_id + CategoryIcon

Interacción tap-to-edit en items

Screenshots comparativas (web vs mobile) del header + lista.