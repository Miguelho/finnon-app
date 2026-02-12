import { View, Text, StyleSheet } from "react-native";
import { TrendingUp, Target, Activity } from "lucide-react-native";
import {
  formatMoneyWithSymbol,
  withAlpha,
  themeTokens,
  type GoalGamification,
  type CurrentMonthComparison,
} from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

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
  const { tokens: userTokens } = useUserTheme();
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
      <Text style={[styles.title, { color: userTokens.textPrimary }]}>
        {copy.gamificationTitle}
      </Text>

      {/* Main gamification cards */}
      <View style={styles.grid}>
        {/* Streak Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: userTokens.surface, borderColor: userTokens.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: withAlpha(colors.state.positive, 0.15) },
              ]}
            >
              <TrendingUp size={16} color={colors.state.positive} />
            </View>
            <Text style={[styles.cardLabel, { color: userTokens.textSecondary }]}>
              {copy.streakLabel}
            </Text>
          </View>
          <Text style={[styles.cardValue, { color: userTokens.textPrimary }]}>
            {copy.streak(gamification.currentStreak)}
          </Text>
        </View>

        {/* History Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: userTokens.surface, borderColor: userTokens.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: withAlpha(colors.state.positive, 0.15) },
              ]}
            >
              <Target size={16} color={colors.state.positive} />
            </View>
            <Text style={[styles.cardLabel, { color: userTokens.textSecondary }]}>
              {copy.historyLabel}
            </Text>
          </View>
          <Text style={[styles.cardValue, { color: userTokens.textPrimary }]}>
            {copy.history(gamification.totalCompleted, gamification.totalGoals)}
          </Text>
        </View>
      </View>

      {/* Comparison Card - Only show if there's history */}
      {hasComparison && (
        <View
          style={[
            styles.comparisonCard,
            { backgroundColor: userTokens.surface, borderColor: userTokens.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: withAlpha(userTokens.textSecondary, 0.15) },
              ]}
            >
              <Activity size={16} color={userTokens.textSecondary} />
            </View>
            <Text style={[styles.comparisonTitle, { color: userTokens.textPrimary }]}>
              {copy.comparisonTitle}
            </Text>
          </View>

          <View style={styles.comparisonGrid}>
            {/* Savings comparison */}
            {savedVsAvg && (
              <View style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: userTokens.textSecondary }]}>
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
                <Text style={[styles.comparisonLabel, { color: userTokens.textSecondary }]}>
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
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
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
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  comparisonCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: "500",
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
    marginBottom: 4,
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: "600",
  },
});
