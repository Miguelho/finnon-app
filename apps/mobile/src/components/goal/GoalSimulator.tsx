import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Animated,
} from "react-native";
import { ChevronDown } from "lucide-react-native";
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
import { CategoryIcon } from "../CategoryIcon";
import { useUserTheme } from "../../contexts/UserThemeContext";

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
  const { tokens: userTokens } = useUserTheme();
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
      <TouchableOpacity
        onPress={() => setIsExpanded(true)}
        style={styles.linkButton}
        accessibilityRole="button"
        accessibilityLabel={copy.linkText}
      >
        <Text style={[styles.linkText, { color: userTokens.textSecondary }]}>
          {copy.linkText}
        </Text>
        <ChevronDown
          size={16}
          color={userTokens.textSecondary}
        />
      </TouchableOpacity>
    );
  }

  if (simulatorCandidates.length === 0) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: cardStyles.backgroundColor, borderColor: cardStyles.borderColor },
        ]}
      >
        <TouchableOpacity
          onPress={() => setIsExpanded((prev) => !prev)}
          style={styles.header}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
        >
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {copy.title}
            </Text>
            <Text style={[styles.subtitle, { color: subtitleColor }]}>
              {subtitle}
            </Text>
          </View>
          <View
            style={[
              styles.chevronContainer,
              { backgroundColor: userTokens.surface },
              { transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] },
            ]}
          >
            <ChevronDown
              size={16}
              color={userTokens.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {isExpanded ? (
          <View style={styles.content}>
            <View
              style={[
                styles.impactPanel,
                {
                  backgroundColor: userTokens.surface,
                  marginBottom: 0,
                },
              ]}
            >
              <Text style={[styles.impactEmpty, { color: userTokens.textSecondary }]}>
                {copy.noItems}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cardStyles.backgroundColor, borderColor: cardStyles.borderColor },
      ]}
    >
      {/* Header */}
      <TouchableOpacity
        onPress={() => setIsExpanded((prev) => !prev)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: userTokens.textPrimary }]}>
            {copy.title}
          </Text>
          <Text style={[styles.subtitle, { color: subtitleColor }]}>
            {subtitle}
          </Text>
        </View>
        <View
          style={[
            styles.chevronContainer,
            { backgroundColor: userTokens.surface },
            { transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] },
          ]}
        >
          <ChevronDown
            size={16}
            color={userTokens.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Content */}
      {isExpanded && (
        <View style={styles.content}>
          {/* Impact Preview */}
          <View style={[styles.impactPanel, { backgroundColor: userTokens.surface }]}>
            {hasSelection ? (
              <>
                <Text style={[styles.impactDays, { color: impactTitleColor }]}>
                  {impactTitle}
                </Text>
                {impactSubtitle && (
                  <Text style={[styles.impactSavings, { color: userTokens.textSecondary }]}>
                    {impactSubtitle}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.impactEmpty, { color: userTokens.textSecondary }]}>
                  {copy.impact.empty}
                </Text>
                <Text style={[styles.impactEmptyDetail, { color: userTokens.textSecondary }]}>
                  {copy.impact.emptyDetail}
                </Text>
              </>
            )}
          </View>

          {/* Candidates List */}
          <View style={styles.list}>
            {simulatorCandidates.map((tx) => {
              const isDisabled = disabledIds.has(tx.id);
              const category = tx.categoryId
                ? categoriesById[tx.categoryId]
                : null;
              const displayName =
                tx.merchant || category?.name || tx.merchantNorm || "Expense";
              const iconKey = category?.icon_id as CategoryIconKey | undefined;

              return (
                <View
                  key={tx.id}
                  style={[
                    styles.listItem,
                    {
                      backgroundColor: userTokens.surface,
                      borderColor: userTokens.border,
                    },
                    isDisabled && styles.listItemDisabled,
                  ]}
                >
                  <View style={styles.listItemLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: userTokens.surfaceAlt },
                      ]}
                    >
                      {iconKey ? (
                        <CategoryIcon iconKey={iconKey} size={20} tone="muted" />
                      ) : (
                        <Text style={[styles.iconFallback, { color: userTokens.textSecondary }]}>
                          {displayName.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.itemInfo}>
                      <Text
                        style={[styles.itemName, { color: userTokens.textPrimary }]}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                      <Text style={[styles.itemAmount, { color: userTokens.textSecondary }]}>
                        {formatMoneyWithSymbol(
                          tx.amountBaseMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                        /mes
                      </Text>
                    </View>
                  </View>
                  <View style={styles.listItemRight}>
                    {tx.delayDays != null && tx.delayDays > 0 && (
                      <Text style={styles.itemImpact}>
                        {copy.itemImpact(tx.delayDays)}
                      </Text>
                    )}
                    <Switch
                      value={!isDisabled}
                      onValueChange={() => toggleItem(tx.id)}
                      trackColor={{
                        false: userTokens.border,
                        true: colors.state.positive,
                      }}
                      thumbColor={userTokens.surface}
                      accessibilityLabel={`Toggle ${displayName}`}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.xs,
    padding: tokens.spacing.md,
  },
  linkText: {
    fontSize: tokens.typography.size.sm,
  },
  card: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: tokens.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: String(tokens.typography.weight.semibold) as "600",
    fontSize: tokens.typography.size.base,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
    marginTop: 2,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radii.md,
  },
  content: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
  },
  impactPanel: {
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    alignItems: "center",
  },
  impactDays: {
    fontSize: tokens.typography.size.xl,
    fontWeight: String(tokens.typography.weight.bold) as "700",
    color: colors.state.positive,
  },
  impactSavings: {
    fontSize: tokens.typography.size.sm,
    marginTop: tokens.spacing.xs,
  },
  impactEmpty: {
    fontSize: tokens.typography.size.sm,
  },
  impactEmptyDetail: {
    fontSize: tokens.typography.size.xs,
    marginTop: tokens.spacing.xs,
  },
  list: {
    gap: tokens.spacing.md,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
  },
  listItemDisabled: {
    opacity: 0.5,
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconFallback: {
    fontSize: tokens.typography.size.sm,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontWeight: String(tokens.typography.weight.medium) as "500",
    fontSize: tokens.typography.size.sm,
  },
  itemAmount: {
    fontSize: tokens.typography.size.xs,
  },
  listItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  itemImpact: {
    fontSize: tokens.typography.size.xs,
    color: colors.state.positive,
    textAlign: "right",
  },
});
