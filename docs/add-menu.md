31. Menú de añadir movimientos simplificado. Estas son las opciones
a) Movimiento: abre el menú de añadir movimiento. En este menú el usuario puede elegir si es un ingreso o es un gasto por lo que es redundante dar la opción desde el menú de añadir movimientos.
b) Añadir obligación: una obligación es un movimiento de gasto en el futuro que puede estar o no pagado. Esta opción puede integrarse en el menú de añadir movimiento mediante la adición de la opción (es obligación?) desde el menú de añadir movimiento. De esta manera, eliminamos otro elemento más del menú de añadir movimientos
c) Mover la opción de añadir categoría: esta opción está fuera de lugar si pensamos en el menú como de añadir movimientos, por lo que su lugar es mejor en la pantalla/página /categories. Mantener el mismo Copy: "+Añadir".

Finnon (Web + Mobile): Menú “Añadir” simplificado + mover “Añadir categoría”
Contexto

Somos Finnon (fintech personal/shared finance). Queremos reducir fricción mental y que “añadir” se sienta cotidiano y obvio, sin redundancias. 

finnon_mkt

Objetivo

Simplificar el menú de “Añadir”:

Eliminar la opción “Añadir obligación” del menú principal: la obligación se crea desde el flujo de “Añadir movimiento”.

Mantener una única entrada principal: “Movimiento” → abre el formulario donde el usuario decide:

Tipo: Ingreso / Gasto

¿Es obligación? (toggle) → si está activado, el movimiento es un gasto futuro “pendiente”, con estado pagado/no pagado.

Mover “+Añadir categoría” fuera del menú “Añadir movimientos”:

Su lugar es /categories (web) y Categories screen (mobile), manteniendo el mismo copy: “+Añadir”.

Alcance

Web (Next.js) y Mobile (Expo/React Native).

Cambios de UI + navegación + pequeñas adaptaciones de formularios.

No inventar tokens ni estilos nuevos: usar tokens existentes. 

color-guide

Cambios de UI / UX
A) Menú “Añadir” (web + mobile)

Antes: opciones separadas (Movimiento, Añadir obligación, Añadir categoría).
Después: solo:

Movimiento (única entrada)

Reglas UX (obligatorias):

Nada de overlays dramáticos / blur “modal”: continuidad visual prioritaria. 

ux-approach

 

design-principles

Animaciones sutiles, funcionales, sin rebote. 

ux-approach

Jerarquía por espaciado/alineación, no por color. 

design-principles

Colores SOLO con tokens semánticos (acción/estado), no decoración. 

color-guide

Entregable UI:

Actualizar el componente que renderiza el menú “Añadir” para que muestre solo un item: “Movimiento”.

Si existían handlers/rutas para “Añadir obligación” y “Añadir categoría” desde este menú: eliminarlos.

B) Formulario “Añadir movimiento”: integrar obligaciones

En el formulario de “Añadir movimiento” (web y mobile) añadir un control:

Toggle / checkbox: ¿Es obligación?

Por defecto: OFF

Al activarlo:

Forzar/seleccionar tipo Gasto (si el usuario estaba en Ingreso, cambiarlo a Gasto automáticamente).

Mostrar campo Pagado (switch):

Por defecto: OFF (si es obligación, normalmente nace como pendiente)

Mantener fecha (la obligación es “gasto futuro”, así que la fecha suele ser > hoy, pero no bloquear: solo permitir cualquier fecha.

Si ¿Es obligación? está OFF:

Ocultar Pagado si no aplica en el modelo actual (según implementación existente).

Nota: no duplicar flujos. “Obligación” no es otra pantalla; es una variante del mismo movimiento.

C) “Añadir categoría” se mueve a /categories

En /categories (web) y pantalla de categorías (mobile), añadir botón “+Añadir” (mismo copy).

Ese botón abre el flujo existente de crear categoría (modal/panel/screen según plataforma).

Eliminar accesos a “Añadir categoría” desde el menú “Añadir movimientos”.