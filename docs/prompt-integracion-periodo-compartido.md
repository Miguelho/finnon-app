# Prompt de Integración: Componente Temporal Compartido + Deep Link Categoría → Movimientos

## Contexto del cambio

La aplicación Finnon tiene dos pantallas que manejan selección temporal de formas diferentes:

- **Tu Cuenta** (`/account`): usa un selector de periodo (Semana/Mes/Trimestre/Año) definido en `apps/web/src/app/account/account-redesign-client.tsx` con la función `getPeriodRange()` que calcula rangos de fecha.
- **Movimientos** (`/transactions`): usa un navegador mes-a-mes con flechas (← Anterior / Siguiente →) definido en `apps/web/src/app/transactions/movements-client.tsx:943-996`, con estado `selectedMonth` como string `"YYYY-MM"`.

Se necesita unificar ambos bajo un componente temporal compartido y habilitar deep links desde Tu Cuenta a Movimientos con filtros pre-aplicados.

**Objetivo funcional:** Cuando el usuario está en Tu Cuenta viendo el trimestre y hace click en la categoría "Casa", debe aterrizar en `/transactions?period=quarter&category=<categoryId>` y ver los movimientos de Casa filtrados por el trimestre actual, con libertad total para modificar filtros después.

---

## Fase 1: Extraer el componente temporal compartido

### 1.1 Crear tipos compartidos en `@poleursus/shared`

Crear o extender el archivo de tipos compartidos con:

```typescript
// packages/shared/src/types/period.ts

export type Period = "week" | "month" | "quarter" | "year";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PeriodConfig {
  key: Period;
  label: string;
}

export const PERIODS: PeriodConfig[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Año" },
];
```

### 1.2 Extraer `getPeriodRange` a `@poleursus/shared`

Mover la función desde `apps/web/src/app/account/page.tsx:92-108` a shared:

```typescript
// packages/shared/src/utils/period.ts

import { type Period, type DateRange } from "../types/period";

/**
 * Calcula el rango de fechas para un periodo dado.
 * "start" es el inicio del periodo, "end" es el final del día actual.
 */
export const getPeriodRange = (period: Period, now: Date = new Date()): DateRange => {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "week":
      return {
        start: new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000),
        end: endOfDay,
      };
    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: endOfDay,
      };
    case "quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        start: new Date(now.getFullYear(), quarterStartMonth, 1),
        end: endOfDay,
      };
    }
    case "year":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: endOfDay,
      };
  }
};

/**
 * Formatea una fecha como string ISO "YYYY-MM-DD" para queries a Supabase.
 */
export const formatDateISO = (date: Date): string => {
  return date.toISOString().split("T")[0];
};
```

### 1.3 Crear el componente visual `PeriodSelector`

Crear un componente reutilizable que extraiga la UI de selección de periodo actualmente embebida en `account-redesign-client.tsx:112-125`:

```typescript
// apps/web/src/components/shared/PeriodSelector.tsx

"use client";

import { type Period, PERIODS } from "@poleursus/shared";

interface PeriodSelectorProps {
  selected: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({ selected, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            selected === key
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

> **Nota:** Replica el estilo visual exacto que ya existe en Tu Cuenta. Revisa las clases CSS de `account-redesign-client.tsx:112-125` y ajusta si difieren.

### 1.4 Actualizar Tu Cuenta para usar el componente extraído

En `apps/web/src/components/account/account-redesign-client.tsx`:

1. Eliminar el array local `PERIODS` (líneas 12-17).
2. Eliminar el JSX del selector inline (líneas 112-125).
3. Importar y usar el nuevo componente:

```typescript
import { PeriodSelector } from "@/components/shared/PeriodSelector";
import { type Period } from "@poleursus/shared";

// En el state:
const [selectedPeriod, setSelectedPeriod] = useState<Period>("month");

// En el JSX, donde estaba el selector anterior:
<PeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
```

4. Actualizar imports de `getPeriodRange` para que apunten a `@poleursus/shared` en lugar de la definición local en `page.tsx`.

---

## Fase 2: Refactorizar Movimientos para usar periodos

### 2.1 Cambiar el fetching server-side

En `apps/web/src/app/transactions/page.tsx`:

**Antes (líneas 48-58):** trae TODAS las transacciones sin filtro de fecha.

**Después:**

```typescript
import { getPeriodRange, formatDateISO } from "@poleursus/shared";
import { type Period } from "@poleursus/shared";

// Leer parámetros de URL
const periodParam = (searchParams.period as Period) ?? "month";
const categoryParam = searchParams.category as string | undefined;

// Calcular rango de fechas
const range = getPeriodRange(periodParam, new Date());

// Fetch filtrado por rango
const { data: transactions } = await supabase
  .from("transactions")
  .select(`*, category:categories(id, name, icon_id, type)`)
  .eq("account_id", activeAccount.id)
  .gte("date", formatDateISO(range.start))
  .lte("date", formatDateISO(range.end))
  .order("date", { ascending: false });
```

**Importante:** También aplica el mismo patrón al fetch de recurrentes si existe en el mismo archivo.

Pasar los parámetros iniciales al componente cliente:

```typescript
<MovementsClient
  initialTransactions={transactions ?? []}
  initialRecurringItems={recurrents ?? []}
  initialPeriod={periodParam}
  initialCategoryFilter={categoryParam ?? null}
  // ... otros props existentes
/>
```

### 2.2 Actualizar el componente cliente de Movimientos

En `apps/web/src/app/transactions/movements-client.tsx`:

#### 2.2.1 Reemplazar el estado temporal

**Eliminar:**
```typescript
const [selectedMonth, setSelectedMonth] = useState(initialMonth);
```

**Reemplazar con:**
```typescript
import { type Period } from "@poleursus/shared";

// Props nuevos
interface MovementsClientProps {
  // ... props existentes
  initialPeriod: Period;
  initialCategoryFilter: string | null;
}

// State
const [selectedPeriod, setSelectedPeriod] = useState<Period>(initialPeriod);
```

#### 2.2.2 Inicializar filtro de categoría desde deep link

**Cambiar la inicialización de `categoryFilters` (línea ~669):**

```typescript
// Antes:
const [categoryFilters, setCategoryFilters] = useState<string[]>([]);

// Después:
const [categoryFilters, setCategoryFilters] = useState<string[]>(
  initialCategoryFilter ? [initialCategoryFilter] : []
);
```

#### 2.2.3 Reemplazar el filtrado por mes con filtrado por periodo

**Eliminar el filtrado por mes (líneas 700-702):**
```typescript
// ELIMINAR:
const monthMovements = useMemo(
  () => movements.filter((movement) => movement.date.startsWith(selectedMonth)),
  [movements, selectedMonth]
);
```

**Nota:** Como ahora el fetching server-side ya filtra por rango, los datos que llegan ya están acotados al periodo. Si necesitas re-filtrar en cliente cuando el usuario cambia de periodo sin recargar la página, usa `router.push` para actualizar la URL y que el server component re-fetche:

```typescript
import { useRouter } from "next/navigation";

const router = useRouter();

const handlePeriodChange = (newPeriod: Period) => {
  setSelectedPeriod(newPeriod);

  // Construir URL con todos los filtros activos
  const params = new URLSearchParams();
  params.set("period", newPeriod);
  if (categoryFilters.length > 0) {
    params.set("category", categoryFilters[0]);
  }

  router.push(`/transactions?${params.toString()}`);
};
```

#### 2.2.4 Reemplazar el selector temporal en la UI

**Eliminar todo el bloque del navegador mes-a-mes (líneas 943-996):** las flechas "← Anterior / Siguiente →" y el display de "Febrero De 2026".

**Sustituir por:**

```typescript
import { PeriodSelector } from "@/components/shared/PeriodSelector";

// En el JSX, donde estaba el navegador de meses:
<PeriodSelector selected={selectedPeriod} onChange={handlePeriodChange} />
```

#### 2.2.5 Sincronizar URL con cambios de filtro

Para que la URL refleje siempre el estado actual de filtros (útil para compartir links y para el botón atrás del navegador):

```typescript
useEffect(() => {
  const params = new URLSearchParams();
  params.set("period", selectedPeriod);
  if (categoryFilters.length > 0) {
    params.set("category", categoryFilters.join(","));
  }
  if (merchantFilters.length > 0) {
    params.set("merchant", merchantFilters.join(","));
  }
  if (typeFilters.length > 0) {
    params.set("type", typeFilters.join(","));
  }

  // replace para no crear entradas en el historial por cada cambio de filtro
  router.replace(`/transactions?${params.toString()}`, { scroll: false });
}, [selectedPeriod, categoryFilters, merchantFilters, typeFilters]);
```

**Atención:** Hay que tener cuidado de que este `useEffect` no entre en un loop con la lectura de `searchParams`. La estrategia recomendada es leer `searchParams` solo para la inicialización (en `useState`) y que a partir de ahí el estado local sea la fuente de verdad, sincronizando hacia la URL con `router.replace`.

---

## Fase 3: Deep link desde Tu Cuenta

### 3.1 Modificar la navegación de categoría en Tu Cuenta

En el componente donde se renderizan las categorías dentro de Tu Cuenta (probablemente en `account-redesign-client.tsx` o un subcomponente), buscar el handler de click en categoría.

**Antes:**
```typescript
router.push(`/categories/${category.id}`);
```

**Después:**
```typescript
router.push(`/transactions?period=${selectedPeriod}&category=${category.id}`);
```

Donde `selectedPeriod` es el estado actual del selector temporal de Tu Cuenta.

### 3.2 Verificar el link "Ver todas →" de categorías

El enlace "Ver todas →" que aparece junto a "Gastos por categoría" debería ir a `/transactions?period=${selectedPeriod}` (sin filtro de categoría, para ver todas).

### 3.3 Verificar el link "Ver todos →" de últimos movimientos

Igualmente, el enlace "Ver todos →" junto a "Últimos movimientos" debería ir a `/transactions?period=${selectedPeriod}`.

---

## Fase 4: Deprecar la pantalla de categoría

### 4.1 Eliminar archivos

- Eliminar `apps/web/src/app/categories/[id]/` (la carpeta completa con `page.tsx`, `category-detail-client.tsx` y cualquier otro archivo).

### 4.2 Verificar la página de listado de categorías

- Revisar si `apps/web/src/app/categories/categories-client.tsx` se usa para algo más que navegar al detalle de categoría. Si la ruta `/categories` sigue siendo necesaria como configuración de categorías, mantenerla pero actualizar su navegación interna (línea 305) para que apunte a `/transactions?category=<id>` en lugar de `/categories/<id>`.
- Si `/categories` no tiene otro uso, deprecar la carpeta completa.

### 4.3 Limpiar referencias

Buscar en todo el proyecto referencias a `/categories/` en navegación y actualizar o eliminar:

```bash
grep -r "categories/" apps/web/src/app/ --include="*.tsx" --include="*.ts" -l
```

---

## Resumen de archivos afectados

| Archivo | Acción |
|---------|--------|
| `packages/shared/src/types/period.ts` | **CREAR** — tipos Period, DateRange, PERIODS |
| `packages/shared/src/utils/period.ts` | **CREAR** — getPeriodRange, formatDateISO |
| `packages/shared/src/index.ts` | **EDITAR** — exportar los nuevos módulos |
| `apps/web/src/components/shared/PeriodSelector.tsx` | **CREAR** — componente visual compartido |
| `apps/web/src/components/account/account-redesign-client.tsx` | **EDITAR** — usar PeriodSelector, importar de shared, actualizar navegación de categorías |
| `apps/web/src/app/account/page.tsx` | **EDITAR** — importar getPeriodRange de shared en vez de definirlo localmente |
| `apps/web/src/app/transactions/page.tsx` | **EDITAR** — leer params de URL, fetch con rango de fechas, pasar initialPeriod/initialCategoryFilter a cliente |
| `apps/web/src/app/transactions/movements-client.tsx` | **EDITAR** — reemplazar selector mes-a-mes por PeriodSelector, inicializar filtros desde props, sincronizar URL |
| `apps/web/src/app/categories/[id]/` | **ELIMINAR** — pantalla de detalle de categoría |
| `apps/web/src/app/categories/categories-client.tsx` | **EDITAR o ELIMINAR** — actualizar navegación o deprecar si no tiene otro uso |

---

## Criterios de validación

1. **Tu Cuenta → Categoría "Casa" (vista Trimestre):** Al hacer click se navega a `/transactions?period=quarter&category=<id>`, se muestra PeriodSelector con "Trimestre" activo, chip "Casa ×" visible en filtros, y solo se ven movimientos de Casa del trimestre actual.
2. **Cambio de periodo en Movimientos:** Al cambiar de Trimestre a Mes, la URL se actualiza, se re-fetchean los datos, y los filtros de categoría se mantienen.
3. **Eliminar filtro de categoría:** Al quitar el chip "Casa ×", la URL se actualiza quitando `&category=...` y se muestran todos los movimientos del periodo.
4. **Navegación directa a `/transactions`:** Sin parámetros, defaults a `period=month` sin filtros de categoría (comportamiento equivalente al actual).
5. **Ruta `/categories/<id>` eliminada:** Devuelve 404 o redirige a `/transactions`.
6. **PeriodSelector idéntico visualmente** en Tu Cuenta y en Movimientos.
7. **Recurrentes en Movimientos:** La sección de pagos recurrentes y la barra "Por registrar" siguen funcionando correctamente con el nuevo esquema temporal.
