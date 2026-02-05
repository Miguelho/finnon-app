# Prompt: Histórico de Objetivos y Gamificación

## Contexto

La pantalla "Objetivo" de Finnon actualmente solo muestra el mes actual. Queremos convertirla en una vista navegable por meses que muestre el histórico de objetivos con gamificación (rachas, comparativas).

## Cambios necesarios

### 1. Base de datos

Añadir campos a la tabla `financial_goals` para guardar el resultado final del mes:

```sql
ALTER TABLE financial_goals ADD COLUMN final_saved_minor bigint;
ALTER TABLE financial_goals ADD COLUMN completed boolean;
ALTER TABLE financial_goals ADD COLUMN completed_at date;  -- día que se cumplió (si aplica)
ALTER TABLE financial_goals ADD COLUMN closed_at timestamptz;  -- cuando se cerró el mes

COMMENT ON COLUMN financial_goals.final_saved_minor IS 'Ahorro final al cerrar el mes';
COMMENT ON COLUMN financial_goals.completed IS 'true si se cumplió el objetivo, false si no, null si el mes no ha terminado';
COMMENT ON COLUMN financial_goals.completed_at IS 'Fecha en que se cumplió el objetivo (si completed=true)';
COMMENT ON COLUMN financial_goals.closed_at IS 'Timestamp cuando se ejecutó el cierre del mes';
```

### 2. Job de cierre de mes

Crear función que se ejecute el día 1 de cada mes para cerrar el mes anterior:

```sql
CREATE OR REPLACE FUNCTION close_previous_month_goals()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous_month text;
  v_month_start date;
  v_month_end date;
BEGIN
  -- Calcular mes anterior
  v_previous_month := to_char(now() - interval '1 month', 'YYYY-MM');
  v_month_start := date_trunc('month', now() - interval '1 month')::date;
  v_month_end := (date_trunc('month', now()) - interval '1 day')::date;

  -- Actualizar todos los goals del mes anterior que no estén cerrados
  UPDATE financial_goals g
  SET
    final_saved_minor = (
      SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount_base_minor ELSE -t.amount_base_minor END), 0)
      FROM transactions t
      WHERE t.account_id = g.account_id
        AND t.date >= v_month_start
        AND t.date <= v_month_end
    ),
    completed = (
      SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount_base_minor ELSE -t.amount_base_minor END), 0) >= g.target_amount_base_minor
      FROM transactions t
      WHERE t.account_id = g.account_id
        AND t.date >= v_month_start
        AND t.date <= v_month_end
    ),
    completed_at = (
      -- Calcular el día en que se cumplió (si se cumplió)
      -- Esto requiere lógica más compleja, simplificado aquí
      CASE WHEN completed THEN v_month_end ELSE NULL END
    ),
    closed_at = now()
  WHERE g.month = v_previous_month
    AND g.closed_at IS NULL;
END;
$$;
```

Configurar pg_cron o similar para ejecutar el día 1 de cada mes:

```sql
SELECT cron.schedule('close-month-goals', '0 1 1 * *', 'SELECT close_previous_month_goals()');
```

### 3. RPC para obtener histórico y gamificación

```sql
CREATE OR REPLACE FUNCTION get_goal_history(
  p_account_id uuid,
  p_limit int DEFAULT 12
)
RETURNS TABLE (
  month text,
  target_minor bigint,
  final_saved_minor bigint,
  completed boolean,
  completed_at date,
  is_current boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    g.month,
    g.target_amount_base_minor,
    g.final_saved_minor,
    g.completed,
    g.completed_at,
    g.closed_at IS NULL as is_current
  FROM financial_goals g
  WHERE g.account_id = p_account_id
  ORDER BY g.month DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION get_goal_gamification(
  p_account_id uuid
)
RETURNS TABLE (
  current_streak int,
  total_completed int,
  total_goals int,
  avg_saved_minor bigint,
  avg_completion_day int
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_streak int := 0;
  v_month text;
  v_completed boolean;
BEGIN
  -- Calcular racha actual (meses consecutivos completados)
  FOR v_month, v_completed IN
    SELECT g.month, g.completed
    FROM financial_goals g
    WHERE g.account_id = p_account_id
      AND g.closed_at IS NOT NULL
    ORDER BY g.month DESC
  LOOP
    IF v_completed THEN
      v_streak := v_streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    v_streak,
    COUNT(*) FILTER (WHERE g.completed = true)::int,
    COUNT(*) FILTER (WHERE g.closed_at IS NOT NULL)::int,
    AVG(g.final_saved_minor) FILTER (WHERE g.closed_at IS NOT NULL)::bigint,
    AVG(EXTRACT(DAY FROM g.completed_at)) FILTER (WHERE g.completed = true)::int
  FROM financial_goals g
  WHERE g.account_id = p_account_id;
END;
$$;
```

### 4. Tipos en shared (@poleursus/shared)

Crear `goal-history.types.ts`:

```typescript
export type GoalHistoryEntry = {
  month: string;  // YYYY-MM
  targetMinor: bigint;
  finalSavedMinor: bigint | null;
  completed: boolean | null;
  completedAt: string | null;  // YYYY-MM-DD
  isCurrent: boolean;
};

export type GoalGamification = {
  currentStreak: number;
  totalCompleted: number;
  totalGoals: number;
  avgSavedMinor: bigint;
  avgCompletionDay: number | null;
};

export type GoalHistoryView = {
  // Para mes pasado
  month: string;
  targetMinor: bigint;
  finalSavedMinor: bigint;
  completed: boolean;
  completedAt: string | null;
  // Datos derivados
  difference: bigint;  // finalSavedMinor - targetMinor
  completionDayDelta: number | null;  // días antes/después de la media
};
```

### 5. Lógica en shared

Crear `goal-history.compute.ts`:

```typescript
import type { GoalHistoryEntry, GoalGamification, GoalHistoryView } from './goal-history.types';

export const computeGoalHistoryView = (
  entry: GoalHistoryEntry,
  gamification: GoalGamification
): GoalHistoryView | null => {
  if (entry.isCurrent || entry.finalSavedMinor === null || entry.completed === null) {
    return null;
  }

  const completionDay = entry.completedAt 
    ? parseInt(entry.completedAt.split('-')[2], 10) 
    : null;

  return {
    month: entry.month,
    targetMinor: entry.targetMinor,
    finalSavedMinor: entry.finalSavedMinor,
    completed: entry.completed,
    completedAt: entry.completedAt,
    difference: entry.finalSavedMinor - entry.targetMinor,
    completionDayDelta: completionDay && gamification.avgCompletionDay
      ? gamification.avgCompletionDay - completionDay
      : null,
  };
};

export type CurrentMonthComparison = {
  savedVsAvg: bigint;  // positivo = ahorrando más que la media
  velocityVsAvg: number | null;  // positivo = días antes que la media
};

export const computeCurrentMonthComparison = (
  currentSavedMinor: bigint,
  estimatedCompletionDay: number | null,
  gamification: GoalGamification
): CurrentMonthComparison => {
  return {
    savedVsAvg: currentSavedMinor - gamification.avgSavedMinor,
    velocityVsAvg: estimatedCompletionDay && gamification.avgCompletionDay
      ? gamification.avgCompletionDay - estimatedCompletionDay
      : null,
  };
};

// Textos para gamificación
export type GamificationCopy = {
  streak: (months: number) => string;
  history: (completed: number, total: number) => string;
  savedVsAvg: (amount: string, isPositive: boolean) => string;
  velocityVsAvg: (days: number) => string;
  completedLabel: string;
  failedLabel: string;
  completedOnDay: (day: number, daysDelta: number | null) => string;
  missedBy: (amount: string) => string;
};

export const getStreakText = (streak: number, copy: GamificationCopy): string => {
  return copy.streak(streak);
};

export const getHistoryText = (
  completed: number,
  total: number,
  copy: GamificationCopy
): string => {
  return copy.history(completed, total);
};
```

Exportar desde `index.ts`.

### 6. Componente de navegación por meses

Crear componente `MonthNavigator` para web y mobile:

```typescript
type MonthNavigatorProps = {
  currentMonth: string;  // YYYY-MM
  onMonthChange: (month: string) => void;
  minMonth?: string;  // Mes más antiguo disponible
};
```

Comportamiento:
- Flecha izquierda: mes anterior (siempre habilitada si hay histórico)
- Flecha derecha: mes siguiente (deshabilitada si es el mes actual)
- Label central: "febrero 2026" (mes y año legibles)

### 7. Vista de mes actual

Estructura:
```
├── Hero (ahorro real + proyección) - CON botón Editar
├── Sección "Tu progreso histórico"
│   ├── Card Racha: "🔥 3 meses"
│   ├── Card Histórico: "8 de 12"
│   └── Card Comparativa
│       ├── Ahorro: "+€320"
│       └── Velocidad: "5 días antes"
└── Simulador (ya implementado)
```

### 8. Vista de mes pasado

Estructura:
```
├── Hero (solo lectura)
│   ├── Badge ✓ verde o ✗ rojo (esquina superior derecha)
│   ├── Label "Objetivo cumplido" / "Objetivo no alcanzado"
│   ├── Importe final (verde si cumplido, rojo si no)
│   ├── "de €X.XXX"
│   └── Detalle contextual:
│       - Si cumplido: "Cumpliste el día X (Y días antes)"
│       - Si no: "Faltaron €X para el objetivo"
└── (Sin simulador, sin gamificación)
```

### 9. Copys necesarios

```typescript
const goalHistoryCopy = {
  // Navegación
  currentMonth: "Este mes",
  
  // Gamificación
  streakLabel: "Racha actual",
  streak: (months: number) => `${months} meses`,
  historyLabel: "Histórico",
  history: (completed: number, total: number) => `${completed} de ${total}`,
  comparisonTitle: "Este mes vs tu media",
  comparisonSaved: "Ahorro",
  comparisonVelocity: "Velocidad",
  savedPositive: (amount: string) => `+${amount}`,
  savedNegative: (amount: string) => `-${amount}`,
  velocityPositive: (days: number) => `${days} días antes`,
  velocityNegative: (days: number) => `${days} días después`,
  
  // Mes pasado
  completedLabel: "Objetivo cumplido",
  failedLabel: "Objetivo no alcanzado",
  completedOnDay: (day: number, delta: number | null) => {
    if (delta === null) return `Cumpliste el día ${day}`;
    if (delta > 0) return `Cumpliste el día ${day} (${delta} días antes)`;
    if (delta < 0) return `Cumpliste el día ${day} (${Math.abs(delta)} días después)`;
    return `Cumpliste el día ${day}`;
  },
  missedBy: (amount: string) => `Faltaron ${amount} para el objetivo`,
};
```

## Wireframe de referencia

Adjunto archivo `finnon-objetivo-historico.html` que muestra:
- Navegación por meses
- Vista del mes actual con gamificación
- Vista de mes pasado cumplido
- Vista de mes pasado no cumplido

## Consideraciones

1. **La racha se rompe** si un mes no se cumple. Si enero no se cumplió pero diciembre sí, la racha es 0.
2. **Meses sin objetivo** no cuentan para el histórico ni la racha.
3. **La comparativa** solo se muestra si hay al menos 1 mes cerrado con datos.
4. **El mes actual** no tiene `completed` definido hasta que se cierre.
5. **Formato de mes**: usar `date-fns` o similar para formatear "febrero 2026" según locale.

## Entregables

1. Migración SQL para añadir campos a `financial_goals`
2. Función SQL `close_previous_month_goals`
3. RPCs `get_goal_history` y `get_goal_gamification`
4. Tipos en shared: `goal-history.types.ts`
5. Lógica en shared: `goal-history.compute.ts`
6. Actualizar `index.ts` del shared
7. Componente `MonthNavigator` para web
8. Componente `MonthNavigator` para mobile
9. Componente `GoalGamification` para web (sección de racha + histórico + comparativa)
10. Componente `GoalGamification` para mobile
11. Componente `GoalHistoryHero` para web (hero de mes pasado)
12. Componente `GoalHistoryHero` para mobile
13. Integrar navegación en pantalla Objetivo
14. Copys/traducciones
