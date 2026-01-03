“Gestión de categorías desde Añadir (web + mobile)”
Contexto

Monorepo con:

apps/web (Next.js)

apps/mobile (Expo / React Native)

packages/shared (tipos, lógica compartida, copy)

Ya existe backend + lógica de negocio para guardar categorías; falta la UI para gestionarlas.

Las categorías son por cuenta (account_id) y deben estar disponibles para todos los miembros de la cuenta (account members).

El menú “Añadir” ya existe (web y mobile). Queremos añadir ahí una entrada nueva.

Objetivo

Implementar una UI consistente (web y mobile) para crear/editar/eliminar categorías desde el menú “Añadir”, de forma que esas categorías se puedan usar al asignarlas a transacciones por cualquier usuario miembro de la cuenta.

Definition of done (requerido)

Opción “Añadir categoría” en el menú de Añadir (web y mobile).

Categorías disponibles para todos los usuarios de la cuenta (mismos datos compartidos por account_id).

Alcance funcional
1) Entrada en menú “Añadir”

Añadir un ítem visible y consistente en ambos:

Label: Añadir categoría

Icono: “tag”/“label” (si hay set de iconos, usar el existente; si no, uno neutro y simple)

Al pulsarlo:

Web: abrir el mismo patrón de panel/flow que ya uses para acciones de “Añadir” (ideal: panel lateral integrado, sin dramatismo).

Mobile: abrir una pantalla o bottom-sheet equivalente (lo que esté más alineado con tu navegación actual), manteniendo continuidad.

2) Pantalla/Panel “Categorías”

Contenido mínimo:

Lista de categorías de la cuenta activa (orden alfabético o por “último uso” si lo tienes fácil; si no, alfabético).

Acciones:

“Nueva categoría”

Editar (tap en item o botón)

Eliminar (con confirmación)

Crear / Editar categoría

Campos:

name (obligatorio)

type si aplica (income / expense / both) según tu modelo actual

icon_id si ya existe en modelo (si no hay selector aún, dejarlo opcional o elegir default)

Validaciones UI (y si ya existen en backend, reflejarlas):

Nombre no vacío, trim

Longitud razonable (p.ej. 2–40)

Evitar duplicados por cuenta (case-insensitive) si backend lo soporta; si no, manejarlo como error de integridad con un mensaje claro.

Eliminar

Confirmación simple:

Título: “Eliminar categoría”

Texto: “Se eliminará de esta cuenta.”

Si hay transacciones asociadas y backend lo impide o lo reasigna:

Mostrar el error tal cual y mensaje claro (“No se puede eliminar si está en uso”) o implementar “re-asignar” solo si ya existe.

3) Disponibilidad en transacciones

Asegurar que el selector de categoría en el formulario de transacciones (web y mobile) usa la lista compartida de categorías de la cuenta activa:

Tras crear/editar/eliminar, debe reflejarse al volver al formulario (refetch o update de cache/store).

UX / UI guardrails (no negociables)

Mantener continuidad visual: evitar overlays dramáticos; si hay modal/panel, que se sienta integrado. 

ux-approach

 

design-principles

Jerarquía por espacio y tipografía, no por color.

Animaciones: sutiles, funcionales, sin rebotes.

Colores: usar tokens, nunca hex directos. 

color-guide

Estados:

Loading (skeleton/placeholder sobrio)

Empty state (copy breve)

Error (toast o inline, sin alarmismo)

Shared module (packages/shared) — obligación
Copy (wording) compartido

Todo el copy de esta feature debe vivir en packages/shared.

apps/web y apps/mobile leen el copy desde shared usando su i18n, sin acoplar shared a ninguna librería de i18n.

Añadir keys mínimas (ejemplos):

add.menu.addCategory

categories.title

categories.empty.title

categories.empty.body

categories.cta.new

categories.form.name.label

categories.form.save

categories.form.cancel

categories.delete.title

categories.delete.body

categories.delete.confirm

categories.error.duplicateName

common.loading

common.errorGeneric

Tipos / validación compartida

Si no existe ya, colocar en shared:

Tipo Category

Zod schema / validator de CategoryCreateInput y CategoryUpdateInput

Helper normalizeCategoryName(name) (trim + colapsar espacios, etc.)

Data access / permisos

Conectar la UI a las funciones existentes de categorías (ya hay backend):

listCategories(accountId)

createCategory(accountId, payload)

updateCategory(categoryId, payload)

deleteCategory(categoryId)

Asegurar que siempre se usa activeAccountId como fuente de verdad.

Garantizar que un miembro de la cuenta ve las mismas categorías (mismo account_id). (Se asume que RLS/policies ya lo permiten.)

Entregables

Web

Menú “Añadir” con ítem “Añadir categoría”

Vista panel/página de gestión con lista + CRUD

Mobile

Menú “Añadir” con ítem “Añadir categoría”

Pantalla/bottom-sheet equivalente con lista + CRUD

Shared

Copy keys nuevas + export(s)

Validación/normalización compartida (si procede)

Estados y errores

Empty state + loading + error

Tests mínimos

Unit test de normalización/validación en shared

(Opcional) test de integración: crear categoría y verla en selector de transacción

Criterios de aceptación (concretos)

Desde “Añadir” → “Añadir categoría”:

puedo crear una categoría y verla al instante en la lista

al volver al formulario de transacción, aparece en el selector

Dos miembros distintos de la misma cuenta:

ven la misma lista de categorías

pueden usar esas categorías en transacciones

UI:

sin colores hardcoded (solo tokens) 

color-guide

sin overlay dramático / sin sensación “modal del sistema” 

ux-approach

 

design-principles

Copy: todo en packages/shared (nada duplicado en apps)