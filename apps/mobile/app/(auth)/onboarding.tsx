import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  DefaultCategory,
  OnboardingGoalInput,
  OnboardingRecurrentInput,
} from "@poleursus/shared";
import { DEFAULT_CATEGORIES } from "@poleursus/shared";
import { useCopy, t } from "../../src/lib/i18n";
import { CreateAccountStep } from "./onboarding/CreateAccountStep";
import { WelcomeStep } from "./onboarding/WelcomeStep";
import { CategoriesStep } from "./onboarding/CategoriesStep";
import { RecurrentsStep } from "./onboarding/RecurrentsStep";
import { ObjectiveStep } from "./onboarding/ObjectiveStep";
import { DoneStep } from "./onboarding/DoneStep";
import {
  createInitialRecurrentsState,
  ONBOARDING_STORAGE_KEY,
  type OnboardingPersistedState,
  type RecurrentsStepState,
} from "./onboarding/state";

type OnboardingStep =
  | "create-account"
  | "welcome"
  | "categories"
  | "recurrents"
  | "objective"
  | "done";

export default function OnboardingScreen() {
  const { dictionary } = useCopy();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("EUR");
  const [selectedCategories, setSelectedCategories] = useState<DefaultCategory[]>(() =>
    DEFAULT_CATEGORIES.filter((category) => category.preselected)
  );
  const [recurrentsState, setRecurrentsState] = useState<RecurrentsStepState>(() =>
    createInitialRecurrentsState((key) => t(dictionary, key))
  );
  const [objectiveDraft, setObjectiveDraft] = useState<{
    amount: string;
    months: 3 | 6 | 12;
  }>({ amount: "", months: 3 });
  const [recurrents, setRecurrents] = useState<OnboardingRecurrentInput[]>([]);
  const [goal, setGoal] = useState<OnboardingGoalInput | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  const goTo = (step: OnboardingStep) => setCurrentStep(step);

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
    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (!stored) {
          setHasHydrated(true);
          return;
        }
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
        console.warn("[Onboarding] Failed to restore draft:", error);
      } finally {
        setHasHydrated(true);
      }
    };
    loadState();
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
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(payload)).catch(
      (error) => {
        console.warn("[Onboarding] Failed to persist draft:", error);
      }
    );
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
      return (
        <CreateAccountStep
          onComplete={(id, curr) => {
            setAccountId(id);
            setCurrency(curr);
            goTo("categories");
          }}
        />
      );
    case "welcome":
      return (
        <WelcomeStep
          onContinue={() => (accountId ? goTo("categories") : goTo("create-account"))}
          showInvite={!accountId}
        />
      );
    case "categories":
      return (
        <CategoriesStep
          selectedCategories={selectedCategories}
          onChangeSelectedCategories={setSelectedCategories}
          onContinue={() => goTo("recurrents")}
          onBack={() => goTo("welcome")}
        />
      );
    case "recurrents":
      return (
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
    case "objective":
      return (
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
    case "done":
      return (
        <DoneStep
          accountId={accountId ?? ""}
          selectedCategories={selectedCategories}
          recurrents={recurrents}
          goal={goal}
          currency={currency}
        />
      );
    default:
      return null;
  }
}
