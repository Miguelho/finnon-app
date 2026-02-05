"use client";

import { TrendingUp, Target, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatMoneyWithSymbol,
  themeTokens,
  type GoalGamification,
  type CurrentMonthComparison,
} from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

type GoalGamificationCopy = {
  gamificationTitle: string;
  streakLabel: string;
  streak: (months: number) => string;
  historyLabel: string;
  history: (completed: number, total: number) => string;
  comparisonTitle: string;
  comparisonSaved: string;
  comparisonVelocity: string;
  savedPositive: (amount: string) => string;
  savedNegative: (amount: string) => string;
  velocityPositive: (days: number) => string;
  velocityNegative: (days: number) => string;
};

type GoalGamificationProps = {
  gamification: GoalGamification;
  comparison: CurrentMonthComparison | null;
  baseCurrency: string;
  currencySymbol: string;
  copy: GoalGamificationCopy;
};

export function GoalGamificationSection({
  gamification,
  comparison,
  baseCurrency,
  currencySymbol,
  copy,
}: GoalGamificationProps) {
  const hasComparison = comparison !== null && gamification.totalGoals > 0;

  const formatSavedVsAvg = () => {
    if (!comparison) return null;
    const isPositive = comparison.savedVsAvg >= 0n;
    const absAmount = isPositive ? comparison.savedVsAvg : -comparison.savedVsAvg;
    const formatted = formatMoneyWithSymbol(absAmount, baseCurrency, currencySymbol);
    
    return {
      text: isPositive ? copy.savedPositive(formatted) : copy.savedNegative(formatted),
      color: isPositive ? colors.state.positive : colors.state.negative,
    };
  };

  const formatVelocityVsAvg = () => {
    if (!comparison || comparison.velocityVsAvg === null) return null;
    const days = comparison.velocityVsAvg;
    const isPositive = days > 0;
    return {
      text: isPositive ? copy.velocityPositive(Math.abs(days)) : copy.velocityNegative(Math.abs(days)),
      color: isPositive ? colors.state.positive : colors.state.negative,
    };
  };

  const savedVsAvg = formatSavedVsAvg();
  const velocityVsAvg = formatVelocityVsAvg();

  return (
    <div className="space-y-4">
      <h3
        style={{
          fontSize: tokens.typography.size.lg,
          fontWeight: tokens.typography.weight.semibold,
          color: colors.text.primary,
        }}
      >
        {copy.gamificationTitle}
      </h3>

      {/* Main gamification cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Streak Card */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: tokens.radii.md,
                  backgroundColor: `${colors.state.positive}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TrendingUp size={16} style={{ color: colors.state.positive }} />
              </div>
              <span
                style={{
                  fontSize: tokens.typography.size.sm,
                  color: colors.text.secondary,
                }}
              >
                {copy.streakLabel}
              </span>
            </div>
            <div
              style={{
                fontSize: tokens.typography.size.xl,
                fontWeight: tokens.typography.weight.bold,
                color: colors.text.primary,
              }}
            >
              {copy.streak(gamification.currentStreak)}
            </div>
          </CardContent>
        </Card>

        {/* History Card */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: tokens.radii.md,
                  backgroundColor: `${colors.state.positive}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Target size={16} style={{ color: colors.state.positive }} />
              </div>
              <span
                style={{
                  fontSize: tokens.typography.size.sm,
                  color: colors.text.secondary,
                }}
              >
                {copy.historyLabel}
              </span>
            </div>
            <div
              style={{
                fontSize: tokens.typography.size.xl,
                fontWeight: tokens.typography.weight.bold,
                color: colors.text.primary,
              }}
            >
              {copy.history(gamification.totalCompleted, gamification.totalGoals)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Card - Only show if there's history */}
      {hasComparison && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: tokens.radii.md,
                  backgroundColor: `${colors.text.secondary}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Activity size={16} style={{ color: colors.text.secondary }} />
              </div>
              <span
                style={{
                  fontSize: tokens.typography.size.sm,
                  fontWeight: tokens.typography.weight.medium,
                  color: colors.text.primary,
                }}
              >
                {copy.comparisonTitle}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Savings comparison */}
              {savedVsAvg && (
                <div>
                  <div
                    style={{
                      fontSize: tokens.typography.size.xs,
                      color: colors.text.secondary,
                      marginBottom: 4,
                    }}
                  >
                    {copy.comparisonSaved}
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.size.lg,
                      fontWeight: tokens.typography.weight.semibold,
                      color: savedVsAvg.color,
                    }}
                  >
                    {savedVsAvg.text}
                  </div>
                </div>
              )}

              {/* Velocity comparison */}
              {velocityVsAvg && (
                <div>
                  <div
                    style={{
                      fontSize: tokens.typography.size.xs,
                      color: colors.text.secondary,
                      marginBottom: 4,
                    }}
                  >
                    {copy.comparisonVelocity}
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.size.lg,
                      fontWeight: tokens.typography.weight.semibold,
                      color: velocityVsAvg.color,
                    }}
                  >
                    {velocityVsAvg.text}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
