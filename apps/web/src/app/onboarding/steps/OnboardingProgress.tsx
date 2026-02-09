"use client";

import { cn } from "@/lib/utils";
import {
  getProgressState,
  type OnboardingProgressStep,
} from "@poleursus/shared";

type OnboardingProgressProps = {
  current: OnboardingProgressStep;
};

export function OnboardingProgress({ current }: OnboardingProgressProps) {
  const steps = getProgressState(current);

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step) => (
        <span
          key={step.step}
          className={cn(
            "h-1 w-10 rounded-full bg-[#e5e7eb]",
            step.state === "completed" && "bg-[#16a34a]",
            step.state === "active" && "bg-[#1a1f36]"
          )}
        />
      ))}
    </div>
  );
}
