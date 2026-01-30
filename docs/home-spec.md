1) Home consolidada (web + móvil + web móvil): orden definitivo

1) Hero (Estado del mes / hoy)

Neto del mes (grande): +€X / -€X

Debajo, en pequeño: Ingresos y Gastos

Fila: Balance hoy

Chip condicional: “Incluye pendiente €X” (solo si hay pendiente)

2) Próximos 7 días

Toggle 7/14/30 (como ya tienes)

Hazlo más útil: además del neto, muestra 2–3 próximos eventos (ej: “Vie: Alquiler €900”, “Lun: Luz €45”)

3) Calendario semana (apoyo)

Week strip (lun–dom) con tus dots

Botón/link: “Ver mes” (abre vista mensual en sheet/modal)

4) Actividad reciente

Lista tal cual, con “Ver transacciones”

CTA “+ Añadir” siempre flotante.

Esto te deja un home que se entiende en 2 segundos y no depende del calendario.

2) Componente “Calendario Semana” (cómo debe funcionar)
UI

Una fila con los 7 días (lun–dom), cada celda:

número del día

hasta 3 dots (si hay más, “+n” pequeñito)

Estado seleccionado (fondo suave)

Hoy con borde/punto destacado

Interacción

Tap día ⇒ Bottom sheet “Detalle del día”

total del día (neto)

lista de movimientos del día

CTA: “Añadir para este día” (pre-rellena fecha)

“Ver mes”

Abre vista mensual completa (sheet en móvil, panel/drawer en desktop)

En esa vista mensual sí puedes poner leyenda + navegación de mes.

3) Responsive: reglas simples (para que web móvil parezca app)
Móvil (app + web móvil)

Home en 1 columna

Calendario = semana (por defecto)

“Ver mes” = bottom sheet / full screen modal

Desktop web

2 columnas si quieres, pero:

Izquierda: Hero + Próximos + Actividad

Derecha: Semana + mini “Detalle del día” (en vez del mes enorme)

“Ver mes” abre el calendario mensual en panel

4) Limpieza obligatoria de consistencia (rápido y con impacto)

Unifica navegación en móvil

Web móvil debería tener bottom nav igual que app (Inicio/Movimientos/Objetivo/Cuenta)

La hamburguesa queda para ajustes/extra, no para navegar lo principal.

Unifica el FAB

Mismo color y estilo en app y web móvil (elige uno y muere con él).

Respeta safe-area para que no tape la lista.

Leyenda de dots

Aunque sea apoyo, sin leyenda es críptico. Solución minimal:

iconito i junto a “Semana”

tooltip/sheet: “Verde ingresos · Rojo gastos · Amarillo pendiente”

5) Qué haría ya (prioridad)

Sustituir el calendario mensual del Home por Calendario Semana.

Añadir Detalle del día en bottom sheet al tocar un día.

Reordenar Home: Hero arriba + Próximos + Semana + Actividad.

Unificar navegación y FAB en web móvil para que sea “app-like”.

Si quieres, te dejo también el copy exacto (títulos) para que suene consistente:

“Resumen del mes”

“Próximos” (7/14/30)

“Semana” + link “Ver mes”

“Actividad reciente”

Cuando lo implementes, esa home va a sentirse mucho más “producto serio” y menos “calendario bonito con números”.