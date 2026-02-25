import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addMonths,
  CURRENCIES,
  computeProjectMonthlyAllocation,
  distributeProjectSurplusProportionally,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getMonthRangeFromKey,
  parseMoneyToMinor,
  themeTokens,
  toMonthKey,
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
import { Input } from "../../../../src/components/Input";

type AllocationMode = "unassigned" | "proportional" | "manual";

type AccountRow = {
  id: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole; user_id: string }>;
};

type ParsedRow = {
  projectId: string;
  amountMinor: bigint;
  error: string | null;
};

const tokens = themeTokens.light;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

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

const formatSignedMoney = (
  value: bigint,
  baseCurrency: string,
  currencySymbol: string
) => {
  const abs = value < 0n ? -value : value;
  const formatted = formatMoneyWithSymbol(abs, baseCurrency, currencySymbol);
  if (value === 0n) return formatted;
  return value > 0n ? `+${formatted}` : `-${formatted}`;
};

export default function ProjectsMonthCloseScreen() {
  const { month } = useLocalSearchParams<{ month?: string }>();
  const router = useRouter();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [monthKey, setMonthKey] = useState(addMonths(toMonthKey(new Date()), -1));
  const [monthStart, setMonthStart] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [actualSavedMinor, setActualSavedMinor] = useState(0n);
  const [confirmedRows, setConfirmedRows] = useState<ProjectContribution[]>([]);
  const [userLabels, setUserLabels] = useState<Record<string, string>>({});

  const [allocationMode, setAllocationMode] = useState<AllocationMode>("unassigned");
  const [inputsByProject, setInputsByProject] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId) {
      setLoading(false);
      setError(t(dictionary, "errors.noSession"));
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
      const currentSymbol =
        CURRENCIES.find((item) => item.code === currentCurrency)?.symbol ??
        currentCurrency;

      const currentMonth = toMonthKey(new Date());
      const fallbackMonth = addMonths(currentMonth, -1);
      const resolvedMonth =
        typeof month === "string" && MONTH_KEY_PATTERN.test(month)
          ? month
          : fallbackMonth;
      const range = getMonthRangeFromKey(resolvedMonth);

      const { data: projectRows, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("account_id", selectedAccountId)
        .eq("status", "active")
        .not("monthly_commitment_base_minor", "is", null)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (projectError) throw projectError;

      const currentProjects = ((projectRows ?? []) as Project[]).filter(
        (project) => toMinor(project.monthly_commitment_base_minor) > 0n
      );

      const { data: monthTransactions, error: txError } = await supabase
        .from("transactions")
        .select("type, amount_minor, amount_base_minor")
        .eq("account_id", selectedAccountId)
        .gte("date", range.start)
        .lte("date", range.end);

      if (txError) throw txError;

      let incomeMinor = 0n;
      let expenseMinor = 0n;
      (monthTransactions ?? []).forEach((transaction) => {
        const amount = toMinor(transaction.amount_base_minor ?? transaction.amount_minor ?? 0);
        if (transaction.type === "income") {
          incomeMinor += amount;
        } else {
          expenseMinor += amount;
        }
      });
      const currentActualSaved = incomeMinor - expenseMinor;

      const projectIds = currentProjects.map((project) => project.id);
      const { data: contributionRows, error: contributionsError } =
        projectIds.length > 0
          ? await supabase
              .from("project_contributions")
              .select("*")
              .eq("account_id", selectedAccountId)
              .eq("period", range.start)
              .in("project_id", projectIds)
          : { data: [] as ProjectContribution[], error: null };

      if (contributionsError) throw contributionsError;

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

      const allocatableMinor = currentActualSaved > 0n ? currentActualSaved : 0n;
      const allocations = computeProjectMonthlyAllocation({
        projects: currentProjects.map((project) => ({
          projectId: project.id,
          priority: project.priority,
          commitmentMinor: project.monthly_commitment_base_minor,
        })),
        actualSavedMinor: allocatableMinor,
      });

      const groupedExisting = new Map<
        string,
        { actualMinor: bigint; confirmed: boolean }
      >();
      ((contributionRows ?? []) as ProjectContribution[]).forEach((entry) => {
        const current = groupedExisting.get(entry.project_id) ?? {
          actualMinor: 0n,
          confirmed: false,
        };
        groupedExisting.set(entry.project_id, {
          actualMinor: current.actualMinor + toMinor(entry.actual_amount_base_minor),
          confirmed: current.confirmed || Boolean(entry.confirmed),
        });
      });

      const isInitiallyConfirmed =
        currentProjects.length > 0 &&
        currentProjects.every((project) => groupedExisting.get(project.id)?.confirmed);

      const suggestedByProject = new Map<string, bigint>();
      allocations.allocations.forEach((row) => {
        suggestedByProject.set(row.projectId, row.allocatedMinor);
      });

      const initialInputs: Record<string, string> = {};
      currentProjects.forEach((project) => {
        const existing = groupedExisting.get(project.id);
        const suggested = suggestedByProject.get(project.id) ?? 0n;
        const value = existing?.actualMinor ?? suggested;
        initialInputs[project.id] = formatMinorToMoney(value, currentCurrency);
      });

      setRole(currentRole);
      setBaseCurrency(currentCurrency);
      setCurrencySymbol(currentSymbol);
      setMonthKey(resolvedMonth);
      setMonthStart(range.start);
      setProjects(currentProjects);
      setActualSavedMinor(currentActualSaved);
      setConfirmedRows((contributionRows ?? []) as ProjectContribution[]);
      setUserLabels(labels);
      setAllocationMode(isInitiallyConfirmed ? "manual" : "unassigned");
      setInputsByProject(initialInputs);
      setErrorMessage(null);
      setSuccessMessage(null);
    } catch (loadError) {
      console.error("[Projects][mobile] month-close load error", loadError);
      setError(t(dictionary, "errors.internalServer"));
    } finally {
      setLoading(false);
    }
  }, [dictionary, month, selectedAccountId, user]);

  useEffect(() => {
    if (isFocused) {
      void loadData();
    }
  }, [isFocused, loadData]);

  const canEdit = role !== "viewer";
  const allocatableMinor = actualSavedMinor > 0n ? actualSavedMinor : 0n;

  const commitments = useMemo(
    () =>
      projects.map((project) => ({
        project,
        commitmentMinor: toMinor(project.monthly_commitment_base_minor ?? 0),
      })),
    [projects]
  );

  const allocationResult = useMemo(
    () =>
      computeProjectMonthlyAllocation({
        projects: commitments.map((row) => ({
          projectId: row.project.id,
          priority: row.project.priority,
          commitmentMinor: row.commitmentMinor,
        })),
        actualSavedMinor: allocatableMinor,
      }),
    [allocatableMinor, commitments]
  );

  const surplusProportional = useMemo(
    () =>
      distributeProjectSurplusProportionally({
        projects: commitments.map((row) => ({
          projectId: row.project.id,
          priority: row.project.priority,
          commitmentMinor: row.commitmentMinor,
        })),
        surplusMinor: allocationResult.surplusMinor,
      }),
    [allocationResult.surplusMinor, commitments]
  );

  const suggestedByProject = useMemo(() => {
    const map = new Map<string, bigint>();
    allocationResult.allocations.forEach((row) => {
      map.set(row.projectId, row.allocatedMinor);
    });
    return map;
  }, [allocationResult.allocations]);

  const proportionalByProject = useMemo(() => {
    const map = new Map<string, bigint>();
    surplusProportional.forEach((row) => {
      map.set(row.projectId, row.allocatedSurplusMinor);
    });
    return map;
  }, [surplusProportional]);

  const isFullyConfirmed = useMemo(() => {
    if (projects.length === 0) return false;
    const confirmedProjectIds = new Set(
      confirmedRows
        .filter((row) => row.confirmed)
        .map((row) => row.project_id)
    );
    return projects.every((project) => confirmedProjectIds.has(project.id));
  }, [confirmedRows, projects]);

  const latestConfirmation = useMemo(() => {
    const confirmed = confirmedRows
      .filter((row) => row.confirmed)
      .sort((a, b) => {
        const aTime =
          typeof a.confirmed_at === "string"
            ? new Date(a.confirmed_at).getTime()
            : 0;
        const bTime =
          typeof b.confirmed_at === "string"
            ? new Date(b.confirmed_at).getTime()
            : 0;
        return bTime - aTime;
      });
    return confirmed[0] ?? null;
  }, [confirmedRows]);

  const parsedAllocations = useMemo(() => {
    const rows: ParsedRow[] = commitments.map(({ project }) => {
      const raw = (inputsByProject[project.id] ?? "").trim();
      if (!raw) {
        return { projectId: project.id, amountMinor: 0n, error: null };
      }
      const parsed = parseMoneyToMinor(raw, baseCurrency);
      if (typeof parsed === "object" && "error" in parsed) {
        return {
          projectId: project.id,
          amountMinor: 0n,
          error: t(dictionary, parsed.error.key, parsed.error.params),
        };
      }
      return { projectId: project.id, amountMinor: parsed, error: null };
    });

    const byProject = new Map(rows.map((row) => [row.projectId, row]));
    const totalAssignedMinor = rows.reduce(
      (total, row) => total + row.amountMinor,
      0n
    );
    const hasErrors = rows.some((row) => row.error !== null);

    return { rows, byProject, totalAssignedMinor, hasErrors };
  }, [baseCurrency, commitments, dictionary, inputsByProject]);

  const overAssignedMinor =
    parsedAllocations.totalAssignedMinor > allocatableMinor
      ? parsedAllocations.totalAssignedMinor - allocatableMinor
      : 0n;

  const unassignedMinor =
    allocatableMinor > parsedAllocations.totalAssignedMinor
      ? allocatableMinor - parsedAllocations.totalAssignedMinor
      : 0n;

  const deficitAfterAssignMinor =
    allocationResult.totalCommittedMinor > parsedAllocations.totalAssignedMinor
      ? allocationResult.totalCommittedMinor - parsedAllocations.totalAssignedMinor
      : 0n;

  const applyAutomaticMode = (mode: Exclude<AllocationMode, "manual">) => {
    const next: Record<string, string> = {};
    commitments.forEach(({ project }) => {
      const base = suggestedByProject.get(project.id) ?? 0n;
      const extra =
        mode === "proportional" ? proportionalByProject.get(project.id) ?? 0n : 0n;
      next[project.id] = formatMinorToMoney(base + extra, baseCurrency);
    });
    setAllocationMode(mode);
    setInputsByProject(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleInputChange = (projectId: string, value: string) => {
    setAllocationMode("manual");
    setInputsByProject((previous) => ({
      ...previous,
      [projectId]: sanitizeNumericInput(value),
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleConfirm = async () => {
    if (!canEdit || !selectedAccountId || !user || isSaving) return;

    if (projects.length === 0) {
      setErrorMessage(t(dictionary, "projects.monthClose.noProjects"));
      return;
    }

    if (parsedAllocations.hasErrors) {
      setErrorMessage(t(dictionary, "projects.monthClose.fixErrors"));
      return;
    }

    if (overAssignedMinor > 0n) {
      setErrorMessage(
        t(dictionary, "projects.monthClose.overAssigned", {
          amount: formatMoneyWithSymbol(overAssignedMinor, baseCurrency, currencySymbol),
        })
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const nowIso = new Date().toISOString();
      const payload = commitments.map(({ project, commitmentMinor }) => {
        const parsed = parsedAllocations.byProject.get(project.id);
        const assignedMinor = parsed?.amountMinor ?? 0n;
        const suggestedMinor =
          (suggestedByProject.get(project.id) ?? 0n) +
          (allocationMode === "proportional"
            ? proportionalByProject.get(project.id) ?? 0n
            : 0n);

        return {
          account_id: selectedAccountId,
          project_id: project.id,
          user_id: user.id,
          period: monthStart,
          committed_amount_base_minor: String(commitmentMinor),
          actual_amount_base_minor: String(assignedMinor),
          source: assignedMinor === suggestedMinor ? "automatic" : "manual",
          confirmed: true,
          confirmed_at: nowIso,
          updated_at: nowIso,
        };
      });

      const { data, error: confirmError } = await supabase
        .from("project_contributions")
        .upsert(payload, { onConflict: "project_id,period" })
        .select("*");

      if (confirmError) throw confirmError;

      setConfirmedRows((data ?? []) as ProjectContribution[]);
      setSuccessMessage(t(dictionary, "projects.monthClose.confirmed"));
      void loadData();
    } catch (confirmError) {
      console.error("[Projects][mobile] month-close confirm error", confirmError);
      setErrorMessage(t(dictionary, "errors.internalServer"));
    } finally {
      setIsSaving(false);
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

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "projects.monthClose.title") }} />
        <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
          <View style={styles.container}>
            <Card title={t(dictionary, "common.errorTitle")} description={error}>
              <Button onPress={() => void loadData()} title={t(dictionary, "common.retry")} />
            </Card>
          </View>
        </View>
      </>
    );
  }

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
          <Card>
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {t(dictionary, "projects.monthClose.title")}
            </Text>
            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
              {t(dictionary, "projects.monthClose.subtitle", {
                month: formatMonthLabel(monthKey, locale),
              })}
            </Text>
          </Card>

          <View style={styles.summaryGrid}>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.monthClose.actualSaved")}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatSignedMoney(actualSavedMinor, baseCurrency, currencySymbol)}
              </Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.monthClose.totalCommitted")}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(
                  allocationResult.totalCommittedMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.monthClose.allocatable")}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(allocatableMinor, baseCurrency, currencySymbol)}
              </Text>
            </Card>
          </View>

          {isFullyConfirmed && latestConfirmation ? (
            <Card>
              <Text style={styles.confirmedTitle}>
                {t(dictionary, "projects.monthClose.alreadyConfirmed")}
              </Text>
              <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.monthClose.confirmedBy", {
                  name:
                    latestConfirmation.user_id
                      ? userLabels[latestConfirmation.user_id] ??
                        latestConfirmation.user_id.slice(0, 8)
                      : t(dictionary, "projects.history.unknownUser"),
                })}
              </Text>
            </Card>
          ) : null}

          {projects.length === 0 ? (
            <Card>
              <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.monthClose.noProjects")}
              </Text>
              <View style={styles.actionsRow}>
                <Button
                  variant="secondary"
                  title={t(dictionary, "projects.backToList")}
                  onPress={() => router.push("/(auth)/(tabs)/projects")}
                />
              </View>
            </Card>
          ) : (
            <>
              {allocationResult.surplusMinor > 0n ? (
                <Card>
                  <Text style={[styles.surplusTitle, { color: userTokens.textPrimary }]}>
                    {t(dictionary, "projects.monthClose.surplusTitle")}
                  </Text>
                  <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "projects.monthClose.surplusDescription", {
                      amount: formatMoneyWithSymbol(
                        allocationResult.surplusMinor,
                        baseCurrency,
                        currencySymbol
                      ),
                    })}
                  </Text>
                  <View style={styles.modeButtons}>
                    <Button
                      title={t(dictionary, "projects.monthClose.surplusUnassigned")}
                      variant={allocationMode === "unassigned" ? "primary" : "secondary"}
                      onPress={() => applyAutomaticMode("unassigned")}
                      disabled={!canEdit}
                    />
                    <Button
                      title={t(dictionary, "projects.monthClose.surplusProportional")}
                      variant={allocationMode === "proportional" ? "primary" : "secondary"}
                      onPress={() => applyAutomaticMode("proportional")}
                      disabled={!canEdit}
                    />
                  </View>
                </Card>
              ) : null}

              <Card>
                <View style={styles.allocationList}>
                  {commitments.map(({ project, commitmentMinor }) => {
                    const parsed = parsedAllocations.byProject.get(project.id);
                    const assignedMinor = parsed?.amountMinor ?? 0n;
                    const isFulfilled =
                      commitmentMinor > 0n && assignedMinor >= commitmentMinor;
                    const hasDeficit = commitmentMinor > 0n && assignedMinor < commitmentMinor;

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
                        <View style={styles.projectCardHeader}>
                          <View style={styles.projectCardTitleBlock}>
                            <Text style={[styles.projectTitle, { color: userTokens.textPrimary }]}>
                              {project.emoji} {project.name}
                            </Text>
                            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                              {t(dictionary, "projects.monthClose.projectCommitment", {
                                amount: formatMoneyWithSymbol(
                                  commitmentMinor,
                                  baseCurrency,
                                  currencySymbol
                                ),
                              })}
                            </Text>
                          </View>
                          {isFulfilled ? (
                            <Text style={styles.statusFulfilled}>
                              {t(dictionary, "projects.history.statusFulfilled")}
                            </Text>
                          ) : hasDeficit ? (
                            <Text style={styles.statusDeficit}>
                              {t(dictionary, "projects.history.statusDeficit")}
                            </Text>
                          ) : (
                            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                              {t(dictionary, "projects.history.statusNoPlan")}
                            </Text>
                          )}
                        </View>

                        <Input
                          label={t(dictionary, "projects.monthClose.projectAssigned")}
                          value={inputsByProject[project.id] ?? ""}
                          onChangeText={(value) => handleInputChange(project.id, value)}
                          keyboardType="numeric"
                          placeholder="0"
                          disabled={!canEdit}
                          error={parsed?.error ?? undefined}
                        />
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card>
                <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.monthClose.unassigned", {
                    amount: formatMoneyWithSymbol(unassignedMinor, baseCurrency, currencySymbol),
                  })}
                </Text>
                <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.monthClose.deficit", {
                    amount: formatMoneyWithSymbol(
                      deficitAfterAssignMinor,
                      baseCurrency,
                      currencySymbol
                    ),
                  })}
                </Text>
                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
              </Card>

              <View style={styles.actionsRow}>
                <Button
                  variant="secondary"
                  title={t(dictionary, "common.cancel")}
                  onPress={() => router.push("/(auth)/(tabs)/projects")}
                  disabled={isSaving}
                />
                <Button
                  title={
                    isSaving
                      ? t(dictionary, "projects.monthClose.confirming")
                      : t(dictionary, "projects.monthClose.confirmCta")
                  }
                  onPress={handleConfirm}
                  disabled={
                    !canEdit ||
                    isSaving ||
                    parsedAllocations.hasErrors ||
                    overAssignedMinor > 0n
                  }
                  loading={isSaving}
                />
              </View>
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
  },
  subtitle: {
    marginTop: 2,
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  summaryGrid: {
    gap: tokens.spacing.sm,
  },
  summaryCard: {
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
  },
  summaryLabel: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  summaryValue: {
    marginTop: 2,
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  confirmedTitle: {
    color: "#059669",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-SemiBold",
  },
  surplusTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-SemiBold",
  },
  modeButtons: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  allocationList: {
    gap: tokens.spacing.sm,
  },
  projectCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.sm,
  },
  projectCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  projectCardTitleBlock: {
    flex: 1,
  },
  projectTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-SemiBold",
  },
  statusFulfilled: {
    color: "#059669",
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-SemiBold",
  },
  statusDeficit: {
    color: "#D97706",
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-SemiBold",
  },
  actionsRow: {
    gap: tokens.spacing.xs,
  },
  errorText: {
    marginTop: tokens.spacing.xs,
    color: "#DC2626",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  successText: {
    marginTop: tokens.spacing.xs,
    color: "#059669",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
});
