"use client";

import type { ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  formatMoneyWithSymbol,
  themeTokens,
  type GoalHistoryView,
} from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

type GoalHistoryHeroCopy = {
  completedLabel: string;
  failedLabel: string;
  completedOnDay: string;
  completedOnDayDelta: string;
  completedOnDayDeltaLate: string;
  missedBy: string;
  finalAmount: string;
  targetWas: string;
  exceededBy: string;
};

type GoalHistoryHeroProps = {
  view: GoalHistoryView;
  baseCurrency: string;
  currencySymbol: string;
  copy: GoalHistoryHeroCopy;
  monthNavigator?: ReactNode;
};

export function GoalHistoryHero({
  view,
  baseCurrency,
  currencySymbol,
  copy,
  monthNavigator,
}: GoalHistoryHeroProps) {
  const isCompleted = view.completed;
  const completionDay = view.completedAt
    ? parseInt(view.completedAt.split("-")[2], 10)
    : null;

  const statusColor = isCompleted ? colors.state.positive : colors.state.negative;
  const statusBgColor = isCompleted
    ? `${colors.state.positive}15`
    : `${colors.state.negative}15`;
  const statusLabel = isCompleted ? copy.completedLabel : copy.failedLabel;

  const formattedFinal = formatMoneyWithSymbol(
    view.finalSavedMinor,
    baseCurrency,
    currencySymbol
  );
  const formattedTarget = formatMoneyWithSymbol(
    view.targetMinor,
    baseCurrency,
    currencySymbol
  );

  const getDetailText = () => {
    if (isCompleted && completionDay !== null) {
      if (view.completionDayDelta === null) {
        return copy.completedOnDay.replace("{day}", String(completionDay));
      }
      if (view.completionDayDelta > 0) {
        return copy.completedOnDayDelta
          .replace("{day}", String(completionDay))
          .replace("{delta}", String(view.completionDayDelta));
      }
      if (view.completionDayDelta < 0) {
        return copy.completedOnDayDeltaLate
          .replace("{day}", String(completionDay))
          .replace("{delta}", String(Math.abs(view.completionDayDelta)));
      }
      return copy.completedOnDay.replace("{day}", String(completionDay));
    }

    // Not completed - show how much was missing
    const missingAmount = -view.difference;
    const formattedMissing = formatMoneyWithSymbol(
      missingAmount,
      baseCurrency,
      currencySymbol
    );
    return copy.missedBy.replace("{amount}", formattedMissing);
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center">{monthNavigator ?? null}</div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: tokens.spacing.xs,
              padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
              borderRadius: tokens.radii.full,
              backgroundColor: statusBgColor,
              color: statusColor,
              fontSize: tokens.typography.size.sm,
              fontWeight: tokens.typography.weight.medium,
            }}
          >
            {isCompleted ? (
              <CheckCircle2 size={16} />
            ) : (
              <XCircle size={16} />
            )}
            <span>{statusLabel}</span>
          </div>
        </div>

        {/* Main amount - centered */}
        <div className="text-center space-y-1">
          <div
            style={{
              fontSize: tokens.typography.size.xs,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: colors.text.secondary,
              fontWeight: tokens.typography.weight.medium,
            }}
          >
            {copy.finalAmount}
          </div>
          <h2
            style={{
              fontSize: "2.5rem",
              fontWeight: tokens.typography.weight.bold,
              color: statusColor,
              lineHeight: 1.1,
            }}
          >
            {formattedFinal}
          </h2>
          <p
            className="text-sm"
            style={{ color: colors.text.secondary }}
          >
            {copy.targetWas.replace("{amount}", formattedTarget)}
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="h-2 w-full rounded-full"
          style={{ backgroundColor: colors.state.neutral }}
          aria-hidden
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(Math.round((Number(view.finalSavedMinor) / Number(view.targetMinor)) * 100), 100)}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>

        {/* Detail text */}
        <div className="text-center">
          <p
            style={{
              fontSize: tokens.typography.size.sm,
              color: colors.text.secondary,
            }}
          >
            {getDetailText()}
          </p>
        </div>
      </CardHeader>
    </Card>
  );
}
