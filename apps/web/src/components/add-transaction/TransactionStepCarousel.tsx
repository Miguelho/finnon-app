"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TransactionStepCarouselProps {
  currentStep: number;
  steps: React.ReactNode[];
  className?: string;
}

export function TransactionStepCarousel({
  currentStep,
  steps,
  className,
}: TransactionStepCarouselProps) {
  const stepRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    const activeStepEl = stepRefs.current[currentStep - 1];
    if (activeStepEl) {
      activeStepEl.scrollTop = 0;
    }
  }, [currentStep]);

  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(-${(currentStep - 1) * 100}%)`,
        }}
      >
        {steps.map((step, index) => (
          <div
            key={index}
            ref={(el) => {
              stepRefs.current[index] = el;
            }}
            className="w-full flex-shrink-0 overflow-y-auto px-1"
            aria-hidden={currentStep !== index + 1}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
