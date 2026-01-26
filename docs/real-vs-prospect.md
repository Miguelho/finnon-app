“Real vs Pendiente” (web + mobile)
Objetivo

En Home (y donde haya “resumen del mes”) separar claramente:

Gasto real (ya pagado / ya ocurrido)

Gasto pendiente (con fecha futura, aún por pagar)

Ingreso real (ya cobrado)

Ingreso pendiente (con fecha futura, aún por cobrar)

Balance hoy (a día de hoy)

Balance fin de mes (proyección dentro del mes)

Sin dashboards densos: dos números por concepto, entendibles en 3 segundos.

Definiciones (reglas de negocio)
1) Qué es “pendiente”

Una transacción es pendiente si:

está dentro del mes seleccionado, y

date es estrictamente mayor que “hoy” (según zona horaria de la cuenta / usuario).

Un recurrente de dentro de una semana cuenta como pendiente, no como gasto real.

2) Qué es “real”

Una transacción es real si:

está dentro del mes seleccionado, y

date es menor o igual a “hoy”.

3) Ventana temporal

Por defecto: mes actual.

Si el usuario cambia de mes:

meses pasados → pendiente = 0

meses futuros → real = 0
(esto es coherente y fácil de entender)

4) Totales y balances

Dentro del mes seleccionado:

expense_real = suma gastos con date <= hoy

expense_pending = suma gastos con date > hoy

income_real = suma ingresos con date <= hoy

income_pending = suma ingresos con date > hoy

Balances:

Balance hoy = income_real - expense_real

Balance fin de mes = (income_real + income_pending) - (expense_real + expense_pending)

Esto cumple la promesa de “ver de un vistazo qué te obliga este mes” 

finnon_mkt

UI propuesta (simple y “silenciosa”)
Home — Bloque “Balance”

Un card (o bloque superior) con dos filas:

Balance hoy

Balance fin de mes

Jerarquía por espacio y tipografía, no por color .

Home — Bloque “Este mes”

Dos columnas (o dos mini-cards apiladas en móvil):

Ingresos

Real

Pendiente

Gastos

Real

Pendiente

Copy sugerido (limpio):

“Real”

“Pendiente”

(opcional) helper: “Pendiente = con fecha futura”

Lista de transacciones

Si date > hoy: mostrar chip “Pendiente” en el tile (neutro, no alarmista).

No uses rojo/alerta: “pendiente” no es error.

Tokens (sin inventar colores)

Texto y estructura: color.text.primary/secondary/muted

Estado:

ingreso (positivo): color.state.positive

gasto (negativo): color.state.negative

etiqueta “Pendiente”: color.state.neutral + texto secundario 

color-guide

Datos y agregación (Supabase/Postgres)

Asumo el esquema base de transactions con account_id, type (income/expense), date, y totalizable en moneda base (amount_base_minor) 

init

.

SQL (agregación del mes)

Idea: una sola query que devuelva todo el summary.

-- inputs:
-- :account_id, :month_start (date), :month_end (date), :today (date)

select
  coalesce(sum(case when type='income'  and date <= :today then amount_base_minor end), 0) as income_real_minor,
  coalesce(sum(case when type='income'  and date >  :today then amount_base_minor end), 0) as income_pending_minor,
  coalesce(sum(case when type='expense' and date <= :today then amount_base_minor end), 0) as expense_real_minor,
  coalesce(sum(case when type='expense' and date >  :today then amount_base_minor end), 0) as expense_pending_minor
from transactions
where account_id = :account_id
  and date >= :month_start
  and date <= :month_end;


Balances en backend o frontend (con minor units):

balance_today = income_real - expense_real

balance_eom = (income_real + income_pending) - (expense_real + expense_pending)

Índices recomendados

(account_id, date) ya estaba como recomendado 

init


Esto es clave para que Home sea instantáneo.

Recurrentes (lo importante para que esto funcione)

Si tu motor de recurrentes solo crea transacciones el día que toca, entonces no habrá “pendientes” hasta que llegue la fecha.

Para cumplir la feature, v1 tiene que garantizar una de estas dos cosas (elige una):

Materializar ocurrencias futuras hasta fin de mes (recomendado: simple, consistente con tu modelo actual).

Calcular pendientes “virtuales” desde la tabla de recurrentes (más complejo: mezcla dos fuentes).

Mi recomendación práctica: materializa hasta fin de mes (y re-genera si cambian reglas) porque mantiene una sola fuente: transactions.

Criterios de aceptación (DoD)

En Home (web + móvil), para el mes actual:

Un gasto con date = hoy + 7 suma en Gasto pendiente, no en real.

Un ingreso con date = hoy + 3 suma en Ingreso pendiente.

Balance hoy y Balance fin de mes cuadran con las fórmulas.

En el listado:

transacciones futuras se etiquetan “Pendiente”.

No se introducen colores nuevos; solo tokens existentes 

color-guide

UX sobria: sin overlays dramáticos ni “dashboard vibe”

Prompt listo para tu agente de código (si lo quieres pegar tal cual)

Si te sirve, aquí va en formato operativo:

Implementar “Real vs Pendiente” en Home (web + mobile)

Añadir selector de “hoy” y rango de mes (monthStart/monthEnd) en capa de data.

Crear query/función getMonthlySummary(accountId, month, today) que devuelva:

income_real_minor, income_pending_minor, expense_real_minor, expense_pending_minor

balance_today_minor, balance_eom_minor (calculado)

UI Home:

Card Balance: “Hoy” y “Fin de mes”

Card Este mes: Ingresos (Real/Pendiente) + Gastos (Real/Pendiente)

Transaction tile:

si date > today: chip “Pendiente” con color.state.neutral

Tests:

fixtures con 4 transacciones (2 pasadas, 2 futuras) y asserts de sums.

Mantener principios visuales: jerarquía por layout; color solo estado/impacto.