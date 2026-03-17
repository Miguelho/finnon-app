import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildProjectColorMap,
  computeProjectProgress,
  CURRENCIES,
  formatMoneyWithSymbol,
  getProjectColor,
  getProjectMonthlyFundingTargetMinor,
  getProjectReserveTransferDeltaMinor,
  PROJECT_PALETTE,
  themeTokens,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Project,
  type ReserveTransfer,
  type UserRole,
} from "@poleursus/shared";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";
import { Card } from "../../../../src/components/Card";
import { ProjectProgressRing } from "../../../../src/components/projects/ProjectProgressRing";

const tokens = themeTokens.light;

type AccountRow = {
  id: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole; user_id: string }>;
};

type SpendingTransaction = {
  id: string;
  date: string;
  merchant: string | null;
  notes: string | null;
  amount_base_minor: bigint | number | string | null;
};

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

const formatDuration = (months: number, locale: "es" | "en") => {
  if (months <= 0) return locale === "en" ? "Reached" : "Alcanzado";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years > 0 && remainingMonths > 0) {
    return locale === "en"
      ? `${years}y ${remainingMonths}m`
      : `${years}a ${remainingMonths}m`;
  }
  if (years > 0) return locale === "en" ? `${years}y` : `${years}a`;
  return `${remainingMonths}m`;
};

const formatDateLabel = (value: string | Date | null | undefined, locale: "es" | "en") => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatMonthLabel = (period: string, locale: "es" | "en") => {
  const date = new Date(`${period}T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
};

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const insets = useSafeAreaInsets();
  const localeCode: "es" | "en" = locale === "en" ? "en" : "es";
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const currentMonthStart = `${currentMonthKey}-01`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [accountProjectsForColor, setAccountProjectsForColor] = useState<
    Array<{ id: string; color?: string | null; created_at?: string | Date | null }>
  >([]);
  const [monthCloses, setMonthCloses] = useState<MonthClose[]>([]);
  const [monthCloseAllocations, setMonthCloseAllocations] = useState<MonthCloseAllocation[]>([]);
  const [reserveTransfers, setReserveTransfers] = useState<ReserveTransfer[]>([]);
  const [fundingPlans, setFundingPlans] = useState<MonthlyProjectFundingPlan[]>([]);
  const [spendingTransactions, setSpendingTransactions] = useState<SpendingTransaction[]>([]);
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [isSpendingOpen, setIsSpendingOpen] = useState(true);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isSavingColor, setIsSavingColor] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);
  const [colorMessage, setColorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId || !projectId) {
      setLoading(false);
      setError(t(dictionary, "errors.invalidRequest"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        accountResult,
        projectResult,
        projectColorsResult,
        monthClosesResult,
        monthCloseAllocationsResult,
        reserveTransfersResult,
        fundingPlansResult,
        spendingTransactionsResult,
      ] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, base_currency, account_members!inner(role, user_id)")
          .eq("id", selectedAccountId)
          .eq("account_members.user_id", user.id)
          .maybeSingle(),
        supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .eq("account_id", selectedAccountId)
          .maybeSingle(),
        supabase
          .from("projects")
          .select("id, color, created_at")
          .eq("account_id", selectedAccountId)
          .not("target_amount_base_minor", "is", null),
        supabase
          .from("month_closes")
          .select("*")
          .eq("account_id", selectedAccountId)
          .order("period", { ascending: false }),
        supabase
          .from("month_close_allocations")
          .select("*")
          .eq("account_id", selectedAccountId)
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("reserve_transfers")
          .select("*")
          .eq("account_id", selectedAccountId)
          .eq("destination_project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("monthly_project_funding_plans")
          .select("*")
          .eq("account_id", selectedAccountId)
          .eq("period", currentMonthStart)
          .eq("project_id", projectId),
        supabase
          .from("transactions")
          .select("id, date, merchant, notes, amount_base_minor")
          .eq("account_id", selectedAccountId)
          .eq("type", "expense")
          .eq("project_id", projectId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (accountResult.error || !accountResult.data) {
        throw accountResult.error ?? new Error("account-not-found");
      }
      if (projectResult.error || !projectResult.data) {
        throw projectResult.error ?? new Error("project-not-found");
      }
      if (projectColorsResult.error) throw projectColorsResult.error;
      if (monthClosesResult.error) throw monthClosesResult.error;
      if (monthCloseAllocationsResult.error) throw monthCloseAllocationsResult.error;
      if (reserveTransfersResult.error) throw reserveTransfersResult.error;
      if (fundingPlansResult.error) throw fundingPlansResult.error;
      if (spendingTransactionsResult.error) throw spendingTransactionsResult.error;

      const account = accountResult.data as AccountRow;
      const accountCurrency = account.base_currency;
      const symbol =
        CURRENCIES.find((item) => item.code === accountCurrency)?.symbol ?? accountCurrency;
      const nextProject = projectResult.data as Project;

      setProject(nextProject);
      setAccountProjectsForColor(
        (projectColorsResult.data as Array<{
          id: string;
          color?: string | null;
          created_at?: string | Date | null;
        }>) ?? []
      );
      setMonthCloses((monthClosesResult.data as MonthClose[]) ?? []);
      setMonthCloseAllocations((monthCloseAllocationsResult.data as MonthCloseAllocation[]) ?? []);
      setReserveTransfers((reserveTransfersResult.data as ReserveTransfer[]) ?? []);
      setFundingPlans((fundingPlansResult.data as MonthlyProjectFundingPlan[]) ?? []);
      setSpendingTransactions((spendingTransactionsResult.data as SpendingTransaction[]) ?? []);
      setRole(account.account_members?.[0]?.role ?? "viewer");
      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setColorError(null);
      setColorMessage(null);
    } catch (loadError) {
      console.error("[Projects][mobile] detail load error", loadError);
      setError(t(dictionary, "errors.internalServer"));
    } finally {
      setLoading(false);
    }
  }, [currentMonthStart, dictionary, projectId, selectedAccountId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canEdit = role !== "viewer";

  const projectColorMap = useMemo(() => {
    if (!project) return new Map<string, string>();
    const hasCurrentProject = accountProjectsForColor.some((entry) => entry.id === project.id);
    const projectsForColor = hasCurrentProject
      ? accountProjectsForColor.map((entry) =>
          entry.id === project.id ? { ...entry, color: project.color } : entry
        )
      : [
          ...accountProjectsForColor,
          {
            id: project.id,
            color: project.color,
            created_at: project.created_at,
          },
        ];

    return buildProjectColorMap(projectsForColor);
  }, [accountProjectsForColor, project]);

  const resolvedProjectColor = useMemo(() => {
    if (!project) return PROJECT_PALETTE[0];
    return getProjectColor(project, projectColorMap);
  }, [project, projectColorMap]);

  const monthClosesById = useMemo(
    () => new Map<string, MonthClose>(monthCloses.map((monthClose) => [monthClose.id, monthClose])),
    [monthCloses]
  );

  const fundingFromMonthClosesMinor = useMemo(
    () =>
      monthCloseAllocations.reduce(
        (total, entry) => total + toMinor(entry.amount_base_minor),
        0n
      ),
    [monthCloseAllocations]
  );

  const fundingFromReservesMinor = useMemo(
    () =>
      reserveTransfers.reduce(
        (total, entry) => total + getProjectReserveTransferDeltaMinor(entry),
        0n
      ),
    [reserveTransfers]
  );

  const plannedThisMonthMinor = useMemo(
    () =>
      fundingPlans.reduce(
        (total, entry) => total + toMinor(entry.planned_amount_base_minor),
        0n
      ),
    [fundingPlans]
  );

  const spentMinor = useMemo(
    () =>
      spendingTransactions.reduce(
        (total, entry) => total + toMinor(entry.amount_base_minor),
        0n
      ),
    [spendingTransactions]
  );

  const totalFundedMinor = useMemo(
    () => fundingFromMonthClosesMinor + fundingFromReservesMinor,
    [fundingFromMonthClosesMinor, fundingFromReservesMinor]
  );

  const heroProgress = useMemo(() => {
    if (!project) return null;
    return computeProjectProgress({
      project,
      fundedMinor: totalFundedMinor,
      reserveTransferredMinor: fundingFromReservesMinor,
      plannedThisMonthMinor,
      spentMinor,
    });
  }, [fundingFromReservesMinor, plannedThisMonthMinor, project, spentMinor, totalFundedMinor]);

  const historyRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        periodKey: string;
        actualMinor: bigint;
        confirmedAt: string | null;
      }
    >();

    monthCloseAllocations.forEach((entry) => {
      const monthClose = monthClosesById.get(entry.month_close_id);
      const periodKey = String(monthClose?.period ?? entry.created_at ?? "").slice(0, 7);
      if (!periodKey) return;

      const current = grouped.get(periodKey) ?? {
        periodKey,
        actualMinor: 0n,
        confirmedAt: null,
      };

      grouped.set(periodKey, {
        periodKey,
        actualMinor: current.actualMinor + toMinor(entry.amount_base_minor),
        confirmedAt:
          (typeof monthClose?.closed_at === "string" ? monthClose.closed_at : null) ??
          (typeof entry.created_at === "string" ? entry.created_at : null) ??
          current.confirmedAt,
      });
    });

    const chronological = Array.from(grouped.values()).sort((a, b) =>
      a.periodKey < b.periodKey ? -1 : a.periodKey > b.periodKey ? 1 : 0
    );

    let cumulativeMinor = 0n;
    return chronological
      .map((row) => {
        cumulativeMinor += row.actualMinor;
        return {
          ...row,
          cumulativeMinor,
        };
      })
      .reverse();
  }, [monthCloseAllocations, monthClosesById]);

  const createdAtLabel = useMemo(() => {
    if (!project?.created_at) return null;
    const date = project.created_at instanceof Date ? project.created_at : new Date(project.created_at);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(localeCode === "en" ? "en-US" : "es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  }, [localeCode, project?.created_at]);

  const estimatedFinishLabel = useMemo(() => {
    if (!heroProgress) return null;
    if (heroProgress.monthsLeft === null || !heroProgress.estimatedCompletionDate) {
      return t(dictionary, "projects.noPlan");
    }

    return t(dictionary, "projects.simulator.estimatedDate", {
      duration: formatDuration(heroProgress.monthsLeft, localeCode),
      date: new Intl.DateTimeFormat(localeCode === "en" ? "en-US" : "es-ES", {
        month: "long",
        year: "numeric",
      }).format(heroProgress.estimatedCompletionDate),
    });
  }, [dictionary, heroProgress, localeCode]);

  const handleSetProjectColor = async (color: string) => {
    if (!canEdit || !project || !selectedAccountId || isSavingColor) return;
    if (resolvedProjectColor === color && project.color) {
      setIsColorPickerOpen(false);
      return;
    }

    setIsSavingColor(true);
    setColorError(null);
    setColorMessage(null);

    try {
      const { data, error: updateError } = await supabase
        .from("projects")
        .update({
          color,
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id)
        .eq("account_id", selectedAccountId)
        .select("*")
        .single();

      if (updateError) throw updateError;

      setProject(data as Project);
      setIsColorPickerOpen(false);
      setColorMessage(t(dictionary, "projects.colorSaved"));
    } catch (updateError) {
      console.error("[Projects][mobile] color update error", updateError);
      setColorError(
        localeCode === "en" ? "Couldn't save the color." : "No se pudo guardar el color."
      );
    } finally {
      setIsSavingColor(false);
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

  if (!project || !heroProgress) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "navigation.projects") }} />
        <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
          <View style={styles.container}>
            <Card title={t(dictionary, "common.errorTitle")} description={error ?? undefined}>
              <TouchableOpacity
                onPress={() => void loadData()}
                style={[styles.retryButton, { backgroundColor: primaryActionColor }]}
                activeOpacity={0.85}
              >
                <Text style={styles.retryButtonText}>{t(dictionary, "common.retry")}</Text>
              </TouchableOpacity>
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
            <View style={styles.heroSection}>
              <View style={styles.heroRingColumn}>
                <View style={styles.ringWrapper}>
                  <ProjectProgressRing
                    progress={heroProgress.progressRatio}
                    size={212}
                    strokeWidth={12}
                    trackColor={userTokens.surfaceAlt}
                    progressColor={resolvedProjectColor}
                    center={
                      <View style={styles.ringCenter}>
                        <Text style={styles.projectEmoji}>{project.emoji || "\u{1F3AF}"}</Text>
                        <Text style={[styles.heroPercent, { color: resolvedProjectColor }]}>
                          {Math.round(heroProgress.progressRatio * 100)}%
                        </Text>
                        {canEdit ? (
                          <TouchableOpacity
                            onPress={() => setIsColorPickerOpen((previous) => !previous)}
                            disabled={isSavingColor}
                            activeOpacity={0.85}
                            style={[
                              styles.colorTrigger,
                              {
                                backgroundColor: resolvedProjectColor,
                                borderColor: userTokens.surface,
                              },
                              isSavingColor && styles.colorTriggerDisabled,
                            ]}
                          >
                            <View style={styles.colorTriggerInner} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    }
                  />
                </View>

                {canEdit && isColorPickerOpen ? (
                  <View
                    style={[
                      styles.colorPalette,
                      { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
                    ]}
                  >
                    {PROJECT_PALETTE.map((color) => {
                      const isSelected = resolvedProjectColor === color;
                      return (
                        <TouchableOpacity
                          key={color}
                          onPress={() => void handleSetProjectColor(color)}
                          disabled={isSavingColor}
                          activeOpacity={0.85}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: color, borderColor: userTokens.border },
                            isSelected && styles.colorSwatchSelected,
                            isSavingColor && styles.colorSwatchDisabled,
                          ]}
                        >
                          {isSelected ? <View style={styles.colorSwatchInner} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <View style={styles.heroCopy}>
                <Text style={[styles.projectName, { color: userTokens.textPrimary }]}>
                  {project.name}
                </Text>
                {createdAtLabel ? (
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "projects.createdAt", { date: createdAtLabel })}
                  </Text>
                ) : null}
                <Text style={[styles.priorityText, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.priority")} #{project.priority}
                </Text>
              </View>
            </View>

            {colorError ? (
              <Text style={[styles.feedbackError, { color: "#E0956A" }]}>{colorError}</Text>
            ) : null}
            {colorMessage ? (
              <Text style={[styles.feedbackSuccess, { color: resolvedProjectColor }]}>
                {colorMessage}
              </Text>
            ) : null}

            <View style={styles.metricsGrid}>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
                ]}
              >
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.target")}
                </Text>
                <Text style={[styles.amountValue, { color: userTokens.textPrimary }]}>
                  {formatMoneyWithSymbol(heroProgress.targetMinor, baseCurrency, currencySymbol)}
                </Text>
              </View>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
                ]}
              >
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {localeCode === "en" ? "Funded" : "Financiado"}
                </Text>
                <Text style={[styles.amountValue, { color: userTokens.textPrimary }]}>
                  {formatMoneyWithSymbol(
                    heroProgress.fundedReservedMinor,
                    baseCurrency,
                    currencySymbol
                  )}
                </Text>
              </View>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
                ]}
              >
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {localeCode === "en" ? "Planned this month" : "Planificado este mes"}
                </Text>
                <Text style={[styles.amountValue, { color: userTokens.textPrimary }]}>
                  {formatMoneyWithSymbol(
                    heroProgress.plannedThisMonthMinor,
                    baseCurrency,
                    currencySymbol
                  )}
                </Text>
              </View>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
                ]}
              >
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {localeCode === "en" ? "Spent" : "Gastado"}
                </Text>
                <Text style={[styles.amountValue, { color: userTokens.textPrimary }]}>
                  {formatMoneyWithSymbol(heroProgress.spentMinor, baseCurrency, currencySymbol)}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.breakdownCard,
                { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
              ]}
            >
              <View style={styles.breakdownRow}>
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {localeCode === "en" ? "From month closes" : "Desde cierres"}
                </Text>
                <Text style={[styles.breakdownValue, { color: userTokens.textPrimary }]}>
                  {formatMoneyWithSymbol(
                    fundingFromMonthClosesMinor,
                    baseCurrency,
                    currencySymbol
                  )}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {localeCode === "en"
                    ? "From Own Funds transfers"
                    : "Desde transferencias de Fondos Propios"}
                </Text>
                <Text style={[styles.breakdownValue, { color: userTokens.textPrimary }]}>
                  {formatMoneyWithSymbol(
                    fundingFromReservesMinor,
                    baseCurrency,
                    currencySymbol
                  )}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.remaining")}
                </Text>
                <Text style={[styles.breakdownValue, { color: userTokens.textPrimary }]}>
                  {formatMoneyWithSymbol(heroProgress.remainingMinor, baseCurrency, currencySymbol)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {localeCode === "en" ? "Current monthly target" : "Objetivo mensual actual"}
                </Text>
                <Text style={[styles.breakdownValue, { color: userTokens.textPrimary }]}>
                  {getProjectMonthlyFundingTargetMinor(project) > 0n
                    ? `${formatMoneyWithSymbol(
                        getProjectMonthlyFundingTargetMinor(project),
                        baseCurrency,
                        currencySymbol
                      )} ${t(dictionary, "projects.perMonth")}`
                    : t(dictionary, "projects.noPlan")}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {localeCode === "en" ? "Estimated finish" : "Fin estimado"}
                </Text>
                <Text style={[styles.breakdownValue, { color: userTokens.textPrimary }]}>
                  {estimatedFinishLabel}
                </Text>
              </View>
            </View>

            <View style={[styles.extraTransactionsCard, { borderColor: userTokens.border }]}>
              <TouchableOpacity
                style={styles.expensesToggle}
                onPress={() => setIsSpendingOpen((previous) => !previous)}
                activeOpacity={0.8}
              >
                <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
                  {localeCode === "en" ? "Associated spending" : "Gasto asociado"}
                </Text>
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {isSpendingOpen
                    ? t(dictionary, "projects.simulator.collapse")
                    : t(dictionary, "projects.simulator.expand")}
                </Text>
              </TouchableOpacity>

              {isSpendingOpen ? (
                spendingTransactions.length > 0 ? (
                  <View style={styles.extraTransactionsList}>
                    {spendingTransactions.map((entry) => {
                      const label =
                        entry.merchant?.trim() ||
                        entry.notes?.trim() ||
                        (localeCode === "en" ? "Expense" : "Gasto");
                      const dateLabel = formatDateLabel(entry.date, localeCode) ?? entry.date;
                      return (
                        <View
                          key={entry.id}
                          style={[
                            styles.extraTransactionRow,
                            { borderColor: userTokens.border },
                          ]}
                        >
                          <View style={styles.expenseCopy}>
                            <Text
                              numberOfLines={1}
                              style={[styles.expenseLabel, { color: userTokens.textPrimary }]}
                            >
                              {label}
                            </Text>
                            <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                              {dateLabel}
                            </Text>
                          </View>
                          <Text style={[styles.breakdownValue, { color: userTokens.textPrimary }]}>
                            {formatMoneyWithSymbol(
                              toMinor(entry.amount_base_minor),
                              baseCurrency,
                              currencySymbol
                            )}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {localeCode === "en"
                      ? "No associated spending yet."
                      : "Todavia no hay gasto asociado."}
                  </Text>
                )
              ) : null}
            </View>
          </Card>

          <Card>
            <View style={styles.historyHeader}>
              <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                {localeCode === "en" ? "History" : "Historial"}
              </Text>
              <Text style={[styles.historyTitle, { color: userTokens.textPrimary }]}>
                {localeCode === "en" ? "Funding history" : "Historial de financiación"}
              </Text>
            </View>

            <View style={styles.historyList}>
              {historyRows.length > 0 ? (
                historyRows.map((row) => (
                  <View
                    key={row.periodKey}
                    style={[
                      styles.historyRow,
                      { borderColor: userTokens.border },
                    ]}
                  >
                    <View style={styles.historyCopy}>
                      <Text style={[styles.historyPeriod, { color: userTokens.textPrimary }]}>
                        {formatMonthLabel(row.periodKey, localeCode)}
                      </Text>
                      <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                        {row.confirmedAt
                          ? formatDateLabel(row.confirmedAt, localeCode)
                          : localeCode === "en"
                            ? "Confirmed month close"
                            : "Cierre confirmado"}
                      </Text>
                    </View>
                    <View style={styles.historyAmounts}>
                      <Text style={[styles.historyAmount, { color: userTokens.textPrimary }]}>
                        {formatMoneyWithSymbol(row.actualMinor, baseCurrency, currencySymbol)}
                      </Text>
                      <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                        {localeCode === "en" ? "Funded total" : "Financiado total"}:{" "}
                        {formatMoneyWithSymbol(
                          row.cumulativeMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                  {localeCode === "en"
                    ? "No funding history yet."
                    : "Todavia no hay historial de financiacion."}
                </Text>
              )}
            </View>
          </Card>
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
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  retryButton: {
    alignItems: "center",
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontFamily: "DMSans-SemiBold",
    fontSize: 15,
    lineHeight: 20,
  },
  heroSection: {
    gap: tokens.spacing.lg,
  },
  heroRingColumn: {
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  ringWrapper: {
    position: "relative",
    width: 212,
    height: 212,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    alignItems: "center",
    gap: 4,
  },
  projectEmoji: {
    fontSize: 38,
  },
  colorTrigger: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  colorTriggerDisabled: {
    opacity: 0.6,
  },
  colorTriggerInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  colorPalette: {
    width: "100%",
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: tokens.spacing.sm,
  },
  heroCopy: {
    alignItems: "center",
    gap: 4,
  },
  projectName: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "DMSans-SemiBold",
    textAlign: "center",
  },
  priorityText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "DMSans-SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroPercent: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "JetBrainsMono-Medium",
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "DMSans-Medium",
  },
  metricsGrid: {
    marginTop: tokens.spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  metricCard: {
    width: "48%",
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    gap: 4,
  },
  amountValue: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "JetBrainsMono-Medium",
  },
  breakdownCard: {
    marginTop: tokens.spacing.lg,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  breakdownValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "JetBrainsMono-Medium",
    textAlign: "right",
  },
  extraTransactionsCard: {
    marginTop: tokens.spacing.lg,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  expensesToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "DMSans-SemiBold",
  },
  extraTransactionsList: {
    gap: tokens.spacing.sm,
  },
  extraTransactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.md,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  expenseCopy: {
    flex: 1,
    gap: 2,
  },
  expenseLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "DMSans-Medium",
  },
  feedbackError: {
    marginTop: tokens.spacing.md,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "DMSans-Medium",
    textAlign: "center",
  },
  feedbackSuccess: {
    marginTop: tokens.spacing.md,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "DMSans-Medium",
    textAlign: "center",
  },
  historyHeader: {
    gap: 4,
  },
  historyTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "DMSans-SemiBold",
  },
  historyList: {
    marginTop: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  historyPeriod: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "DMSans-SemiBold",
  },
  historyAmounts: {
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 1,
  },
  historyAmount: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "JetBrainsMono-Medium",
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: {
    transform: [{ scale: 1.05 }],
  },
  colorSwatchDisabled: {
    opacity: 0.5,
  },
  colorSwatchInner: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
});
