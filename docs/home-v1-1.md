Prompt — Home consolidada (Web + Mobile + Web móvil): orden definitivo
Contexto

Finnon necesita una Home única y coherente en:

Web desktop

Mobile app

Web móvil (navegador)

La Home debe entenderse “en 2 segundos”, sin depender de un calendario mensual grande. 

home-spec

Objetivo

Implementar la Home consolidada con el orden definitivo y los componentes asociados:

Hero (Estado del mes / hoy)

Próximos (7/14/30)

Semana (week strip + detalle del día)

Actividad reciente
FAB “+ Añadir” siempre flotante.

Además:

Sustituir el calendario mensual del Home por Calendario Semana.

Añadir Detalle del día en bottom sheet/panel.

Añadir acceso “Ver mes” a vista mensual completa (en sheet/modal en móvil, panel en desktop). 

home-spec

Decisiones cerradas (NO debatir / NO proponer alternativas)

En mobile: bottom sheet para “Detalle del día” y para “Ver mes”. 

home-spec

En web desktop: layout puede ser 2 columnas, pero el mes completo NO va en el Home principal; “Ver mes” abre un panel. 

home-spec

Sin overlays dramáticos ni desenfoques: continuidad visual (preferencia “sin overlay”).

Color solo por estado/impacto, usar tokens, nunca hex directos.

Animaciones: sutiles, funcionales, sin rebotes.

Especificación UI (exacta)
1) Hero — “Resumen del mes”

Contenido:

Neto del mes (grande): +€X / -€X

Debajo (pequeño): Ingresos y Gastos

Fila: Balance hoy

Chip condicional: “Incluye pendiente €X” (solo si hay pendiente > 0) 

En web móvil: Ingresos y Gastos deben ir en 2 columnas inline (no en dos líneas). 

home-spec

2) Próximos — toggle 7/14/30

Mantener toggle 7/14/30 (ya existe).

Además del neto del rango, mostrar los movimientos del rango seleccionado (máx 10), ordenados por fecha. 
Si hay más de 10, mostrar el mensaje: “Si quieres ver más movimientos, ve a Movimientos”. 

home-spec

3) Semana — Calendario Semana (apoyo)

Week strip (lun–dom) con “dots”.

Selector de semana (NO de mes): navegar por semanas y mostrar semana del año y del mes.

Botón/link: “Ver mes” (abre vista mensual completa en sheet/modal/panel según plataforma). 

home-spec

4) Actividad reciente

Lista actual tal cual.

Link “Ver transacciones”.

FAB “+ Añadir” flotante siempre. 

home-spec

Componente “Calendario Semana” — comportamiento
UI de cada día (celda)

Número del día

Hasta 3 dots; si hay más: “+n” pequeño

Día seleccionado: fondo suave

“Hoy”: borde/punto destacado 

home-spec

Interacción

Tap día ⇒ abrir Bottom sheet “Detalle del día”

total del día (neto)

lista de movimientos del día

CTA: “Añadir para este día” (pre-rellena fecha)

En ese sheet: link “Ver mes” 

En web móvil, el panel inferior debe permitir scroll interno (nested) para ver todo el contenido. 

home-spec

Responsive (reglas simples)
Mobile (app + web móvil)

Home 1 columna

Calendario por defecto: Semana

“Ver mes”: bottom sheet / full screen modal

Web móvil debe sentirse “app-like”:

Bottom nav igual que app: Inicio / Movimientos / Objetivo / Cuenta

Hamburguesa solo para ajustes/extra 

home-spec

Desktop web

Puedes usar 2 columnas:

Izquierda: Hero + Próximos + Actividad

Derecha: Semana + mini “Detalle del día” (no mes enorme)

“Ver mes” abre calendario mensual en panel 

home-spec

Consistencia obligatoria (DoD de UI)

Unificar navegación en web móvil con bottom nav como la app. 
Debe verse en todas las tabs del flujo principal. 

home-spec

Unificar el FAB (mismo estilo/color en app + web móvil) y respetar safe-area para no tapar listas. 

home-spec

Leyenda minimal de dots:

iconito i junto a “Semana”

tooltip/sheet: “Verde ingresos · Rojo gastos · Amarillo pendiente” 

home-spec

Tokens de color SIEMPRE (no valores directos). 

color-guide

Nada de overlays/blur “de modal del sistema”.

Data / lógica mínima requerida (sin inventar features nuevas)

Implementa/consume selectors o endpoints existentes (o crea agregaciones si no existen) para:

monthSummary: neto, ingresos, gastos, pendiente (para chip condicional)

todayBalance

upcomingSummary(rangeDays) + upcomingItems(rangeDays, limit=10)

weekStrip(days=7): por día, número de movimientos + breakdown para dots (income/expense/pending)

dayDetail(date): neto del día + lista movimientos

monthView(month): dots por día; cambiar de mes no debe borrar los datos ya cargados. 

Reglas de representación:

Dots: máx 3; si más ⇒ +n

“Incluye pendiente” solo si pendingTotal > 0

Próximos: mostrar movimientos del rango (máx 10), ordenados por fecha (con día de semana + label corto); si hay más, mostrar el mensaje indicado. 

home-spec

Entregables (por plataforma)
Shared (si aplica)

Tipos/helpers para:

rangos 7/14/30

formateo del copy de “próximos movimientos” y mensaje de “ver más”

util de “startOfWeek (lun)”

Evitar duplicación de lógica entre web y mobile.

Web (Next.js)

Reordenar Home con las 4 secciones + FAB.

Implementar:

WeekStrip + DayDetail (sheet/drawer)

MonthView en panel al pulsar “Ver mes”

Desktop: soporte 2 columnas como regla descrita.

Mobile (Expo / RN)

Reordenar Home igual.

WeekStrip + BottomSheet DayDetail

MonthView en bottom sheet / modal full screen.

Web móvil (responsive)

Home 1 columna, comportamiento igual que app.

Bottom nav idéntica a app; hamburguesa solo ajustes. 

home-spec

Criterios de aceptación (checklist)

 El Home respeta el orden: Hero → Próximos → Semana → Actividad, con FAB siempre visible. 

home-spec

 El calendario mensual grande ya no aparece en Home.

 Tap en un día abre Detalle del día con neto + lista + CTA “Añadir para este día”.

 “Ver mes” abre vista mensual completa (sheet/modal en móvil, panel en desktop).

 Próximos 7/14/30 muestra neto + movimientos del rango (máx 10) y el mensaje de “ver más” si aplica. 

 Web móvil tiene bottom nav como app (no navegación principal por hamburguesa).

 Bottom nav visible en todas las tabs del flujo principal. 

 FAB unificado y no tapa contenido (safe-area OK).

 Leyenda de dots accesible desde icono i.

 Sin overlays/blur dramáticos; animaciones sobrias.

 Colores solo con tokens (sin hex).

 Pasa lint/typecheck y no rompe navegación existente.

 Selector de semana (no mes) con semana del año y del mes.

 En web móvil, el detalle del día permite scroll interno.

 En la vista mensual, los dots no se pierden al cambiar de mes.

 En web móvil, Ingresos/Gastos van inline en 2 columnas.

Copy exacto (usar tal cual)

“Resumen del mes”

“Próximos” (con toggle 7/14/30)

“Semana” + link “Ver mes”

“Actividad reciente” 

“Si quieres ver más movimientos, ve a Movimientos”
