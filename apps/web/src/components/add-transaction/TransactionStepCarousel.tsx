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
  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        className="flex transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(-${(currentStep - 1) * 100}%)`,
        }}
      >
        {steps.map((step, index) => (
          <div
            key={index}
            className="w-full flex-shrink-0 px-1"
            aria-hidden={currentStep !== index + 1}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
