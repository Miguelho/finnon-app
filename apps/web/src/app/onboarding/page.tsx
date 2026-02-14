"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { InvitationsClient } from "@/components/invitations/invitations-client";
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
  | "welcome"
  | "invitations"
  | "categories"
  | "recurrents"
  | "objective"
  | "create-account"
  | "done";

export default function OnboardingPage() {
  const tGlobal = useTranslations();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string>("");
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

  let content: ReactNode = null;
  const isOnboardingStep = (value: string): value is OnboardingStep =>
    [
      "welcome",
      "invitations",
      "categories",
      "recurrents",
      "objective",
      "create-account",
      "done",
    ].includes(value);

  useEffect(() => {
    const stored = sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as OnboardingPersistedState;
        if (parsed.accountId !== undefined) setAccountId(parsed.accountId);
        if (parsed.accountName) setAccountName(parsed.accountName);
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
      accountName,
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
    accountName,
    currency,
    selectedCategories,
    recurrentsState,
    objectiveDraft,
    recurrents,
    goal,
  ]);

  switch (currentStep) {
    case "welcome":
      content = (
        <WelcomeStep
          onContinue={() => goTo("create-account")}
          onInvite={() => goTo("invitations")}
          showInvite={!accountId}
        />
      );
      break;
    case "invitations":
      content = (
        <InvitationsClient onBack={() => goTo("welcome")} />
      );
      break;
    case "create-account":
      content = (
        <CreateAccountStep
          initialAccountName={accountName}
          initialCurrency={currency}
          onContinue={(name, curr) => {
            setAccountName(name);
            setCurrency(curr);
            goTo("categories");
          }}
          onBack={() => goTo("welcome")}
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
      content = accountId || accountName.trim() ? (
        <DoneStep
          accountId={accountId}
          accountName={accountName}
          selectedCategories={selectedCategories}
          recurrents={recurrents}
          goal={goal}
          currency={currency}
          onAccountResolved={setAccountId}
        />
      ) : (
        <CreateAccountStep
          initialAccountName={accountName}
          initialCurrency={currency}
          onContinue={(name, curr) => {
            setAccountName(name);
            setCurrency(curr);
            goTo("done");
          }}
          onBack={() => goTo("objective")}
        />
      );
      break;
    default:
      content = null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-2xl">{content}</div>
    </div>
  );
}
