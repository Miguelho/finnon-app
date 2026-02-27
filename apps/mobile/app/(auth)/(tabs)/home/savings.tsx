import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import {
  addMonths,
  CURRENCIES,
  computeProjectProgress,
  computeSavingsDistribution,
  computeSavingsHistoryStats,
  computeSavingsMonthFromTransactions,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getMonthRangeFromKey,
  themeTokens,
  toMonthKey,
  type Project,
  type ProjectContribution,
} from "@poleursus/shared";
import { Card } from "../../../../src/components/Card";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";

const tokens = themeTokens.light;

type TxRow = {
  type: "income" | "expense";
  amount_minor: bigint | number | string | null;
  amount_base_minor: bigint | number | string | null;
  date: string;
};

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const toPeriodKey = (value: string | Date | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 7);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

const buildMonthKeysEndingAt = (endMonthKey: string, count: number) =>
  Array.from({ length: count }, (_, index) => addMonths(endMonthKey, -(count - 1 - index)));

const formatSignedMoney = (value: bigint, baseCurrency: string, currencySymbol: string) => {
  const abs = value < 0n ? -value : value;
  const formatted = formatMoneyWithSymbol(abs, baseCurrency, currencySymbol);
  if (value === 0n) return formatted;
  return value > 0n ? `+${formatted}` : `-${formatted}`;
};

export default function SavingsDetailScreen() {
  const { selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const isFocused = useIsFocused();

  const [monthKey, setMonthKey] = useState(toMonthKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [projects, setProjects] = useState<Project[]>([]);
  const [periodContributions, setPeriodContributions] = useState<ProjectContribution[]>([]);
  const [historyContributions, setHistoryContributions] = useState<ProjectContribution[]>([]);
  const [historyTransactions, setHistoryTransactions] = useState<TxRow[]>([]);
  const [savingsMinor, setSavingsMinor] = useState(0n);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedAccountId || !isFocused) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const range = getMonthRangeFromKey(monthKey);
      const txHistoryStart = getMonthRangeFromKey(addMonths(monthKey, -11));

      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("base_currency")
        .eq("id", selectedAccountId)
        .maybeSingle();
      if (accountError || !account) throw accountError ?? new Error("account-not-found");

      const accountCurrency = account.base_currency;
      const symbol =
        CURRENCIES.find((item) => item.code === accountCurrency)?.symbol ??
        accountCurrency;

      const { data: txRows, error: txError } = await supabase
        .from("transactions")
        .select("type, amount_minor, amount_base_minor, date")
        .eq("account_id", selectedAccountId)
        .gte("date", txHistoryStart.start)
        .lte("date", range.end);
      if (txError) throw txError;

      const monthTxRows = ((txRows ?? []) as TxRow[]).filter(
        (tx) => toPeriodKey(tx.date) === monthKey
      );
      const monthSavings = computeSavingsMonthFromTransactions(
        (monthTxRows as Array<{
          type: "income" | "expense";
          amount_minor: bigint | number | string | null;
          amount_base_minor: bigint | number | string | null;
        }>) ?? []
      );

      const { data: projectRows, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("account_id", selectedAccountId)
        .eq("status", "active")
        .order("priority", { ascending: true });
      if (projectsError) throw projectsError;

      const { data: periodRows, error: periodError } = await supabase
        .from("project_contributions")
        .select("*")
        .eq("account_id", selectedAccountId)
        .eq("period", range.start)
        .eq("confirmed", true);
      if (periodError) throw periodError;

      const { data: historyRows, error: historyError } = await supabase
        .from("project_contributions")
        .select("*")
        .eq("account_id", selectedAccountId)
        .eq("confirmed", true)
        .order("period", { ascending: false })
        .limit(72);
      if (historyError) throw historyError;

      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setSavingsMinor(monthSavings.savingsMinor);
      setProjects((projectRows ?? []) as Project[]);
      setPeriodContributions((periodRows ?? []) as ProjectContribution[]);
      setHistoryContributions((historyRows ?? []) as ProjectContribution[]);
      setHistoryTransactions((txRows ?? []) as TxRow[]);
    } catch (loadError) {
      console.error("[Savings][mobile] load error", loadError);
      setError(t(dictionary, "errors.internalServer"));
    } finally {
      setLoading(false);
    }
  }, [dictionary, isFocused, monthKey, selectedAccountId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const distribution = useMemo(
    () =>
      computeSavingsDistribution({
        projects,
        savingsMinor,
      }),
    [projects, savingsMinor]
  );

  const actualByProject = useMemo(() => {
    const map = new Map<string, bigint>();
    periodContributions.forEach((row) => {
      map.set(row.project_id, (map.get(row.project_id) ?? 0n) + toMinor(row.actual_amount_base_minor));
    });
    return map;
  }, [periodContributions]);

  const historyStats = useMemo(
    () =>
      computeSavingsHistoryStats({
        projects,
        contributions: historyContributions,
      }),
    [historyContributions, projects]
  );

  const progressByProject = useMemo(() => {
    const byProject = new Map<string, ReturnType<typeof computeProjectProgress>>();
    const byContributions = new Map<string, ProjectContribution[]>();
    historyContributions.forEach((entry) => {
      const list = byContributions.get(entry.project_id) ?? [];
      list.push(entry);
      byContributions.set(entry.project_id, list);
    });
    projects.forEach((project) => {
      if (project.is_hucha) return;
      byProject.set(
        project.id,
        computeProjectProgress({
          project,
          contributions: byContributions.get(project.id) ?? [],
        })
      );
    });
    return byProject;
  }, [historyContributions, projects]);

  const monthlySavings = useMemo(() => {
    const map = new Map<string, bigint>();
    historyTransactions.forEach((tx) => {
      const period = toPeriodKey(tx.date);
      if (!period) return;
      const amount = toMinor(tx.amount_base_minor ?? tx.amount_minor);
      map.set(period, (map.get(period) ?? 0n) + (tx.type === "income" ? amount : -amount));
    });
    return map;
  }, [historyTransactions]);

  const chartPeriods = useMemo(() => buildMonthKeysEndingAt(monthKey, 6), [monthKey]);

  const evolutionRows = useMemo(() => {
    const achievedByPeriod = new Map(
      historyStats.periods.map((row) => [row.period, row.achieved] as const)
    );
    return chartPeriods.map((period) => ({
      period,
      amountMinor: monthlySavings.get(period) ?? 0n,
      achieved: achievedByPeriod.get(period) ?? false,
      isCurrent: period === monthKey,
    }));
  }, [chartPeriods, historyStats.periods, monthlySavings, monthKey]);

  const chartScaleMinor = useMemo(() => {
    let maxMinor = distribution.objectiveMinor > 0n ? distribution.objectiveMinor : 1n;
    evolutionRows.forEach((row) => {
      if (row.amountMinor > maxMinor) maxMinor = row.amountMinor;
    });
    return maxMinor > 0n ? maxMinor : 1n;
  }, [distribution.objectiveMinor, evolutionRows]);

  const goalLinePercent = useMemo(() => {
    if (distribution.objectiveMinor <= 0n) return 0;
    return Math.min(100, (Number(distribution.objectiveMinor) / Number(chartScaleMinor)) * 100);
  }, [chartScaleMinor, distribution.objectiveMinor]);
  const chartBarMaxHeightPx = 120;
  const chartBarMinHeightPx = 8;

  const reachedDayByPeriod = useMemo(() => {
    const objectiveMinor = distribution.objectiveMinor;
    const byPeriod = new Map<string, TxRow[]>();
    historyTransactions.forEach((tx) => {
      const period = toPeriodKey(tx.date);
      if (!period) return;
      const list = byPeriod.get(period) ?? [];
      list.push(tx);
      byPeriod.set(period, list);
    });

    const reached = new Map<string, number | null>();
    byPeriod.forEach((rows, period) => {
      if (objectiveMinor <= 0n) {
        reached.set(period, null);
        return;
      }
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      let cumulative = 0n;
      let dayReached: number | null = null;
      for (const row of sorted) {
        const amount = toMinor(row.amount_base_minor ?? row.amount_minor);
        cumulative += row.type === "income" ? amount : -amount;
        if (cumulative >= objectiveMinor) {
          const parsedDate = new Date(`${row.date}T00:00:00`);
          dayReached = Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getDate();
          break;
        }
      }
      reached.set(period, dayReached);
    });

    return reached;
  }, [distribution.objectiveMinor, historyTransactions]);

  const comparison = useMemo<{
    averageMinor: bigint;
    savingsDiffMinor: bigint;
    velocityLabel: string;
    velocityPositive: boolean;
    bestMonth: { period: string; amountMinor: bigint } | null;
  }>(() => {
    const previousRows = evolutionRows.filter((row) => row.period !== monthKey);
    const averageMinor =
      previousRows.length > 0
        ? previousRows.reduce((total, row) => total + row.amountMinor, 0n) /
          BigInt(previousRows.length)
        : 0n;
    const savingsDiffMinor = savingsMinor - averageMinor;

    const currentDay = reachedDayByPeriod.get(monthKey) ?? null;
    const previousDays = previousRows
      .map((row) => reachedDayByPeriod.get(row.period) ?? null)
      .filter((day): day is number => day !== null);
    const averageReachedDay =
      previousDays.length > 0
        ? Math.round(previousDays.reduce((sum, day) => sum + day, 0) / previousDays.length)
        : null;

    let velocityLabel = locale === "en" ? "Pending" : "Pendiente";
    let velocityPositive = false;
    if (currentDay !== null && averageReachedDay !== null) {
      const delta = currentDay - averageReachedDay;
      if (delta === 0) {
        velocityLabel = locale === "en" ? "On average" : "En la media";
      } else if (delta < 0) {
        velocityPositive = true;
        velocityLabel =
          locale === "en"
            ? `${Math.abs(delta)} days earlier`
            : `${Math.abs(delta)} días antes`;
      } else {
        velocityLabel =
          locale === "en" ? `${delta} days later` : `${delta} días después`;
      }
    } else if (currentDay !== null && averageReachedDay === null) {
      velocityLabel = locale === "en" ? `Day ${currentDay}` : `Día ${currentDay}`;
    }

    let bestMonth: { period: string; amountMinor: bigint } | null = null;
    monthlySavings.forEach((amountMinor, period) => {
      if (bestMonth === null || amountMinor > bestMonth.amountMinor) {
        bestMonth = { period, amountMinor };
      }
    });

    return {
      averageMinor,
      savingsDiffMinor,
      velocityLabel,
      velocityPositive,
      bestMonth,
    };
  }, [evolutionRows, locale, monthKey, monthlySavings, reachedDayByPeriod, savingsMinor]);

  const monthDate = new Date(`${monthKey}-01T00:00:00`);
  const monthLabel = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(monthDate);
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const positiveSavings = savingsMinor > 0n ? savingsMinor : 0n;
  const progressScaleMinor =
    positiveSavings > distribution.objectiveMinor
      ? positiveSavings
      : distribution.objectiveMinor > 0n
      ? distribution.objectiveMinor
      : 1n;
  const projectsPercent =
    progressScaleMinor > 0n
      ? (Number(distribution.projectCoveredMinor) / Number(progressScaleMinor)) * 100
      : 0;
  const huchaPercent =
    progressScaleMinor > 0n
      ? (Number(distribution.huchaMinor) / Number(progressScaleMinor)) * 100
      : 0;
  const objectiveMarkerPercent =
    progressScaleMinor > 0n
      ? (Number(distribution.objectiveMinor) / Number(progressScaleMinor)) * 100
      : 0;

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "home.savings.title") }} />
        <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
          <ActivityIndicator size="large" color={primaryActionColor} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t(dictionary, "home.savings.title") }} />
      <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
        <ScrollView contentContainerStyle={styles.container}>
          {error ? (
            <Card>
              <Text style={[styles.errorText, { color: userTokens.textPrimary }]}>{error}</Text>
            </Card>
          ) : null}

          <Card>
            <Text style={[styles.heroAmount, { color: "#4ade80" }]}>
              {formatMoneyWithSymbol(savingsMinor, baseCurrency, currencySymbol)}
            </Text>
            <Text style={[styles.meta, { color: userTokens.textSecondary }]}>
              {locale === "en" ? "Saved this month" : "Ahorrado este mes"}
            </Text>

            <View style={styles.monthNav}>
              <TouchableOpacity
                onPress={() => setMonthKey((prev) => addMonths(prev, -1))}
                style={[styles.monthNavBtn, { borderColor: userTokens.border }]}
              >
                <Text style={[styles.monthNavBtnText, { color: userTokens.textSecondary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: userTokens.textSecondary }]}>
                {monthLabelCapitalized}
              </Text>
              <TouchableOpacity
                onPress={() => setMonthKey((prev) => addMonths(prev, 1))}
                style={[styles.monthNavBtn, { borderColor: userTokens.border }]}
              >
                <Text style={[styles.monthNavBtnText, { color: userTokens.textSecondary }]}>›</Text>
              </TouchableOpacity>
            </View>
          </Card>

          <Card>
            <View style={[styles.progressTrack, { backgroundColor: userTokens.surfaceAlt }]}>
              {positiveSavings > 0n ? (
                <>
                  <View
                    style={[
                      styles.progressProjects,
                      { width: `${Math.max(0, Math.min(100, projectsPercent))}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressHucha,
                      {
                        width: `${Math.max(0, Math.min(100, huchaPercent))}%`,
                        left: `${Math.max(0, Math.min(100, projectsPercent))}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressMarker,
                      {
                        left: `${Math.max(0, Math.min(100, objectiveMarkerPercent))}%`,
                        backgroundColor: userTokens.textPrimary,
                      },
                    ]}
                  />
                </>
              ) : null}
            </View>

            <View style={styles.progressLabels}>
              <Text style={[styles.meta, { color: userTokens.textSecondary }]}>
                {distribution.projectCoveredMinor >= distribution.objectiveMinor &&
                distribution.objectiveMinor > 0n
                  ? locale === "en"
                    ? "Projects covered ✓"
                    : "Proyectos cubiertos ✓"
                  : locale === "en"
                  ? "Pending"
                  : "Pendiente"}
              </Text>
              <Text style={[styles.meta, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Total" : "Total"}:{" "}
                {formatMoneyWithSymbol(savingsMinor, baseCurrency, currencySymbol)}
              </Text>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "Savings distribution" : "Distribución del ahorro"}
            </Text>
            {distribution.allocations.map((row) => {
              const actualMinor = actualByProject.get(row.project.id) ?? row.allocatedMinor;
              const progress = progressByProject.get(row.project.id);
              const progressPct = Math.round((progress?.progressRatio ?? 0) * 100);
              return (
                <View key={row.project.id} style={styles.distRow}>
                  <View style={styles.distRowLeft}>
                    <View style={styles.distProjectIcon}>
                      <Text style={styles.distProjectIconText}>{row.project.emoji}</Text>
                    </View>
                    <View style={styles.distRowCopy}>
                      <Text style={[styles.rowLabel, { color: userTokens.textPrimary }]}>
                        {row.project.name}
                      </Text>
                      <Text style={[styles.rowMeta, { color: userTokens.textSecondary }]}>
                        {formatMoneyWithSymbol(row.commitmentMinor, baseCurrency, currencySymbol)}
                        {locale === "en" ? "/month" : "/mes"} · {progressPct}%
                        {locale === "en" ? " completed" : " completado"}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.rowValue, { color: "#4ade80" }]}>
                    {formatMoneyWithSymbol(actualMinor, baseCurrency, currencySymbol)}
                  </Text>
                </View>
              );
            })}
            <View style={styles.distRow}>
              <View style={styles.distRowLeft}>
                <View style={styles.distHuchaIcon}>
                  <Text style={styles.distProjectIconText}>🐷</Text>
                </View>
                <View style={styles.distRowCopy}>
                  <Text style={[styles.rowLabel, { color: userTokens.textPrimary }]}>Hucha</Text>
                  <Text style={[styles.rowMeta, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "Monthly surplus" : "Excedente del mes"}
                  </Text>
                </View>
              </View>
              <Text style={[styles.rowValue, { color: "#fb923c" }]}>
                {formatMoneyWithSymbol(distribution.huchaMinor, baseCurrency, currencySymbol)}
              </Text>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "Your progress" : "Tu progreso"}
            </Text>
            <View style={styles.historyGrid}>
              <View style={[styles.historyCard, { backgroundColor: userTokens.surfaceAlt }]}>
                <Text style={[styles.historyLabel, { color: userTokens.textSecondary }]}>
                  {locale === "en" ? "🏆 Months completed" : "🏆 Meses cumplidos"}
                </Text>
                <Text style={[styles.historyValueGreen, { color: "#4ade80" }]}>
                  {historyStats.achievedMonths} {locale === "en" ? "of" : "de"}{" "}
                  {historyStats.totalMonths}
                </Text>
              </View>
              <View style={[styles.historyCard, { backgroundColor: userTokens.surfaceAlt }]}>
                <Text style={[styles.historyLabel, { color: userTokens.textSecondary }]}>
                  {locale === "en" ? "📈 Current streak" : "📈 Racha actual"}
                </Text>
                <Text style={[styles.historyValue, { color: userTokens.textPrimary }]}>
                  {historyStats.currentStreak} {locale === "en" ? "months" : "meses"}
                </Text>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "Last 6 months evolution" : "Evolución últimos 6 meses"}
            </Text>
            <View style={styles.chartWrap}>
              {distribution.objectiveMinor > 0n ? (
                <View
                  style={[
                    styles.chartGoalLine,
                    {
                      bottom: `${goalLinePercent}%`,
                      borderTopColor: userTokens.textSecondary,
                    },
                  ]}
                >
                  <Text style={[styles.chartGoalLabel, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "Goal" : "Meta"}{" "}
                    {formatMoneyWithSymbol(distribution.objectiveMinor, baseCurrency, currencySymbol)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.chartBarsRow}>
                {evolutionRows.map((row) => {
                  const positiveAmount = row.amountMinor > 0n ? row.amountMinor : 0n;
                  const heightPx = Math.max(
                    positiveAmount > 0n ? 10 : chartBarMinHeightPx,
                    (Number(positiveAmount) / Number(chartScaleMinor)) * chartBarMaxHeightPx
                  );
                  return (
                    <View key={row.period} style={styles.chartGroup}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: Math.min(chartBarMaxHeightPx, heightPx),
                            backgroundColor: row.achieved ? "#4ade80" : "#fb923c",
                            borderColor: row.isCurrent ? "rgba(74, 222, 128, 0.35)" : "transparent",
                          },
                        ]}
                      />
                      <Text style={[styles.chartMonthLabel, { color: userTokens.textSecondary }]}>
                        {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
                          month: "short",
                        })
                          .format(new Date(`${row.period}-01T00:00:00`))
                          .replace(".", "")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "⚡ This month vs your average" : "⚡ Este mes vs tu media"}
            </Text>
            <View style={styles.compRow}>
              <Text style={[styles.compLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Savings" : "Ahorro"}
              </Text>
              <Text style={[styles.compValue, { color: comparison.savingsDiffMinor >= 0n ? "#4ade80" : "#fb923c" }]}>
                {formatSignedMoney(comparison.savingsDiffMinor, baseCurrency, currencySymbol)}
              </Text>
            </View>
            <View style={styles.compRow}>
              <Text style={[styles.compLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Speed" : "Velocidad"}
              </Text>
              <Text style={[styles.compValue, { color: comparison.velocityPositive ? "#4ade80" : "#fb923c" }]}>
                {comparison.velocityLabel}
              </Text>
            </View>
            <View style={[styles.compRow, styles.compLastRow]}>
              <Text style={[styles.compLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Best month" : "Mejor mes"}
              </Text>
              <Text style={[styles.compValue, { color: userTokens.textPrimary }]}>
                {comparison.bestMonth
                  ? `${formatMonthLabel(comparison.bestMonth.period, locale === "en" ? "en-US" : "es-ES")} · ${formatMoneyWithSymbol(
                      comparison.bestMonth.amountMinor,
                      baseCurrency,
                      currencySymbol
                    )}`
                  : locale === "en"
                  ? "No data"
                  : "Sin datos"}
              </Text>
            </View>
          </Card>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    paddingBottom: 120,
  },
  heroAmount: {
    fontSize: 38,
    fontFamily: "JetBrainsMono-Medium",
  },
  meta: {
    marginTop: 4,
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  monthNav: {
    marginTop: tokens.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.md,
  },
  monthNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavBtnText: {
    fontSize: 16,
    fontFamily: "DMSans-SemiBold",
  },
  monthLabel: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  progressTrack: {
    height: 36,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  progressProjects: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#4ade80",
  },
  progressHucha: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(251, 146, 60, 0.85)",
  },
  progressMarker: {
    position: "absolute",
    top: -2,
    height: 40,
    width: 2,
  },
  progressLabels: {
    marginTop: tokens.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-SemiBold",
    marginBottom: tokens.spacing.xs,
  },
  distRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  distRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  distProjectIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  distHuchaIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(251, 146, 60, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  distProjectIconText: {
    fontSize: 16,
  },
  distRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  rowMeta: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  rowValue: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "JetBrainsMono-Medium",
  },
  historyGrid: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  historyCard: {
    flex: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.sm,
  },
  historyLabel: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  historyValue: {
    marginTop: 6,
    fontSize: 22,
    fontFamily: "DMSans-SemiBold",
  },
  historyValueGreen: {
    marginTop: 6,
    fontSize: 22,
    fontFamily: "DMSans-SemiBold",
  },
  chartWrap: {
    marginTop: tokens.spacing.sm,
    height: 140,
    position: "relative",
  },
  chartGoalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: "dashed",
  },
  chartGoalLabel: {
    position: "absolute",
    right: 0,
    top: -16,
    fontSize: 10,
    fontFamily: "DMSans-Regular",
  },
  chartBarsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  chartGroup: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  chartBar: {
    width: "100%",
    maxWidth: 26,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 2,
  },
  chartMonthLabel: {
    fontSize: 10,
    fontFamily: "DMSans-Regular",
  },
  compRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  compLastRow: {
    borderBottomWidth: 0,
  },
  compLabel: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  compValue: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-SemiBold",
    textAlign: "right",
    flexShrink: 1,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
});
