# SPEC: Rediseño Ahorro — Hucha, Eliminación Objetivo, Drill-down

## Contexto

Esta spec cubre la reestructuración del modelo de ahorro en Finnon. Se elimina el concepto de "Objetivo" como entidad independiente y se integra dentro de "Proyectos" mediante un nuevo concepto: la **Hucha** (proyecto especial de ahorro libre). La pantalla de Objetivo desaparece, la navegación pasa de 5 a 4 tabs, y se introduce un drill-down de ahorro accesible desde Inicio.

---

## 1. Cambios en modelo de datos (Supabase)

### 1.1 Tabla `projects` — nuevo campo `is_hucha`

```sql
ALTER TABLE public.projects
  ADD COLUMN is_hucha boolean NOT NULL DEFAULT false;
```

Restricciones adicionales (implementar como check constraints o triggers):

- Solo puede existir **un proyecto con `is_hucha = true` por `account_id`**.
- Un proyecto con `is_hucha = true` **no se puede eliminar** (soft-delete deshabilitado, DELETE bloqueado).
- Un proyecto con `is_hucha = true` **no requiere `target_amount_base_minor`** → cambiar el check constraint actual de `target_amount_base_minor > 0` para permitir `NULL` cuando `is_hucha = true`.
- Un proyecto con `is_hucha = true` **no requiere `monthly_commitment_base_minor`** (se calcula dinámicamente como el sobrante).
- Un proyecto con `is_hucha = true` tiene `priority` = `2147483647` (max int, siempre última prioridad).
- Un proyecto con `is_hucha = true` no puede tener `status` = `'completed'` ni `'cancelled'`.

```sql
-- Constraint de unicidad
CREATE UNIQUE INDEX idx_one_hucha_per_account 
  ON public.projects (account_id) 
  WHERE is_hucha = true;

-- Constraint: no se puede borrar la hucha
CREATE OR REPLACE FUNCTION prevent_hucha_delete() 
RETURNS trigger AS $$
BEGIN
  IF OLD.is_hucha = true THEN
    RAISE EXCEPTION 'Cannot delete hucha project';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_hucha_delete
  BEFORE DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION prevent_hucha_delete();

-- Modificar check constraint de target_amount
ALTER TABLE public.projects 
  DROP CONSTRAINT IF EXISTS projects_target_amount_base_minor_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_target_amount_check 
  CHECK (is_hucha = true OR target_amount_base_minor > 0);

-- Permitir NULL en target_amount para hucha
-- (target_amount_base_minor ya debería aceptar NULL si cambiamos el NOT NULL)
ALTER TABLE public.projects 
  ALTER COLUMN target_amount_base_minor DROP NOT NULL;
```

### 1.2 Creación automática de la Hucha

Crear una función que se ejecute al crear una cuenta (hook post-insert en `accounts` o en la lógica de onboarding):

```sql
CREATE OR REPLACE FUNCTION create_hucha_for_account()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.projects (
    account_id, name, emoji, is_hucha, 
    target_amount_base_minor, monthly_commitment_base_minor,
    priority, status, created_by
  ) VALUES (
    NEW.id, 'Hucha', '🐷', true,
    NULL, NULL,
    2147483647, 'active', NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_hucha_on_account
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION create_hucha_for_account();
```

**Migración para cuentas existentes:** Script one-off que inserte una Hucha para cada cuenta que no tenga una:

```sql
INSERT INTO public.projects (account_id, name, emoji, is_hucha, target_amount_base_minor, monthly_commitment_base_minor, priority, status, created_by)
SELECT a.id, 'Hucha', '🐷', true, NULL, NULL, 2147483647, 'active', a.created_by
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects p WHERE p.account_id = a.id AND p.is_hucha = true
);
```

### 1.3 Deprecación de `financial_goals`

**No eliminar la tabla inmediatamente.** Fase de transición:

1. **Dejar de escribir** en `financial_goals` desde el código cliente y onboarding.
2. **Dejar de leer** desde UI (eliminar pantalla Objetivo, hooks, cache keys).
3. **Marcar RPCs como deprecated**: `close_previous_month_goals`, `get_goal_history`, `get_goal_gamification`, `get_goal_for_month`.
4. **Migrar datos históricos** (opcional, fase posterior): los datos de `financial_goals` (meses completados, `final_saved_minor`) podrían usarse para construir el historial de la nueva vista. Decisión: ¿migrar a `project_contributions` de la Hucha retroactivamente o mantener `financial_goals` como read-only para historial?

**Migración de datos históricos:** Los meses completados en `financial_goals` se migran retroactivamente como contribuciones a la Hucha. Script de migración:

```sql
-- Migrar meses completados de financial_goals como contribuciones retroactivas a la Hucha
INSERT INTO public.project_contributions (
  project_id, account_id, user_id, period,
  committed_amount_base_minor, actual_amount_base_minor,
  source, confirmed, confirmed_at, created_at, updated_at
)
SELECT 
  p.id AS project_id,
  fg.account_id,
  fg.created_by AS user_id,
  (fg.month || '-01')::date AS period,
  0 AS committed_amount_base_minor,
  COALESCE(fg.final_saved_minor, fg.target_amount_base_minor) AS actual_amount_base_minor,
  'automatic' AS source,
  true AS confirmed,
  COALESCE(fg.closed_at, fg.completed_at::timestamptz, fg.updated_at) AS confirmed_at,
  fg.created_at,
  fg.updated_at
FROM public.financial_goals fg
JOIN public.projects p ON p.account_id = fg.account_id AND p.is_hucha = true
WHERE fg.completed = true
  AND NOT EXISTS (
    SELECT 1 FROM public.project_contributions pc
    WHERE pc.project_id = p.id AND pc.period = (fg.month || '-01')::date
  );
```

**Nota:** `final_saved_minor` contiene el ahorro real del mes cerrado. Si es NULL (datos antiguos sin ese campo), se usa `target_amount_base_minor` como fallback. Tras la migración, dejar la tabla `financial_goals` intacta como respaldo read-only. Eliminar en migración futura cuando se confirme que los datos históricos se muestran correctamente desde `project_contributions`.

### 1.4 Cambios en `project_contributions` para la Hucha

El cierre mensual ahora creará una contribución adicional para la Hucha con el sobrante:

- `project_id` → ID del proyecto Hucha de la cuenta.
- `committed_amount_base_minor` → 0 (la Hucha no tiene compromiso fijo).
- `actual_amount_base_minor` → el sobrante después de asignar a proyectos.
- `source` → `'automatic'`.

No se necesitan cambios de schema en esta tabla.

---

## 2. Lógica de negocio

### 2.1 Cálculo del objetivo de ahorro mensual

El objetivo de ahorro mensual **ya no se define manualmente**. Se calcula como:

```
objetivo_mensual = SUM(monthly_commitment_base_minor) 
                   FROM projects 
                   WHERE account_id = X 
                     AND status = 'active' 
                     AND is_hucha = false 
                     AND monthly_commitment_base_minor IS NOT NULL 
                     AND monthly_commitment_base_minor > 0
```

La Hucha **no contribuye** al objetivo. El objetivo es solo la suma de compromisos de proyectos concretos.

### 2.2 Cálculo del ahorro del mes

```
ahorro_mes = SUM(ingresos_mes) - SUM(gastos_mes)
```

Donde ingresos y gastos son los movimientos (transactions + obligations) del mes en curso para la cuenta.

### 2.3 Distribución del ahorro (barra de progreso)

La barra de ahorro en Inicio cuenta una historia en dos fases:

1. **Fase 1 — Proyectos (0 → objetivo_mensual):** El ahorro va cubriendo los compromisos de proyectos, ordenados por prioridad ascendente. Se muestra como segmento verde sólido.
2. **Fase 2 — Hucha (objetivo_mensual → ahorro_mes):** Todo lo que supere el objetivo va a la Hucha. Se muestra como segmento naranja.

Si `ahorro_mes < objetivo_mensual`: solo se ve el segmento verde parcial, sin segmento naranja. Mensaje: "Te faltan €X para cubrir tus proyectos".

Si `ahorro_mes >= objetivo_mensual`: segmento verde completo + segmento naranja con el excedente. Mensaje: "✓ Proyectos financiados · €X extra van a tu Hucha".

Si `ahorro_mes <= 0`: barra vacía. Mensaje: "Este mes aún no has generado ahorro".

### 2.4 Cierre mensual — nuevo flujo con Hucha

El flujo actual de cierre mensual se modifica:

1. Se calcula `ahorro_mes` (ingresos - gastos del periodo).
2. Se distribuye entre proyectos activos (no-hucha) por prioridad, como ya funciona en `compute.ts`.
3. **Nuevo:** El `surplusMinor` que hoy queda sin asignar se asigna automáticamente a la Hucha.
4. Se crea un `project_contribution` para la Hucha con:
   - `committed_amount_base_minor` = 0
   - `actual_amount_base_minor` = surplusMinor
   - `source` = 'automatic'
   - `confirmed` = true (se confirma junto con el resto del cierre)
5. Si `surplusMinor <= 0`, no se crea contribución a la Hucha (o se crea con amount = 0, según preferencia — recomiendo no crear fila si es 0).

**Opción de distribución de surplus:** Eliminar la opción `unassigned` del selector de surplus. Las opciones pasan a ser:
- `hucha` (por defecto) — el sobrante va íntegro a la Hucha.
- `proportional` — se reparte entre proyectos proporcionalmente (se mantiene).
- `manual` — el usuario edita manualmente (se mantiene, pero el resto no asignado va a Hucha).

### 2.5 Acumulado de la Hucha

```
hucha_acumulado = SUM(actual_amount_base_minor) 
                  FROM project_contributions 
                  WHERE project_id = hucha_project_id
```

### 2.6 Progreso histórico (reemplaza gamificación de Objetivo)

Ya no se usa `financial_goals` para el historial. Se calcula desde `project_contributions`:

**Meses cumplidos (acumulativo):**
```
meses_cumplidos = COUNT(DISTINCT period) 
                  FROM project_contributions pc
                  JOIN projects p ON pc.project_id = p.id
                  WHERE pc.account_id = X 
                    AND p.is_hucha = false
                    AND pc.confirmed = true
                    AND pc.actual_amount_base_minor >= pc.committed_amount_base_minor
                  -- Agrupado por period: un mes "cumple" si TODOS los proyectos 
                  -- de ese mes tienen actual >= committed
```

Lógica más precisa: un mes se considera "cumplido" si la suma total de `actual_amount_base_minor` de todos los proyectos (no-hucha) del periodo >= suma total de `committed_amount_base_minor` del mismo periodo.

```sql
SELECT period, 
       SUM(actual_amount_base_minor) as total_actual,
       SUM(committed_amount_base_minor) as total_committed
FROM project_contributions pc
JOIN projects p ON pc.project_id = p.id
WHERE pc.account_id = $1 
  AND p.is_hucha = false
  AND pc.confirmed = true
GROUP BY period
HAVING SUM(actual_amount_base_minor) >= SUM(committed_amount_base_minor)
```

**Total de meses con cierre:** COUNT de periodos distintos con al menos una contribución confirmada.

**Racha actual:** Meses consecutivos cumplidos desde el más reciente hacia atrás.

**Media de ahorro:** Promedio de `ahorro_mes` (ingresos - gastos) sobre los meses con cierre completado.

**Comparativa "este mes vs tu media":**
- Ahorro: `ahorro_mes_actual - media_ahorro` (positivo = verde, negativo = naranja).
- Velocidad: día del mes en que se alcanzó el objetivo (compromisos de proyectos cubiertos) vs la media de días en meses anteriores. Si aún no se alcanzó, mostrar "Pendiente".

---

## 3. Navegación

### 3.1 Tabs (web y mobile)

Cambiar de 5 a 4 tabs:

| Antes | Después |
|-------|---------|
| Inicio | Inicio |
| Movimientos | Movimientos |
| Proyectos | Proyectos |
| Objetivo | ~~eliminado~~ |
| Tu Cuenta | Tu Cuenta |

### 3.2 Eliminación de rutas

**Web:**
- Eliminar `apps/web/src/app/goal/` (toda la carpeta).
- Eliminar enlace a "Objetivo" en la navegación (`apps/web/src/components/` — buscar el nav component).

**Mobile:**
- Eliminar la tab/ruta de Objetivo en `apps/mobile/app/(tabs)/`.
- Eliminar enlace en el tab bar.

### 3.3 Eliminación de código relacionado con Objetivo

- Eliminar/deprecar hooks de cache: `useCachedGoalData` en web y mobile.
- Eliminar cache keys: `goalMonth`, `goalHistory`, `goalGamification` de `packages/shared/src/cache/keys.ts`.
- Eliminar tags de invalidación: `goal_*` de `packages/shared/src/cache/invalidation.ts`.
- Eliminar listener realtime de tabla `financial_goals` en los providers de cache.
- Eliminar componentes de UI específicos de la pantalla Objetivo en web y mobile.

---

## 4. Pantalla de Inicio — sección de ahorro rediseñada

### 4.1 Sección de ahorro (entry point al drill-down)

Reemplaza la sección actual de ahorro/objetivo en Inicio. Es una card interactiva (tappable).

**Datos que muestra:**
- Título: "Ahorro del mes"
- Subtítulo derecho: mes y año actual (ej. "Febrero 2026")
- Barra de progreso con dos segmentos:
  - Segmento 1 (verde sólido): proporción del ahorro que cubre los compromisos de proyectos. Ancho = `min(ahorro_mes, objetivo_mensual) / ahorro_mes * 100%` del total llenado.
  - Segmento 2 (naranja): proporción del ahorro que va a Hucha. Ancho = `max(0, ahorro_mes - objetivo_mensual) / ahorro_mes * 100%` del total llenado.
  - Si `ahorro_mes <= 0`, barra vacía.
  - Un marcador vertical blanco en la posición donde acaban los compromisos de proyectos.
- Leyenda debajo de la barra:
  - "Proyectos €{objetivo_mensual}" con dot verde
  - "Hucha €{max(0, ahorro_mes - objetivo_mensual)}" con dot naranja
  - Total ahorro a la derecha en verde bold
- Mensaje motivacional:
  - Si proyectos cubiertos: "✓ Proyectos financiados · €X extra van a tu Hucha este mes"
  - Si no cubiertos: "Te faltan €X para cubrir tus proyectos este mes"
  - Si ahorro <= 0: "Este mes aún no has generado ahorro"
- Indicador visual de que es tappable (flecha → a la derecha)

**Comportamiento:** Al hacer tap, navegar al drill-down de ahorro.

### 4.2 Drill-down de ahorro

En **web**: nueva ruta `apps/web/src/app/savings/page.tsx` (o como slide panel si el patrón ya existe en la app). Accesible desde Inicio, con botón "← Inicio" para volver.

En **mobile**: push navigation desde la pantalla de Inicio. Header con back button.

**Estructura del drill-down (de arriba a abajo):**

#### A) Cifra principal
- Número grande verde: `€{ahorro_mes}` formateado.
- Subtítulo: "ahorrado este mes".
- Selector de mes con flechas ‹ › para navegar entre meses históricos.

#### B) Barra de distribución
- Barra horizontal stacked con dos segmentos coloreados:
  - Verde: proyectos (con label de €cantidad dentro si cabe).
  - Naranja: Hucha (con label de €cantidad dentro si cabe).
- Labels debajo: "Proyectos cubiertos ✓" (o "Pendiente") a la izquierda, "Total: €X" a la derecha.

#### C) Distribución detallada
- Título: "Distribución del ahorro"
- Lista de items:
  - Por cada proyecto activo (no-hucha): icono + nombre + "€X/mes · Y% completado" + cantidad asignada en verde.
  - Último item: Hucha con icono 🐷 + "Excedente del mes" + cantidad en naranja.
- Si el mes tiene cierre confirmado, mostrar las cantidades reales de `project_contributions`.
- Si es el mes en curso (sin cierre), mostrar la distribución proyectada según la lógica de `compute.ts`.

#### D) Progreso histórico
- Grid 2 columnas:
  - Card "Meses cumplidos": `X de Y` (verde).
  - Card "Racha actual": `X meses`.

#### E) Gráfico de evolución
- Mini gráfico de barras: últimos 6 meses.
- Cada barra = ahorro total del mes.
- Color: verde si el mes cumplió el objetivo, naranja si no.
- Mes actual con glow/highlight.
- Línea discontinua horizontal marcando el objetivo actual (suma de compromisos).

#### F) Comparativa con media
- Card con filas:
  - "Ahorro": diferencia vs media (verde si positivo, naranja si negativo).
  - "Velocidad": días antes/después vs media para cubrir compromisos.
  - "Mejor mes": mes y cantidad del mayor ahorro histórico.

---

## 5. Pantalla de Proyectos — rediseñada

### 5.1 Estructura

**Header:**
- Título: "Proyectos"
- Subtítulo: "Conecta tu ahorro mensual con metas concretas"
- Botones: "Cierre mensual" + "+ Nuevo proyecto" (se mantienen).

**Sección Hucha (fija, siempre arriba):**
- Card con borde superior decorativo (gradiente naranja → rosa).
- Fila superior:
  - Izquierda: icono 🐷 + "Hucha" + "Tu colchón de ahorro libre".
  - Derecha: acumulado total en naranja + label "acumulado".
- Fila inferior (2 stats):
  - "Este mes": `+€{contribución_hucha_mes_actual}` en verde (si hay cierre, el valor real; si no, el sobrante proyectado).
  - "Media mensual": promedio de contribuciones históricas a la Hucha.

**La Hucha no es editable** como un proyecto normal. No tiene botón de editar, no permite cambiar nombre/emoji/target/commitment. Se puede mostrar un label "Automático" si se quiere reforzar que el usuario no la configura.

**Sección proyectos activos:**
- Label: "PROYECTOS ACTIVOS"
- Botón: "+ Nuevo proyecto"
- Lista de project cards:
  - Cada card: icono + nombre + "€X/mes · {fecha estimada}" + porcentaje completado.
  - Barra de progreso verde.
  - Footer: "€X de €Y" + "En X años y X meses".
  - Tappable → navega al detalle del proyecto.

**Compromiso mensual total:**
- Card al fondo: "Compromiso mensual total" + `€{objetivo_mensual}/mes`.
- Este valor = suma de `monthly_commitment_base_minor` de proyectos activos no-hucha.
- **No incluye la Hucha** (el sobrante es variable).

### 5.2 Hucha — detalle (drill-down)

La Hucha **es tappable** y navega a una pantalla de detalle similar a cualquier otro proyecto, pero adaptada a su naturaleza:

**Header:**
- Icono 🐷 + "Hucha"
- Label: "Tu colchón de ahorro libre"
- **No hay botón de editar** (nombre, emoji, target no son editables).

**Cifra principal:**
- Acumulado total en naranja grande.
- Subtítulo: "acumulado total".

**Stats rápidos (grid 2 columnas):**
- "Este mes": contribución del mes actual (o proyectada si no hay cierre).
- "Media mensual": promedio de contribuciones históricas.
- "Mejor mes": mes con mayor contribución y su cantidad.
- "Meses con aportación": count de meses con contribución > 0.

**Historial de contribuciones:**
- Lista cronológica descendente (más reciente primero) de todas las `project_contributions` donde `project_id = hucha_id`.
- Cada fila: periodo (ej. "Febrero 2026") + cantidad (ej. "+€1,272.06") en verde.
- Indicar visualmente cuáles vienen de la migración histórica (ej. label "Histórico" en gris) vs las generadas por el nuevo cierre mensual.

**Gráfico de evolución:**
- Mini gráfico de barras con las contribuciones mensuales a la Hucha de los últimos 6-12 meses.
- Barras en naranja.

**Navegación:**
- Web: ruta `apps/web/src/app/projects/hucha/page.tsx` (o reusar `projects/[projectId]/page.tsx` con lógica condicional si `is_hucha`).
- Mobile: push navigation desde la pantalla de Proyectos, reusando el detalle de proyecto con adaptaciones para Hucha.

---

## 6. Onboarding — cambios

### 6.1 Eliminar paso "Objective"

El paso actual en el onboarding (`ObjectiveStep`) que pide al usuario definir un `goal { targetAmountMinor, months }` se elimina.

### 6.2 Nuevo paso: primer proyecto (opcional)

Reemplazar el paso de Objetivo con un paso que invite al usuario a crear su primer proyecto de ahorro:

- Título: "¿Tienes algún sueño que financiar?"
- Subtítulo: "Crea tu primer proyecto de ahorro. Todo lo que sobre irá a tu Hucha automáticamente."
- Campos:
  - Nombre del proyecto (text input)
  - Emoji (icon picker)
  - Importe objetivo (currency input)
  - Cuota mensual sugerida (calculada a partir de un plazo, o directa)
- Botón "Crear proyecto" + link "Saltar por ahora"
- Si el usuario salta, sigue adelante solo con la Hucha (que se creó automáticamente con la cuenta).

### 6.3 Persistencia en onboarding

En `persist.ts`, reemplazar la inserción en `financial_goals` (líneas 171-189 aprox.) por:

- Si el usuario creó un proyecto en el onboarding: INSERT en `projects` con los datos del proyecto.
- La Hucha ya existe (creada por trigger en `accounts`), no hace falta crearla aquí.
- Eliminar toda referencia a `financial_goals` en la persistencia del onboarding.

---

## 7. Cache — cambios

### 7.1 Eliminar keys y tags de Goal

En `packages/shared/src/cache/keys.ts`:
- Eliminar: `goalMonth`, `goalHistory`, `goalGamification`.

En `packages/shared/src/cache/invalidation.ts`:
- Eliminar mappings de la tabla `financial_goals`.
- Eliminar tags `goal_*`.

### 7.2 Nuevas keys para drill-down de ahorro

En `packages/shared/src/cache/keys.ts`, añadir:

```typescript
savingsSummary: (accountId: string, period: string) => 
  `savings:summary:${accountId}:${period}` as const,

savingsHistory: (accountId: string) => 
  `savings:history:${accountId}` as const,

savingsGamification: (accountId: string) => 
  `savings:gamification:${accountId}` as const,

huchaAccumulated: (accountId: string) =>
  `hucha:accumulated:${accountId}` as const,
```

Tags nuevos: `savings_summary`, `savings_history`, `savings_gamification`, `hucha`.

### 7.3 Invalidación

Mapping de invalidación para las nuevas keys:

| Mutación en tabla | Tags a invalidar |
|---|---|
| `project_contributions` (insert/update/delete) | `savings_summary`, `savings_history`, `savings_gamification`, `hucha`, `projects` |
| `projects` (insert/update/delete) | `savings_summary`, `projects`, `hucha` |
| `transactions` (insert/update/delete) | `savings_summary` (porque cambia ingresos-gastos del mes) |
| `obligations` (insert/update/delete) | `savings_summary` |

### 7.4 Eliminar listener realtime de `financial_goals`

En los providers de cache (web y mobile), eliminar la suscripción realtime a la tabla `financial_goals`.

### 7.5 Hooks nuevos

```typescript
// Reemplaza useCachedGoalData
useCachedSavingsSummary(accountId: string, period: string)
// Retorna: { ahorro_mes, objetivo_mensual, distribucion[], mensaje }

useCachedSavingsHistory(accountId: string)  
// Retorna: { meses_cumplidos, total_meses, racha_actual, evolucion_6m[], mejor_mes }

useCachedSavingsGamification(accountId: string)
// Retorna: { comparativa_ahorro, comparativa_velocidad }

useCachedHuchaAccumulated(accountId: string)
// Retorna: { acumulado, contribucion_mes_actual, media_mensual }
```

---

## 8. Resumen de archivos a crear/modificar/eliminar

### Crear

| Archivo | Descripción |
|---|---|
| `supabase/migrations/0XX_hucha.sql` | Migración: campo is_hucha, constraints, trigger, datos existentes, migración retroactiva de financial_goals |
| `apps/web/src/app/savings/page.tsx` | Página del drill-down de ahorro (web) |
| `apps/web/src/app/savings/savings-client.tsx` | Client component del drill-down |
| `apps/web/src/app/projects/hucha/page.tsx` | Detalle de la Hucha (web) — o lógica condicional en `projects/[projectId]` |
| `apps/mobile/app/(tabs)/home/savings.tsx` | Pantalla drill-down (mobile, push nav) |
| `apps/mobile/app/(tabs)/projects/hucha.tsx` | Detalle de la Hucha (mobile) — o lógica condicional en detalle de proyecto |
| `packages/shared/src/cache/keys.ts` | Nuevas keys (savings_*, hucha) — modificar |
| `packages/shared/src/cache/invalidation.ts` | Nuevos mappings — modificar |

### Modificar

| Archivo | Cambio |
|---|---|
| Navegación web (nav component) | Eliminar tab Objetivo, reordenar |
| `apps/mobile/app/(tabs)/_layout.tsx` | Eliminar tab Objetivo |
| Pantalla Inicio (web + mobile) | Reemplazar sección de ahorro/objetivo por nueva sección con barra dual |
| `apps/web/src/app/projects/` | Añadir sección Hucha arriba, recalcular compromiso total |
| `apps/mobile/app/(tabs)/projects/` | Ídem mobile |
| Cierre mensual (web + mobile) | Añadir contribución a Hucha con surplus, eliminar opción "unassigned" |
| `packages/shared/src/` compute.ts (o equivalente) | Asegurar que surplus se retorne para asignar a Hucha |
| Onboarding (web + mobile) | Reemplazar paso Objective por paso "Primer proyecto" |
| `apps/*/src/cache/hooks.ts` | Eliminar `useCachedGoalData`, añadir nuevos hooks |
| Cache providers (web + mobile) | Eliminar listener realtime de `financial_goals` |

### Eliminar

| Archivo/carpeta | Razón |
|---|---|
| `apps/web/src/app/goal/` | Pantalla Objetivo eliminada |
| `apps/mobile/app/(tabs)/goal/` (o equivalente) | Pantalla Objetivo eliminada (mobile) |
| Componentes UI específicos de Objetivo | Ya no se usan |
| RPCs: `close_previous_month_goals`, `get_goal_history`, `get_goal_gamification`, `get_goal_for_month` | Deprecated (no eliminar de DB aún, solo dejar de invocar) |

---

## 9. Orden de implementación sugerido

1. **Migración de DB** — is_hucha, constraints, trigger, migración de cuentas existentes.
2. **Cierre mensual** — asignar surplus a Hucha (backend logic).
3. **Cache** — nuevas keys, tags, hooks. Eliminar goal_*.
4. **Pantalla Proyectos** — rediseño con sección Hucha.
5. **Pantalla Inicio** — nueva sección de ahorro con barra dual.
6. **Drill-down de ahorro** — nueva pantalla/ruta.
7. **Navegación** — eliminar tab Objetivo (web + mobile).
8. **Onboarding** — reemplazar paso Objective.
9. **Limpieza** — eliminar código muerto de Goal (pantallas, hooks, componentes, RPCs no invocadas).

---

## 10. Referencia visual

El prototipo HTML adjunto (`finnon-prototype.html`) muestra el diseño target de:
- Sección de ahorro en Inicio (entry point).
- Drill-down de ahorro (vista completa).
- Pantalla de Proyectos con Hucha.

Mantener la estética dark actual de Finnon. Colores clave:
- Verde (`#4ade80`) para proyectos y progreso positivo.
- Naranja (`#fb923c`) para Hucha y alertas de progreso negativo.
- Fondo oscuro (`#111111`, `#1a1a1a`, `#1e1e1e`).
