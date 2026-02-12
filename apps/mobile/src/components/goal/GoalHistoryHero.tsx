import { View, Text, StyleSheet } from "react-native";
import type { ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react-native";
import {
  formatMoneyWithSymbol,
  withAlpha,
  themeTokens,
  type GoalHistoryView,
} from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

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
  const { tokens: userTokens } = useUserTheme();
  const isCompleted = view.completed;
  const completionDayPart = view.completedAt?.split("-")[2];
  const completionDay = completionDayPart ? parseInt(completionDayPart, 10) : null;

  const statusColor = isCompleted ? colors.state.positive : colors.state.negative;
  const statusBgColor = isCompleted
    ? withAlpha(colors.state.positive, 0.15)
    : withAlpha(colors.state.negative, 0.15);
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

  const progressWidth = Math.min(
    Math.round((Number(view.finalSavedMinor) / Number(view.targetMinor)) * 100),
    100
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: userTokens.surface, borderColor: userTokens.border },
      ]}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <View>{monthNavigator ?? null}</View>
        <View style={[styles.badge, { backgroundColor: statusBgColor }]}>
          {isCompleted ? (
            <CheckCircle2 size={16} color={statusColor} />
          ) : (
            <XCircle size={16} color={statusColor} />
          )}
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Main amount - centered */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amountLabel, { color: userTokens.textSecondary }]}>
          {copy.finalAmount}
        </Text>
        <Text style={[styles.amountValue, { color: statusColor }]}>
          {formattedFinal}
        </Text>
        <Text style={[styles.targetText, { color: userTokens.textSecondary }]}>
          {copy.targetWas.replace("{amount}", formattedTarget)}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBarContainer, { backgroundColor: userTokens.border }]}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progressWidth}%`,
              backgroundColor: statusColor,
            },
          ]}
        />
      </View>

      {/* Detail text */}
      <Text style={[styles.detailText, { color: userTokens.textSecondary }]}>
        {getDetailText()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    gap: 16,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  amountContainer: {
    alignItems: "center",
    gap: 4,
  },
  amountLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  amountValue: {
    fontSize: 40,
    fontWeight: "700",
    lineHeight: 44,
  },
  targetText: {
    fontSize: 14,
  },
  progressBarContainer: {
    height: 8,
    width: "100%",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  detailText: {
    fontSize: 14,
    textAlign: "center",
  },
});
