import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CURRENCIES,
  computeProjectProgress,
  formatMoneyWithSymbol,
  getMinorUnits,
  themeTokens,
  type Project,
  type ProjectContribution,
  type UserRole,
} from "@poleursus/shared";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";
import { Button } from "../../../../src/components/Button";
import { Card } from "../../../../src/components/Card";
import { ProjectAmountSlider } from "../../../../src/components/projects/ProjectAmountSlider";
import { ProjectProgressRing } from "../../../../src/components/projects/ProjectProgressRing";

type AccountRow = {
  id: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole; user_id: string }>;
};

type RecurringExpense = {
  id: string;
  merchant: string | null;
  notes: string | null;
  amount_minor: bigint | number | string;
  currency: string;
  is_paused: boolean;
  type: "expense" | "income";
};

type HistoryStatus = "fulfilled" | "deficit" | "no_plan" | "pending";

const tokens = themeTokens.light;

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.round(value));
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const formatDuration = (
  months: number,
  dictionary: ReturnType<typeof import("@poleursus/shared").getDictionary>
) => {
  if (months <= 0) return t(dictionary, "projects.simulator.reached");
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years > 0 && remainingMonths > 0) {
    return t(dictionary, "projects.simulator.durationYearMonth", {
      years,
      months: remainingMonths,
    });
  }
  if (years > 0) {
    return t(dictionary, "projects.simulator.durationYears", { years });
  }
  return t(dictionary, "projects.simulator.durationMonths", {
    months: remainingMonths,
  });
};

const formatDateMonth = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);

const formatPeriodLabel = (period: string, locale: string) => {
  const monthDate = new Date(`${period.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(monthDate.getTime())) return period;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(monthDate);
};

const formatDateLabel = (value: string | null | undefined, locale: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const {
    tokens: userTokens,
    primaryActionColor,
    primaryActionTextColor,
  } = useUserTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [contributions, setContributions] = useState<ProjectContribution[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [userLabels, setUserLabels] = useState<Record<string, string>>({});
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");

  const [activeTab, setActiveTab] = useState<"simulator" | "history">("simulator");
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);
  const [disabledRecurringIds, setDisabledRecurringIds] = useState<Set<string>>(
    new Set()
  );
  const [sliderMinor, setSliderMinor] = useState(0);
  const [sliderTrackWidth, setSliderTrackWidth] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId || !projectId) {
      setLoading(false);
      setError(t(dictionary, "errors.invalidRequest"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("id, base_currency, account_members!inner(role, user_id)")
        .eq("id", selectedAccountId)
        .eq("account_members.user_id", user.id)
        .maybeSingle();

      if (accountError || !account) {
        throw accountError ?? new Error("account-not-found");
      }

      const accountRow = account as AccountRow;
      const currentRole = accountRow.account_members?.[0]?.role ?? "viewer";
      const currentCurrency = accountRow.base_currency;
      const currentCurrencySymbol =
        CURRENCIES.find((item) => item.code === currentCurrency)?.symbol ??
        currentCurrency;

      const { data: projectRow, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("account_id", selectedAccountId)
        .maybeSingle();

      if (projectError || !projectRow) {
        throw projectError ?? new Error("project-not-found");
      }

      const { data: contributionRows, error: contributionsError } = await supabase
        .from("project_contributions")
        .select("*")
        .eq("project_id", projectId)
        .order("period", { ascending: false })
        .order("created_at", { ascending: false });

      if (contributionsError) throw contributionsError;

      const { data: recurringRows, error: recurringError } = await supabase
        .from("recurring_items")
        .select("id, merchant, notes, amount_minor, currency, is_paused, type")
        .eq("account_id", selectedAccountId)
        .eq("type", "expense")
        .eq("currency", currentCurrency)
        .eq("is_paused", false)
        .order("amount_minor", { ascending: false });

      if (recurringError) throw recurringError;

      const userIds = Array.from(
        new Set(
          ((contributionRows ?? []) as ProjectContribution[])
            .map((entry) => entry.user_id)
            .filter(Boolean)
        )
      ) as string[];

      const { data: profiles, error: profilesError } =
        userIds.length > 0
          ? await supabase
              .from("profiles")
              .select("user_id, display_name, email")
              .in("user_id", userIds)
          : { data: [], error: null };

      if (profilesError) throw profilesError;

      const labels = (profiles ?? []).reduce<Record<string, string>>((acc, profile) => {
        acc[profile.user_id] =
          profile.display_name?.trim() ||
          profile.email?.trim() ||
          profile.user_id.slice(0, 8);
        return acc;
      }, {});

      const nextProject = projectRow as Project;
      setProject(nextProject);
      setContributions((contributionRows ?? []) as ProjectContribution[]);
      setRecurringExpenses((recurringRows ?? []) as RecurringExpense[]);
      setUserLabels(labels);
      setRole(currentRole);
      setBaseCurrency(currentCurrency);
      setCurrencySymbol(currentCurrencySymbol);
      setSliderMinor(Number(toMinor(nextProject.monthly_commitment_base_minor ?? 0)));
      setDisabledRecurringIds(new Set());
    } catch (loadError) {
      console.error("[Projects][mobile] detail load error", loadError);
      setError(t(dictionary, "errors.internalServer"));
    } finally {
      setLoading(false);
    }
  }, [dictionary, projectId, selectedAccountId, user]);

  useEffect(() => {
    if (isFocused) {
      void loadData();
    }
  }, [isFocused, loadData]);

  const canEdit = role !== "viewer";
  const minorUnits = getMinorUnits(baseCurrency);
  const minorFactor = 10 ** minorUnits;
  const sliderStep = Math.max(1, 25 * minorFactor);

  const sortedRecurringExpenses = useMemo(
    () =>
      [...recurringExpenses]
        .filter((item) => item.type === "expense" && !item.is_paused)
        .sort((a, b) => Number(toMinor(b.amount_minor) - toMinor(a.amount_minor))),
    [recurringExpenses]
  );

  const releasedFromRecurringMinor = useMemo(() => {
    let total = 0n;
    sortedRecurringExpenses.forEach((expense) => {
      if (disabledRecurringIds.has(expense.id)) {
        total += toMinor(expense.amount_minor);
      }
    });
    return total;
  }, [disabledRecurringIds, sortedRecurringExpenses]);

  const effectiveMonthlyMinor = useMemo(
    () => BigInt(Math.max(sliderMinor, 0)) + releasedFromRecurringMinor,
    [releasedFromRecurringMinor, sliderMinor]
  );

  const heroProgress = useMemo(() => {
    if (!project) return null;
    return computeProjectProgress({ project, contributions });
  }, [contributions, project]);

  const simulatorProgress = useMemo(() => {
    if (!project) return null;
    return computeProjectProgress({
      project: { ...project, monthly_commitment_base_minor: effectiveMonthlyMinor },
      contributions,
    });
  }, [contributions, effectiveMonthlyMinor, project]);

  const sliderMax = useMemo(() => {
    if (!project) return sliderStep;
    const targetMinor = Number(toMinor(project.target_amount_base_minor));
    const currentMinor = Number(toMinor(project.monthly_commitment_base_minor ?? 0));
    const base = 1500 * minorFactor;
    return Math.max(base, targetMinor, currentMinor + 500 * minorFactor, sliderStep);
  }, [minorFactor, project, sliderStep]);

  const historyRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        periodKey: string;
        committedMinor: bigint;
        actualMinor: bigint;
        confirmed: boolean;
        confirmedAt: string | null;
        userId: string | null;
      }
    >();

    contributions.forEach((entry) => {
      const rawPeriod = typeof entry.period === "string" ? entry.period : String(entry.period);
      const periodKey = rawPeriod.slice(0, 10);
      const current = grouped.get(periodKey) ?? {
        periodKey,
        committedMinor: 0n,
        actualMinor: 0n,
        confirmed: false,
        confirmedAt: null,
        userId: null,
      };
      const confirmedAt = typeof entry.confirmed_at === "string" ? entry.confirmed_at : null;

      grouped.set(periodKey, {
        periodKey,
        committedMinor: current.committedMinor + toMinor(entry.committed_amount_base_minor ?? 0),
        actualMinor: current.actualMinor + toMinor(entry.actual_amount_base_minor),
        confirmed: current.confirmed || Boolean(entry.confirmed),
        confirmedAt: confirmedAt ?? current.confirmedAt,
        userId: entry.user_id ?? current.userId,
      });
    });

    const chronological = Array.from(grouped.values()).sort((a, b) =>
      a.periodKey < b.periodKey ? -1 : a.periodKey > b.periodKey ? 1 : 0
    );

    let cumulativeMinor = 0n;
    const withCumulative = chronological.map((row) => {
      cumulativeMinor += row.actualMinor;
      return { ...row, cumulativeMinor };
    });

    return withCumulative.reverse();
  }, [contributions]);

  const createdAtLabel = useMemo(() => {
    if (!project?.created_at) return null;
    const date =
      project.created_at instanceof Date ? project.created_at : new Date(project.created_at);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  }, [locale, project?.created_at]);

  const toggleRecurringExpense = (id: string) => {
    setDisabledRecurringIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSetCommitment = async () => {
    if (!canEdit || !project || !selectedAccountId || isSaving) return;

    if (effectiveMonthlyMinor <= 0n) {
      setSaveError(t(dictionary, "projects.validation.commitmentRequired"));
      setSaveMessage(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const { data, error: updateError } = await supabase
        .from("projects")
        .update({
          monthly_commitment_base_minor: String(effectiveMonthlyMinor),
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id)
        .eq("account_id", selectedAccountId)
        .select("*")
        .single();

      if (updateError) throw updateError;

      setProject(data as Project);
      setSliderMinor(Number(effectiveMonthlyMinor));
      setDisabledRecurringIds(new Set());
      setSaveMessage(
        t(dictionary, "projects.simulator.saved", {
          amount: formatMoneyWithSymbol(effectiveMonthlyMinor, baseCurrency, currencySymbol),
        })
      );
    } catch (updateError) {
      console.error("[Projects][mobile] commitment update error", updateError);
      setSaveError(t(dictionary, "errors.internalServer"));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "navigation.projects") }} />
        <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
          <ActivityIndicator size="large" color={primaryActionColor} />
        </View>
      </>
    );
  }

  if (!project || !heroProgress || !simulatorProgress) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "navigation.projects") }} />
        <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
          <View style={styles.container}>
            <Card title={t(dictionary, "common.errorTitle")} description={error ?? undefined}>
              <Button onPress={() => void loadData()} title={t(dictionary, "common.retry")} />
            </Card>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: project.name }} />
      <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: tokens.spacing.xxl + insets.bottom + 64 },
          ]}
        >
          <Card>
            <View style={styles.projectHeader}>
              <View style={styles.projectHeaderMain}>
                <Text style={styles.projectEmoji}>{project.emoji || "\u{1F3AF}"}</Text>
                <View style={styles.projectHeaderText}>
                  <Text style={[styles.projectName, { color: userTokens.textPrimary }]}>
                    {project.name}
                  </Text>
                  {createdAtLabel ? (
                    <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                      {t(dictionary, "projects.createdAt", { date: createdAtLabel })}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.priorityBlock}>
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.priority")}
                </Text>
                <Text style={[styles.priorityValue, { color: userTokens.textPrimary }]}>
                  #{project.priority}
                </Text>
              </View>
            </View>

            <View style={styles.heroRow}>
              <ProjectProgressRing
                progress={heroProgress.progressRatio}
                size={148}
                strokeWidth={10}
                trackColor={userTokens.surfaceAlt}
                progressColor={primaryActionColor}
                center={
                  <View>
                    <Text style={[styles.heroPercent, { color: userTokens.textPrimary }]}>
                      {Math.round(heroProgress.progressRatio * 100)}%
                    </Text>
                  </View>
                }
              />
              <View style={styles.heroNumbers}>
                <View>
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "projects.target")}
                  </Text>
                  <Text style={[styles.amountValue, { color: userTokens.textPrimary }]}>
                    {formatMoneyWithSymbol(heroProgress.targetMinor, baseCurrency, currencySymbol)}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "projects.saved")}
                  </Text>
                  <Text style={[styles.amountValue, { color: userTokens.textPrimary }]}>
                    {formatMoneyWithSymbol(heroProgress.savedMinor, baseCurrency, currencySymbol)}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "projects.remaining")}
                  </Text>
                  <Text style={[styles.amountValue, { color: userTokens.textPrimary }]}>
                    {formatMoneyWithSymbol(heroProgress.remainingMinor, baseCurrency, currencySymbol)}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.commitmentCard,
                { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
              ]}
            >
              <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.currentCommitment")}
              </Text>
              <Text style={[styles.commitmentValue, { color: userTokens.textPrimary }]}>
                {heroProgress.commitmentMinor > 0n
                  ? `${formatMoneyWithSymbol(heroProgress.commitmentMinor, baseCurrency, currencySymbol)} ${t(dictionary, "projects.perMonth")}`
                  : t(dictionary, "projects.noPlan")}
              </Text>
              {heroProgress.monthsLeft !== null && heroProgress.estimatedCompletionDate ? (
                <Text style={[styles.commitmentEta, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.simulator.estimatedDate", {
                    duration: formatDuration(heroProgress.monthsLeft, dictionary),
                    date: formatDateMonth(heroProgress.estimatedCompletionDate, locale),
                  })}
                </Text>
              ) : null}
            </View>
          </Card>

          <View style={[styles.tabs, { borderColor: userTokens.border }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "simulator" && { backgroundColor: primaryActionColor },
              ]}
              onPress={() => setActiveTab("simulator")}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === "simulator"
                        ? primaryActionTextColor
                        : userTokens.textSecondary,
                  },
                ]}
              >
                {t(dictionary, "projects.simulator.tab")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "history" && { backgroundColor: primaryActionColor },
              ]}
              onPress={() => setActiveTab("history")}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === "history"
                        ? primaryActionTextColor
                        : userTokens.textSecondary,
                  },
                ]}
              >
                {t(dictionary, "projects.history.tab")}
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === "simulator" ? (
            <Card>
              <View style={styles.sliderHeader}>
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.simulator.sliderLabel")}
                </Text>
                <Text style={[styles.sliderAmount, { color: userTokens.textPrimary }]}>
                  {formatMoneyWithSymbol(BigInt(sliderMinor), baseCurrency, currencySymbol)}
                  <Text style={[styles.sliderSuffix, { color: userTokens.textSecondary }]}>
                    {" "}
                    {t(dictionary, "projects.perMonth")}
                  </Text>
                </Text>
              </View>

              <ProjectAmountSlider
                min={0}
                max={sliderMax}
                step={sliderStep}
                value={sliderMinor}
                onChange={setSliderMinor}
                trackColor={userTokens.border}
                fillColor={primaryActionColor}
                thumbColor={primaryActionColor}
                trackWidth={sliderTrackWidth}
                onTrackLayout={setSliderTrackWidth}
              />
              <Text style={[styles.sliderHint, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.simulator.sliderHint")}
              </Text>

              <View
                style={[
                  styles.effectiveCard,
                  { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
                ]}
              >
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.simulator.effectiveSaving")}
                </Text>
                <Text style={[styles.effectiveValue, { color: userTokens.textPrimary }]}>
                  {formatMoneyWithSymbol(effectiveMonthlyMinor, baseCurrency, currencySymbol)}
                  <Text style={[styles.sliderSuffix, { color: userTokens.textSecondary }]}>
                    {" "}
                    {t(dictionary, "projects.perMonth")}
                  </Text>
                </Text>
                {simulatorProgress.monthsLeft !== null &&
                simulatorProgress.estimatedCompletionDate ? (
                  <Text style={[styles.commitmentEta, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "projects.simulator.estimatedDate", {
                      duration: formatDuration(simulatorProgress.monthsLeft, dictionary),
                      date: formatDateMonth(simulatorProgress.estimatedCompletionDate, locale),
                    })}
                  </Text>
                ) : (
                  <Text style={[styles.commitmentEta, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "projects.noPlan")}
                  </Text>
                )}
              </View>

              <View style={[styles.expensesCard, { borderColor: userTokens.border }]}>
                <TouchableOpacity
                  style={styles.expensesToggle}
                  onPress={() => setIsExpensesOpen((previous) => !previous)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.expensesTitle, { color: userTokens.textPrimary }]}>
                    {t(dictionary, "projects.simulator.cutExpensesTitle")}
                  </Text>
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {isExpensesOpen
                      ? t(dictionary, "projects.simulator.collapse")
                      : t(dictionary, "projects.simulator.expand")}
                  </Text>
                </TouchableOpacity>

                {isExpensesOpen ? (
                  sortedRecurringExpenses.length > 0 ? (
                    <View style={styles.expensesList}>
                      {sortedRecurringExpenses.map((expense) => {
                        const disabled = disabledRecurringIds.has(expense.id);
                        const label =
                          expense.merchant?.trim() ||
                          expense.notes?.trim() ||
                          t(dictionary, "projects.simulator.unnamedExpense");

                        return (
                          <View
                            key={expense.id}
                            style={[
                              styles.expenseRow,
                              { borderBottomColor: userTokens.border },
                            ]}
                          >
                            <View style={styles.expenseCopy}>
                              <Text
                                style={[styles.expenseLabel, { color: userTokens.textPrimary }]}
                              >
                                {label}
                              </Text>
                              <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                                {formatMoneyWithSymbol(
                                  toMinor(expense.amount_minor),
                                  baseCurrency,
                                  currencySymbol
                                )}{" "}
                                {t(dictionary, "projects.perMonth")}
                              </Text>
                            </View>
                            <Switch
                              value={disabled}
                              onValueChange={() => toggleRecurringExpense(expense.id)}
                            />
                          </View>
                        );
                      })}
                      <View
                        style={[
                          styles.releasedChip,
                          { backgroundColor: userTokens.surfaceAlt },
                        ]}
                      >
                        <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                          {t(dictionary, "projects.simulator.releasedFromExpenses")}{" "}
                          <Text style={[styles.releasedValue, { color: userTokens.textPrimary }]}>
                            {formatMoneyWithSymbol(
                              releasedFromRecurringMinor,
                              baseCurrency,
                              currencySymbol
                            )}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                      {t(dictionary, "projects.simulator.noRecurringExpenses")}
                    </Text>
                  )
                ) : null}
              </View>

              {saveError ? (
                <Text style={[styles.feedbackError]}>{saveError}</Text>
              ) : null}
              {saveMessage ? (
                <Text style={[styles.feedbackSuccess]}>{saveMessage}</Text>
              ) : null}

              <Button
                title={
                  isSaving
                    ? t(dictionary, "projects.simulator.saving")
                    : t(dictionary, "projects.simulator.setCommitment", {
                        amount: formatMoneyWithSymbol(
                          effectiveMonthlyMinor,
                          baseCurrency,
                          currencySymbol
                        ),
                      })
                }
                onPress={handleSetCommitment}
                loading={isSaving}
                disabled={!canEdit || isSaving || effectiveMonthlyMinor <= 0n}
              />
            </Card>
          ) : (
            <Card>
              {historyRows.length === 0 ? (
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.history.empty")}
                </Text>
              ) : (
                <View style={styles.historyList}>
                  {historyRows.map((entry) => {
                    const committedMinor = entry.committedMinor;
                    const actualMinor = entry.actualMinor;

                    let status: HistoryStatus = "pending";
                    if (!entry.confirmed) {
                      status = "pending";
                    } else if (committedMinor > 0n && actualMinor >= committedMinor) {
                      status = "fulfilled";
                    } else if (committedMinor > 0n) {
                      status = "deficit";
                    } else {
                      status = "no_plan";
                    }

                    const statusCopy =
                      status === "pending"
                        ? t(dictionary, "projects.history.statusPending")
                        : status === "fulfilled"
                        ? t(dictionary, "projects.history.statusFulfilled")
                        : status === "deficit"
                        ? t(dictionary, "projects.history.statusDeficit")
                        : t(dictionary, "projects.history.statusNoPlan");

                    const statusColor =
                      status === "fulfilled"
                        ? "#059669"
                        : status === "deficit"
                        ? "#D97706"
                        : status === "pending"
                        ? primaryActionColor
                        : userTokens.textSecondary;

                    const contributorLabel = entry.userId
                      ? userLabels[entry.userId] ?? entry.userId.slice(0, 8)
                      : t(dictionary, "projects.history.unknownUser");

                    const confirmedDateLabel = formatDateLabel(entry.confirmedAt, locale);

                    const maxMinor =
                      committedMinor > actualMinor
                        ? committedMinor > 0n
                          ? committedMinor
                          : 1n
                        : actualMinor > 0n
                        ? actualMinor
                        : 1n;

                    const actualPercent = Math.min(
                      100,
                      Math.max(0, (Number(actualMinor) / Number(maxMinor)) * 100)
                    );
                    const commitmentPercent = Math.min(
                      100,
                      Math.max(0, (Number(committedMinor) / Number(maxMinor)) * 100)
                    );

                    return (
                      <View
                        key={entry.periodKey}
                        style={[
                          styles.historyCard,
                          { borderColor: userTokens.border, backgroundColor: userTokens.surface },
                        ]}
                      >
                        <View style={styles.historyHeader}>
                          <View style={styles.historyLeft}>
                            <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                              {formatPeriodLabel(entry.periodKey, locale)}
                            </Text>
                            <Text style={[styles.historyStatus, { color: statusColor }]}>
                              {statusCopy}
                            </Text>
                            <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                              {t(dictionary, "projects.history.contributor", {
                                name: contributorLabel,
                              })}
                            </Text>
                            {confirmedDateLabel ? (
                              <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                                {t(dictionary, "projects.history.confirmedAt", {
                                  date: confirmedDateLabel,
                                })}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.historyRight}>
                            <Text style={[styles.historyAmount, { color: userTokens.textPrimary }]}>
                              {t(dictionary, "projects.history.actual")}:{" "}
                              {formatMoneyWithSymbol(actualMinor, baseCurrency, currencySymbol)}
                            </Text>
                            <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                              {t(dictionary, "projects.history.committed")}:{" "}
                              {formatMoneyWithSymbol(
                                committedMinor,
                                baseCurrency,
                                currencySymbol
                              )}
                            </Text>
                            <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                              {t(dictionary, "projects.history.cumulative")}:{" "}
                              {formatMoneyWithSymbol(
                                entry.cumulativeMinor,
                                baseCurrency,
                                currencySymbol
                              )}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.historyBarWrap}>
                          <View
                            style={[styles.historyBarTrack, { backgroundColor: userTokens.border }]}
                          >
                            <View
                              style={[
                                styles.historyBarActual,
                                {
                                  backgroundColor: primaryActionColor,
                                  width: `${actualPercent}%`,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.historyBarCommitment,
                                {
                                  backgroundColor: userTokens.textPrimary,
                                  left: `${commitmentPercent}%`,
                                },
                              ]}
                            />
                          </View>
                          <View style={styles.historyBarLegend}>
                            <Text style={[styles.legendText, { color: userTokens.textSecondary }]}>
                              {t(dictionary, "projects.history.barActual")}
                            </Text>
                            <Text style={[styles.legendText, { color: userTokens.textSecondary }]}>
                              {t(dictionary, "projects.history.barCommitted")}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  projectHeaderMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  projectHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  projectEmoji: {
    fontSize: 36,
  },
  projectName: {
    fontSize: tokens.typography.size.xl,
    fontFamily: "DMSans-Bold",
  },
  metaText: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  priorityBlock: {
    alignItems: "flex-end",
  },
  priorityValue: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  heroRow: {
    marginTop: tokens.spacing.md,
    flexDirection: "row",
    gap: tokens.spacing.md,
    alignItems: "center",
  },
  heroPercent: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  heroNumbers: {
    flex: 1,
    gap: tokens.spacing.sm,
  },
  amountValue: {
    marginTop: 2,
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  commitmentCard: {
    marginTop: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    padding: tokens.spacing.sm,
  },
  commitmentValue: {
    marginTop: 2,
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-SemiBold",
  },
  commitmentEta: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: 3,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radii.md,
    paddingVertical: 9,
  },
  tabText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-SemiBold",
  },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  sliderAmount: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  sliderSuffix: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  sliderHint: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
    marginBottom: tokens.spacing.sm,
  },
  effectiveCard: {
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  effectiveValue: {
    fontSize: tokens.typography.size.xl,
    fontFamily: "DMSans-Bold",
  },
  expensesCard: {
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  expensesToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expensesTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-SemiBold",
  },
  expensesList: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    borderBottomWidth: 1,
    paddingBottom: tokens.spacing.sm,
  },
  expenseCopy: {
    flex: 1,
    minWidth: 0,
  },
  expenseLabel: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  releasedChip: {
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  releasedValue: {
    fontFamily: "DMSans-Bold",
  },
  feedbackError: {
    color: "#DC2626",
    fontSize: tokens.typography.size.sm,
    marginBottom: tokens.spacing.xs,
    fontFamily: "DMSans-Medium",
  },
  feedbackSuccess: {
    color: "#059669",
    fontSize: tokens.typography.size.sm,
    marginBottom: tokens.spacing.xs,
    fontFamily: "DMSans-Medium",
  },
  historyList: {
    gap: tokens.spacing.sm,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  historyLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  historyStatus: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-SemiBold",
  },
  historyRight: {
    alignItems: "flex-end",
    maxWidth: "52%",
    gap: 2,
  },
  historyAmount: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-SemiBold",
    textAlign: "right",
  },
  historyBarWrap: {
    gap: 4,
  },
  historyBarTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
  },
  historyBarActual: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  historyBarCommitment: {
    position: "absolute",
    top: 0,
    width: 2,
    height: 8,
    marginLeft: -1,
  },
  historyBarLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendText: {
    fontSize: 11,
    fontFamily: "DMSans-Regular",
  },
});
