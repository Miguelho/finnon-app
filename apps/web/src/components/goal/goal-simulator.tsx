"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CategoryIcon } from "@/components/category-icon";
import { useWebUserTheme } from "@/components/theme/web-user-theme-provider";
import {
  computeSimulatorImpact,
  filterSimulatorCandidates,
  getSimulatorCardVariant,
  shouldExpandByDefault,
  formatMoneyWithSymbol,
  themeTokens,
  type UserThemeTokens,
  type MonthStatus,
  type SavingsCandidateTx,
  type CategoryIconKey,
} from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

type SimulatorCopy = {
  title: string;
  subtitle: {
    retrasado: string;
    enRiesgo: string;
    adelantado: string;
  };
  linkText: string;
  impact: {
    empty: string;
    emptyDetail: string;
    daysEarlier: (days: number) => string;
    reachGoal: string;
    remaining: (amount: string) => string;
    savings: (amount: string) => string;
  };
  itemImpact: (days: number) => string;
  noItems: string;
};

type GoalSimulatorProps = {
  monthStatus: MonthStatus;
  candidates: SavingsCandidateTx[];
  baseCurrency: string;
  currencySymbol: string;
  gapToGoalMinor?: bigint | null;
  categoriesById: Record<string, { name: string; icon_id: string | null }>;
  copy: SimulatorCopy;
};

const getCardStyles = (
  variant: "danger" | "warning" | "neutral",
  userTokens: UserThemeTokens
) => {
  switch (variant) {
    case "danger":
      return {
        backgroundColor: userTokens.dangerBackground,
        borderColor: userTokens.dangerBorder,
      };
    case "warning":
      return {
        backgroundColor: userTokens.surfaceAlt,
        borderColor: userTokens.border,
      };
    default:
      return {
        backgroundColor: userTokens.surfaceAlt,
        borderColor: userTokens.border,
      };
  }
};

const getSubtitleColor = (
  variant: "danger" | "warning" | "neutral",
  userTokens: UserThemeTokens
) => {
  switch (variant) {
    case "danger":
      return userTokens.dangerText;
    case "warning":
      return colors.state.warning;
    default:
      return userTokens.textSecondary;
  }
};

export function GoalSimulator({
  monthStatus,
  candidates,
  baseCurrency,
  currencySymbol,
  gapToGoalMinor,
  categoriesById,
  copy,
}: GoalSimulatorProps) {
  const { tokens: userTokens } = useWebUserTheme();
  const variant = getSimulatorCardVariant(monthStatus);
  const defaultExpanded = shouldExpandByDefault(monthStatus);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());

  const simulatorCandidates = useMemo(
    () => filterSimulatorCandidates(candidates),
    [candidates]
  );

  const impact = useMemo(
    () =>
      computeSimulatorImpact({
        candidates: simulatorCandidates,
        disabledIds: Array.from(disabledIds),
        gapToGoalMinor,
      }),
    [simulatorCandidates, disabledIds, gapToGoalMinor]
  );

  const subtitle = useMemo(() => {
    switch (monthStatus) {
      case "retrasado":
        return copy.subtitle.retrasado;
      case "en_riesgo":
        return copy.subtitle.enRiesgo;
      default:
        return copy.subtitle.adelantado;
    }
  }, [monthStatus, copy.subtitle]);

  const toggleItem = (id: string) => {
    setDisabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const cardStyles = getCardStyles(variant, userTokens);
  const subtitleColor = getSubtitleColor(variant, userTokens);
  const hasSelection = impact.disabledCount > 0;
  const formattedSavings = formatMoneyWithSymbol(
    impact.totalSavedMinor,
    baseCurrency,
    currencySymbol
  );
  const formattedRemaining =
    impact.remainingMinor !== undefined
      ? formatMoneyWithSymbol(
          impact.remainingMinor,
          baseCurrency,
          currencySymbol
        )
      : null;
  const impactTitle = hasSelection
    ? impact.reachesGoal
      ? copy.impact.reachGoal
      : formattedRemaining
        ? copy.impact.remaining(formattedRemaining)
        : impact.totalDelayDays > 0
          ? copy.impact.daysEarlier(impact.totalDelayDays)
          : copy.impact.savings(formattedSavings)
    : null;
  const impactSubtitle = hasSelection
    ? copy.impact.savings(formattedSavings)
    : null;
  const impactTitleColor =
    hasSelection && formattedRemaining && !impact.reachesGoal
      ? colors.state.negative
      : colors.state.positive;

  // For "adelantado" state, show only a link until expanded
  if (monthStatus === "adelantado" && !isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.spacing.xs,
          padding: tokens.spacing.md,
          width: "100%",
          border: "none",
          background: "transparent",
          color: userTokens.textSecondary,
          fontSize: tokens.typography.size.sm,
          cursor: "pointer",
          transition: "color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = userTokens.textPrimary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = userTokens.textSecondary;
        }}
      >
        <span>{copy.linkText}</span>
        <ChevronDown size={16} />
      </button>
    );
  }

  if (simulatorCandidates.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: cardStyles.backgroundColor,
        border: `1px solid ${cardStyles.borderColor}`,
        borderRadius: tokens.radii.lg,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: tokens.spacing.md,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <div
            style={{
              fontWeight: tokens.typography.weight.semibold,
              fontSize: tokens.typography.size.md,
              color: userTokens.textPrimary,
            }}
          >
            {copy.title}
          </div>
          <div
            style={{
              fontSize: tokens.typography.size.sm,
              color: subtitleColor,
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: userTokens.surface,
            borderRadius: tokens.radii.md,
            transition: "transform 0.3s ease",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <ChevronDown size={16} color={userTokens.textSecondary} />
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div style={{ padding: `0 ${tokens.spacing.md} ${tokens.spacing.md}` }}>
          {/* Impact Preview */}
          <div
            style={{
              backgroundColor: userTokens.surface,
              borderRadius: tokens.radii.md,
              padding: tokens.spacing.md,
              marginBottom: tokens.spacing.md,
              textAlign: "center",
            }}
          >
            {hasSelection ? (
              <>
                <div
                  style={{
                    fontSize: tokens.typography.size.xl,
                    fontWeight: tokens.typography.weight.bold,
                    color: impactTitleColor,
                  }}
                >
                  {impactTitle}
                </div>
                {impactSubtitle && (
                  <div
                    style={{
                      fontSize: tokens.typography.size.sm,
                      color: userTokens.textSecondary,
                      marginTop: tokens.spacing.xs,
                    }}
                  >
                    {impactSubtitle}
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: tokens.typography.size.sm,
                    color: userTokens.textSecondary,
                  }}
                >
                  {copy.impact.empty}
                </div>
                <div
                  style={{
                    fontSize: tokens.typography.size.xs,
                    color: userTokens.textTertiary,
                    marginTop: tokens.spacing.xs,
                  }}
                >
                  {copy.impact.emptyDetail}
                </div>
              </>
            )}
          </div>

          {/* Candidates List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.spacing.sm,
            }}
          >
            {simulatorCandidates.map((tx) => {
              const isDisabled = disabledIds.has(tx.id);
              const category = tx.categoryId
                ? categoriesById[tx.categoryId]
                : null;
              const displayName =
                tx.merchant || category?.name || tx.merchantNorm || "Expense";
              const iconKey = category?.icon_id as CategoryIconKey | undefined;

              return (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                    backgroundColor: userTokens.surface,
                    border: `1px solid ${userTokens.border}`,
                    borderRadius: tokens.radii.md,
                    opacity: isDisabled ? 0.5 : 1,
                    transition: "opacity 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: tokens.spacing.sm,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: userTokens.surfaceAlt,
                        borderRadius: tokens.radii.md,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {iconKey ? (
                        <CategoryIcon iconKey={iconKey} size={20} tone="muted" />
                      ) : (
                        <span
                          style={{
                            fontSize: tokens.typography.size.sm,
                            color: userTokens.textSecondary,
                          }}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: tokens.typography.weight.medium,
                          fontSize: tokens.typography.size.sm,
                          color: userTokens.textPrimary,
                        }}
                      >
                        {displayName}
                      </div>
                      <div
                        style={{
                          fontSize: tokens.typography.size.xs,
                          color: userTokens.textSecondary,
                        }}
                      >
                        {formatMoneyWithSymbol(
                          tx.amountBaseMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                        /mes
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: tokens.spacing.sm,
                    }}
                  >
                    {tx.delayDays != null && tx.delayDays > 0 && (
                      <div
                        style={{
                          fontSize: tokens.typography.size.xs,
                          color: colors.state.positive,
                          textAlign: "right",
                        }}
                      >
                        {copy.itemImpact(tx.delayDays)}
                      </div>
                    )}
                    <Switch
                      checked={!isDisabled}
                      onCheckedChange={() => toggleItem(tx.id)}
                      aria-label={`Toggle ${displayName}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
