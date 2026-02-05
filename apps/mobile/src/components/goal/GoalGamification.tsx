import { View, Text, StyleSheet } from "react-native";
import { TrendingUp, Target, Activity } from "lucide-react-native";
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
      text: isPositive
        ? copy.savedPositive(formatted)
        : copy.savedNegative(formatted),
      color: isPositive ? colors.state.positive : colors.state.negative,
    };
  };

  const formatVelocityVsAvg = () => {
    if (!comparison || comparison.velocityVsAvg === null) return null;
    const days = comparison.velocityVsAvg;
    const isPositive = days > 0;
    return {
      text: isPositive
        ? copy.velocityPositive(Math.abs(days))
        : copy.velocityNegative(Math.abs(days)),
      color: isPositive ? colors.state.positive : colors.state.negative,
    };
  };

  const savedVsAvg = formatSavedVsAvg();
  const velocityVsAvg = formatVelocityVsAvg();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{copy.gamificationTitle}</Text>

      {/* Main gamification cards */}
      <View style={styles.grid}>
        {/* Streak Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${colors.state.positive}15` },
              ]}
            >
              <TrendingUp size={16} color={colors.state.positive} />
            </View>
            <Text style={styles.cardLabel}>{copy.streakLabel}</Text>
          </View>
          <Text style={styles.cardValue}>
            {copy.streak(gamification.currentStreak)}
          </Text>
        </View>

        {/* History Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${colors.state.positive}15` },
              ]}
            >
              <Target size={16} color={colors.state.positive} />
            </View>
            <Text style={styles.cardLabel}>{copy.historyLabel}</Text>
          </View>
          <Text style={styles.cardValue}>
            {copy.history(gamification.totalCompleted, gamification.totalGoals)}
          </Text>
        </View>
      </View>

      {/* Comparison Card - Only show if there's history */}
      {hasComparison && (
        <View style={styles.comparisonCard}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${colors.text.secondary}15` },
              ]}
            >
              <Activity size={16} color={colors.text.secondary} />
            </View>
            <Text style={styles.comparisonTitle}>{copy.comparisonTitle}</Text>
          </View>

          <View style={styles.comparisonGrid}>
            {/* Savings comparison */}
            {savedVsAvg && (
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>
                  {copy.comparisonSaved}
                </Text>
                <Text style={[styles.comparisonValue, { color: savedVsAvg.color }]}>
                  {savedVsAvg.text}
                </Text>
              </View>
            )}

            {/* Velocity comparison */}
            {velocityVsAvg && (
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>
                  {copy.comparisonVelocity}
                </Text>
                <Text
                  style={[styles.comparisonValue, { color: velocityVsAvg.color }]}
                >
                  {velocityVsAvg.text}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary,
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },
  comparisonCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text.primary,
  },
  comparisonGrid: {
    flexDirection: "row",
    gap: 16,
  },
  comparisonItem: {
    flex: 1,
  },
  comparisonLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: "600",
  },
});
