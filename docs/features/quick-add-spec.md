# Spec Técnica: Quick Add (Introducción Rápida de Movimientos)

## 1. Objetivo

Reducir la fricción de entrada manual de datos mostrando 3 sugerencias de movimientos frecuentes en el paso 1 del formulario de creación (`AddTransactionForm`). Al seleccionar una sugerencia, se autorellenan `amount`, `merchant`, `categoryId` y `date` (hoy). El usuario revisa cada paso del formulario existente sin rellenar manualmente si la sugerencia es correcta.

Las sugerencias se calculan **client-side** sobre el dataset de transacciones de 3 meses disponible en la cache centralizada, sin llamadas adicionales a Supabase.

---

## 2. Modelo de datos

### 2.1 Agrupación

Se agrupan las transacciones de los últimos 90 días por:

- **`merchant`** (normalizado)
- **`categoryId`**
- **`type`** (income / expense) — filtro previo, no parte de la clave de grupo

Cada grupo genera un candidato a sugerencia.

### 2.2 Campos derivados por grupo

| Campo | Definición |
|---|---|
| `merchant` | Nombre del merchant (normalizado) |
| `categoryId` | ID de la categoría asociada |
| `frequency` | Nº de ocurrencias en los últimos 90 días |
| `daymatchRatio` | Ocurrencias en el día de semana actual / ocurrencias totales |
| `daysSinceLast` | Días transcurridos desde la última ocurrencia del grupo |
| `modeAmount` | Importe más repetido dentro del grupo. En caso de empate de frecuencia, el importe de la ocurrencia más reciente |

### 2.3 Estructura del candidato

```typescript
interface QuickAddSuggestion {
  merchant: string;
  categoryId: string;
  amount: number;          // modeAmount
  frequency: number;
  daymatchRatio: number;   // 0..1
  daysSinceLast: number;
  lastUsed: string;        // ISO date
}
```

---

## 3. Algoritmo de scoring

### 3.1 Ordenación jerárquica (sin pesos numéricos)

Las sugerencias se ordenan por sort jerárquico con desempate en cascada:

1. **`frequency`** — descendente (más frecuente primero)
2. **`daymatchRatio`** — descendente (mayor afinidad con el día de semana actual)
3. **`daysSinceLast`** — ascendente (más reciente primero)

Se toman los **3 primeros** resultados tras ordenar.

### 3.2 Cálculo de `modeAmount`

Dentro de cada grupo (`merchant + categoryId`):

1. Agrupar las transacciones por `amount`.
2. Contar ocurrencias de cada `amount`.
3. Seleccionar el `amount` con mayor frecuencia.
4. Si hay empate: seleccionar el `amount` cuya ocurrencia más reciente sea más cercana a hoy.

### 3.3 Cálculo de `daymatchRatio`

```
daymatchRatio = transacciones del grupo en el mismo dayOfWeek que hoy / total de transacciones del grupo
```

Donde `dayOfWeek` se extrae del campo `date` de la transacción (no de `created_at`).

### 3.4 Umbral mínimo

Un grupo necesita `frequency >= 2` para ser candidato. Los movimientos que solo han ocurrido una vez no generan sugerencia (evita ruido de gastos esporádicos).

---

## 4. Fuente de datos

### 4.1 Cache centralizada

Los datos se obtienen del hook `useCachedTransactionsRange` con rango de 90 días hacia atrás desde hoy.

```typescript
const today = new Date();
const ninetyDaysAgo = subDays(today, 90);
const { data: transactions } = useCachedTransactionsRange(accountId, ninetyDaysAgo, today);
```

No se hacen llamadas adicionales a Supabase. No se modifican las RPCs existentes (`get_merchant_suggestions`, `get_top_categories`).

### 4.2 Filtrado previo

Antes de agrupar, se filtran las transacciones por:

- `type` coincide con el tipo seleccionado en el formulario (income / expense)
- `merchant` no es null ni vacío (movimientos sin merchant no generan sugerencias)

---

## 5. Integración en el formulario

### 5.1 Ubicación

Las sugerencias se muestran en **Step1Details** (`Step1Details.tsx`), antes de los campos del formulario, como chips/tarjetas compactas.

### 5.2 Contenido visual de cada sugerencia

Cada chip muestra:

- Nombre del merchant
- Importe (`modeAmount`) con formato de moneda de la cuenta
- Indicador visual de categoría (icono + color de la categoría)

### 5.3 Interacción

1. El usuario abre el formulario de crear movimiento.
2. Selecciona tipo (income/expense) — las sugerencias se recalculan al cambiar tipo.
3. Ve hasta 3 chips de sugerencia encima de los campos del formulario.
4. Al tocar un chip:
   - `amount` se rellena con `modeAmount`
   - `merchant` se rellena con el merchant de la sugerencia
   - `date` se rellena con hoy (comportamiento por defecto actual, sin cambio)
   - `categoryId` se almacena internamente para preseleccionarse en el paso 2
5. El usuario puede modificar cualquier campo antes de avanzar.
6. En el paso 2, la categoría aparece preseleccionada pero el usuario puede cambiarla.
7. Paso 3 (notes) funciona sin cambios.

### 5.4 Estado vacío

Si no hay sugerencias (usuario nuevo o sin suficientes datos):

- No se muestran chips.
- Se muestra un texto informativo sutil: _"A medida que registres movimientos, te sugeriremos los más frecuentes para que los añadas con un toque."_
- Este mensaje desaparece cuando hay al menos 1 sugerencia disponible.

### 5.5 Deselección

Si el usuario toca un chip ya seleccionado, se limpian los campos autorellenados y vuelven a su estado vacío.

---

## 6. Implementación

### 6.1 Nuevo módulo: motor de sugerencias

**Ubicación:** `packages/shared/src/suggestions/quick-add.ts`

Este módulo es puro cálculo, sin dependencias de React ni de plataforma.

```typescript
// Tipos
export interface QuickAddSuggestion {
  merchant: string;
  categoryId: string;
  amount: number;
  frequency: number;
  daymatchRatio: number;
  daysSinceLast: number;
  lastUsed: string;
}

export interface QuickAddConfig {
  minFrequency: number;     // default: 2
  maxSuggestions: number;    // default: 3
  windowDays: number;        // default: 90
}

// API pública
export function computeQuickAddSuggestions(
  transactions: Transaction[],
  type: 'income' | 'expense',
  referenceDate: Date,
  config?: Partial<QuickAddConfig>
): QuickAddSuggestion[];
```

**Pasos internos de `computeQuickAddSuggestions`:**

1. Filtrar transacciones por `type` y `merchant` no vacío.
2. Agrupar por `normalize(merchant) + categoryId`.
3. Para cada grupo:
   - Calcular `frequency` (conteo).
   - Descartar si `frequency < config.minFrequency`.
   - Calcular `modeAmount` (importe más frecuente; empate → más reciente).
   - Calcular `daymatchRatio` usando `referenceDate.getDay()`.
   - Calcular `daysSinceLast` desde `referenceDate`.
4. Ordenar por `[frequency DESC, daymatchRatio DESC, daysSinceLast ASC]`.
5. Retornar los primeros `config.maxSuggestions`.

### 6.2 Normalización de merchant

Reutilizar la función de normalización existente que ya usa `get_merchant_suggestions` en backend. Si no está disponible en el paquete shared, extraerla:

```typescript
export function normalizeMerchant(name: string): string {
  return name.trim().toLowerCase();
}
```

Verificar que la normalización sea consistente con la que aplica la RPC `021_get_merchant_suggestions_rpc.sql` para evitar discrepancias entre sugerencias client-side y datos del backend.

### 6.3 Hook de React

**Ubicación mobile:** `apps/mobile/src/hooks/useQuickAddSuggestions.ts`
**Ubicación web:** `apps/web/src/hooks/useQuickAddSuggestions.ts`

```typescript
export function useQuickAddSuggestions(
  accountId: string,
  type: 'income' | 'expense'
): {
  suggestions: QuickAddSuggestion[];
  isLoading: boolean;
} {
  const today = new Date();
  const from = subDays(today, 90);
  const { data: transactions, isLoading } = useCachedTransactionsRange(accountId, from, today);

  const suggestions = useMemo(
    () => transactions ? computeQuickAddSuggestions(transactions, type, today) : [],
    [transactions, type, today.toDateString()]
  );

  return { suggestions, isLoading };
}
```

**Nota sobre memoización:** La dependencia `today.toDateString()` garantiza que las sugerencias se recalculan al cambiar el día pero no en cada render.

### 6.4 Modificaciones en Step1Details

En `Step1Details.tsx`:

1. Importar `useQuickAddSuggestions`.
2. Renderizar las sugerencias como chips antes de los campos del formulario.
3. Al tocar un chip, actualizar el form state con `amount`, `merchant`, y almacenar `categoryId` para el paso 2.
4. Gestionar estado de chip seleccionado (highlight visual + deselección).

### 6.5 Modificaciones en Step2Category

En `Step2Category.tsx`:

1. Leer el `categoryId` preseleccionado desde el form state (si existe).
2. Si hay preselección, mostrar la categoría ya seleccionada al entrar al paso.
3. El usuario puede cambiarla normalmente.

### 6.6 Propagación del categoryId preseleccionado

Opción recomendada: añadir un campo `suggestedCategoryId` al form state que `Step1Details` setea al tocar un chip y `Step2Category` consume como valor inicial. Este campo no participa en la validación — `categoryId` sigue siendo el campo definitivo.

---

## 7. Configuración

Los parámetros del algoritmo se definen en un objeto de configuración centralizado:

**Ubicación:** `packages/shared/src/suggestions/config.ts`

```typescript
export const QUICK_ADD_DEFAULT_CONFIG: QuickAddConfig = {
  minFrequency: 2,
  maxSuggestions: 3,
  windowDays: 90,
};
```

Estos valores son los defaults. El hook acepta overrides parciales para testing o futuros ajustes sin cambiar código.

---

## 8. Testing

### 8.1 Tests unitarios para `computeQuickAddSuggestions`

| Caso | Input | Expected |
|---|---|---|
| Sin transacciones | `[]` | `[]` |
| Todos con frequency 1 | Movimientos únicos | `[]` (filtrados por `minFrequency`) |
| Ordenación por frequency | 3 merchants con freq 10, 5, 3 | Orden: 10 → 5 → 3 |
| Desempate por daymatch | 2 merchants con freq 5; uno 80% lunes, otro 20% lunes; hoy es lunes | El de 80% primero |
| Desempate por recencia | 2 merchants con freq 5 y daymatch idéntico; uno hace 2 días, otro hace 30 | El de 2 días primero |
| modeAmount: moda clara | Merchant con importes [10, 10, 10, 12, 15] | `modeAmount = 10` |
| modeAmount: empate | Merchant con importes [10, 10, 12, 12]; 12 más reciente | `modeAmount = 12` |
| Filtro por tipo | Mix income/expense | Solo sugerencias del tipo solicitado |
| Merchant vacío excluido | Transacciones sin merchant | No generan sugerencias |
| Máximo 3 | 10 merchants elegibles | Solo 3 retornados |
| Config override | `minFrequency: 5` | Solo merchants con freq ≥ 5 |

### 8.2 Tests de integración

- Verificar que el hook devuelve sugerencias correctas desde cache.
- Verificar que al tocar un chip en Step1, los campos se autorellenan.
- Verificar que el `categoryId` preseleccionado persiste al navegar a Step2.
- Verificar que cambiar el tipo (income ↔ expense) recalcula las sugerencias.
- Verificar la deselección (tocar chip seleccionado limpia campos).
- Verificar estado vacío (usuario sin datos, mensaje informativo visible).

---

## 9. Decisiones explícitas

| Decisión | Justificación |
|---|---|
| Client-side, no RPC | Reduce carga Supabase; datos ya en cache de 3 meses |
| Sort jerárquico, no scoring ponderado | Misma efectividad para el caso de uso real; más legible y testeable |
| `date` para dayOfWeek, no `created_at` | `date` refleja cuándo ocurrió el gasto, no cuándo se registró |
| Sin franja horaria en v1 | `created_at` no es proxy fiable de hora real del movimiento |
| `minFrequency >= 2` | Evita ruido de gastos esporádicos |
| `modeAmount` en vez de media | El usuario espera ver el importe que suele pagar, no un promedio |
| `suggestedCategoryId` separado de `categoryId` | No contamina validación; es solo preset visual |

---

## 10. Fuera de alcance (v1)

- Ponderación por franja horaria.
- Sugerencias basadas en movimientos recurrentes/obligaciones (solo transacciones normales).
- Machine learning o modelos predictivos.
- Personalización de sugerencias por usuario dentro de una cuenta compartida.
- Analytics de uso de sugerencias (CTR, tasa de aceptación).

---

## 11. Archivos a crear/modificar

### Crear

| Archivo | Descripción |
|---|---|
| `packages/shared/src/suggestions/quick-add.ts` | Motor de cálculo de sugerencias |
| `packages/shared/src/suggestions/config.ts` | Configuración por defecto |
| `packages/shared/src/suggestions/index.ts` | Re-exports |
| `apps/mobile/src/hooks/useQuickAddSuggestions.ts` | Hook React Native |
| `apps/web/src/hooks/useQuickAddSuggestions.ts` | Hook Web |
| `packages/shared/src/suggestions/__tests__/quick-add.test.ts` | Tests unitarios |

### Modificar

| Archivo | Cambio |
|---|---|
| `packages/shared/src/index.ts` | Exportar módulo suggestions |
| `Step1Details.tsx` (mobile) | Renderizar chips de sugerencia; gestionar selección/deselección |
| `Step1Details.tsx` (web) | Idem para web |
| `Step2Category.tsx` (mobile) | Consumir `suggestedCategoryId` como preselección |
| `Step2Category.tsx` (web) | Idem para web |
| `AddTransactionForm.tsx` (mobile) | Añadir `suggestedCategoryId` al form state |
| `AddTransactionForm.tsx` (web) | Idem para web |
