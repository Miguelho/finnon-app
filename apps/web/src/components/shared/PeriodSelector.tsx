"use client";

import { type Period, PERIODS } from "@poleursus/shared";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import styles from "./PeriodSelector.module.css";

interface PeriodSelectorProps {
  selected: Period;
  onChange: (period: Period) => void;
  className?: string;
}

export function PeriodSelector({ selected, onChange, className }: PeriodSelectorProps) {
  const t = useTranslations();
  const periodLabelKey: Record<Period, string> = {
    week: "common.periodWeek",
    month: "common.periodMonth",
    quarter: "common.periodQuarter",
    year: "common.periodYear",
  };

  return (
    <div className={cn(styles.selector, className)}>
      {PERIODS.map(({ key }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(styles.chip, selected === key && styles.chipActive)}
        >
          {t(periodLabelKey[key] as any)}
        </button>
      ))}
    </div>
  );
}
