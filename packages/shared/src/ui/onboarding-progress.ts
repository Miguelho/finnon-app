export type OnboardingProgressStep = "categories" | "recurrents" | "project";

export type OnboardingProgressState = {
  step: OnboardingProgressStep;
  state: "completed" | "active" | "pending";
};

export function getProgressState(
  current: OnboardingProgressStep
): OnboardingProgressState[] {
  const steps: OnboardingProgressStep[] = [
    "categories",
    "recurrents",
    "project",
  ];
  const currentIndex = steps.indexOf(current);

  return steps.map((step, index) => ({
    step,
    state: index < currentIndex ? "completed" : index === currentIndex ? "active" : "pending",
  }));
}
