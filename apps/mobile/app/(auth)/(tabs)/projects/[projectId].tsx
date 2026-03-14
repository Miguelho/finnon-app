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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildProjectColorMap,
  computeProjectProgress,
  CURRENCIES,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getMinorUnits,
  getProjectColor,
  getProjectMonthlyFundingTargetMinor,
  getProjectReserveTransferDeltaMinor,
  parseMoneyToMinor,
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
import { Button } from "../../../../src/components/Button";
import { Card } from "../../../../src/components/Card";
import { Input } from "../../../../src/components/Input";
import { ProjectAmountSlider } from "../../../../src/components/projects/ProjectAmountSlider";
import { ProjectProgressRing } from "../../../../src/components/projects/ProjectProgressRing";

const tokens = themeTokens.light;

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

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

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
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [spendingTransactions, setSpendingTransactions] = useState<SpendingTransaction[]>([]);
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [activeTab, setActiveTab] = useState<"simulator" | "history">("simulator");
  const [isSpendingOpen, setIsSpendingOpen] = useState(false);
  const [disabledRecurringIds, setDisabledRecurringIds] = useState<Set<string>>(new Set());
  const [sliderMinor, setSliderMinor] = useState(0);
  const [sliderTrackWidth, setSliderTrackWidth] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingColor, setIsSavingColor] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [returnAmountInput, setReturnAmountInput] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnMessage, setReturnMessage] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState(false);

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
        recurringExpensesResult,
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
          .from("recurring_items")
          .select("id, merchant, notes, amount_minor, currency, is_paused, type")
          .eq("account_id", selectedAccountId)
          .eq("type", "expense")
          .eq("is_paused", false)
          .order("amount_minor", { ascending: false }),
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
      if (recurringExpensesResult.error) throw recurringExpensesResult.error;
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
      setRecurringExpenses((recurringExpensesResult.data as RecurringExpense[]) ?? []);
      setSpendingTransactions((spendingTransactionsResult.data as SpendingTransaction[]) ?? []);
      setRole(account.account_members?.[0]?.role ?? "viewer");
      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setSliderMinor(Number(getProjectMonthlyFundingTargetMinor(nextProject)));
      setDisabledRecurringIds(new Set());
      setSaveError(null);
      setSaveMessage(null);
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
  const minorUnits = getMinorUnits(baseCurrency);
  const minorFactor = 10 ** minorUnits;
  const sliderStep = Math.max(1, 25 * minorFactor);

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

  const availableReservedMinor = useMemo(
    () => (totalFundedMinor > spentMinor ? totalFundedMinor - spentMinor : 0n),
    [spentMinor, totalFundedMinor]
  );

  const refundableFromReserveMinor = useMemo(
    () => (fundingFromReservesMinor > 0n ? fundingFromReservesMinor : 0n),
    [fundingFromReservesMinor]
  );

  const maxReturnableMinor = useMemo(
    () =>
      refundableFromReserveMinor < availableReservedMinor
        ? refundableFromReserveMinor
        : availableReservedMinor,
    [availableReservedMinor, refundableFromReserveMinor]
  );

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
    return computeProjectProgress({
      project,
      fundedMinor: totalFundedMinor,
      reserveTransferredMinor: fundingFromReservesMinor,
      plannedThisMonthMinor,
      spentMinor,
    });
  }, [fundingFromReservesMinor, plannedThisMonthMinor, project, spentMinor, totalFundedMinor]);

  const simulatorProgress = useMemo(() => {
    if (!project) return null;
    return computeProjectProgress({
      project: {
        ...project,
        monthly_commitment_base_minor: effectiveMonthlyMinor,
      },
      fundedMinor: totalFundedMinor,
      reserveTransferredMinor: fundingFromReservesMinor,
      plannedThisMonthMinor,
      spentMinor,
    });
  }, [
    effectiveMonthlyMinor,
    fundingFromReservesMinor,
    plannedThisMonthMinor,
    project,
    spentMinor,
    totalFundedMinor,
  ]);

  const sliderMax = useMemo(() => {
    if (!project) return sliderStep;
    const targetMinor = Number(toMinor(project.target_amount_base_minor));
    const currentMinor = Number(getProjectMonthlyFundingTargetMinor(project));
    const base = 1500 * minorFactor;
    return Math.max(base, targetMinor, currentMinor + 500 * minorFactor, sliderStep);
  }, [minorFactor, project, sliderStep]);

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

  const parsedReturnAmount = useMemo(() => {
    const raw = returnAmountInput.trim();
    if (!raw) return { amountMinor: 0n, error: null as string | null };

    const parsed = parseMoneyToMinor(raw, baseCurrency);
    if (typeof parsed === "object" && "error" in parsed) {
      return {
        amountMinor: 0n,
        error: localeCode === "en" ? "Review the amount." : "Revisa el importe.",
      };
    }

    return { amountMinor: parsed, error: null as string | null };
  }, [baseCurrency, localeCode, returnAmountInput]);

  const canReturnToReserve =
    canEdit &&
    parsedReturnAmount.error === null &&
    parsedReturnAmount.amountMinor > 0n &&
    parsedReturnAmount.amountMinor <= maxReturnableMinor;

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

  const handleSetProjectColor = async (color: string) => {
    if (!canEdit || !project || !selectedAccountId || isSavingColor) return;
    if (resolvedProjectColor === color && project.color) return;

    setIsSavingColor(true);
    setSaveError(null);
    setSaveMessage(null);

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
      setSaveMessage(t(dictionary, "projects.colorSaved"));
    } catch (updateError) {
      console.error("[Projects][mobile] color update error", updateError);
      setSaveError(t(dictionary, "errors.internalServer"));
    } finally {
      setIsSavingColor(false);
    }
  };

  const handleReturnToReserve = async () => {
    if (!canEdit || !project || !selectedAccountId || !canReturnToReserve || isReturning) return;

    setIsReturning(true);
    setReturnError(null);
    setReturnMessage(null);

    try {
      const { error: rpcError } = await supabase.rpc("transfer_project_to_hucha", {
        p_account_id: selectedAccountId,
        p_project_id: project.id,
        p_amount_base_minor: parsedReturnAmount.amountMinor.toString(),
      });

      if (rpcError) throw rpcError;

      setReturnAmountInput("");
      setReturnMessage(
        localeCode === "en"
          ? "Return to piggy bank confirmed."
          : "Devolucion a la hucha confirmada."
      );
      await loadData();
    } catch (transferError) {
      console.error("[Projects][mobile] return to piggy bank error", transferError);
      setReturnError(
        localeCode === "en"
          ? "Couldn't move the money back to the piggy bank."
          : "No se pudo devolver el dinero a la hucha."
      );
    } finally {
      setIsReturning(false);
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
                progressColor={resolvedProjectColor}
                center={
                  <View>
                    <Text style={[styles.heroPercent, { color: resolvedProjectColor }]}>
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
                <View>
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
                <View>
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {localeCode === "en" ? "Spent" : "Gastado"}
                  </Text>
                  <Text style={[styles.amountValue, { color: userTokens.textPrimary }]}>
                    {formatMoneyWithSymbol(heroProgress.spentMinor, baseCurrency, currencySymbol)}
                  </Text>
                </View>
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
                    ? "From piggy bank transfers"
                    : "Desde transferencias de hucha"}
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
            </View>

            {canEdit ? (
              <View style={[styles.returnCard, { borderColor: userTokens.border }]}>
                <View style={styles.returnHeader}>
                  <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
                    {localeCode === "en" ? "Return to piggy bank" : "Devolver a la hucha"}
                  </Text>
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {localeCode === "en"
                      ? "Only unspent money that originally came from the piggy bank can be returned."
                      : "Solo se puede devolver dinero no gastado que viniese originalmente de la hucha."}
                  </Text>
                </View>

                <Input
                  label={localeCode === "en" ? "Amount" : "Importe"}
                  value={returnAmountInput}
                  onChangeText={(value) => setReturnAmountInput(sanitizeNumericInput(value))}
                  keyboardType="numeric"
                  placeholder="0"
                  disabled={maxReturnableMinor <= 0n || isReturning}
                />

                <View
                  style={[
                    styles.returnStats,
                    { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
                  ]}
                >
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                      {localeCode === "en" ? "Available to return" : "Disponible para devolver"}
                    </Text>
                    <Text style={[styles.breakdownValue, { color: userTokens.textPrimary }]}>
                      {formatMoneyWithSymbol(maxReturnableMinor, baseCurrency, currencySymbol)}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                      {localeCode === "en" ? "Net from piggy bank" : "Neto desde hucha"}
                    </Text>
                    <Text style={[styles.breakdownValue, { color: userTokens.textPrimary }]}>
                      {formatMoneyWithSymbol(
                        refundableFromReserveMinor,
                        baseCurrency,
                        currencySymbol
                      )}
                    </Text>
                  </View>
                </View>

                {maxReturnableMinor <= 0n ? (
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {localeCode === "en"
                      ? "There is no available balance to return to the piggy bank."
                      : "No hay saldo disponible para devolver a la hucha."}
                  </Text>
                ) : null}
                {parsedReturnAmount.error ? (
                  <Text style={[styles.feedbackError, { color: "#E0956A" }]}>
                    {parsedReturnAmount.error}
                  </Text>
                ) : null}
                {parsedReturnAmount.amountMinor > maxReturnableMinor ? (
                  <Text style={[styles.feedbackError, { color: "#E0956A" }]}>
                    {localeCode === "en"
                      ? "The amount exceeds what can be returned right now."
                      : "El importe supera lo que se puede devolver ahora mismo."}
                  </Text>
                ) : null}
                {returnError ? (
                  <Text style={[styles.feedbackError, { color: "#E0956A" }]}>{returnError}</Text>
                ) : null}
                {returnMessage ? (
                  <Text style={[styles.feedbackSuccess, { color: resolvedProjectColor }]}>
                    {returnMessage}
                  </Text>
                ) : null}

                <Button
                  onPress={() => void handleReturnToReserve()}
                  title={
                    isReturning
                      ? localeCode === "en"
                        ? "Returning..."
                        : "Devolviendo..."
                      : localeCode === "en"
                        ? "Return to piggy bank"
                        : "Devolver a la hucha"
                  }
                  loading={isReturning}
                  disabled={!canReturnToReserve}
                />
              </View>
            ) : null}

            <View style={[styles.extraTransactionsCard, { borderColor: userTokens.border }]}>
              <TouchableOpacity
                style={styles.expensesToggle}
                onPress={() => setIsSpendingOpen((previous) => !previous)}
                activeOpacity={0.8}
              >
                <Text style={[styles.expensesTitle, { color: userTokens.textPrimary }]}>
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
            <View style={styles.tabRow}>
              <TouchableOpacity
                onPress={() => setActiveTab("simulator")}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor:
                      activeTab === "simulator" ? userTokens.surfaceAlt : "transparent",
                    borderColor: userTokens.border,
                  },
                ]}
              >
                <Text style={[styles.tabText, { color: userTokens.textPrimary }]}>
                  {localeCode === "en" ? "Simulator" : "Simulador"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab("history")}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor:
                      activeTab === "history" ? userTokens.surfaceAlt : "transparent",
                    borderColor: userTokens.border,
                  },
                ]}
              >
                <Text style={[styles.tabText, { color: userTokens.textPrimary }]}>
                  {localeCode === "en" ? "History" : "Historial"}
                </Text>
              </TouchableOpacity>
            </View>

            {activeTab === "simulator" ? (
              <View style={styles.simulatorBody}>
                <View
                  style={[
                    styles.commitmentCard,
                    { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
                  ]}
                >
                  <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                    {localeCode === "en" ? "Current monthly target" : "Objetivo mensual actual"}
                  </Text>
                  <Text style={[styles.commitmentValue, { color: userTokens.textPrimary }]}>
                    {getProjectMonthlyFundingTargetMinor(project) > 0n
                      ? `${formatMoneyWithSymbol(
                          getProjectMonthlyFundingTargetMinor(project),
                          baseCurrency,
                          currencySymbol
                        )} ${t(dictionary, "projects.perMonth")}`
                      : t(dictionary, "projects.noPlan")}
                  </Text>
                  {heroProgress.monthsLeft !== null && heroProgress.estimatedCompletionDate ? (
                    <Text style={[styles.commitmentEta, { color: userTokens.textSecondary }]}>
                      {t(dictionary, "projects.simulator.estimatedDate", {
                        duration: formatDuration(heroProgress.monthsLeft, localeCode),
                        date: new Intl.DateTimeFormat(
                          localeCode === "en" ? "en-US" : "es-ES",
                          { month: "long", year: "numeric" }
                        ).format(heroProgress.estimatedCompletionDate),
                      })}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.simulatorSummary}>
                  <View>
                    <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                      {t(dictionary, "projects.simulator.sliderLabel")}
                    </Text>
                    <Text style={[styles.simulatorAmount, { color: userTokens.textPrimary }]}>
                      {formatMoneyWithSymbol(effectiveMonthlyMinor, baseCurrency, currencySymbol)}
                    </Text>
                  </View>
                  <View style={styles.simulatorSummaryRight}>
                    <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                      {localeCode === "en" ? "Estimated finish" : "Fin estimado"}
                    </Text>
                    <Text style={[styles.summaryInlineValue, { color: userTokens.textPrimary }]}>
                      {simulatorProgress.monthsLeft === null ||
                      !simulatorProgress.estimatedCompletionDate
                        ? t(dictionary, "projects.noPlan")
                        : `${formatDuration(simulatorProgress.monthsLeft, localeCode)} · ${new Intl.DateTimeFormat(
                            localeCode === "en" ? "en-US" : "es-ES",
                            { month: "long", year: "numeric" }
                          ).format(simulatorProgress.estimatedCompletionDate)}`}
                    </Text>
                  </View>
                </View>

                <ProjectAmountSlider
                  min={0}
                  max={sliderMax}
                  step={sliderStep}
                  value={sliderMinor}
                  onChange={setSliderMinor}
                  trackColor={userTokens.border}
                  fillColor={resolvedProjectColor}
                  thumbColor={resolvedProjectColor}
                  trackWidth={sliderTrackWidth}
                  onTrackLayout={setSliderTrackWidth}
                />

                {sortedRecurringExpenses.length > 0 ? (
                  <View style={styles.recurringList}>
                    <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
                      {localeCode === "en"
                        ? "Switch off recurring expenses"
                        : "Apaga gastos recurrentes"}
                    </Text>
                    {sortedRecurringExpenses.map((expense) => {
                      const amountMinor = toMinor(expense.amount_minor);
                      const label =
                        expense.merchant?.trim() ||
                        expense.notes?.trim() ||
                        (localeCode === "en" ? "Recurring expense" : "Gasto recurrente");
                      const isEnabled = disabledRecurringIds.has(expense.id);
                      return (
                        <View
                          key={expense.id}
                          style={[
                            styles.recurringRow,
                            { borderColor: userTokens.border },
                          ]}
                        >
                          <View style={styles.recurringCopy}>
                            <Text style={[styles.recurringLabel, { color: userTokens.textPrimary }]}>
                              {label}
                            </Text>
                            <Text style={[styles.metaText, { color: userTokens.textSecondary }]}>
                              {formatMoneyWithSymbol(amountMinor, baseCurrency, currencySymbol)}
                            </Text>
                          </View>
                          <Switch
                            value={isEnabled}
                            onValueChange={() => toggleRecurringExpense(expense.id)}
                            trackColor={{
                              false: userTokens.border,
                              true: resolvedProjectColor,
                            }}
                            thumbColor={isEnabled ? "#FFFFFF" : "#F1F5F9"}
                          />
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {saveError ? (
                  <Text style={[styles.feedbackError, { color: "#E0956A" }]}>{saveError}</Text>
                ) : null}
                {saveMessage ? (
                  <Text style={[styles.feedbackSuccess, { color: resolvedProjectColor }]}>
                    {saveMessage}
                  </Text>
                ) : null}

                {canEdit ? (
                  <Button
                    onPress={() => void handleSetCommitment()}
                    title={localeCode === "en" ? "Save monthly target" : "Guardar objetivo mensual"}
                    loading={isSaving}
                  />
                ) : null}
              </View>
            ) : (
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
            )}
          </Card>

          {canEdit ? (
            <Card>
              <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
                {t(dictionary, "projects.colorLabel")}
              </Text>
              <View style={styles.colorSwatches}>
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
            </Card>
          ) : null}
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
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  projectHeaderMain: {
    flex: 1,
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  projectEmoji: {
    fontSize: 34,
  },
  projectHeaderText: {
    flex: 1,
    gap: 4,
  },
  projectName: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "DMSans-SemiBold",
  },
  priorityBlock: {
    alignItems: "flex-end",
    gap: 4,
  },
  priorityValue: {
    fontSize: 18,
    fontFamily: "JetBrainsMono-Medium",
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "DMSans-Medium",
  },
  heroRow: {
    marginTop: tokens.spacing.lg,
    gap: tokens.spacing.lg,
    alignItems: "center",
  },
  heroNumbers: {
    width: "100%",
    gap: tokens.spacing.md,
  },
  heroPercent: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "JetBrainsMono-Medium",
  },
  amountValue: {
    fontSize: 19,
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
  returnCard: {
    marginTop: tokens.spacing.lg,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  returnHeader: {
    gap: 4,
  },
  returnStats: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  expensesToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  expensesTitle: {
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
  tabRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: "DMSans-SemiBold",
  },
  simulatorBody: {
    marginTop: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  commitmentCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  commitmentValue: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "JetBrainsMono-Medium",
  },
  commitmentEta: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "DMSans-Medium",
  },
  simulatorSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  simulatorSummaryRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  simulatorAmount: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "JetBrainsMono-Medium",
  },
  summaryInlineValue: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "DMSans-Medium",
    textAlign: "right",
  },
  recurringList: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "DMSans-SemiBold",
  },
  recurringRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.md,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  recurringCopy: {
    flex: 1,
    gap: 2,
  },
  recurringLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "DMSans-Medium",
  },
  feedbackError: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "DMSans-Medium",
  },
  feedbackSuccess: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "DMSans-Medium",
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
  },
  historyAmount: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "JetBrainsMono-Medium",
  },
  colorSwatches: {
    marginTop: tokens.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
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
