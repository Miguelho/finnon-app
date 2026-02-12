import type { DefaultCategory } from "../categories/defaults";
import type { RecurringFrequency } from "../recurring/recurring";

/** Categoría seleccionada durante el onboarding */
export type OnboardingCategorySelection = {
  category: DefaultCategory;
  selected: boolean;
};

/** Recurrente sugerido en el onboarding */
export type OnboardingSuggestedRecurrent = {
  id: string;
  labelKey: string;
  label_es: string;
  label_en: string;
  type: "income" | "expense";
  suggestedCategoryName: string;
  placeholderAmount: string;
  frequency: RecurringFrequency;
  interval: number;
  icon: string;
};

/** Datos que el usuario rellena para un recurrente en el onboarding */
export type OnboardingRecurrentInput = {
  suggestedId: string;
  label: string;
  type: "income" | "expense";
  amountMinor: number;
  currency: string;
  categoryName: string;
  expectedDate?: string;
  frequency: RecurringFrequency;
  interval: number;
  dayOfMonth: number;
};

/** Datos del objetivo del onboarding */
export type OnboardingGoalInput = {
  targetAmountMinor: number;
  months: 3 | 6 | 12;
};

/** Payload completo del onboarding para persistir */
export type OnboardingPayload = {
  accountId: string;
  selectedCategories: DefaultCategory[];
  recurrents: OnboardingRecurrentInput[];
  goal: OnboardingGoalInput | null;
};
