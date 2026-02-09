# Finnon Onboarding — Spec técnica de implementación

## Resumen

Expandir el flujo de onboarding actual (crear cuenta → Home) a un flujo guiado de 5 pasos:

1. **Bienvenida** — Pantalla informativa
2. **Categorías** — Selección de categorías sugeridas
3. **Gastos fijos** — Registro de mínimo 2 recurrentes
4. **Objetivo** — Definir un objetivo de ahorro (opcional)
5. **Resumen** — Preview de datos creados + CTA invitar pareja

El flujo se inserta **después** de crear la cuenta (nombre + moneda) y **antes** de redirigir al Home.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  @poleursus/shared                                  │
│  ├── categories/defaults.ts  (expandir)             │
│  ├── onboarding/types.ts     (nuevo)                │
│  └── onboarding/index.ts     (nuevo)                │
├─────────────────────────────────────────────────────┤
│  apps/web                                           │
│  └── src/app/onboarding/                            │
│      ├── page.tsx            (refactor: multi-step) │
│      ├── actions.ts          (expandir)             │
│      └── steps/              (nuevo)                │
│          ├── WelcomeStep.tsx                         │
│          ├── CategoriesStep.tsx                      │
│          ├── RecurrentsStep.tsx                      │
│          ├── ObjectiveStep.tsx                       │
│          └── DoneStep.tsx                            │
├─────────────────────────────────────────────────────┤
│  apps/mobile                                        │
│  └── app/(auth)/                                    │
│      └── onboarding.tsx      (refactor: multi-step) │
│      └── onboarding/         (nuevo)                │
│          ├── WelcomeStep.tsx                         │
│          ├── CategoriesStep.tsx                      │
│          ├── RecurrentsStep.tsx                      │
│          ├── ObjectiveStep.tsx                       │
│          └── DoneStep.tsx                            │
└─────────────────────────────────────────────────────┘
```

---

## 1. Cambios en `@poleursus/shared`

### 1.1 Expandir `categories/defaults.ts`

Reemplazar `DEFAULT_CATEGORIES` con un set más completo. Añadir un campo `preselected: boolean` para indicar cuáles vienen marcadas por defecto en el onboarding.

```typescript
// packages/shared/src/categories/defaults.ts

import { type CategoryIconKey } from "../icons/category-icons";
import { normalizeCategoryName, type CategoryType } from "../schemas/category";

export type DefaultCategory = {
  name: string;
  name_en: string; // Para i18n
  icon_id: CategoryIconKey;
  type: CategoryType;
  preselected: boolean;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Gastos - preseleccionados
  { name: "Hogar",          name_en: "Home",            icon_id: "House",           type: "expense", preselected: true },
  { name: "Transporte",     name_en: "Transport",       icon_id: "Car",             type: "expense", preselected: true },
  { name: "Alimentación",   name_en: "Groceries",       icon_id: "ShoppingCart",    type: "expense", preselected: true },
  { name: "Restaurantes",   name_en: "Restaurants",     icon_id: "ForkKnife",       type: "expense", preselected: true },
  { name: "Suscripciones",  name_en: "Subscriptions",   icon_id: "Monitor",         type: "expense", preselected: true },
  { name: "Suministros",    name_en: "Utilities",       icon_id: "Plug",            type: "expense", preselected: true },
  // Gastos - no preseleccionados
  { name: "Salud",          name_en: "Health",          icon_id: "FirstAidKit",     type: "expense", preselected: false },
  { name: "Ocio",           name_en: "Leisure",         icon_id: "GameController",  type: "expense", preselected: false },
  { name: "Ropa",           name_en: "Clothing",        icon_id: "TShirt",          type: "expense", preselected: false },
  { name: "Mascotas",       name_en: "Pets",            icon_id: "PawPrint",        type: "expense", preselected: false },
  // Ingresos
  { name: "Nómina",         name_en: "Salary",          icon_id: "Briefcase",       type: "income",  preselected: true },
];

// ... resto de seedDefaultCategories se mantiene igual pero usa el nuevo array
```

> **Nota**: Los `icon_id` deben mapearse a los que ya existen en `category-icons`. Verificar que `House`, `Car`, `ShoppingCart`, `ForkKnife`, `Monitor`, `Plug`, `FirstAidKit`, `TShirt`, `Briefcase` existen. Si no, usar los más cercanos disponibles.

> **Nota sobre i18n**: `name_en` se incluye para que el onboarding pueda mostrar el nombre en el idioma correcto. La función `seedDefaultCategories` debería recibir el locale y usar `name` o `name_en` según corresponda.

### 1.2 Nuevo módulo `onboarding/`

```typescript
// packages/shared/src/onboarding/types.ts

import type { DefaultCategory } from "../categories/defaults";
import type { RecurringFrequency } from "../recurring/recurring";

/** Categoría seleccionada durante el onboarding */
export type OnboardingCategorySelection = {
  category: DefaultCategory;
  selected: boolean;
};

/** Recurrente sugerido en el onboarding */
export type OnboardingSuggestedRecurrent = {
  id: string;                      // ID local temporal (ej: "sug_salary")
  labelKey: string;                // Clave i18n (ej: "onboarding.recurrents.salary")
  label_es: string;                // Fallback español
  label_en: string;                // Fallback inglés
  type: "income" | "expense";
  suggestedCategoryName: string;   // Para vincular con la categoría creada
  placeholderAmount: string;       // Ej: "2000" — solo para UI, no se guarda
  frequency: RecurringFrequency;
  interval: number;
  icon: string;                    // Emoji para UI
};

/** Datos que el usuario rellena para un recurrente en el onboarding */
export type OnboardingRecurrentInput = {
  suggestedId: string;             // Referencia al sugerido
  label: string;                   // Nombre del recurrente (puede ser editado)
  type: "income" | "expense";
  amountMinor: number;             // En minor units (céntimos)
  currency: string;                // De la cuenta recién creada
  categoryName: string;            // Para buscar la categoría tras crearlas
  frequency: RecurringFrequency;
  interval: number;
  dayOfMonth: number;              // Default: día actual
};

/** Datos del objetivo del onboarding */
export type OnboardingGoalInput = {
  targetAmountMinor: number;       // En minor units
  months: 3 | 6 | 12;
};

/** Payload completo del onboarding para persistir */
export type OnboardingPayload = {
  accountId: string;
  selectedCategories: DefaultCategory[];
  recurrents: OnboardingRecurrentInput[];
  goal: OnboardingGoalInput | null; // null si el usuario lo saltó
};
```

```typescript
// packages/shared/src/onboarding/constants.ts

import type { OnboardingSuggestedRecurrent } from "./types";

export const SUGGESTED_RECURRENTS: OnboardingSuggestedRecurrent[] = [
  {
    id: "sug_salary",
    labelKey: "onboarding.recurrents.salary",
    label_es: "Nómina",
    label_en: "Salary",
    type: "income",
    suggestedCategoryName: "Nómina",
    placeholderAmount: "2000",
    frequency: "monthly",
    interval: 1,
    icon: "💼",
  },
  {
    id: "sug_rent",
    labelKey: "onboarding.recurrents.rent",
    label_es: "Alquiler",
    label_en: "Rent",
    type: "expense",
    suggestedCategoryName: "Hogar",
    placeholderAmount: "850",
    frequency: "monthly",
    interval: 1,
    icon: "🏠",
  },
  {
    id: "sug_netflix",
    labelKey: "onboarding.recurrents.netflix",
    label_es: "Netflix",
    label_en: "Netflix",
    type: "expense",
    suggestedCategoryName: "Suscripciones",
    placeholderAmount: "17.99",
    frequency: "monthly",
    interval: 1,
    icon: "📺",
  },
  {
    id: "sug_spotify",
    labelKey: "onboarding.recurrents.spotify",
    label_es: "Spotify",
    label_en: "Spotify",
    type: "expense",
    suggestedCategoryName: "Suscripciones",
    placeholderAmount: "10.99",
    frequency: "monthly",
    interval: 1,
    icon: "🎵",
  },
  {
    id: "sug_gym",
    labelKey: "onboarding.recurrents.gym",
    label_es: "Gimnasio",
    label_en: "Gym",
    type: "expense",
    suggestedCategoryName: "Salud",
    placeholderAmount: "39.90",
    frequency: "monthly",
    interval: 1,
    icon: "💪",
  },
  {
    id: "sug_phone",
    labelKey: "onboarding.recurrents.phone",
    label_es: "Teléfono",
    label_en: "Phone",
    type: "expense",
    suggestedCategoryName: "Suministros",
    placeholderAmount: "25",
    frequency: "monthly",
    interval: 1,
    icon: "📱",
  },
];

export const ONBOARDING_MIN_RECURRENTS = 2;

export const GOAL_TIMELINE_OPTIONS = [3, 6, 12] as const;
```

```typescript
// packages/shared/src/onboarding/index.ts

export * from "./types";
export * from "./constants";
```

Añadir el export en `packages/shared/src/index.ts`:

```typescript
export * from "./onboarding";
```

---

## 2. Lógica de persistencia

El onboarding guarda todo en un solo momento al completar (paso 5, botón "Ir a Finnon"). No se persiste nada durante los pasos intermedios — el estado vive en memoria (React state).

### Orden de operaciones:

```
1. Insertar categorías seleccionadas → obtener IDs
2. Para cada recurrente, mapear categoryName → categoryId
3. Insertar recurrentes
4. Si hay goal, insertar goal del mes actual
5. Redirigir al Home
```

### 2.1 Función compartida (en `@poleursus/shared`)

```typescript
// packages/shared/src/onboarding/persist.ts

import type { OnboardingPayload, DefaultCategory } from "./types";

export type OnboardingDbClient = {
  from: (table: string) => any;
};

/**
 * Persiste todos los datos del onboarding en una transacción lógica.
 * Se llama desde web (server action) y desde móvil (directamente).
 */
export async function persistOnboarding(
  client: OnboardingDbClient,
  payload: OnboardingPayload,
  userId: string,
  locale: "es" | "en"
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Insertar categorías
    const categoryRows = payload.selectedCategories.map((cat) => ({
      account_id: payload.accountId,
      name: locale === "en" ? cat.name_en : cat.name,
      icon_id: cat.icon_id,
      type: cat.type,
    }));

    const { data: insertedCategories, error: catError } = await client
      .from("categories")
      .insert(categoryRows)
      .select("id, name");

    if (catError) throw catError;

    // 2. Crear mapa nombre → id para vincular recurrentes
    const categoryMap = new Map<string, string>();
    for (const cat of insertedCategories ?? []) {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    }

    // 3. Insertar recurrentes
    if (payload.recurrents.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const dayOfMonth = new Date().getUTCDate();

      const recurrentRows = payload.recurrents.map((rec) => {
        // Buscar categoría por nombre (localizado)
        const catName = locale === "en"
          ? rec.categoryName  // ya viene en inglés si locale es en
          : rec.categoryName;
        const categoryId = categoryMap.get(catName.toLowerCase()) ?? null;

        return {
          account_id: payload.accountId,
          type: rec.type,
          amount_minor: rec.amountMinor,
          currency: rec.currency,
          category_id: categoryId,
          merchant: rec.label,
          start_date: today,
          frequency: rec.frequency,
          interval: rec.interval,
          day_of_month: rec.dayOfMonth || dayOfMonth,
          is_paused: false,
          created_by: userId,
        };
      });

      const { error: recError } = await client
        .from("recurring_items")
        .insert(recurrentRows);

      if (recError) throw recError;
    }

    // 4. Insertar goal si existe
    if (payload.goal) {
      const now = new Date();
      const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

      const { error: goalError } = await client
        .from("financial_goals")
        .insert({
          account_id: payload.accountId,
          month: monthKey,
          type: "save",
          target_amount_base_minor: payload.goal.targetAmountMinor,
          created_by: userId,
        });

      if (goalError) throw goalError;
    }

    return { success: true };
  } catch (err) {
    console.error("Error persisting onboarding:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
```

> **Importante**: Verificar que los nombres de tabla (`categories`, `recurring_items`, `financial_goals`) coinciden con tu schema de Supabase. Ajustar si difieren.

---

## 3. Implementación Web (Next.js)

### 3.1 Refactor `apps/web/src/app/onboarding/page.tsx`

Convertir la página actual en un wizard multi-step. El paso 1 sigue siendo la creación de cuenta (nombre + moneda). Una vez creada, se avanza por los pasos nuevos.

```typescript
// apps/web/src/app/onboarding/page.tsx

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreateAccountStep } from "./steps/CreateAccountStep";
import { WelcomeStep } from "./steps/WelcomeStep";
import { CategoriesStep } from "./steps/CategoriesStep";
import { RecurrentsStep } from "./steps/RecurrentsStep";
import { ObjectiveStep } from "./steps/ObjectiveStep";
import { DoneStep } from "./steps/DoneStep";
import type {
  DefaultCategory,
  OnboardingRecurrentInput,
  OnboardingGoalInput,
} from "@poleursus/shared";

type OnboardingStep =
  | "create-account"
  | "welcome"
  | "categories"
  | "recurrents"
  | "objective"
  | "done";

const STEP_ORDER: OnboardingStep[] = [
  "create-account",
  "welcome",
  "categories",
  "recurrents",
  "objective",
  "done",
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("create-account");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("EUR");
  const [selectedCategories, setSelectedCategories] = useState<DefaultCategory[]>([]);
  const [recurrents, setRecurrents] = useState<OnboardingRecurrentInput[]>([]);
  const [goal, setGoal] = useState<OnboardingGoalInput | null>(null);

  const goTo = (step: OnboardingStep) => setCurrentStep(step);

  const handleAccountCreated = (id: string, curr: string) => {
    setAccountId(id);
    setCurrency(curr);
    goTo("welcome");
  };

  switch (currentStep) {
    case "create-account":
      return <CreateAccountStep onComplete={handleAccountCreated} />;
    case "welcome":
      return <WelcomeStep onContinue={() => goTo("categories")} />;
    case "categories":
      return (
        <CategoriesStep
          onContinue={(cats) => {
            setSelectedCategories(cats);
            goTo("recurrents");
          }}
          onBack={() => goTo("welcome")}
        />
      );
    case "recurrents":
      return (
        <RecurrentsStep
          currency={currency}
          onContinue={(recs) => {
            setRecurrents(recs);
            goTo("objective");
          }}
          onBack={() => goTo("categories")}
        />
      );
    case "objective":
      return (
        <ObjectiveStep
          currency={currency}
          onContinue={(g) => {
            setGoal(g);
            goTo("done");
          }}
          onSkip={() => {
            setGoal(null);
            goTo("done");
          }}
          onBack={() => goTo("recurrents")}
        />
      );
    case "done":
      return (
        <DoneStep
          accountId={accountId!}
          selectedCategories={selectedCategories}
          recurrents={recurrents}
          goal={goal}
          currency={currency}
        />
      );
  }
}
```

### 3.2 `CreateAccountStep`

Extraer el formulario actual de `page.tsx` a un componente step. Es básicamente el código que ya tienes, pero el `onComplete` callback devuelve `(accountId, currency)` en lugar de redirigir.

### 3.3 `WelcomeStep`

Pantalla estática con la info del onboarding (lo que hay en el wireframe paso 0). Solo tiene un botón "Empezar".

### 3.4 `CategoriesStep`

```typescript
// Pseudocódigo de la interfaz del componente

type Props = {
  onContinue: (selectedCategories: DefaultCategory[]) => void;
  onBack: () => void;
};

// Usa DEFAULT_CATEGORIES de @poleursus/shared
// Inicializa las que tienen preselected: true como checked
// El usuario puede toggle cada una
// Al pulsar Continuar, devuelve solo las seleccionadas
```

### 3.5 `RecurrentsStep`

```typescript
type Props = {
  currency: string;
  onContinue: (recurrents: OnboardingRecurrentInput[]) => void;
  onBack: () => void;
};

// Usa SUGGESTED_RECURRENTS de @poleursus/shared
// El usuario selecciona y pone importe
// Mínimo 2 seleccionados para habilitar "Continuar"
// Convierte el importe a minor units (céntimos): 850.00 → 85000
// El botón "Añadir otro gasto o ingreso" puede abrir un mini-form inline
```

### 3.6 `ObjectiveStep`

```typescript
type Props = {
  currency: string;
  onContinue: (goal: OnboardingGoalInput) => void;
  onSkip: () => void;
  onBack: () => void;
};

// Input de cantidad + selector de timeline (3/6/12 meses)
// Preview dinámico: targetAmount / months = mensualidad
// "Continuar" persiste, "Lo haré más tarde" llama onSkip
```

### 3.7 `DoneStep`

```typescript
type Props = {
  accountId: string;
  selectedCategories: DefaultCategory[];
  recurrents: OnboardingRecurrentInput[];
  goal: OnboardingGoalInput | null;
  currency: string;
};

// Al montarse o al pulsar "Ir a Finnon":
// 1. Llama a persistOnboarding (server action que usa la función de shared)
// 2. Si éxito, redirige a / (que a su vez va al Home)
// 3. Si error, muestra mensaje y permite reintentar
//
// Muestra el preview de "tu semana" con los recurrentes creados
// Muestra el CTA de invitar a pareja/compañero
```

### 3.8 Server action para persistir

```typescript
// apps/web/src/app/onboarding/actions.ts

"use server";

import { createClient } from "@/lib/supabase/server";
import { persistOnboarding } from "@poleursus/shared";
import type { OnboardingPayload } from "@poleursus/shared";

export async function persistOnboardingAction(
  payload: OnboardingPayload,
  locale: "es" | "en"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  return persistOnboarding(supabase, payload, user.id, locale);
}
```

---

## 4. Implementación Móvil (React Native / Expo)

### 4.1 Refactor `apps/mobile/app/(auth)/onboarding.tsx`

Misma lógica que web: wizard multi-step con estado en memoria. La diferencia es la UI (React Native views en lugar de HTML).

```typescript
// apps/mobile/app/(auth)/onboarding.tsx

import { useState } from "react";
import { CreateAccountStep } from "./onboarding/CreateAccountStep";
import { WelcomeStep } from "./onboarding/WelcomeStep";
import { CategoriesStep } from "./onboarding/CategoriesStep";
import { RecurrentsStep } from "./onboarding/RecurrentsStep";
import { ObjectiveStep } from "./onboarding/ObjectiveStep";
import { DoneStep } from "./onboarding/DoneStep";
// ... misma estructura de state y switch que web

export default function OnboardingScreen() {
  // Mismo patrón que web, cambiando solo los componentes de UI
}
```

### 4.2 Componentes step móvil

Cada step sigue el mismo contrato de props que en web. La diferencia es:

- `ScrollView` en lugar de `div`
- Componentes de UI nativos (`View`, `Text`, `TouchableOpacity`, `TextInput`)
- Usar los componentes existentes de Finnon (`Card`, `Input`, `Button`)
- `KeyboardAvoidingView` en pasos con inputs

### 4.3 Persistencia en móvil

En móvil se llama directamente a `persistOnboarding` con el cliente Supabase:

```typescript
import { supabase } from "../../src/lib/supabase";
import { persistOnboarding } from "@poleursus/shared";

// En DoneStep:
const result = await persistOnboarding(supabase, payload, user.id, locale);
```

---

## 5. Cambios en el flujo de navegación

### Web (`middleware.ts`)

No requiere cambios. `/onboarding` ya es una ruta permitida sin cuenta activa. El flujo interno del wizard se maneja dentro de la página.

### Móvil (`index.tsx`)

No requiere cambios. `/(auth)/onboarding` ya es accesible. El wizard se maneja internamente.

### Post-onboarding

Actualmente:
- Web: `onboarding` → `createAccountAction` → redirect a `/select-account`
- Móvil: `onboarding` → `setSelectedAccountId` → `router.replace("/")`

Nuevo flujo:
- Web: paso "done" → `persistOnboardingAction` → redirect a `/` (que detecta cuenta activa y va al Home)
- Móvil: paso "done" → `persistOnboarding` → `setSelectedAccountId` → `router.replace("/")`

> **Importante**: En web, asegurar que la cookie de `active-account` se setea después de crear la cuenta (en `CreateAccountStep`), de forma que al llegar a `/` el middleware no redirija a `/select-account`.

---

## 6. Copy / i18n

Añadir las siguientes claves a los archivos de traducción:

```json
{
  "onboarding": {
    "welcome": {
      "title": "Bienvenido a Finnon",
      "subtitle": "Vamos a configurar tu cuenta en 2 minutos para que empieces con todo listo.",
      "step1": "Elige tus categorías",
      "step1Desc": "Te sugerimos unas para empezar",
      "step2": "Añade tus gastos fijos",
      "step2Desc": "Alquiler, suscripciones, nómina...",
      "step3": "Define un objetivo",
      "step3Desc": "Opcional — puedes hacerlo después",
      "timeEstimate": "Menos de 2 minutos",
      "start": "Empezar"
    },
    "categories": {
      "title": "Elige tus categorías",
      "subtitle": "Selecciona las que uses. Podrás añadir más después.",
      "footer": "Puedes crear categorías personalizadas más tarde en Ajustes",
      "continue": "Continuar"
    },
    "recurrents": {
      "title": "¿Cuáles son tus gastos fijos?",
      "subtitle": "Añade al menos 2 para ver tu semana con datos reales.",
      "salary": "Nómina",
      "rent": "Alquiler",
      "netflix": "Netflix",
      "spotify": "Spotify",
      "gym": "Gimnasio",
      "phone": "Teléfono",
      "addCustom": "Añadir otro gasto o ingreso",
      "minimum": "Selecciona al menos 2 para continuar",
      "minimumMet": "seleccionados",
      "continue": "Continuar"
    },
    "objective": {
      "title": "¿Tienes un objetivo de ahorro?",
      "subtitle": "Finnon te ayudará a ver si vas por buen camino.",
      "amountLabel": "Quiero ahorrar",
      "timelineLabel": "En un plazo de",
      "months3": "3 meses",
      "months6": "6 meses",
      "months12": "12 meses",
      "previewTitle": "Tu plan de ahorro",
      "previewText": "Necesitas ahorrar {amount}/mes para llegar a tu objetivo.",
      "continue": "Continuar",
      "skip": "Lo haré más tarde"
    },
    "done": {
      "title": "¡Todo listo!",
      "subtitle": "Tu cuenta está configurada. Así se ve tu semana con los datos que has añadido:",
      "thisWeek": "Esta semana",
      "inviteTitle": "¿Compartes gastos con alguien?",
      "inviteDesc": "Invita a tu pareja o compañero de piso para gestionar la cuenta juntos.",
      "inviteButton": "Invitar",
      "goToApp": "Ir a Finnon"
    }
  }
}
```

Añadir equivalentes en inglés.

---

## 7. Componente de barra de progreso (compartido)

Tanto web como móvil necesitan la barra de progreso de 3 dots (categorías → recurrentes → objetivo). Puede vivir en `@poleursus/shared/ui` como lógica o como componentes separados por plataforma.

```typescript
// Lógica compartida
export type OnboardingProgressStep = "categories" | "recurrents" | "objective";

export function getProgressState(current: OnboardingProgressStep) {
  const steps: OnboardingProgressStep[] = ["categories", "recurrents", "objective"];
  const currentIndex = steps.indexOf(current);
  return steps.map((step, i) => ({
    step,
    state: i < currentIndex ? "completed" : i === currentIndex ? "active" : "pending",
  }));
}
```

---

## 8. Plan de implementación por orden

### Fase 1 — Shared (prerequisito)
1. Expandir `DEFAULT_CATEGORIES` en `categories/defaults.ts`
2. Crear `onboarding/types.ts`, `onboarding/constants.ts`, `onboarding/persist.ts`
3. Exportar desde `index.ts`
4. Verificar que los `icon_id` existen en `category-icons`

### Fase 2 — Web
1. Crear los step components en `apps/web/src/app/onboarding/steps/`
2. Refactorizar `page.tsx` como wizard
3. Añadir server action `persistOnboardingAction`
4. Añadir claves i18n
5. Testear flujo completo

### Fase 3 — Móvil
1. Crear los step components en `apps/mobile/app/(auth)/onboarding/`
2. Refactorizar `onboarding.tsx` como wizard
3. Añadir claves i18n
4. Testear flujo completo

### Fase 4 — Limpieza
1. Eliminar la llamada a `seedDefaultCategories` del onboarding móvil actual (ya no hace falta, las categorías se crean en el paso 2 del wizard)
2. Verificar que `select-account` sigue funcionando para usuarios que ya pasaron el onboarding antiguo

---

## 9. Validaciones y edge cases

- **Usuario cierra la app a mitad del onboarding**: La cuenta ya está creada (paso 1) pero sin categorías/recurrentes. Al volver, el gate (`index.tsx` / `page.tsx`) detecta que tiene cuenta y va al Home. El Home mostrará los empty states existentes. No es ideal pero tampoco rompe nada.
- **Usuario vuelve atrás en el wizard**: El estado en memoria se mantiene. Si vuelve a "categorías" y cambia algo, los cambios se reflejan al avanzar.
- **Errores de red al persistir**: El `DoneStep` debe mostrar un estado de error con botón de reintentar.
- **Usuarios existentes**: No se ven afectados. El onboarding expandido solo se ejecuta para cuentas nuevas.
- **Categorías duplicadas**: `seedDefaultCategories` ya tiene lógica de dedup. La nueva función de persistencia inserta directamente, pero como es una cuenta nueva no debería haber conflictos. Añadir un check por seguridad si se quiere.
