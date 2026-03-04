import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  DefaultCategory,
  OnboardingFirstProjectInput,
  OnboardingRecurrentInput,
} from "@poleursus/shared";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PROJECT_EMOJI,
  PROJECT_PALETTE,
} from "@poleursus/shared";
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
  | "welcome"
  | "categories"
  | "recurrents"
  | "project"
  | "create-account"
  | "done";

export default function OnboardingScreen() {
  const { dictionary } = useCopy();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [selectedCategories, setSelectedCategories] = useState<DefaultCategory[]>(() =>
    DEFAULT_CATEGORIES.filter((category) => category.preselected)
  );
  const [recurrentsState, setRecurrentsState] = useState<RecurrentsStepState>(() =>
    createInitialRecurrentsState((key) => t(dictionary, key as never))
  );
  const [projectDraft, setProjectDraft] = useState<{
    name: string;
    emoji: string;
    color: string;
    targetAmount: string;
    monthlyCommitment: string;
  }>({
    name: "",
    emoji: DEFAULT_PROJECT_EMOJI,
    color: PROJECT_PALETTE[0],
    targetAmount: "25000",
    monthlyCommitment: "",
  });
  const [recurrents, setRecurrents] = useState<OnboardingRecurrentInput[]>([]);
  const [firstProject, setFirstProject] = useState<OnboardingFirstProjectInput | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  const goTo = (step: OnboardingStep) => setCurrentStep(step);

  const isOnboardingStep = (value: string): value is OnboardingStep =>
    [
      "welcome",
      "categories",
      "recurrents",
      "project",
      "create-account",
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
        if (parsed.accountName) setAccountName(parsed.accountName);
        if (parsed.currency) setCurrency(parsed.currency);
        if (Array.isArray(parsed.selectedCategories)) {
          setSelectedCategories(parsed.selectedCategories);
        }
        if (parsed.recurrentsState) setRecurrentsState(parsed.recurrentsState);
        if (parsed.projectDraft) {
          setProjectDraft((prev) => ({ ...prev, ...parsed.projectDraft }));
        } else if ((parsed as any).objectiveDraft) {
          const legacy = (parsed as any).objectiveDraft;
          setProjectDraft((prev) => ({
            ...prev,
            targetAmount: legacy.amount ?? prev.targetAmount,
          }));
        }
        if (Array.isArray(parsed.recurrents)) setRecurrents(parsed.recurrents);
        if (parsed.firstProject !== undefined) {
          setFirstProject(parsed.firstProject ?? null);
        } else if ((parsed as any).goal !== undefined) {
          setFirstProject(null);
        }
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
      accountName,
      currency,
      selectedCategories,
      recurrentsState,
      projectDraft,
      recurrents,
      firstProject,
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
    accountName,
    currency,
    selectedCategories,
    recurrentsState,
    projectDraft,
    recurrents,
    firstProject,
  ]);

  switch (currentStep) {
    case "welcome":
      return (
        <WelcomeStep
          onContinue={() => goTo("create-account")}
          showInvite={!accountId}
        />
      );
    case "create-account":
      return (
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
            goTo("project");
          }}
          onBack={() => goTo("categories")}
        />
      );
    case "project":
      return (
        <ObjectiveStep
          currency={currency}
          name={projectDraft.name}
          emoji={projectDraft.emoji}
          color={projectDraft.color}
          targetAmount={projectDraft.targetAmount}
          monthlyCommitment={projectDraft.monthlyCommitment}
          onNameChange={(value) =>
            setProjectDraft((prev) => ({ ...prev, name: value }))
          }
          onEmojiChange={(value) =>
            setProjectDraft((prev) => ({ ...prev, emoji: value }))
          }
          onColorChange={(value) =>
            setProjectDraft((prev) => ({ ...prev, color: value }))
          }
          onTargetAmountChange={(value) =>
            setProjectDraft((prev) => ({ ...prev, targetAmount: value }))
          }
          onMonthlyCommitmentChange={(value) =>
            setProjectDraft((prev) => ({ ...prev, monthlyCommitment: value }))
          }
          onContinue={(project) => {
            setFirstProject(project);
            goTo("done");
          }}
          onSkip={() => {
            setFirstProject(null);
            goTo("done");
          }}
          onBack={() => goTo("recurrents")}
        />
      );
    case "done":
      return accountId || accountName.trim() ? (
        <DoneStep
          accountId={accountId}
          accountName={accountName}
          selectedCategories={selectedCategories}
          recurrents={recurrents}
          firstProject={firstProject}
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
          onBack={() => goTo("project")}
        />
      );
    default:
      return null;
  }
}
