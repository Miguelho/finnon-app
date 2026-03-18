import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { supabase } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { Card } from "../../../../src/components/Card";
import { Button } from "../../../../src/components/Button";
import { RecurringTile } from "../../../../src/components/RecurringTile";
import {
  CURRENCIES,
  computeRecurringMonthInsights,
  formatMinorToMoney,
  formatMonthLabel,
  themeTokens,
  type RecurringItem,
  type RecurringItemInsight,
  type RecurringLinkedTransaction,
  type RecurringItemWithCategory,
} from "@poleursus/shared";
import { useCopy, t } from "../../../../src/lib/i18n";

const tokens = themeTokens.light;
const spacing = tokens.spacing;
const typography = tokens.typography;
const radii = tokens.radii;

const donutSize = 160;
const donutRadius = 56;
const donutStroke = 18;
const donutCircumference = 2 * Math.PI * donutRadius;

export default function RecurrentesScreen(): React.JSX.Element {
  const router = useRouter();
  const { selectedAccountId } = useAuth();
  const { tokens: userThemeTokens } = useUserTheme();
  const { dictionary, locale } = useCopy();
  const [recurringItems, setRecurringItems] = useState<
    RecurringItemWithCategory[]
  >([]);
  const [recurringTransactions, setRecurringTransactions] = useState<
    RecurringLinkedTransaction[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedAccountId) {
      setError(t(dictionary, "transactions.noAccountSelected"));
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("recurring_items")
        .select(
          `
          *,
          category:categories(id, name, icon_id, type)
        `
        )
        .eq("account_id", selectedAccountId)
        .order("merchant", { ascending: true });

      if (fetchError) throw fetchError;

      const recurringIds = (data || []).map((item) => item.id);
      const { data: transactionData, error: transactionError } =
        recurringIds.length > 0
          ? await supabase
              .from("transactions")
              .select(
                "id, recurring_item_id, recurring_occurrence_date, amount_minor, date"
              )
              .eq("account_id", selectedAccountId)
              .in("recurring_item_id", recurringIds)
              .order("recurring_occurrence_date", { ascending: false })
          : { data: [], error: null };

      if (transactionError) throw transactionError;

      setRecurringItems(data || []);
      setRecurringTransactions(transactionData || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || t(dictionary, "recurrentes.loadError"));
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, dictionary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleEdit = (id: string) => {
    router.push(`/(auth)/transaction/recurrent/${id}`);
  };

  const handlePause = async (id: string, isPaused: boolean) => {
    try {
      const { data, error: updateError } = await supabase
        .from("recurring_items")
        .update({
          is_paused: isPaused,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      setRecurringItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_paused: data.is_paused } : item
        )
      );

      Alert.alert(
        t(dictionary, "common.successTitle"),
        isPaused
          ? t(dictionary, "recurrentes.pauseSuccess")
          : t(dictionary, "recurrentes.resumeSuccess")
      );
    } catch (e: any) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        isPaused
          ? t(dictionary, "recurrentes.pauseError")
          : t(dictionary, "recurrentes.resumeError")
      );
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      t(dictionary, "recurrentes.deleteConfirmTitle"),
      t(dictionary, "recurrentes.deleteConfirmDescription"),
      [
        { text: t(dictionary, "common.cancel"), style: "cancel" },
        {
          text: t(dictionary, "recurrentes.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const { error: deleteError } = await supabase
                .from("recurring_items")
                .delete()
                .eq("id", id);

              if (deleteError) throw deleteError;

              setRecurringItems((prev) => prev.filter((item) => item.id !== id));

              Alert.alert(
                t(dictionary, "common.successTitle"),
                t(dictionary, "recurrentes.deleteSuccess")
              );
            } catch (e: any) {
              Alert.alert(
                t(dictionary, "common.errorTitle"),
                t(dictionary, "recurrentes.deleteError")
              );
            }
          },
        },
      ]
    );
  };

  const handleEnd = (id: string) => {
    Alert.alert(
      t(dictionary, "recurrentes.endConfirmTitle"),
      t(dictionary, "recurrentes.endConfirmDescription"),
      [
        { text: t(dictionary, "common.cancel"), style: "cancel" },
        {
          text: t(dictionary, "recurrentes.end"),
          style: "destructive",
          onPress: async () => {
            try {
              const today = new Date().toISOString().slice(0, 10);
              const { data, error: updateError } = await supabase
                .from("recurring_items")
                .update({
                  end_date: today,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select()
                .single();

              if (updateError) throw updateError;

              setRecurringItems((prev) =>
                prev.map((item) =>
                  item.id === id ? { ...item, end_date: data.end_date } : item
                )
              );

              Alert.alert(
                t(dictionary, "common.successTitle"),
                t(dictionary, "recurrentes.endSuccess")
              );
            } catch (e: any) {
              Alert.alert(
                t(dictionary, "common.errorTitle"),
                t(dictionary, "recurrentes.endError")
              );
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/transactions");
    }
  };

  const screenTitle = t(dictionary, "recurrentes.title");
  const screenOptions = {
    title: screenTitle,
    headerStyle: { backgroundColor: userThemeTokens.background },
    headerTitleStyle: { color: userThemeTokens.textPrimary },
    headerLeft: () => (
        <TouchableOpacity
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t(dictionary, "common.back")}
          style={styles.headerBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={userThemeTokens.textPrimary} />
        </TouchableOpacity>
      ),
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View
          style={[styles.loading, { backgroundColor: userThemeTokens.background }]}
        >
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View
          style={[styles.container, { backgroundColor: userThemeTokens.background }]}
        >
          <Card title={t(dictionary, "common.errorTitle")} description={error}>
            <Button title={t(dictionary, "common.retry")} onPress={loadData} />
          </Card>
        </View>
      </>
    );
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const monthKey = todayISO.slice(0, 7);
  const monthLabel = formatMonthLabel(monthKey, locale);
  const insights = computeRecurringMonthInsights({
    recurringItems,
    transactions: recurringTransactions,
    monthKey,
    todayISO,
  });
  const expenseItems = insights.expense.items;
  const incomeItems = insights.income.items;
  const currencySymbol =
    CURRENCIES.find((entry) => entry.code === recurringItems[0]?.currency)?.symbol ??
    CURRENCIES.find((entry) => entry.code === "EUR")?.symbol ??
    "€";

  const formatShortDate = (value: string) =>
    new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short" });

  const formatExpenseAmount = (minor: bigint) =>
    `-${currencySymbol} ${formatMinorToMoney(minor, recurringItems[0]?.currency ?? "EUR")}`;

  const formatIncomeAmount = (minor: bigint) =>
    `${currencySymbol} ${formatMinorToMoney(minor, recurringItems[0]?.currency ?? "EUR")}`;

  const formatSignedAmount = (minor: bigint) => {
    const sign = minor < 0n ? "-" : "";
    const absolute = minor < 0n ? -minor : minor;
    return `${sign}${currencySymbol} ${formatMinorToMoney(
      absolute,
      recurringItems[0]?.currency ?? "EUR"
    )}`;
  };

  const formatDeltaAmount = (minor: bigint) => {
    if (minor === 0n) return t(dictionary, "recurrentes.trendFlat");
    const sign = minor > 0n ? "+" : "-";
    const absolute = minor > 0n ? minor : -minor;
    return `${sign}${currencySymbol}${formatMinorToMoney(
      absolute,
      recurringItems[0]?.currency ?? "EUR"
    )}`;
  };

  const formatPercent = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);

  const getStatusBadge = (item: RecurringItemInsight) => {
    if (item.status === "confirmed") {
      return {
        label: t(dictionary, "recurrentes.statusConfirmed"),
        tone: "positive" as const,
      };
    }
    if (item.status === "paused") {
      return { label: t(dictionary, "recurrentes.paused"), tone: "muted" as const };
    }
    if (item.nextOccurrence) {
      return { label: formatShortDate(item.nextOccurrence), tone: "neutral" as const };
    }
    return null;
  };

  const getTrendTone = (item: RecurringItem, deltaMinor: bigint | null) => {
    if (deltaMinor === null || deltaMinor === 0n) return "neutral" as const;
    if (item.type === "expense") {
      return deltaMinor > 0n ? ("negative" as const) : ("positive" as const);
    }
    return deltaMinor > 0n ? ("positive" as const) : ("negative" as const);
  };

  let cumulativeLength = 0;
  const leadIncomeItem =
    incomeItems.find((item) => item.occurrenceCountThisMonth > 0) ?? incomeItems[0];

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <View style={[styles.screen, { backgroundColor: userThemeTokens.background }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={[styles.subtitle, { color: userThemeTokens.textSecondary }]}>
              {t(dictionary, "recurrentes.monthlyProjection", { month: monthLabel })}
            </Text>
          </View>

          {expenseItems.length === 0 && incomeItems.length === 0 ? (
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: userThemeTokens.surface,
                  borderColor: userThemeTokens.border,
                },
              ]}
            >
              <Text style={[styles.benchmarkNote, { color: userThemeTokens.textSecondary }]}>
                {t(dictionary, "recurrentes.empty")}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.summaryGrid}>
                <View
                  style={[
                    styles.summaryCard,
                    {
                      backgroundColor: userThemeTokens.surface,
                      borderColor: userThemeTokens.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.summaryAccent,
                      { backgroundColor: themeTokens.light.colors.state.negative },
                    ]}
                  />
                  <Text style={[styles.summaryLabel, { color: userThemeTokens.textSecondary }]}>
                    {t(dictionary, "recurrentes.expenseSummaryTitle")}
                  </Text>
                  <Text
                    style={[
                      styles.summaryAmount,
                      { color: themeTokens.light.colors.state.negative },
                    ]}
                  >
                    {formatExpenseAmount(insights.expense.totalMinor)}
                  </Text>
                  <Text style={[styles.summaryDetail, { color: userThemeTokens.textSecondary }]}>
                    {insights.expense.projectedCount === 1
                      ? t(dictionary, "recurrentes.summaryRecurringCountOne")
                      : t(dictionary, "recurrentes.summaryRecurringCountOther", {
                          count: insights.expense.projectedCount,
                        })}{" "}
                    ·{" "}
                    {insights.expense.confirmedCount === 1
                      ? t(dictionary, "recurrentes.summaryConfirmedCountOne")
                      : t(dictionary, "recurrentes.summaryConfirmedCountOther", {
                          count: insights.expense.confirmedCount,
                        })}
                  </Text>
                </View>

                <View
                  style={[
                    styles.summaryCard,
                    {
                      backgroundColor: userThemeTokens.surface,
                      borderColor: userThemeTokens.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.summaryAccent,
                      { backgroundColor: themeTokens.light.colors.state.positive },
                    ]}
                  />
                  <Text style={[styles.summaryLabel, { color: userThemeTokens.textSecondary }]}>
                    {t(dictionary, "recurrentes.incomeSummaryTitle")}
                  </Text>
                  <Text
                    style={[
                      styles.summaryAmount,
                      { color: themeTokens.light.colors.state.positive },
                    ]}
                  >
                    {formatIncomeAmount(insights.income.totalMinor)}
                  </Text>
                  <Text style={[styles.summaryDetail, { color: userThemeTokens.textSecondary }]}>
                    {insights.income.projectedCount === 1
                      ? t(dictionary, "recurrentes.summaryRecurringCountOne")
                      : t(dictionary, "recurrentes.summaryRecurringCountOther", {
                          count: insights.income.projectedCount,
                        })}
                    {leadIncomeItem?.referenceDate
                      ? ` · ${leadIncomeItem.recurringItem.merchant || t(dictionary, "recurrentes.incomeFallback")} · ${t(dictionary, "recurrentes.dayOfMonth", {
                          day: new Date(leadIncomeItem.referenceDate).toLocaleDateString(locale, {
                            day: "numeric",
                          }),
                        })}`
                      : ""}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: userThemeTokens.surface,
                    borderColor: userThemeTokens.border,
                  },
                ]}
              >
                <View style={styles.benchmarkHeader}>
                  <Text style={[styles.sectionLabel, { color: userThemeTokens.textSecondary }]}>
                    {t(dictionary, "recurrentes.benchmarkTitle")}
                  </Text>
                  <Text style={[styles.benchmarkValue, { color: userThemeTokens.textPrimary }]}>
                    {insights.expenseShareOfIncome !== null
                      ? formatPercent(insights.expenseShareOfIncome)
                      : "—"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.benchmarkTrack,
                    { backgroundColor: userThemeTokens.surfaceAlt },
                  ]}
                >
                  <View
                    style={[
                      styles.benchmarkFill,
                      {
                        width: `${
                          Math.min((insights.expenseShareOfIncome ?? 0) * 100, 100)
                        }%`,
                      },
                    ]}
                  />
                </View>

                <Text style={[styles.benchmarkNote, { color: userThemeTokens.textSecondary }]}>
                  {insights.expenseShareOfIncome !== null
                    ? t(dictionary, "recurrentes.benchmarkNote", {
                        percentage: formatPercent(insights.expenseShareOfIncome),
                        amount: formatSignedAmount(insights.remainingBalanceMinor),
                      })
                    : t(dictionary, "recurrentes.benchmarkEmpty")}
                </Text>
              </View>

              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: userThemeTokens.surface,
                    borderColor: userThemeTokens.border,
                  },
                ]}
              >
                <Text style={[styles.sectionLabel, { color: userThemeTokens.textSecondary }]}>
                  {t(dictionary, "recurrentes.categoryDistributionTitle")}
                </Text>

                {insights.categories.length > 0 ? (
                  <View style={styles.chartWrap}>
                    <View style={styles.chartCircleWrap}>
                      <Svg width={donutSize} height={donutSize}>
                        <Circle
                          cx={donutSize / 2}
                          cy={donutSize / 2}
                          r={donutRadius}
                          fill="none"
                          stroke={userThemeTokens.surfaceAlt}
                          strokeWidth={donutStroke}
                        />
                        {insights.categories.map((category) => {
                          const segmentLength = donutCircumference * category.share;
                          const offset = cumulativeLength;
                          cumulativeLength += segmentLength;
                          return (
                            <Circle
                              key={category.id ?? category.name ?? category.color}
                              cx={donutSize / 2}
                              cy={donutSize / 2}
                              r={donutRadius}
                              fill="none"
                              stroke={category.color}
                              strokeWidth={donutStroke}
                              strokeDasharray={`${segmentLength} ${donutCircumference}`}
                              strokeDashoffset={-offset}
                              rotation={-90}
                              origin={`${donutSize / 2}, ${donutSize / 2}`}
                            />
                          );
                        })}
                      </Svg>
                      <View style={styles.chartCenter}>
                        <Text style={[styles.chartAmount, { color: userThemeTokens.textPrimary }]}>
                          {formatIncomeAmount(insights.expense.totalMinor)}
                        </Text>
                        <Text
                          style={[styles.chartLabel, { color: userThemeTokens.textSecondary }]}
                        >
                          {t(dictionary, "recurrentes.projectedShort")}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.legend}>
                      {insights.categories.map((category) => (
                        <View
                          key={category.id ?? category.name ?? category.color}
                          style={[
                            styles.legendRow,
                            { backgroundColor: userThemeTokens.surfaceAlt },
                          ]}
                        >
                          <View style={styles.legendLeft}>
                            <View
                              style={[
                                styles.legendDot,
                                { backgroundColor: category.color },
                              ]}
                            />
                            <Text
                              style={[styles.legendName, { color: userThemeTokens.textPrimary }]}
                            >
                              {category.name || t(dictionary, "common.noneOption")}
                            </Text>
                          </View>
                          <View style={styles.legendRight}>
                            <Text
                              style={[
                                styles.legendAmount,
                                { color: userThemeTokens.textPrimary },
                              ]}
                            >
                              {formatIncomeAmount(category.amountMinor)}
                            </Text>
                            <Text
                              style={[
                                styles.legendPercent,
                                { color: userThemeTokens.textSecondary },
                              ]}
                            >
                              {formatPercent(category.share)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.benchmarkNote, { color: userThemeTokens.textSecondary }]}>
                    {t(dictionary, "recurrentes.chartEmpty")}
                  </Text>
                )}
              </View>

              {expenseItems.length > 0 ? (
            <View style={styles.listSection}>
              <View style={styles.listHeader}>
                <Text style={[styles.sectionLabel, { color: userThemeTokens.textSecondary }]}>
                  {t(dictionary, "recurrentes.expenseListTitle")}
                </Text>
                <View
                  style={[
                    styles.listCountPill,
                    { backgroundColor: userThemeTokens.surfaceAlt },
                  ]}
                >
                  <Text style={[styles.listCountText, { color: userThemeTokens.textSecondary }]}>
                    {expenseItems.length === 1
                      ? t(dictionary, "recurrentes.listCountOne")
                      : t(dictionary, "recurrentes.listCountOther", {
                          count: expenseItems.length,
                        })}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.listContainer,
                  {
                    backgroundColor: userThemeTokens.surface,
                    borderColor: userThemeTokens.border,
                  },
                ]}
              >
                {expenseItems.map((item, index) => {
                  const isLast = index === expenseItems.length - 1;
                  return (
                    <View
                      key={item.recurringItem.id}
                      style={[
                        styles.listRow,
                        { borderBottomColor: userThemeTokens.border },
                        isLast && styles.listRowLast,
                      ]}
                    >
                      <RecurringTile
                        recurringItem={item.recurringItem}
                        detailLabel={item.referenceDate ? formatShortDate(item.referenceDate) : null}
                        statusBadge={getStatusBadge(item)}
                        trend={
                          item.deltaMinor !== null
                            ? {
                                label: formatDeltaAmount(item.deltaMinor),
                                tone: getTrendTone(item.recurringItem, item.deltaMinor),
                              }
                            : null
                        }
                        categoryColor={item.categoryColor}
                        showLeadingAccent={item.status === "confirmed"}
                        onEdit={handleEdit}
                        onPause={handlePause}
                        onEnd={handleEnd}
                        onDelete={handleDelete}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
              ) : null}

              {incomeItems.length > 0 ? (
            <View style={styles.listSection}>
              <View style={styles.listHeader}>
                <Text style={[styles.sectionLabel, { color: userThemeTokens.textSecondary }]}>
                  {t(dictionary, "recurrentes.incomeListTitle")}
                </Text>
                <View
                  style={[
                    styles.listCountPill,
                    { backgroundColor: userThemeTokens.surfaceAlt },
                  ]}
                >
                  <Text style={[styles.listCountText, { color: userThemeTokens.textSecondary }]}>
                    {incomeItems.length === 1
                      ? t(dictionary, "recurrentes.listCountOne")
                      : t(dictionary, "recurrentes.listCountOther", {
                          count: incomeItems.length,
                        })}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.listContainer,
                  {
                    backgroundColor: userThemeTokens.surface,
                    borderColor: userThemeTokens.border,
                  },
                ]}
              >
                {incomeItems.map((item, index) => {
                  const isLast = index === incomeItems.length - 1;
                  return (
                    <View
                      key={item.recurringItem.id}
                      style={[
                        styles.listRow,
                        { borderBottomColor: userThemeTokens.border },
                        isLast && styles.listRowLast,
                      ]}
                    >
                      <RecurringTile
                        recurringItem={item.recurringItem}
                        detailLabel={item.referenceDate ? formatShortDate(item.referenceDate) : null}
                        statusBadge={getStatusBadge(item)}
                        trend={
                          item.deltaMinor !== null
                            ? {
                                label: formatDeltaAmount(item.deltaMinor),
                                tone: getTrendTone(item.recurringItem, item.deltaMinor),
                              }
                            : null
                        }
                        categoryColor={item.categoryColor}
                        onEdit={handleEdit}
                        onPause={handlePause}
                        onEnd={handleEnd}
                        onDelete={handleDelete}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  subtitle: {
    fontSize: typography.size.sm,
  },
  summaryGrid: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    overflow: "hidden",
  },
  summaryAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryAmount: {
    marginTop: spacing.sm,
    fontSize: 28,
    fontWeight: typography.weight.bold,
  },
  summaryDetail: {
    marginTop: spacing.xs,
    fontSize: typography.size.sm,
  },
  sectionCard: {
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  benchmarkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  benchmarkValue: {
    fontSize: 24,
    fontWeight: typography.weight.bold,
  },
  benchmarkTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  benchmarkFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#5B8DFF",
  },
  benchmarkNote: {
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  chartWrap: {
    gap: spacing.lg,
  },
  chartCircleWrap: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    width: donutSize,
    height: donutSize,
  },
  chartCenter: {
    position: "absolute",
    alignItems: "center",
  },
  chartAmount: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  chartLabel: {
    marginTop: 2,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  legend: {
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  legendRight: {
    alignItems: "flex-end",
    marginLeft: spacing.md,
  },
  legendAmount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  legendPercent: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  listSection: {
    gap: spacing.sm,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  listCountPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  listCountText: {
    fontSize: typography.size.xs,
  },
  listContainer: {
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    overflow: "hidden",
    borderWidth: 1,
  },
  listRow: {
    borderBottomWidth: 1,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  headerBackButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
