import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addMonths,
  computePendingMonthCloseKeysFromMonthCloses,
  CURRENCIES,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getProjectMonthlyFundingTargetMinor,
  parseMoneyToMinor,
  themeTokens,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type Project,
  type ReserveContainer,
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
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

type AccountRow = {
  id: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole; user_id: string }>;
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

type ParsedPlanRow = {
  projectId: string;
  amountMinor: bigint;
  error: string | null;
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

const formatClosedAt = (value: string | null, locale: "es" | "en") => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

export default function ProjectsMonthCloseScreen() {
  const { month } = useLocalSearchParams<{ month?: string }>();
  const router = useRouter();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const insets = useSafeAreaInsets();
  const localeCode: "es" | "en" = locale === "en" ? "en" : "es";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [monthKey, setMonthKey] = useState(addMonths(toMonthKey(new Date()), -1));
  const [pendingMonthKeys, setPendingMonthKeys] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reserveContainers, setReserveContainers] = useState<ReserveContainer[]>([]);
  const [monthState, setMonthState] = useState<SavingsMonthStateRow | null>(null);
  const [monthClose, setMonthClose] = useState<MonthClose | null>(null);
  const [monthCloseAllocations, setMonthCloseAllocations] = useState<MonthCloseAllocation[]>([]);
  const [inputsByProject, setInputsByProject] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accountResult = await supabase
        .from("accounts")
        .select("id, base_currency, account_members!inner(role, user_id)")
        .eq("id", selectedAccountId)
        .eq("account_members.user_id", user.id)
        .maybeSingle();

      if (accountResult.error || !accountResult.data) {
        throw accountResult.error ?? new Error("account-not-found");
      }

      const account = accountResult.data as AccountRow;
      const accountCurrency = account.base_currency;
      const symbol =
        CURRENCIES.find((item) => item.code === accountCurrency)?.symbol ??
        accountCurrency;

      const [projectsResult, reserveContainersResult, monthClosesResult] = await Promise.all([
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
      ]);

      if (projectsResult.error) throw projectsResult.error;
      if (reserveContainersResult.error) throw reserveContainersResult.error;
      if (monthClosesResult.error) throw monthClosesResult.error;

      const nextProjects = (projectsResult.data ?? []) as Project[];
      const nextReserveContainers = (reserveContainersResult.data ?? []) as ReserveContainer[];
      const nextMonthCloses = (monthClosesResult.data ?? []) as MonthClose[];
      const currentMonthKey = toMonthKey(new Date());
      const defaultMonthKey = addMonths(currentMonthKey, -1);
      const computedPendingMonthKeys = computePendingMonthCloseKeysFromMonthCloses({
        commitmentProjects: nextProjects.map((project) => ({
          projectId: project.id,
          createdAt: project.created_at ?? null,
        })),
        closedMonths: nextMonthCloses.map((entry) => ({ period: entry.period })),
        currentMonthKey,
      });

      const resolvedMonth =
        typeof month === "string" && MONTH_KEY_PATTERN.test(month)
          ? month
          : computedPendingMonthKeys[0] ?? defaultMonthKey;
      const monthStart = `${resolvedMonth}-01`;

      const { data: currentMonthState, error: monthStateError } = await supabase.rpc(
        "get_savings_month_state",
        {
          p_account_id: selectedAccountId,
          p_period: monthStart,
        }
      );

      if (monthStateError) throw monthStateError;

      const selectedMonthClose =
        nextMonthCloses.find((entry) => String(entry.period).slice(0, 7) === resolvedMonth) ??
        null;

      const { data: selectedAllocations, error: selectedAllocationsError } =
        selectedMonthClose?.id
          ? await supabase
              .from("month_close_allocations")
              .select("*")
              .eq("month_close_id", selectedMonthClose.id)
              .order("created_at", { ascending: true })
          : { data: [] as MonthCloseAllocation[], error: null };

      if (selectedAllocationsError) throw selectedAllocationsError;

      setRole(account.account_members?.[0]?.role ?? "viewer");
      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setProjects(nextProjects);
      setReserveContainers(nextReserveContainers);
      setMonthKey(resolvedMonth);
      setPendingMonthKeys(computedPendingMonthKeys);
      setMonthState((currentMonthState ?? null) as SavingsMonthStateRow | null);
      setMonthClose(selectedMonthClose);
      setMonthCloseAllocations((selectedAllocations ?? []) as MonthCloseAllocation[]);
      setInputsByProject(() => {
        const next: Record<string, string> = {};
        nextProjects.forEach((project) => {
          const plan = (currentMonthState as SavingsMonthStateRow | null)?.plans.find(
            (entry) => entry.project_id === project.id
          );
          next[project.id] = formatMinorToMoney(
            toMinor(plan?.planned_amount_base_minor ?? 0),
            accountCurrency
          );
        });
        return next;
      });
      setMessage(null);
    } catch (loadError) {
      console.error("[Projects][mobile] month-close load error", loadError);
      setError(locale === "en" ? "Couldn't load month close." : "No se pudo cargar el cierre.");
    } finally {
      setLoading(false);
    }
  }, [localeCode, month, selectedAccountId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canEdit = role !== "viewer";
  const isClosed = monthState?.is_closed ?? Boolean(monthClose?.id);
  const actualSavedMinor = toMinor(monthState?.generated_saved_base_minor ?? 0);
  const positiveSavedMinor = actualSavedMinor > 0n ? actualSavedMinor : 0n;
  const huchaReserve =
    reserveContainers.find((reserveContainer) => reserveContainer.kind === "hucha") ?? null;

  const parsedPlans = useMemo(() => {
    const rows: ParsedPlanRow[] = projects.map((project) => {
      const raw = (inputsByProject[project.id] ?? "").trim();
      if (!raw) return { projectId: project.id, amountMinor: 0n, error: null };

      const parsed = parseMoneyToMinor(raw, baseCurrency);
      if (typeof parsed === "object" && "error" in parsed) {
        return {
          projectId: project.id,
          amountMinor: 0n,
          error: localeCode === "en" ? "Review this amount." : "Revisa este importe.",
        };
      }

      return { projectId: project.id, amountMinor: parsed, error: null };
    });

    return {
      rows,
      totalMinor: rows.reduce((total, row) => total + row.amountMinor, 0n),
      hasErrors: rows.some((row) => row.error !== null),
    };
  }, [baseCurrency, inputsByProject, localeCode, projects]);

  const needsRebalance = parsedPlans.totalMinor > positiveSavedMinor;
  const projectedReserveMinor =
    positiveSavedMinor > parsedPlans.totalMinor ? positiveSavedMinor - parsedPlans.totalMinor : 0n;
  const canPersistPlan = canEdit && !isClosed && !parsedPlans.hasErrors && !needsRebalance;
  const canConfirmClose = canPersistPlan && !isClosing;

  const allocationRows = useMemo(() => {
    const projectsById = new Map(projects.map((project) => [project.id, project]));
    const reservesById = new Map(
      reserveContainers.map((reserveContainer) => [reserveContainer.id, reserveContainer])
    );

    return monthCloseAllocations.map((allocation) => {
      if (allocation.project_id) {
        const project = projectsById.get(allocation.project_id);
        return {
          id: allocation.id,
          label: project
            ? `${project.emoji || "🎯"} ${project.name}`
            : localeCode === "en"
              ? "Project"
              : "Proyecto",
          amountMinor: toMinor(allocation.amount_base_minor),
        };
      }

      const reserve = allocation.reserve_container_id
        ? reservesById.get(allocation.reserve_container_id)
        : null;
      return {
        id: allocation.id,
        label: reserve
          ? `${reserve.emoji || "🐷"} ${reserve.name}`
          : localeCode === "en"
            ? "Reserve"
            : "Reserva",
        amountMinor: toMinor(allocation.amount_base_minor),
      };
    });
  }, [localeCode, monthCloseAllocations, projects, reserveContainers]);

  const persistPlans = async () => {
    if (!selectedAccountId) return;
    const payload = parsedPlans.rows.map((row) => ({
      project_id: row.projectId,
      planned_amount_base_minor: row.amountMinor.toString(),
    }));

    const { error: rpcError } = await supabase.rpc("replace_monthly_project_funding_plans", {
      p_account_id: selectedAccountId,
      p_period: `${monthKey}-01`,
      p_plans: payload,
    });

    if (rpcError) throw rpcError;
  };

  const handleSavePlan = async () => {
    if (!canPersistPlan || isSavingPlan) return;

    setIsSavingPlan(true);
    setError(null);
    setMessage(null);

    try {
      await persistPlans();
      setMessage(locale === "en" ? "Monthly plan updated." : "Plan mensual actualizado.");
      await loadData();
    } catch (saveError) {
      console.error("[Projects][mobile] month-close save error", saveError);
      setError(
        locale === "en"
          ? "Couldn't save the monthly plan."
          : "No se pudo guardar el plan mensual."
      );
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!selectedAccountId || !canConfirmClose) return;

    setIsClosing(true);
    setError(null);
    setMessage(null);

    try {
      await persistPlans();

      const { error: rpcError } = await supabase.rpc("close_savings_month", {
        p_account_id: selectedAccountId,
        p_period: `${monthKey}-01`,
      });

      if (rpcError) throw rpcError;

      setMessage(locale === "en" ? "Month close confirmed." : "Cierre mensual confirmado.");
      await loadData();
    } catch (closeError) {
      console.error("[Projects][mobile] month-close confirm error", closeError);
      setError(
        locale === "en" ? "Couldn't close the month." : "No se pudo cerrar el mes."
      );
    } finally {
      setIsClosing(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "projects.monthClose.title") }} />
        <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
          <ActivityIndicator size="large" color={primaryActionColor} />
        </View>
      </>
    );
  }

  const previousMonth = addMonths(monthKey, -1);
  const nextMonth = addMonths(monthKey, 1);
  const closedAtLabel = formatClosedAt(
    monthState?.closed_at ??
      (typeof monthClose?.closed_at === "string" ? monthClose.closed_at : null),
    localeCode
  );

  return (
    <>
      <Stack.Screen options={{ title: t(dictionary, "projects.monthClose.title") }} />
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
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "End-of-month ritual" : "Ritual de fin de mes"}
            </Text>
            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
              {locale === "en"
                ? "Confirm how the real savings of the month are consolidated."
                : "Confirma cómo se consolida el ahorro real del mes."}
            </Text>
          </Card>

          <Card>
            <Text style={[styles.cardTitle, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "Select month" : "Seleccionar mes"}
            </Text>
            <View style={styles.monthNavigation}>
              <Pressable
                onPress={() =>
                  router.replace(`/(auth)/(tabs)/projects/month-close?month=${previousMonth}`)
                }
                style={[
                  styles.monthButton,
                  { borderColor: userTokens.border, backgroundColor: userTokens.surface },
                ]}
              >
                <Text style={[styles.monthButtonText, { color: userTokens.textPrimary }]}>←</Text>
              </Pressable>
              <View style={styles.monthCenter}>
                <Text style={[styles.monthLabel, { color: userTokens.textPrimary }]}>
                  {formatMonthLabel(monthKey, localeCode)}
                </Text>
                <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                  {pendingMonthKeys.includes(monthKey)
                    ? locale === "en"
                      ? "Pending month"
                      : "Mes pendiente"
                    : locale === "en"
                      ? "Month overview"
                      : "Resumen del mes"}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  router.replace(`/(auth)/(tabs)/projects/month-close?month=${nextMonth}`)
                }
                style={[
                  styles.monthButton,
                  { borderColor: userTokens.border, backgroundColor: userTokens.surface },
                ]}
              >
                <Text style={[styles.monthButtonText, { color: userTokens.textPrimary }]}>→</Text>
              </Pressable>
            </View>

            {pendingMonthKeys.length > 0 ? (
              <View style={styles.pendingWrap}>
                {pendingMonthKeys.map((pendingKey) => {
                  const selected = pendingKey === monthKey;
                  return (
                    <Pressable
                      key={pendingKey}
                      onPress={() =>
                        router.replace(`/(auth)/(tabs)/projects/month-close?month=${pendingKey}`)
                      }
                      style={[
                        styles.pendingChip,
                        {
                          borderColor: selected ? primaryActionColor : userTokens.border,
                          backgroundColor: selected ? primaryActionColor : userTokens.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pendingChipText,
                          { color: selected ? "#FFFFFF" : userTokens.textPrimary },
                        ]}
                      >
                        {formatMonthLabel(pendingKey, localeCode)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Card>

          <View style={styles.summaryGrid}>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Generated" : "Generado"}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(actualSavedMinor, baseCurrency, currencySymbol)}
              </Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Planned" : "Planificado"}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
              </Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "To piggy bank" : "A la hucha"}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(projectedReserveMinor, baseCurrency, currencySymbol)}
              </Text>
            </Card>
          </View>

          {isClosed ? (
            <Card>
              <Text style={[styles.successTitle, { color: "#166534" }]}>
                {locale === "en" ? "Month already closed" : "Mes ya cerrado"}
              </Text>
              {closedAtLabel ? (
                <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                  {locale === "en"
                    ? `Closed on ${closedAtLabel}.`
                    : `Cerrado el ${closedAtLabel}.`}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {!isClosed && needsRebalance ? (
            <Card>
              <Text style={[styles.warningTitle, { color: "#C2410C" }]}>
                {locale === "en" ? "Rebalance required" : "Necesita ajuste"}
              </Text>
              <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                {locale === "en"
                  ? "The plan exceeds the currently positive savings. Lower the planned amounts before closing."
                  : "El plan supera el ahorro positivo disponible. Baja los importes planificados antes de cerrar."}
              </Text>
            </Card>
          ) : null}

          {!isClosed && actualSavedMinor <= 0n ? (
            <Card>
              <Text style={[styles.warningTitle, { color: userTokens.textPrimary }]}>
                {locale === "en"
                  ? "No positive savings this month"
                  : "No hay ahorro positivo este mes"}
              </Text>
              <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                {locale === "en"
                  ? "Closing the month will not allocate funds to projects or to the piggy bank."
                  : "Al cerrar el mes no se asignará financiación ni a proyectos ni a la hucha."}
              </Text>
            </Card>
          ) : null}

          <Card>
            <Text style={[styles.cardTitle, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "Final allocations" : "Asignaciones finales"}
            </Text>

            {projects.length === 0 ? (
              <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                {locale === "en"
                  ? "There are no active financial projects. Any positive remainder will go to the piggy bank."
                  : "No hay proyectos financieros activos. El sobrante positivo irá a la hucha."}
              </Text>
            ) : (
              <View style={styles.projectList}>
                {projects.map((project) => {
                  const parsedRow =
                    parsedPlans.rows.find((row) => row.projectId === project.id) ?? null;

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
                      <Text style={[styles.projectTitle, { color: userTokens.textPrimary }]}>
                        {project.emoji || "🎯"} {project.name}
                      </Text>
                      <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                        {locale === "en" ? "Monthly funding target" : "Objetivo mensual"}:{" "}
                        {formatMoneyWithSymbol(
                          getProjectMonthlyFundingTargetMinor(project),
                          baseCurrency,
                          currencySymbol
                        )}
                      </Text>
                      <Input
                        label={locale === "en" ? "Final amount for the month" : "Importe final del mes"}
                        value={inputsByProject[project.id] ?? ""}
                        onChangeText={(value) =>
                          setInputsByProject((previous) => ({
                            ...previous,
                            [project.id]: sanitizeNumericInput(value),
                          }))
                        }
                        keyboardType="numeric"
                        placeholder="0"
                        disabled={!canEdit || isClosed}
                        error={parsedRow?.error ?? undefined}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          <Card>
            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
              {locale === "en"
                ? `Any unassigned amount will go to ${huchaReserve?.name ?? "the piggy bank"}.`
                : `Lo no asignado irá a ${huchaReserve?.name ?? "la hucha"}.`}
            </Text>
            {message ? <Text style={styles.successText}>{message}</Text> : null}
          </Card>

          {isClosed && allocationRows.length > 0 ? (
            <Card>
              <Text style={[styles.cardTitle, { color: userTokens.textPrimary }]}>
                {locale === "en" ? "Confirmed allocations" : "Asignaciones confirmadas"}
              </Text>
              <View style={styles.projectList}>
                {allocationRows.map((row) => (
                  <View
                    key={row.id}
                    style={[
                      styles.rowCard,
                      {
                        borderColor: userTokens.border,
                        backgroundColor: userTokens.surface,
                      },
                    ]}
                  >
                    <Text style={[styles.projectTitle, { color: userTokens.textPrimary }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.rowAmount, { color: userTokens.textPrimary }]}>
                      {formatMoneyWithSymbol(row.amountMinor, baseCurrency, currencySymbol)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {!isClosed ? (
            <View style={styles.actions}>
              <Button
                variant="secondary"
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
                disabled={!canPersistPlan || isSavingPlan}
                loading={isSavingPlan}
              />
              <Button
                title={
                  isClosing
                    ? locale === "en"
                      ? "Closing..."
                      : "Cerrando..."
                    : locale === "en"
                      ? "Confirm month close"
                      : "Confirmar cierre mensual"
                }
                onPress={() => void handleConfirmClose()}
                disabled={!canConfirmClose}
                loading={isClosing}
              />
            </View>
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
  title: {
    fontSize: tokens.typography.size.xl,
    fontFamily: "DMSans-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  cardTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
    marginBottom: tokens.spacing.sm,
  },
  monthNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  monthButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  monthButtonText: {
    fontSize: 20,
    fontFamily: "DMSans-Bold",
  },
  monthCenter: {
    flex: 1,
    alignItems: "center",
  },
  monthLabel: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
    marginBottom: 2,
  },
  pendingWrap: {
    marginTop: tokens.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  pendingChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pendingChipText: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
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
  warningTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
    marginBottom: 4,
  },
  successTitle: {
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
  projectTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
    marginBottom: 4,
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  rowAmount: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Bold",
  },
  actions: {
    gap: tokens.spacing.sm,
  },
  successText: {
    marginTop: tokens.spacing.sm,
    color: "#15803D",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
});
