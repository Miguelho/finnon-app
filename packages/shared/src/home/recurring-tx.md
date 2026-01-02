Recurring (v1)
Objetivo

Implementar transacciones recurrentes (income/expense) como series que generan ocurrencias virtuales en la vista mensual, y que el usuario puede confirmar para crear una transaction real enlazada.
No crear transacciones automáticamente en background.

Entregables por área
A) DB / Supabase

Crear migración:

Nueva tabla recurring_items con campos:

id uuid pk

account_id uuid not null

type enum/text: income|expense

amount_minor bigint not null

currency char(3) not null

category_id uuid null

merchant text null

notes text null

start_date date not null

frequency enum/text: weekly|monthly|yearly

interval int not null default 1

day_of_month int null (solo mensual; si null usar día de start_date)

end_date date null

is_paused boolean not null default false

created_by uuid not null

created_at timestamptz default now()

updated_at timestamptz default now()

Modificar tabla transactions:

Añadir:

recurring_item_id uuid null references recurring_items(id)

recurring_occurrence_date date null

Añadir constraint única:

unique(account_id, recurring_item_id, recurring_occurrence_date)

RLS:

recurring_items con el mismo patrón de acceso que transactions por account_id y membresía.

Asegurar que inserts/updates solo se permiten si el usuario pertenece a la cuenta.

Checklist DB

 Migración aplicada localmente

 Constraints funcionando (evita duplicados al confirmar)

 RLS verificada con 2 usuarios / 2 cuentas

B) packages/shared (lógica común)

Crear módulo de recurrentes desacoplado de librerías:

Tipos:

RecurringFrequency = 'weekly' | 'monthly' | 'yearly'

RecurringItem (shape de DB, sin dependencias de supabase)

RecurringOccurrence:

recurringItemId

date (ISO YYYY-MM-DD)

key (string estable)

Funciones puras:

getOccurrencesBetween(item, fromISO, toISO) -> RecurringOccurrence[]

getOccurrenceKey(itemId, dateISO) -> string

normalizeMonthlyDay(item) para resolver day_of_month y meses cortos (si day=31 y mes=30 días => usar último día del mes).

Guardrail de cálculo mensual

Si day_of_month es 29/30/31 y el mes no lo tiene → usar el último día del mes.

Checklist shared

 100% functions puras (sin acceso a network, storage, i18n)

 Tests unitarios mínimos para monthly edge cases (febrero, meses de 30 días)

C) Backend API (si tienes capa Node)

Si ahora mismo estás tirando directo de supabase desde cliente, esta sección se puede omitir.
Si existe API:

Endpoint GET /recurring-items?accountId=...

Endpoint POST /recurring-items

Endpoint PATCH /recurring-items/:id (pausar/editar)

Endpoint POST /transactions/confirm-recurring:

input: recurring_item_id, occurrence_date

crea transaction real si no existe (manejar conflicto de unique)

Checklist API

 Confirmación idempotente (si se llama 2 veces no duplica)

 Validaciones de pertenencia a cuenta

D) Web (Next.js)

UI “Añadir transacción”:

Toggle Repetir

Campos mínimos: frecuencia, intervalo, inicio, (opcional fin)

Al guardar con “Repetir” => crear recurring_item (no transaction).

Vista mensual (lista):

Fetch transactions del mes

Fetch recurring_items activas

Generar ocurrencias con shared

Merge:

si hay transaction enlazada => mostrar como normal

si no => mostrar como “pendiente recurrente” con icono discreto

Acción:

En una pendiente => botón “Marcar como registrado”

crea transaction enlazada (recurring_item_id, recurring_occurrence_date)

al refrescar desaparece la pendiente y queda la transaction real

Checklist web

 No se añaden nuevos colores/tokens

 La lista se mantiene “lean” (sin chips pesados, sin overlay dramático)

E) Mobile (Expo / React Native)

Mismo comportamiento que web:

Toggle Repetir en el flujo de añadir

Lista mensual con merge y “Marcar como registrado”

Reutilizar lógica shared en el merge y cálculo de ocurrencias

Checklist mobile

 Paridad funcional con web

 No duplicar lógica de recurrencias fuera de shared

Criterios de aceptación (DoD)

 Crear recurrente (weekly/monthly/yearly + interval) funciona

 Ocurrencias virtuales aparecen en el mes correctamente

 “Marcar como registrado” crea transaction real enlazada, sin duplicados

 RLS y permisos correctos

 Web y mobile comparten la lógica de ocurrencias desde packages/shared

 UX minimalista: sin pantallas densas, sin automatismos ocultos

Guardrails (NO HACER)

❌ No RRULE completo / calendarios complejos en v1

❌ No cron jobs / auto-creación de transacciones

❌ No inventar colores ni componentes visuales nuevos para “recurrente”

❌ No lógica de ocurrencias duplicada fuera de shared

Si vas a poner a trabajar al agente ya, el orden ideal de ejecución es: DB → shared → merge mensual → confirmación.