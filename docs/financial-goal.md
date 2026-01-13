# Prompt para agente de código — Tab “Objetivo financiero” (Web + Mobile)

## Contexto
Tenemos una app fintech (Finnon) con **experiencia web y móvil coherente** (mismos conceptos, distinto layout). Backend en **Supabase** (RLS), front en **Next.js (web)** + **Expo/React Native (mobile)** y paquete compartido `@poleursus/shared` para tipos/servicios/tokens.

## Objetivo (v1)
Añadir un nuevo tab/pestaña **“Objetivo”** para gestionar el **objetivo mensual de ahorro**:
- Tipo único v1: **Ahorrar este mes**.
- Progreso calculado por mes: `ahorro = ingresos - gastos` (en moneda base, minor units).
- UI que responda en 5s: objetivo, progreso, restante, ritmo (€/día o €/semana) + 2–3 insights simples.

> No convertir esto en un “dashboard”. Pocas piezas, mucha claridad.

---

## Guardarraíles (muy importante)
1. **Cambios mínimos**: añade el tab y lo necesario; no refactorices pantallas no relacionadas.
2. **Mismos tokens y estilo** que Finnon (tipografía/espaciado/estados). Evita colores decorativos: color solo para estado (positivo/negativo/neutro).
3. **Web y Mobile deben compartir lógica** (cálculo, tipos, servicios) en `@poleursus/shared`.
4. **Sin floats**: todo en minor units (bigint / number seguro).
5. **RLS obligatorio**: acceso solo a miembros de la cuenta.
6. UX: **Web sin overlay dramático** (panel lateral o modal ligero). **Mobile con bottom sheet**.

---

## UX / UI (v1)

### Navegación
- **Web**: añadir “Objetivo” en el menú de navegación (mismo nivel que Transactions / Account).
- **Mobile**: añadir tab “Objetivo” en la tab bar (icono simple y consistente).

### Pantalla “Objetivo”
#### Sección Hero (arriba)
- Título: “Objetivo del mes”
- Objetivo: “Ahorrar 300 €”
- Progreso: “180 € / 300 €”
- Restante: “Te faltan 120 €”
- Ritmo: “6 €/día” (o “30 €/semana”, configurable internamente)
- Barra de progreso simple (con estado):
  - ahead/on-track => positivo
  - behind => negativo
  - sin datos => neutro

#### Insights (máximo 3)
Ejemplos (elige 2–3 y manténlo estable):
1) “Si mantienes este ritmo, terminas en X €” (forecast lineal simple)
2) “Este mes llevas +X € de gasto vs mes anterior”
3) “Top 2 categorías por gasto: A, B”

#### Acciones
- CTA primario:
  - Si no hay objetivo: **“Crear objetivo”**
  - Si existe: **“Editar objetivo”**
- Editor:
  - Campos mínimos:
    - Cantidad objetivo (moneda base, input)
    - (opcional) nombre, pero por defecto “Objetivo del mes”
  - Web: panel lateral / modal ligero
  - Mobile: bottom sheet

### Estados vacíos
- Sin objetivo: texto + CTA “Crear objetivo”
- Sin transacciones del mes: mostrar hero (si hay objetivo) + mensaje “Cuando registres movimientos, verás el progreso aquí.”

---

## Modelo de datos (Supabase)

### Nueva tabla: `financial_goals`
Campos (v1):
- `id uuid primary key default gen_random_uuid()`
- `account_id uuid not null`
- `month text not null`  -- formato `YYYY-MM`
- `type text not null`   -- v1 solo 'save'
- `target_amount_base_minor bigint not null`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Restricciones:
- `unique(account_id, month, type)`
- `check (type in ('save'))`
- `check (target_amount_base_minor > 0)`

Índices:
- `(account_id, month)`
- unique ya cubre acceso principal

### RLS
- Habilitar RLS en `financial_goals`
- Policies:
  - SELECT/INSERT/UPDATE/DELETE permitido solo si `auth.uid()` es miembro de la cuenta (`account_members` o equivalente existente).
- `created_by = auth.uid()` en inserción desde el servicio.

> Reutiliza el patrón exacto de RLS que ya exista para transacciones/categorías.

---

## Cálculos (shared)
En `@poleursus/shared` crear (o ampliar) un módulo tipo:
- `goals/types.ts`
- `goals/service.ts`
- `goals/selectors.ts` (si aplica)
- `money.ts` helpers (si existe)

### Cálculo mensual
Inputs:
- `income_total_base_minor` del mes
- `expense_total_base_minor` del mes
- `saved = income - expense`
- `progress_ratio = clamp(saved / target, 0..1)` (para UI)
- `remaining = max(target - saved, 0)`
- `days_left` (hasta fin del mes en TZ local)
- `rate_per_day = ceil(remaining / days_left)` (minor -> display)
- Forecast lineal: `forecast_end = saved + (saved_so_far / day_of_month) * (days_in_month - day_of_month)` (manejar día 0)

> Ojo: si `saved` es negativo, remaining crece. Mostrarlo claro, sin romper UI.

### Conversión a display
- Formatear moneda usando el formateador existente (y si no existe, crear uno común).
- No mezclar minor/major en cálculos; solo al final para display.

---

## API / Data fetching

### Web (Next.js)
- Crear endpoints internos o usar directamente Supabase client según patrón actual.
- Recomendación v1: un hook `useMonthlyGoal(accountId, month)` que:
  1) fetch goal (financial_goals)
  2) fetch totals del mes (reutiliza query actual de “totales del mes” si existe)
  3) compone `GoalProgressViewModel` en shared

### Mobile (Expo)
- Mismo hook/servicio compartido si ya tenéis patrón cross-platform.
- Cache ligero (React Query/SWR si ya se usa; no introducir librería nueva si no existe).

---

## Plan de implementación (pasos)

### 1) DB + RLS
- Migration SQL para crear tabla, índices, RLS y policies.
- Validar que la policy no rompe tests existentes.

### 2) Shared domain
- Tipos: `FinancialGoal`, `GoalType = 'save'`, `MonthKey = 'YYYY-MM'`
- Servicio CRUD:
  - `getMonthlyGoal(accountId, month)`
  - `upsertMonthlyGoal(accountId, month, targetAmountBaseMinor)`
- Función `computeGoalProgress({goal, totals, now}) => viewModel`

### 3) UI Web
- Añadir item “Objetivo” al nav.
- Nueva página `/goal` (o ruta equivalente):
  - Hero + Insights + CTA
  - Editor modal/panel
- Responsive:
  - Desktop: contenido centrado con ancho similar a Transactions (uniformidad visual)

### 4) UI Mobile
- Añadir tab “Objetivo”
- Screen `GoalScreen`:
  - Hero + Insights + CTA
  - Bottom sheet editor

### 5) QA + Edge cases
- Sin objetivo
- Objetivo existe pero sin transacciones
- `saved < 0`
- Mes cambiado (si existe selector mensual global, usa el mes actual; v1 solo mes actual si no hay selector)
- Multi-cuenta: el objetivo va ligado a la **cuenta activa**

---

## Definition of Done
1. Tab “Objetivo” visible y funcional en **Web + Mobile**.
2. Tabla `financial_goals` creada con **RLS** y policies correctas.
3. CRUD v1: crear/editar objetivo del mes (upsert).
4. Progreso calculado con minor units; UI muestra objetivo/progreso/restante/ritmo.
5. Insights (2–3) visibles y correctos sin degradar rendimiento.
6. UI consistente con Finnon: jerarquía clara, estados por color, sin ruido.
7. No se rompen pantallas existentes; navegación y safe-area OK en mobile.

---

## Entregables
- Migration SQL (supabase)
- Código shared en `@poleursus/shared`
- Pantalla web + ruta + nav
- Pantalla mobile + tab + bottom sheet
- Tests mínimos (unit para `computeGoalProgress` + smoke manual checklist)

---

## Notas de diseño (para evitar “meh”)
- Usa espacio y tipografía para jerarquía.
- No mezclar negritas aleatorias: solo cifras clave y un único CTA principal.
- Barra de progreso simple, sin gradients “decorativos”.
