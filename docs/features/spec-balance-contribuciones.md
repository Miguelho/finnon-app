# Spec: Balance de Contribuciones

## Contexto

Finnon es una app de gestión financiera colaborativa. Las cuentas compartidas tienen múltiples miembros (parejas, compañeros de piso). Actualmente no hay visibilidad sobre quién contribuye cuánto a los gastos compartidos, lo que genera percepciones de desequilibrio ("yo siempre pago el súper").

Esta feature introduce dos conceptos: **reparto de transacciones** (quién pagó y cómo se divide el gasto) y **balance de contribuciones** (vista agregada de quién ha aportado qué).

---

## 1. Cambios en el modelo de datos

### 1.1 Nuevos campos en `transactions`

Se añaden 3 campos directamente en la tabla de transacciones para evitar una tabla adicional. Si en el futuro el uso de `custom` splits es masivo, se puede migrar a una tabla `transaction_splits` separada de forma mecánica:
1. `personal` → 1 registro para `paid_by` con el 100% del importe
2. `equal` → N registros proporcionales entre los miembros activos
3. `custom` → N registros según `split_details`

#### Campo `split_type`

```sql
alter table public.transactions
  add column split_type text not null default 'equal'
  constraint transactions_split_type_check check (
    split_type = any (array['equal'::text, 'personal'::text, 'custom'::text])
  );
```

- `equal`: el gasto se reparte a partes iguales entre todos los miembros activos (contributor/admin) de la cuenta. No requiere detalle adicional.
- `personal`: el 100% del gasto es para `paid_by`. No requiere detalle adicional.
- `custom`: el reparto se define explícitamente en `split_details`.

#### Campo `split_details`

```sql
alter table public.transactions
  add column split_details jsonb null
  constraint transactions_split_details_check check (
    (split_type != 'custom') or (split_details is not null)
  );
```

Formato de `split_details` (solo cuando `split_type = 'custom'`):
```json
[
  {"user_id": "uuid-miguel", "share_minor": 7000},
  {"user_id": "uuid-ana", "share_minor": 3000}
]
```

**Regla de integridad (validar en la capa de aplicación):** cuando `split_type = 'custom'`, la suma de `share_minor` de todos los elementos de `split_details` DEBE ser igual al `amount_minor` de la transacción.

### 1.2 Nuevo campo: `paid_by`

```sql
alter table public.transactions 
  add column paid_by uuid null;

-- Migración: asignar created_by como paid_by para transacciones existentes
update public.transactions set paid_by = created_by where paid_by is null;

-- Después de la migración, hacer NOT NULL
alter table public.transactions 
  alter column paid_by set not null;

alter table public.transactions
  add constraint transactions_paid_by_fkey 
    foreign key (paid_by) references auth.users (id);

create index idx_transactions_paid_by on public.transactions using btree (paid_by);
```

**`paid_by`** = quién desembolsó el dinero (puede ser diferente de `created_by` que es quien registró la transacción en la app).

---

## 2. Lógica de reparto

### 2.1 Comportamiento por defecto (Opción C)

Cuando se crea una transacción en una cuenta compartida, el reparto por defecto es **partes iguales entre todos los miembros activos** de la cuenta.

Ejemplo: cuenta con 2 miembros, gasto de 50,00€ (5000 minor)
- Split miembro A: 2500
- Split miembro B: 2500

Para importes impares (ej: 5001 entre 2): el primer miembro absorbe el céntimo extra.
- Split miembro A: 2501
- Split miembro B: 2500

### 2.2 Reparto personalizado

El usuario puede modificar el reparto al crear/editar una transacción:

- **100% para mí**: gasto personal (share_minor = amount_minor para el usuario, 0 para el resto)
- **Partes iguales**: default (50/50, 33/33/34, etc.)
- **Personalizado**: el usuario asigna cantidades o porcentajes manualmente

### 2.3 Transacciones en cuentas individuales

Si la cuenta solo tiene 1 miembro, no se crean splits (no tiene sentido). La feature de balance de contribuciones solo aplica a cuentas con 2+ miembros.

### 2.4 Cuentas con miembros de rol `viewer`

Los viewers no participan en splits por defecto. Solo los miembros con rol `contributor` o `admin` se incluyen en el reparto automático.

---

## 3. UI: Formulario de transacción

### 3.1 Nuevo campo: "¿Quién pagó?"

- **Ubicación**: en el formulario de crear/editar transacción, después del campo de importe.
- **Componente**: selector con los miembros de la cuenta (avatar + nombre).
- **Default**: el usuario actual.
- **Solo visible** en cuentas con 2+ miembros activos (contributor/admin).

### 3.2 Nuevo campo: "Reparto"

- **Ubicación**: debajo de "¿Quién pagó?"
- **Solo visible** en cuentas con 2+ miembros activos.
- **Opciones** (segmented control o similar):
  - `Partes iguales` (default) — No muestra detalle adicional.
  - `Solo mío` — Atajo para 100% al usuario actual.
  - `Personalizado` — Expande una lista de miembros con campos de cantidad editables. Al cambiar uno, el resto se ajusta automáticamente para sumar el total.

### 3.3 Validación

- La suma de los splits debe ser exactamente igual al importe de la transacción.
- Si no cuadra, mostrar error inline: "El reparto no suma el total de la transacción".
- `paid_by` es obligatorio en cuentas compartidas.

---

## 4. UI: Balance de contribuciones

### 4.1 Ubicación

Sección dentro de **"Tu cuenta"** → nueva subsección **"Balance"** (o "Contribuciones").

Justificación: es información de la cuenta compartida, no del usuario individual. Ponerlo en Inicio saturaría la vista principal.

### 4.2 Vista principal del balance

**Cabecera resumen:**
- Barra visual proporcional mostrando el % de contribución de cada miembro (con colores asignados).
- Texto: "[Nombre] ha pagado X€ · [Nombre] ha pagado Y€"
- Período seleccionable: Este mes / Mes anterior / Últimos 3 meses / Personalizado.

**Saldo neto:**
- Cálculo: para cada miembro → `total_pagado - total_que_le_corresponde`
  - `total_pagado` = suma de `amount_minor` de todas las transacciones donde `paid_by = user_id` en el período.
  - `total_que_le_corresponde` = suma de `share_minor` de todos sus splits en el período.
- Mostrar como: "[Nombre A] le debe X€ a [Nombre B]" o "Estáis en equilibrio" si la diferencia es < 1€.
- Para N usuarios: mostrar la lista de deudas simplificada (algoritmo de simplificación de deudas min-cash-flow).

**Desglose por categoría:**
- Lista de categorías con barra comparativa por miembro.
- Ejemplo: "Supermercado — Miguel: 340€ (68%) · Ana: 160€ (32%)"
- Ordenado por mayor gasto total descendente.

### 4.3 Vista en detalle de transacción

En la vista de detalle de cada transacción, añadir una sección que muestre:
- Quién pagó (avatar + nombre)
- Cómo se reparte (lista de miembros con su parte)

---

## 5. Cálculo del balance (lógica de negocio)

### 5.1 Query principal

```sql
-- Balance por miembro en un período para una cuenta
-- Paso 1: Total pagado por cada miembro
with pagos as (
  select 
    t.paid_by as user_id,
    sum(t.amount_base_minor) as total_pagado
  from transactions t
  where t.account_id = :account_id
    and t.type = 'expense'
    and t.date between :start_date and :end_date
  group by t.paid_by
),
-- Paso 2: Total que le corresponde a cada miembro
-- Se calcula en la capa de aplicación porque depende del split_type:
--   equal   → amount_base_minor / N miembros activos
--   personal → amount_base_minor si paid_by = user, 0 si no
--   custom  → parsear split_details y convertir a base currency
```

**Recomendación de implementación:** dado que `equal` y `personal` no necesitan JSON parsing, hacer la query en dos pasos:

1. Fetch todas las transacciones del período con sus campos `split_type`, `split_details`, `paid_by`, `amount_base_minor`.
2. Calcular el reparto en la capa de aplicación (TypeScript) iterando las transacciones y acumulando por usuario.

Esto evita queries SQL complejas con `case` + `jsonb_array_elements` y es más fácil de mantener y testear.

```typescript
interface BalanceResult {
  userId: string;
  totalPagado: number;    // lo que ha desembolsado
  totalResponsable: number; // lo que le corresponde pagar
  saldoNeto: number;       // positivo = le deben, negativo = debe
}

function calcularBalance(
  transactions: Transaction[],
  activeMembers: string[]
): BalanceResult[] {
  const balance = new Map<string, { pagado: number; responsable: number }>();
  
  // Inicializar todos los miembros
  for (const uid of activeMembers) {
    balance.set(uid, { pagado: 0, responsable: 0 });
  }

  for (const tx of transactions) {
    // Acumular lo pagado
    const entry = balance.get(tx.paidBy);
    if (entry) entry.pagado += tx.amountBaseMinor;

    // Acumular lo que corresponde según split_type
    switch (tx.splitType) {
      case 'equal': {
        const share = Math.floor(tx.amountBaseMinor / activeMembers.length);
        const remainder = tx.amountBaseMinor % activeMembers.length;
        activeMembers.forEach((uid, i) => {
          const b = balance.get(uid)!;
          b.responsable += share + (i < remainder ? 1 : 0);
        });
        break;
      }
      case 'personal': {
        const b = balance.get(tx.paidBy);
        if (b) b.responsable += tx.amountBaseMinor;
        break;
      }
      case 'custom': {
        for (const split of tx.splitDetails!) {
          const b = balance.get(split.userId);
          if (b) b.responsable += split.shareMinor;
        }
        break;
      }
    }
  }

  return activeMembers.map(uid => {
    const b = balance.get(uid)!;
    return {
      userId: uid,
      totalPagado: b.pagado,
      totalResponsable: b.responsable,
      saldoNeto: b.pagado - b.responsable,
    };
  });
}
```

**Nota sobre multi-divisa:** usar `amount_base_minor` (ya convertido a la divisa base de la cuenta) para los cálculos de balance. Para splits custom, almacenar `share_minor` en la misma divisa que `amount_minor` de la transacción; la conversión a base currency se hace en el cálculo usando el mismo `fx_rate` de la transacción.

### 5.2 Query por categoría

```sql
select
  t.category_id,
  t.paid_by as user_id,
  sum(t.amount_base_minor) as total_pagado
from transactions t
where t.account_id = :account_id
  and t.type = 'expense'
  and t.date between :start_date and :end_date
  and t.category_id is not null
group by t.category_id, t.paid_by
order by sum(t.amount_base_minor) desc;
```

### 5.3 Simplificación de deudas (N > 2 miembros)

Para cuentas con más de 2 miembros, usar el algoritmo min-cash-flow:

1. Calcular saldo neto de cada miembro (total_pagado - total_responsable).
2. Separar en acreedores (saldo positivo) y deudores (saldo negativo).
3. Iterar: el mayor deudor paga al mayor acreedor el mínimo entre ambos saldos.
4. Repetir hasta que todos los saldos sean 0.

Resultado: lista de transferencias mínimas para saldar deudas.

---

## 6. Migración de datos existentes

Para transacciones existentes (creadas antes de esta feature):

1. **`paid_by`**: asignar `created_by` como valor por defecto (ver SQL en sección 1.2).
2. **`split_type`**: todas las transacciones existentes se marcan como `'equal'` (default de la columna).
3. **`split_details`**: queda como `null` para todas (no se necesita para `equal`).

No se requiere script de migración complejo — los defaults de las columnas hacen el trabajo.

**Consideración importante:** el reparto `equal` para transacciones históricas asume que el gasto era compartido a partes iguales, lo cual puede no ser preciso. Aceptar esta limitación y documentarla — el balance histórico pre-migración será aproximado.

---

## 7. Impacto en funcionalidad existente

### 7.1 Creación de transacción
- Añadir campos `paid_by`, `split_type` y opcionalmente `split_details` al formulario (solo cuentas compartidas).
- Guardar todo en una sola operación INSERT (sin tabla auxiliar).

### 7.2 Edición de transacción
- Permitir editar `paid_by` y reparto.
- Al cambiar el importe, si `split_type = 'custom'`, avisar al usuario de que debe revisar el reparto.
- Si `split_type = 'equal'`, no hace falta tocar nada — se recalcula dinámicamente.

### 7.3 Eliminación de transacción
- No hay impacto adicional — los campos de split están en la propia transacción.

### 7.4 Transacciones recurrentes
- Al generar una transacción desde un recurring_item, aplicar el reparto por defecto (partes iguales).
- Considerar añadir configuración de reparto al recurring_item en el futuro (fuera de scope de esta versión).

---

## 8. Permisos y roles

| Acción | viewer | contributor | admin |
|--------|--------|-------------|-------|
| Ver balance de contribuciones | ✅ | ✅ | ✅ |
| Crear transacción con splits | ❌ | ✅ | ✅ |
| Editar paid_by/splits propios | ❌ | ✅ | ✅ |
| Editar paid_by/splits de otros | ❌ | ❌ | ✅ |

---

## 9. Scope y exclusiones

### En scope (v1):
- Campos `paid_by`, `split_type`, `split_details` en transacciones
- UI de reparto en formulario de transacción (partes iguales / solo mío / personalizado)
- Vista de balance de contribuciones en "Tu cuenta"
- Saldo neto entre miembros
- Desglose por categoría
- Migración de datos existentes (defaults automáticos)
- Simplificación de deudas para N > 2

### Fuera de scope (futuro):
- Migración a tabla `transaction_splits` separada (si el uso de custom es masivo)
- Reparto configurable en transacciones recurrentes
- Botón "saldar deuda" (registro automático de transferencia entre miembros)
- Notificaciones cuando el balance supera un umbral
- Historial temporal del balance (gráfico de evolución)
- Export del balance

---

## 10. Criterios de aceptación

1. Al crear una transacción en cuenta compartida, se muestra selector de "quién pagó" y opciones de reparto.
2. El reparto por defecto es `equal` (partes iguales entre miembros contributor/admin).
3. El usuario puede cambiar a `personal` (solo mío) o `custom` (personalizado).
4. Cuando `split_type = 'custom'`, la suma de shares debe igualar el importe total; si no cuadra, mostrar error inline.
5. En "Tu cuenta" → "Balance" se muestra el resumen de contribuciones del período actual.
6. El saldo neto indica claramente quién debe a quién y cuánto.
7. El desglose por categoría muestra la proporción de cada miembro.
8. Las transacciones existentes usan `paid_by = created_by` y `split_type = 'equal'` por defecto.
9. En cuentas individuales (1 miembro), no se muestra nada de esta feature.
10. Los viewers pueden ver el balance pero no crear/editar transacciones.
