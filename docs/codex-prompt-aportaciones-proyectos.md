# Codex Prompt — Aportaciones extra a Proyectos desde movimientos

## Contexto
Finnon es una app de finanzas personales para parejas/convivientes. Los Proyectos son marcadores de progreso hacia objetivos de ahorro (ej: vacaciones, compra). No son fondos reales — representan progreso declarado.

Esta feature permite que un gasto registrado se asigne directamente a un Proyecto como aportación, reduciendo el tiempo estimado para alcanzar el objetivo.

---

## Cambios requeridos

### 1. Modelo de datos

**Tabla `transactions`** — añadir campo:
```sql
project_id uuid REFERENCES projects(id) ON DELETE SET NULL
```
- Nullable
- Solo aplicable a movimientos de tipo gasto (`type = 'expense'`)
- Un gasto puede asignarse a máximo un proyecto

**Tabla `projects`** — NO añadir campo calculado. El `total_contributed` se deriva en runtime:
```
total_contributed = 
  SUM(transactions.amount WHERE project_id = project.id)
  + monthly_contributions_accumulated
```

Añadir migration de Supabase correspondiente.

---

### 2. Lógica de negocio

**Recálculo tras aportación extra:**
```
remaining = goal - total_contributed
months_remaining = remaining / monthly_saving
```
- El `monthly_saving` no cambia
- Solo se reduce `months_remaining`
- Si `total_contributed >= goal`, el proyecto se marca como completado

**Derivados a memoizar** (patrón existente en la app):
```ts
// En el hook/selector de proyecto
const totalContributed = useMemo(() =>
  transactions
    .filter(t => t.project_id === project.id)
    .reduce((sum, t) => sum + t.amount, 0)
  + monthlyAccumulated
, [transactions, project.id, monthlyAccumulated])

const monthsRemaining = useMemo(() =>
  (project.goal - totalContributed) / project.monthly_saving
, [project.goal, totalContributed, project.monthly_saving])
```

---

### 3. UI — Formulario de inserción/edición de movimiento

**Ubicación:** después del bloque de notas, antes del botón de guardar.

**Condición de visibilidad:** solo si `type === 'expense'`

**Componente:**
```
Label: "Asignar a proyecto" (opcional)
Input: Dropdown/Select con proyectos activos del usuario
       — opción vacía por defecto: "Sin proyecto"
       — lista: proyectos con status = 'active', ordenados por nombre
```

**Comportamiento:**
- Al seleccionar un proyecto, se guarda `project_id` en la transacción
- Al seleccionar "Sin proyecto", `project_id` queda `null`
- Disponible tanto en inserción como en edición
- Al editar y cambiar el proyecto asignado, el recálculo es automático por ser derivado

**Web (Next.js):** Server Action para update de la transacción con el nuevo `project_id`

**Mobile (React Native/Expo):** Fetch imperativo + estado local. Usar el patrón existente del formulario de movimientos.

---

### 4. UI — Tarjeta/detalle de Proyecto

Añadir desglose del progreso:

```
Ahorro mensual acumulado    X€
Aportaciones extra          Y€
─────────────────────────────
Total aportado              Z€

Tiempo restante             N meses
```

Las aportaciones extra deben mostrarse separadas del ahorro mensual para que el usuario entienda el origen del progreso.

Añadir también en la tarjeta: lista colapsable de los gastos asignados al proyecto (nombre del movimiento, fecha, importe).

---

### 5. Integridad de datos

- Si un proyecto se elimina: `project_id` de transacciones asociadas queda `null` automáticamente (ON DELETE SET NULL en la FK)
- No permitir asignar ingresos (`type = 'income'`) a proyectos — validación en frontend y en DB (check constraint o RLS)
- Un gasto ya asignado puede reasignarse a otro proyecto o desvincularse desde el formulario de edición

---

## Archivos probablemente afectados

- `packages/shared/` — tipos TypeScript (`Transaction`, `Project`), lógica de recálculo
- `apps/web/` — formulario de movimiento, componente de tarjeta de proyecto, Server Actions
- `apps/mobile/` — formulario de movimiento, pantalla de proyecto
- `supabase/migrations/` — nueva migración con el campo `project_id`

---

## Lo que NO cambia
- El objetivo mensual (`monthly_saving`) es fijo — no se recalcula
- La estructura general del formulario de movimientos
- El color palette ni la tipografía de los proyectos
