import {
  SUGGESTED_RECURRENTS,
  type DefaultCategory,
  type OnboardingFirstProjectInput,
  type OnboardingRecurrentInput,
  type RecurringFrequency,
} from "@poleursus/shared";

export type RecurrentDraft = {
  id: string;
  label: string;
  amount: string;
  expectedDate?: string;
  selected: boolean;
  type: "income" | "expense";
  suggestedCategoryName: string;
  frequency: RecurringFrequency;
  interval: number;
  icon: string;
};

export type RecurrentsStepState = {
  items: RecurrentDraft[];
  customEnabled: boolean;
  customLabel: string;
  customAmount: string;
  customExpectedDate?: string;
  customType: "income" | "expense";
};

export type TranslateFn = (key: string) => string;

export const ONBOARDING_STORAGE_KEY = "@finnon/onboardingDraft";

export type OnboardingPersistedState = {
  currentStep: string;
  accountId: string | null;
  accountName: string;
  currency: string;
  selectedCategories: DefaultCategory[];
  recurrentsState: RecurrentsStepState;
  projectDraft: {
    name: string;
    emoji: string;
    targetAmount: string;
    monthlyCommitment: string;
  };
  recurrents: OnboardingRecurrentInput[];
  firstProject: OnboardingFirstProjectInput | null;
};

export const createInitialRecurrentsState = (
  translate: TranslateFn
): RecurrentsStepState => {
  const today = new Date().toISOString().slice(0, 10);

  return {
    items: SUGGESTED_RECURRENTS.map((item) => ({
      id: item.id,
      label: translate(item.labelKey),
      amount: item.placeholderAmount,
      expectedDate: today,
      selected: false,
      type: item.type,
      suggestedCategoryName: item.suggestedCategoryName,
      frequency: item.frequency,
      interval: item.interval,
      icon: item.icon,
    })),
    customEnabled: false,
    customLabel: "",
    customAmount: "",
    customExpectedDate: today,
    customType: "expense",
  };
};
