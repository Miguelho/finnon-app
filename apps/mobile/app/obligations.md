Implementar Obligations (Mobile) + Verificar/Fijar Web + Diferenciación clara con Recurring
Contexto (lo que ya existe)

Tenemos dos conceptos distintos:

Obligación (Obligation)

Evento único con due_date y estado pending|paid (+ paid_at opcional).

Sirve para “próximas obligaciones” y para calcular dinero comprometido vs pendiente.

Ejemplos: pago tarjeta este mes, factura puntual.

Transacción recurrente (RecurringItem)

Serie repetitiva (weekly/monthly/yearly + interval + start/end).

Genera ocurrencias virtuales y el usuario confirma cada una para convertirla en transacción real.

No crea transacciones automáticamente.

Observación actual: en mobile (home) se está pasando obligations: [] vacío → las obligaciones no están integradas en la UI móvil.

Además, en Web, el menú/flujo de “añadir obligación” muestra “schedule / recurrent payment” (confunde obligación con recurrente). Eso hay que separarlo.

Objetivo

Mobile: implementar Obligations end-to-end (listar, crear/editar, marcar pagada, ver “comprometido vs pendiente”), usando el mismo modelo/servicios que Web.

Web: verificar la implementación real de Obligations y corregir el UX/copy para que quede imposible confundir Obligation con Recurring (especialmente en el menú de “añadir”).

Mantener el enfoque Finnon: claridad del mes en curso, continuidad visual, diseño silencioso. 

finnon_mkt

 

design-principles

 

ux-approach

Alcance de implementación
A) Fuente de verdad de datos (shared + backend)

Asegurar que Obligation vive en packages/shared (tipos + (si aplica) zod schema), y que web y mobile importan de ahí.

Normalizar fechas: en API/DB usar ISO string (YYYY-MM-DD o ISO completo) y convertir a Date solo en UI.

Verificar si existe tabla/endpoint para obligations:

Si ya existe: revisa queries, filtros por account_id y orden por due_date.

Si no existe: crear DB + RLS mínimo siguiendo el patrón de otras entidades (por cuenta), alineado con el modelo Obligation.

Definir operaciones mínimas:

listObligations(accountId, from, to) (para “este mes” y “próximas”)

upsertObligation(...)

markObligationPaid(id, paidAt) / markObligationPending(id)

deleteObligation(id) (opcional si ya existe patrón CRUD)

B) Web — auditoría + corrección UX/copy

Localizar el punto exacto donde en Web “Añadir obligación” muestra “schedule / recurrent payment”.

Corregirlo con una separación explícita y estable:

Acción 1: “Añadir obligación (pago único)”

Campos: name, amount, due_date, estado (por defecto pending), opcional “Marcar como pagada” que setee paid_at.

Acción 2: “Añadir recurrente”

Campos de recurrencia: frequency, interval, start_date, end_date, day_of_month si aplica, is_paused.

Añadir microcopy mínimo (sin dramatismos) que deje clara la diferencia:

Obligación: “Un pago único con fecha de vencimiento.”

Recurrente: “Una serie que genera ocurrencias; confirmas cada una para crear la transacción real.”

Objetivo aquí: que sea imposible llegar a un formulario “equivocado” o que el copy mezcle conceptos.

C) Mobile — implementar UI de Obligations (sin romper la continuidad)

Integrar fetch real de obligations en Home (y dejar de pasar [] vacío).

En Home:

Sección “Próximas obligaciones” (lista corta, ordenada por due_date).

Mostrar: nombre, importe, fecha, estado (pending/paid).

Acción rápida: “Marcar como pagada” / “Deshacer pago”.

Crear pantalla o bottom sheet “Añadir obligación” (preferible bottom sheet si ese es el patrón del producto):

Sin overlay dramático; continuidad visual (alineado con el enfoque UX). 

ux-approach

 

design-principles

Si existe “committed vs pending” en web, replicar el mismo cálculo/etiquetas en mobile.

D) Diseño y tokens (no inventar estilos)

Usar tokens existentes de color (sin hardcode). 

color-guide

Sin overlays oscuros / sin “modal dramático”. 

design-principles

Jerarquía por espacio y tipografía, no por color. 

design-principles

Criterios de aceptación (Definition of Done)
1) Diferencia Obligation vs Recurring (Web, obligatorio)

En el menú/botón de “Añadir” existen dos entradas separadas:

“Añadir obligación (pago único)”

“Añadir recurrente”

El formulario de Obligación:

no muestra campos de schedule/frequency/interval

exige due_date

permite marcar pending/paid (y setea paid_at cuando aplica)

El formulario de Recurrente:

exige frequency + interval + start_date (y opcionales)

no pide due_date como vencimiento único (si hay “day_of_month”, debe explicarse como regla de ocurrencia)

Microcopy mínimo presente (1 línea por concepto) que explique “pago único” vs “serie con ocurrencias a confirmar”.

2) Obligations funcionando en Mobile (end-to-end)

Home móvil muestra “Próximas obligaciones” con datos reales (no array vacío).

Crear/editar obligación desde móvil:

se persiste

aparece en la lista

Marcar pagada / volver a pendiente actualiza UI y datos.

Las obligaciones afectan al resumen mensual (si existe “comprometido vs pendiente”, debe cuadrar con web).

3) Reutilización + consistencia

Tipos y lógica de dominio viven en packages/shared (sin duplicación entre web y mobile).

No acoplar shared a librerías específicas de UI/i18n.

UI mantiene continuidad visual y tokens (sin estilos inventados). 

color-guide

 

ux-approach

Guardrails (no negociables)

No mezclar conceptos en UI: “schedule/recurrent payment” nunca debe aparecer dentro del flujo de obligación.

No crear transacciones automáticamente desde recurrentes (solo ocurrencias virtuales + confirmación).

Nada de overlays oscuros, blur “estético” o dramatismo visual. 

ux-approach

 

design-principles

Usar tokens, no hex directo. 

color-guide

Cambios con mínimo alcance: arreglar copy/flujo en web sin re-arquitecturar pantallas que ya funcionan.

Entregables esperados

PR 1: Web — separación clara de “Añadir obligación” vs “Añadir recurrente” + fix del copy “schedule/recurrent payment”.

PR 2: Shared/Backend — Obligation bien integrado + operaciones necesarias.

PR 3: Mobile — sección Home + pantalla/bottom sheet de CRUD + acciones de pago.