"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { CreateAccountStep } from "./steps/CreateAccountStep";
import { WelcomeStep } from "./steps/WelcomeStep";
import { CategoriesStep } from "./steps/CategoriesStep";
import { RecurrentsStep } from "./steps/RecurrentsStep";
import { ObjectiveStep } from "./steps/ObjectiveStep";
import { DoneStep } from "./steps/DoneStep";
import type {
  DefaultCategory,
  OnboardingGoalInput,
  OnboardingRecurrentInput,
} from "@poleursus/shared";
import { DEFAULT_CATEGORIES } from "@poleursus/shared";
import {
  createInitialRecurrentsState,
  ONBOARDING_STORAGE_KEY,
  type OnboardingPersistedState,
  type RecurrentsStepState,
} from "./state";

type OnboardingStep =
  | "create-account"
  | "welcome"
  | "categories"
  | "recurrents"
  | "objective"
  | "done";

export default function OnboardingPage() {
  const tGlobal = useTranslations();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("EUR");
  const [selectedCategories, setSelectedCategories] = useState<DefaultCategory[]>(
    () => DEFAULT_CATEGORIES.filter((category) => category.preselected)
  );
  const [recurrentsState, setRecurrentsState] = useState<RecurrentsStepState>(() =>
    createInitialRecurrentsState(tGlobal)
  );
  const [objectiveDraft, setObjectiveDraft] = useState<{
    amount: string;
    months: 3 | 6 | 12;
  }>({ amount: "", months: 3 });
  const [recurrents, setRecurrents] = useState<OnboardingRecurrentInput[]>([]);
  const [goal, setGoal] = useState<OnboardingGoalInput | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  const goTo = (step: OnboardingStep) => setCurrentStep(step);

  const handleAccountCreated = (id: string, curr: string) => {
    setAccountId(id);
    setCurrency(curr);
    goTo("categories");
  };

  let content: ReactNode = null;
  const isOnboardingStep = (value: string): value is OnboardingStep =>
    [
      "create-account",
      "welcome",
      "categories",
      "recurrents",
      "objective",
      "done",
    ].includes(value);

  useEffect(() => {
    const stored = sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as OnboardingPersistedState;
        if (parsed.accountId !== undefined) setAccountId(parsed.accountId);
        if (parsed.currency) setCurrency(parsed.currency);
        if (Array.isArray(parsed.selectedCategories)) {
          setSelectedCategories(parsed.selectedCategories);
        }
        if (parsed.recurrentsState) setRecurrentsState(parsed.recurrentsState);
        if (parsed.objectiveDraft) setObjectiveDraft(parsed.objectiveDraft);
        if (Array.isArray(parsed.recurrents)) setRecurrents(parsed.recurrents);
        if (parsed.goal !== undefined) setGoal(parsed.goal ?? null);
        if (parsed.currentStep && isOnboardingStep(parsed.currentStep)) {
          setCurrentStep(parsed.currentStep);
        }
      } catch (error) {
        console.warn("Failed to restore onboarding draft:", error);
      }
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    const payload: OnboardingPersistedState = {
      currentStep,
      accountId,
      currency,
      selectedCategories,
      recurrentsState,
      objectiveDraft,
      recurrents,
      goal,
    };
    sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(payload));
  }, [
    hasHydrated,
    currentStep,
    accountId,
    currency,
    selectedCategories,
    recurrentsState,
    objectiveDraft,
    recurrents,
    goal,
  ]);

  switch (currentStep) {
    case "create-account":
      content = <CreateAccountStep onComplete={handleAccountCreated} />;
      break;
    case "welcome":
      content = (
        <WelcomeStep
          onContinue={() =>
            accountId ? goTo("categories") : goTo("create-account")
          }
          showInvite={!accountId}
        />
      );
      break;
    case "categories":
      content = (
        <CategoriesStep
          selectedCategories={selectedCategories}
          onChangeSelectedCategories={setSelectedCategories}
          onContinue={() => goTo("recurrents")}
          onBack={() => goTo("welcome")}
        />
      );
      break;
    case "recurrents":
      content = (
        <RecurrentsStep
          currency={currency}
          state={recurrentsState}
          onChangeState={setRecurrentsState}
          onContinue={(recs) => {
            setRecurrents(recs);
            goTo("objective");
          }}
          onBack={() => goTo("categories")}
        />
      );
      break;
    case "objective":
      content = (
        <ObjectiveStep
          currency={currency}
          amount={objectiveDraft.amount}
          months={objectiveDraft.months}
          onAmountChange={(value) =>
            setObjectiveDraft((prev) => ({ ...prev, amount: value }))
          }
          onMonthsChange={(value) =>
            setObjectiveDraft((prev) => ({ ...prev, months: value }))
          }
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
      break;
    case "done":
      content = (
        <DoneStep
          accountId={accountId ?? ""}
          selectedCategories={selectedCategories}
          recurrents={recurrents}
          goal={goal}
          currency={currency}
        />
      );
      break;
    default:
      content = null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f0f0] p-4">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-2xl">{content}</div>
    </div>
  );
}
