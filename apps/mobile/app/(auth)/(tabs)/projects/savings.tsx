import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  computePendingMonthCloseKeysFromMonthCloses,
  computeProjectProgress,
  computeSavingsMonthView,
  CURRENCIES,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  getProjectColor,
  getProjectMonthlyFundingTargetMinor,
  getReserveContainerBalanceMinor,
  getMonthRangeFromKey,
  parseMoneyToMinor,
  themeTokens,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Project,
  type ReserveContainer,
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

const tokens = themeTokens.light;

type AccountRow = {
  id: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole; user_id: string }>;
};

type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: string | number | null;
  amount_base_minor: string | number | null;
  date: string;
};

type SavingsMonthStateRow = {
  period: string;
  generated_saved_base_minor: string | number;
  planned_to_projects_base_minor: string | number;
  available_to_plan_minor: string | number;
  needs_rebalance: boolean;
  is_closed: boolean;
  closed_at: string | null;
  allocated_to_projects_base_minor: string | number | null;
  allocated_to_reserves_base_minor: string | number | null;
  plans: Array<{
    project_id: string;
    planned_amount_base_minor: string | number;
  }>;
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

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

export default function SavingsDetailScreen() {
  const router = useRouter();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const insets = useSafeAreaInsets();
  const localeCode: "es" | "en" = locale === "en" ? "en" : "es";
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const currentMonthStart = `${currentMonthKey}-01`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [projects, setProjects] = useState<Project[]>([]);
  const [reserveContainers, setReserveContainers] = useState<ReserveContainer[]>([]);
  const [monthCloses, setMonthCloses] = useState<MonthClose[]>([]);
  const [monthCloseAllocations, setMonthCloseAllocations] = useState<MonthCloseAllocation[]>([]);
  const [reserveTransfers, setReserveTransfers] = useState<ReserveTransfer[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [monthState, setMonthState] = useState<SavingsMonthStateRow | null>(null);
  const [inputsByProject, setInputsByProject] = useState<Record<string, string>>({});

  const loadMonthState = useCallback(async () => {
    if (!selectedAccountId) return null;
    const { data, error: rpcError } = await supabase.rpc("get_savings_month_state", {
      p_account_id: selectedAccountId,
      p_period: currentMonthStart,
    });
    if (rpcError) throw rpcError;
    return (data ?? null) as SavingsMonthStateRow | null;
  }, [currentMonthStart, selectedAccountId]);

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const monthRange = getMonthRangeFromKey(currentMonthKey);

      const [
        accountResult,
        projectsResult,
        reserveContainersResult,
        monthClosesResult,
        monthCloseAllocationsResult,
        reserveTransfersResult,
        transactionsResult,
        monthStateResult,
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
          .eq("account_id", selectedAccountId)
          .not("target_amount_base_minor", "is", null)
          .eq("status", "active")
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("reserve_containers")
          .select("*")
          .eq("account_id", selectedAccountId)
          .eq("status", "active")
          .order("created_at", { ascending: true }),
        supabase
          .from("month_closes")
          .select("*")
          .eq("account_id", selectedAccountId)
          .order("period", { ascending: false }),
        supabase
          .from("month_close_allocations")
          .select("*")
          .eq("account_id", selectedAccountId),
        supabase
          .from("reserve_transfers")
          .select("*")
          .eq("account_id", selectedAccountId)
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("id, type, amount_minor, amount_base_minor, date")
          .eq("account_id", selectedAccountId)
          .gte("date", monthRange.start)
          .lte("date", monthRange.end)
          .order("date", { ascending: true }),
        loadMonthState(),
      ]);

      if (accountResult.error || !accountResult.data) {
        throw accountResult.error ?? new Error("account-not-found");
      }
      if (projectsResult.error) throw projectsResult.error;
      if (reserveContainersResult.error) throw reserveContainersResult.error;
      if (monthClosesResult.error) throw monthClosesResult.error;
      if (monthCloseAllocationsResult.error) throw monthCloseAllocationsResult.error;
      if (reserveTransfersResult.error) throw reserveTransfersResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      const account = accountResult.data as AccountRow;
      const accountCurrency = account.base_currency;
      const symbol =
        CURRENCIES.find((item) => item.code === accountCurrency)?.symbol ??
        accountCurrency;

      const nextProjects = (projectsResult.data ?? []) as Project[];
      const nextMonthState = monthStateResult;

      setRole(account.account_members?.[0]?.role ?? "viewer");
      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setProjects(nextProjects);
      setReserveContainers((reserveContainersResult.data ?? []) as ReserveContainer[]);
      setMonthCloses((monthClosesResult.data ?? []) as MonthClose[]);
      setMonthCloseAllocations(
        (monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]
      );
      setReserveTransfers((reserveTransfersResult.data ?? []) as ReserveTransfer[]);
      setTransactions((transactionsResult.data ?? []) as TransactionRow[]);
      setMonthState(nextMonthState);
      setInputsByProject(() => {
        const next: Record<string, string> = {};
        nextProjects.forEach((project) => {
          const plan = nextMonthState?.plans.find((row) => row.project_id === project.id);
          next[project.id] = formatMinorToMoney(
            toMinor(plan?.planned_amount_base_minor ?? 0),
            accountCurrency
          );
        });
        return next;
      });
    } catch (loadError) {
      console.error("[Savings][mobile] load error", loadError);
      setError(t(dictionary, "home.savings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [currentMonthKey, currentMonthStart, dictionary, loadMonthState, selectedAccountId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canEdit = role !== "viewer";
  const huchaReserve = useMemo(
    () => reserveContainers.find((reserveContainer) => reserveContainer.kind === "hucha") ?? null,
    [reserveContainers]
  );

  const savingsView = useMemo(
    () =>
      computeSavingsMonthView({
        period: currentMonthKey,
        transactions,
        fundingPlans:
          (monthState?.plans ?? []).map((plan) => ({
            id: `${currentMonthKey}:${plan.project_id}`,
            account_id: selectedAccountId ?? "",
            period: currentMonthStart,
            project_id: plan.project_id,
            planned_amount_base_minor: plan.planned_amount_base_minor,
          })) as MonthlyProjectFundingPlan[],
        monthClose:
          monthCloses.find((monthClose) => String(monthClose.period).slice(0, 7) === currentMonthKey) ??
          null,
      }),
    [currentMonthKey, currentMonthStart, monthCloses, monthState?.plans, selectedAccountId, transactions]
  );

  const fundedByProject = useMemo(() => {
    const map = new Map<string, bigint>();
    monthCloseAllocations.forEach((allocation) => {
      if (!allocation.project_id) return;
      map.set(
        allocation.project_id,
        (map.get(allocation.project_id) ?? 0n) + toMinor(allocation.amount_base_minor)
      );
    });
    reserveTransfers.forEach((transfer) => {
      map.set(
        transfer.destination_project_id,
        (map.get(transfer.destination_project_id) ?? 0n) +
          toMinor(transfer.amount_base_minor)
      );
    });
    return map;
  }, [monthCloseAllocations, reserveTransfers]);

  const huchaBalanceMinor = useMemo(
    () =>
      getReserveContainerBalanceMinor({
        reserveContainerId: huchaReserve?.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
      }),
    [huchaReserve?.id, monthCloseAllocations, reserveTransfers]
  );

  const pendingMonthKeys = useMemo(
    () =>
      computePendingMonthCloseKeysFromMonthCloses({
        commitmentProjects: projects.map((project) => ({
          projectId: project.id,
          createdAt: project.created_at ?? null,
        })),
        closedMonths: monthCloses.map((monthClose) => ({ period: monthClose.period })),
        currentMonthKey,
      }),
    [currentMonthKey, monthCloses, projects]
  );

  const pendingCloseMonthKey = pendingMonthKeys[0] ?? null;

  const parsedPlans = useMemo(() => {
    const rows = projects.map((project) => {
      const raw = (inputsByProject[project.id] ?? "").trim();
      if (!raw) {
        return { projectId: project.id, amountMinor: 0n, error: null as string | null };
      }

      const parsed = parseMoneyToMinor(raw, baseCurrency);
      if (typeof parsed === "object" && "error" in parsed) {
        return {
          projectId: project.id,
          amountMinor: 0n,
          error: localeCode === "en" ? "Review this amount." : "Revisa este importe.",
        };
      }

      return { projectId: project.id, amountMinor: parsed, error: null as string | null };
    });

    return {
      rows,
      totalMinor: rows.reduce((total, row) => total + row.amountMinor, 0n),
      hasErrors: rows.some((row) => row.error !== null),
    };
  }, [baseCurrency, inputsByProject, localeCode, projects]);

  const canSavePlan =
    canEdit &&
    !parsedPlans.hasErrors &&
    parsedPlans.totalMinor <=
      (savingsView.generatedSavedMinor > 0n ? savingsView.generatedSavedMinor : 0n) &&
    !savingsView.isClosed;

  const handleInputChange = (projectId: string, value: string) => {
    setInputsByProject((previous) => ({
      ...previous,
      [projectId]: sanitizeNumericInput(value),
    }));
    setError(null);
    setMessage(null);
  };

  const handleSavePlan = async () => {
    if (!selectedAccountId || !canSavePlan || isSavingPlan) return;

    setIsSavingPlan(true);
    setError(null);
    setMessage(null);

    try {
      const payload = parsedPlans.rows.map((row) => ({
        project_id: row.projectId,
        planned_amount_base_minor: row.amountMinor.toString(),
      }));

      const { error: rpcError } = await supabase.rpc("replace_monthly_project_funding_plans", {
        p_account_id: selectedAccountId,
        p_period: currentMonthStart,
        p_plans: payload,
      });

      if (rpcError) throw rpcError;

      setMessage(locale === "en" ? "Monthly plan updated." : "Plan mensual actualizado.");
      await loadData();
    } catch (saveError) {
      console.error("[Savings][mobile] save plan error", saveError);
      setError(
        locale === "en"
          ? "Couldn't save the monthly plan."
          : "No se pudo guardar el plan mensual."
      );
    } finally {
      setIsSavingPlan(false);
    }
  };

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
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: tokens.spacing.xxl + insets.bottom + 64 },
          ]}
        >
          {error ? (
            <Card>
              <Text style={[styles.errorText, { color: userTokens.textPrimary }]}>{error}</Text>
            </Card>
          ) : null}

          <Card>
            <Text style={[styles.eyebrow, { color: userTokens.textSecondary }]}>
              {locale === "en" ? "Savings of the month" : "Ahorro del mes"}
            </Text>
            <Text style={[styles.heroAmount, { color: userTokens.textPrimary }]}>
              {formatMoneyWithSymbol(
                savingsView.generatedSavedMinor,
                baseCurrency,
                currencySymbol
              )}
            </Text>
            <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
              {locale === "en"
                ? "Whatever you do not assign will go to the piggy bank when you close the month."
                : "Lo que no asignes irá a la hucha al cerrar el mes."}
            </Text>
          </Card>

          <View style={styles.summaryGrid}>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Planned" : "Planificado"}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(
                  savingsView.plannedToProjectsMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Available" : "Disponible"}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(
                  savingsView.availableToPlanMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Piggy bank" : "Hucha"}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(huchaBalanceMinor, baseCurrency, currencySymbol)}
              </Text>
            </Card>
          </View>

          {pendingCloseMonthKey ? (
            <Card>
              <Text style={[styles.cardTitle, { color: userTokens.textPrimary }]}>
                {locale === "en" ? "Pending month close" : "Cierre mensual pendiente"}
              </Text>
              <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                {locale === "en"
                  ? `You still need to close ${pendingCloseMonthKey}.`
                  : `Todavía te falta cerrar ${pendingCloseMonthKey}.`}
              </Text>
              <View style={styles.cardActions}>
                <Button
                  title={locale === "en" ? "Review close" : "Revisar cierre"}
                  onPress={() =>
                    router.push(`/(auth)/(tabs)/projects/month-close?month=${pendingCloseMonthKey}`)
                  }
                />
              </View>
            </Card>
          ) : null}

          {savingsView.needsRebalance ? (
            <Card>
              <Text style={[styles.warningTitle, { color: "#C2410C" }]}>
                {locale === "en" ? "Rebalance required" : "Necesita ajuste"}
              </Text>
              <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                {locale === "en"
                  ? "Recent spending reduced the available savings. Lower the monthly plan before closing."
                  : "Nuevos gastos han reducido el ahorro disponible. Baja el plan mensual antes de cerrar."}
              </Text>
            </Card>
          ) : null}

          <Card>
            <Text style={[styles.cardTitle, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "Assign savings" : "Asignar ahorro"}
            </Text>
            <View style={styles.projectList}>
              {projects.length === 0 ? (
                <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                  {locale === "en"
                    ? "Create at least one financial project to start assigning savings."
                    : "Crea al menos un proyecto financiero para empezar a asignar ahorro."}
                </Text>
              ) : (
                projects.map((project) => {
                  const progress = computeProjectProgress({
                    project,
                    fundedMinor: fundedByProject.get(project.id) ?? 0n,
                    plannedThisMonthMinor:
                      parsedPlans.rows.find((row) => row.projectId === project.id)?.amountMinor ??
                      0n,
                  });

                  return (
                    <View
                      key={project.id}
                      style={[
                        styles.projectCard,
                        {
                          borderColor: userTokens.border,
                          backgroundColor: userTokens.surface,
                        },
                      ]}
                    >
                      <View style={styles.projectHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.projectTitle, { color: userTokens.textPrimary }]}>
                            {project.emoji || "🎯"} {project.name}
                          </Text>
                          <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                            {formatMoneyWithSymbol(
                              progress.savedMinor,
                              baseCurrency,
                              currencySymbol
                            )}{" "}
                            /{" "}
                            {formatMoneyWithSymbol(
                              progress.targetMinor,
                              baseCurrency,
                              currencySymbol
                            )}
                          </Text>
                          <Text style={[styles.projectMeta, { color: userTokens.textSecondary }]}>
                            {locale === "en" ? "Funding target" : "Objetivo mensual"}:{" "}
                            {formatMoneyWithSymbol(
                              getProjectMonthlyFundingTargetMinor(project),
                              baseCurrency,
                              currencySymbol
                            )}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.projectPercent,
                            { color: getProjectColor(project) },
                          ]}
                        >
                          {Math.round(progress.progressRatio * 100)}%
                        </Text>
                      </View>
                      <Input
                        label={locale === "en" ? "Planned this month" : "Planificado este mes"}
                        value={inputsByProject[project.id] ?? ""}
                        onChangeText={(value) => handleInputChange(project.id, value)}
                        keyboardType="numeric"
                        placeholder="0"
                        disabled={!canEdit || savingsView.isClosed}
                        error={
                          parsedPlans.rows.find((row) => row.projectId === project.id)?.error ??
                          undefined
                        }
                      />
                    </View>
                  );
                })
              )}
            </View>

            {message ? <Text style={styles.successText}>{message}</Text> : null}

            <View style={styles.footerSummary}>
              <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Planned total" : "Total planificado"}:{" "}
                {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
              </Text>
              <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Projected to piggy bank" : "Previsto para la hucha"}:{" "}
                {formatMoneyWithSymbol(
                  savingsView.generatedSavedMinor > parsedPlans.totalMinor
                    ? savingsView.generatedSavedMinor - parsedPlans.totalMinor
                    : 0n,
                  baseCurrency,
                  currencySymbol
                )}
              </Text>
            </View>

            <View style={styles.cardActions}>
              <Button
                title={
                  isSavingPlan
                    ? locale === "en"
                      ? "Saving..."
                      : "Guardando..."
                    : locale === "en"
                      ? "Save plan"
                      : "Guardar plan"
                }
                onPress={() => void handleSavePlan()}
                disabled={!canSavePlan || isSavingPlan}
                loading={isSavingPlan}
              />
            </View>
          </Card>

          {huchaReserve ? (
            <TouchableOpacity
              onPress={() =>
                router.push(`/(auth)/(tabs)/projects/reserves/${huchaReserve.id}`)
              }
              activeOpacity={0.82}
            >
              <Card>
                <Text style={[styles.cardTitle, { color: userTokens.textPrimary }]}>
                  {huchaReserve.emoji || "🐷"} {huchaReserve.name}
                </Text>
                <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                  {locale === "en"
                    ? "Open the reserve to review its balance and move money to a project."
                    : "Abre la reserva para revisar su saldo y mover dinero a un proyecto."}
                </Text>
              </Card>
            </TouchableOpacity>
          ) : null}
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
  },
  eyebrow: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
    marginBottom: tokens.spacing.xs,
  },
  heroAmount: {
    fontSize: 30,
    fontFamily: "DMSans-Bold",
  },
  helper: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  summaryGrid: {
    gap: tokens.spacing.sm,
  },
  summaryCard: {
    paddingVertical: tokens.spacing.sm,
  },
  summaryLabel: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  cardTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
    marginBottom: tokens.spacing.xs,
  },
  cardActions: {
    marginTop: tokens.spacing.md,
  },
  warningTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
    marginBottom: 4,
  },
  projectList: {
    gap: tokens.spacing.sm,
  },
  projectCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
  },
  projectHeader: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "flex-start",
    marginBottom: tokens.spacing.sm,
  },
  projectTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
  },
  projectMeta: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  projectPercent: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
  },
  footerSummary: {
    marginTop: tokens.spacing.sm,
    gap: 4,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  successText: {
    marginTop: tokens.spacing.sm,
    color: "#15803D",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
});
