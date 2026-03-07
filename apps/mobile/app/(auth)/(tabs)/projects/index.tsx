import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  assignProjectColor,
  buildProjectColorMap,
  computePendingMonthCloseKeysFromMonthCloses,
  computeProjectProgress,
  CURRENCIES,
  DEFAULT_PROJECT_EMOJI,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getMonthlyProjectCommitmentTotal,
  getProjectColor,
  getReserveContainerStats,
  HUCHA_PROJECT_COLOR,
  parseMoneyToMinor,
  PROJECT_EMOJI_SUGGESTIONS,
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
import { ProjectProgressRing } from "../../../../src/components/projects/ProjectProgressRing";

const tokens = themeTokens.light;

type AccountRow = {
  id: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole; user_id: string }>;
};

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

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

const formatEstimatedDate = (date: Date, locale: "es" | "en") =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);

export default function ProjectsScreen() {
  const router = useRouter();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const insets = useSafeAreaInsets();
  const localeCode: "es" | "en" = locale === "en" ? "en" : "es";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reserveContainers, setReserveContainers] = useState<ReserveContainer[]>([]);
  const [fundingPlans, setFundingPlans] = useState<MonthlyProjectFundingPlan[]>([]);
  const [monthCloses, setMonthCloses] = useState<MonthClose[]>([]);
  const [monthCloseAllocations, setMonthCloseAllocations] = useState<MonthCloseAllocation[]>([]);
  const [reserveTransfers, setReserveTransfers] = useState<ReserveTransfer[]>([]);
  const [extraContributions, setExtraContributions] = useState<
    Array<{ project_id: string | null; amount_base_minor: bigint | number | string | null }>
  >([]);
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [hasPendingMonthlyClose, setHasPendingMonthlyClose] = useState(false);
  const [pendingMonthKey, setPendingMonthKey] = useState(addMonths(toMonthKey(new Date()), -1));

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [emojiInput, setEmojiInput] = useState(DEFAULT_PROJECT_EMOJI);
  const [targetInput, setTargetInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("");

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

      const currentMonthKey = toMonthKey(new Date());

      const [projectsResult, reserveContainersResult, fundingPlansResult, monthClosesResult, monthCloseAllocationsResult, reserveTransfersResult] =
        await Promise.all([
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
            .eq("status", "active"),
          supabase
            .from("monthly_project_funding_plans")
            .select("*")
            .eq("account_id", selectedAccountId)
            .eq("period", `${currentMonthKey}-01`),
          supabase
            .from("month_closes")
            .select("*")
            .eq("account_id", selectedAccountId),
          supabase
            .from("month_close_allocations")
            .select("*")
            .eq("account_id", selectedAccountId),
          supabase
            .from("reserve_transfers")
            .select("*")
            .eq("account_id", selectedAccountId),
        ]);

      if (projectsResult.error) throw projectsResult.error;
      if (reserveContainersResult.error) throw reserveContainersResult.error;
      if (fundingPlansResult.error) throw fundingPlansResult.error;
      if (monthClosesResult.error) throw monthClosesResult.error;
      if (monthCloseAllocationsResult.error) throw monthCloseAllocationsResult.error;
      if (reserveTransfersResult.error) throw reserveTransfersResult.error;

      const nextProjects = (projectsResult.data ?? []) as Project[];
      const projectIds = nextProjects.map((project) => project.id);

      const { data: extraContributionRows, error: extraContributionsError } =
        projectIds.length > 0
          ? await supabase
              .from("transactions")
              .select("project_id, amount_base_minor")
              .eq("account_id", selectedAccountId)
              .eq("type", "expense")
              .in("project_id", projectIds)
          : {
              data: [] as Array<{
                project_id: string | null;
                amount_base_minor: bigint | number | string | null;
              }>,
              error: null,
            };

      if (extraContributionsError) throw extraContributionsError;

      const pendingMonthKeys = computePendingMonthCloseKeysFromMonthCloses({
        commitmentProjects: nextProjects.map((project) => ({
          projectId: project.id,
          createdAt: project.created_at ?? null,
        })),
        closedMonths: ((monthClosesResult.data ?? []) as MonthClose[]).map((entry) => ({
          period: entry.period,
        })),
        currentMonthKey,
      });

      setRole(account.account_members?.[0]?.role ?? "viewer");
      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setProjects(nextProjects);
      setReserveContainers((reserveContainersResult.data ?? []) as ReserveContainer[]);
      setFundingPlans((fundingPlansResult.data ?? []) as MonthlyProjectFundingPlan[]);
      setMonthCloses((monthClosesResult.data ?? []) as MonthClose[]);
      setMonthCloseAllocations((monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]);
      setReserveTransfers((reserveTransfersResult.data ?? []) as ReserveTransfer[]);
      setExtraContributions(
        (extraContributionRows ?? []) as Array<{
          project_id: string | null;
          amount_base_minor: bigint | number | string | null;
        }>
      );
      setHasPendingMonthlyClose(pendingMonthKeys.length > 0);
      setPendingMonthKey(pendingMonthKeys[0] ?? addMonths(currentMonthKey, -1));
    } catch (loadError) {
      console.error("[Projects][mobile] load error", loadError);
      setError(t(dictionary, "errors.internalServer"));
    } finally {
      setLoading(false);
    }
  }, [dictionary, selectedAccountId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canEdit = role !== "viewer";
  const fundedByProject = useMemo(() => {
    const byProject = new Map<string, bigint>();
    monthCloseAllocations.forEach((allocation) => {
      if (!allocation.project_id) return;
      byProject.set(
        allocation.project_id,
        (byProject.get(allocation.project_id) ?? 0n) + toMinor(allocation.amount_base_minor)
      );
    });
    reserveTransfers.forEach((transfer) => {
      byProject.set(
        transfer.destination_project_id,
        (byProject.get(transfer.destination_project_id) ?? 0n) +
          toMinor(transfer.amount_base_minor)
      );
    });
    return byProject;
  }, [monthCloseAllocations, reserveTransfers]);

  const plannedByProject = useMemo(() => {
    const byProject = new Map<string, bigint>();
    fundingPlans.forEach((plan) => {
      byProject.set(
        plan.project_id,
        (byProject.get(plan.project_id) ?? 0n) + toMinor(plan.planned_amount_base_minor)
      );
    });
    return byProject;
  }, [fundingPlans]);

  const extraContributionsByProject = useMemo(() => {
    const byProject = new Map<string, bigint>();
    extraContributions.forEach((entry) => {
      if (!entry.project_id) return;
      byProject.set(
        entry.project_id,
        (byProject.get(entry.project_id) ?? 0n) + toMinor(entry.amount_base_minor)
      );
    });
    return byProject;
  }, [extraContributions]);

  const totalCommitmentMinor = useMemo(
    () => getMonthlyProjectCommitmentTotal(projects, { activeOnly: true }),
    [projects]
  );

  const huchaReserve = useMemo(
    () => reserveContainers.find((reserveContainer) => reserveContainer.kind === "hucha") ?? null,
    [reserveContainers]
  );

  const projectColorMap = useMemo(() => buildProjectColorMap(projects), [projects]);
  const monthClosesById = useMemo(
    () => new Map(monthCloses.map((monthClose) => [monthClose.id, monthClose])),
    [monthCloses]
  );

  const huchaStats = useMemo(
    () =>
      getReserveContainerStats({
        reserveContainerId: huchaReserve?.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
        monthClosesById,
        currentPeriod: toMonthKey(new Date()),
      }),
    [huchaReserve?.id, monthCloseAllocations, monthClosesById, reserveTransfers]
  );

  const nextPriority = useMemo(() => {
    const highest = projects.reduce(
      (currentHighest, project) => Math.max(currentHighest, project.priority),
      0
    );
    return highest + 1;
  }, [projects]);

  const openCreate = () => {
    setCreateError(null);
    setNameInput("");
    setEmojiInput(DEFAULT_PROJECT_EMOJI);
    setTargetInput("");
    setPriorityInput(String(nextPriority));
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!canEdit || !user || !selectedAccountId || isCreating) return;

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setCreateError(t(dictionary, "projects.validation.nameRequired"));
      return;
    }

    const parsedTarget = parseMoneyToMinor(targetInput.trim(), baseCurrency);
    if (typeof parsedTarget === "object" && "error" in parsedTarget) {
      setCreateError(t(dictionary, parsedTarget.error.key, parsedTarget.error.params));
      return;
    }

    if (parsedTarget <= 0n) {
      setCreateError(t(dictionary, "money.invalidAmount"));
      return;
    }

    const parsedPriority = Number.parseInt(priorityInput.trim(), 10);
    const safePriority = Number.isFinite(parsedPriority)
      ? Math.max(parsedPriority, 1)
      : nextPriority;

    setIsCreating(true);
    setCreateError(null);
    const nextColor = assignProjectColor(projects);

    try {
      const { error: insertError } = await supabase.from("projects").insert({
        account_id: selectedAccountId,
        name: trimmedName,
        emoji: emojiInput.trim() || DEFAULT_PROJECT_EMOJI,
        color: nextColor,
        target_amount_base_minor: String(parsedTarget),
        priority: safePriority,
        status: "active",
        created_by: user.id,
      });

      if (insertError) throw insertError;

      setIsCreateOpen(false);
      await loadData();
    } catch (createError) {
      console.error("[Projects][mobile] create error", createError);
      setCreateError(t(dictionary, "errors.internalServer"));
    } finally {
      setIsCreating(false);
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

  return (
    <>
      <Stack.Screen options={{ title: t(dictionary, "navigation.projects") }} />
      <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
        {error ? (
          <View style={styles.container}>
            <Card>
              <Text style={[styles.errorText, { color: userTokens.textPrimary }]}>{error}</Text>
              <View style={styles.actions}>
                <Button onPress={() => void loadData()} title={t(dictionary, "common.retry")} />
              </View>
            </Card>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.container,
              { paddingBottom: tokens.spacing.xxl + insets.bottom + 64 },
            ]}
          >
            <View style={styles.actions}>
              <Button
                variant="secondary"
                title={locale === "en" ? "Month close" : "Cierre mensual"}
                onPress={() => router.push("/(auth)/(tabs)/projects/month-close")}
              />
            </View>

            {huchaReserve ? (
              <TouchableOpacity
                style={[
                  styles.huchaCard,
                  {
                    backgroundColor: userTokens.surface,
                    borderColor: "rgba(109, 201, 160, 0.45)",
                  },
                ]}
                activeOpacity={0.82}
                onPress={() =>
                  router.push(`/(auth)/(tabs)/projects/reserves/${huchaReserve.id}`)
                }
              >
                <View style={styles.huchaHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.huchaTitle, { color: userTokens.textPrimary }]}>
                      {huchaReserve.emoji || "🐷"} {huchaReserve.name}
                    </Text>
                    <Text style={[styles.huchaSubtitle, { color: userTokens.textSecondary }]}>
                      {locale === "en"
                        ? "Generic reserve for what remains after the month close."
                        : "Reserva genérica para lo que queda tras el cierre mensual."}
                    </Text>
                  </View>
                  <View style={styles.huchaAmountBlock}>
                    <Text style={[styles.huchaAmount, { color: HUCHA_PROJECT_COLOR }]}>
                      {formatMoneyWithSymbol(
                        huchaStats.accumulatedMinor,
                        baseCurrency,
                        currencySymbol
                      )}
                    </Text>
                    <Text style={[styles.huchaAmountLabel, { color: userTokens.textSecondary }]}>
                      {locale === "en" ? "Balance" : "Saldo"}
                    </Text>
                  </View>
                </View>
                <View style={styles.huchaStatsRow}>
                  <Text style={[styles.huchaStatText, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "This month" : "Este mes"}:{" "}
                    {formatMoneyWithSymbol(
                      huchaStats.currentMonthContributionMinor,
                      baseCurrency,
                      currencySymbol
                    )}
                  </Text>
                  <Text style={[styles.huchaStatText, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "Average" : "Media"}:{" "}
                    {formatMoneyWithSymbol(huchaStats.averageMinor, baseCurrency, currencySymbol)}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {hasPendingMonthlyClose ? (
              <Card>
                <Text style={[styles.pendingTitle, { color: userTokens.textPrimary }]}>
                  {locale === "en" ? "Pending month close" : "Cierre mensual pendiente"}
                </Text>
                <Text style={[styles.pendingDescription, { color: userTokens.textSecondary }]}>
                  {locale === "en"
                    ? `You still need to close ${formatMonthLabel(pendingMonthKey, localeCode)}.`
                    : `Todavía te falta cerrar ${formatMonthLabel(pendingMonthKey, localeCode)}.`}
                </Text>
                <View style={styles.pendingCta}>
                  <Button
                    title={locale === "en" ? "Review close" : "Revisar cierre"}
                    onPress={() =>
                      router.push(`/(auth)/(tabs)/projects/month-close?month=${pendingMonthKey}`)
                    }
                  />
                </View>
              </Card>
            ) : null}

            <View style={styles.activeProjectsHeader}>
              <Text style={[styles.activeProjectsTitle, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Active projects" : "Proyectos activos"}
              </Text>
              <TouchableOpacity
                onPress={openCreate}
                disabled={!canEdit}
                activeOpacity={0.82}
                style={[
                  styles.addProjectPill,
                  {
                    borderColor: userTokens.border,
                    backgroundColor: userTokens.surface,
                    opacity: canEdit ? 1 : 0.45,
                  },
                ]}
              >
                <Text style={[styles.addProjectPillText, { color: userTokens.textSecondary }]}>
                  + {t(dictionary, "projects.newProject")}
                </Text>
              </TouchableOpacity>
            </View>

            {projects.length === 0 ? (
              <Card>
                <Text style={[styles.emptyTitle, { color: userTokens.textPrimary }]}>
                  {t(dictionary, "projects.emptyTitle")}
                </Text>
                <Text style={[styles.emptyDescription, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.emptyDescription")}
                </Text>
                <View style={styles.pendingCta}>
                  <Button
                    title={t(dictionary, "projects.newProject")}
                    onPress={openCreate}
                    disabled={!canEdit}
                  />
                </View>
              </Card>
            ) : (
              <View style={styles.projectsList}>
                {projects.map((project) => {
                  const projectColor = getProjectColor(project, projectColorMap);
                  const progress = computeProjectProgress({
                    project,
                    fundedMinor: fundedByProject.get(project.id) ?? 0n,
                    plannedThisMonthMinor: plannedByProject.get(project.id) ?? 0n,
                    spentMinor: extraContributionsByProject.get(project.id) ?? 0n,
                  });
                  const progressPercent = Math.round(progress.progressRatio * 100);

                  return (
                    <TouchableOpacity
                      key={project.id}
                      style={[
                        styles.projectCard,
                        {
                          backgroundColor: userTokens.surface,
                          borderColor: userTokens.border,
                        },
                      ]}
                      onPress={() => router.push(`/(auth)/(tabs)/projects/${project.id}`)}
                      activeOpacity={0.82}
                    >
                      <View style={styles.projectLeft}>
                        <ProjectProgressRing
                          progress={progress.progressRatio}
                          size={78}
                          strokeWidth={7}
                          trackColor={userTokens.surfaceAlt}
                          progressColor={projectColor}
                          center={<Text style={styles.projectEmoji}>{project.emoji || DEFAULT_PROJECT_EMOJI}</Text>}
                        />
                        <View style={styles.projectCopy}>
                          <Text
                            numberOfLines={1}
                            style={[styles.projectName, { color: userTokens.textPrimary }]}
                          >
                            {project.name}
                          </Text>
                          <Text style={[styles.projectAmounts, { color: userTokens.textSecondary }]}>
                            {formatMoneyWithSymbol(
                              progress.fundedReservedMinor,
                              baseCurrency,
                              currencySymbol
                            )}{" "}
                            {t(dictionary, "projects.of")}{" "}
                            {formatMoneyWithSymbol(
                              progress.targetMinor,
                              baseCurrency,
                              currencySymbol
                            )}
                          </Text>
                          <Text style={[styles.projectMeta, { color: userTokens.textSecondary }]}>
                            {locale === "en" ? "Planned this month" : "Planificado este mes"}:{" "}
                            {formatMoneyWithSymbol(
                              progress.plannedThisMonthMinor,
                              baseCurrency,
                              currencySymbol
                            )}{" "}
                            · {locale === "en" ? "Spent" : "Gastado"}:{" "}
                            {formatMoneyWithSymbol(
                              progress.spentMinor,
                              baseCurrency,
                              currencySymbol
                            )}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.projectRight}>
                        <Text style={[styles.projectPercent, { color: projectColor }]}>
                          {progressPercent}%
                        </Text>
                        {progress.monthsLeft !== null && progress.estimatedCompletionDate ? (
                          <Text style={[styles.projectEta, { color: userTokens.textSecondary }]}>
                            {locale === "en"
                              ? `${formatDuration(progress.monthsLeft, localeCode)} · ${formatEstimatedDate(progress.estimatedCompletionDate, localeCode)}`
                              : `${formatDuration(progress.monthsLeft, localeCode)} · ${formatEstimatedDate(progress.estimatedCompletionDate, localeCode)}`}
                          </Text>
                        ) : (
                          <Text style={[styles.projectNoPlan, { color: "#D97706" }]}>
                            {t(dictionary, "projects.noPlan")}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.commitmentCard,
                {
                  backgroundColor: userTokens.surface,
                  borderColor: userTokens.border,
                },
              ]}
              activeOpacity={0.82}
              onPress={() => router.push("/(auth)/(tabs)/projects/savings")}
            >
              <View style={styles.commitmentContent}>
                <View style={styles.commitmentLeft}>
                  <Text style={[styles.commitmentLabel, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "Monthly funding targets" : "Objetivos mensuales"}
                  </Text>
                  <Text style={[styles.commitmentValue, { color: userTokens.textPrimary }]}>
                    {formatMoneyWithSymbol(totalCommitmentMinor, baseCurrency, currencySymbol)}
                    <Text style={[styles.commitmentSuffix, { color: userTokens.textSecondary }]}>
                      {" "}
                      {t(dictionary, "projects.perMonth")}
                    </Text>
                  </Text>
                </View>
                <Text style={[styles.commitmentChevron, { color: userTokens.textSecondary }]}>
                  ›
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}

        <Modal
          transparent
          visible={isCreateOpen}
          animationType="slide"
          onRequestClose={() => setIsCreateOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setIsCreateOpen(false)} />
            <View
              style={[
                styles.modalSheet,
                { backgroundColor: userTokens.surface, borderColor: userTokens.border },
              ]}
            >
              <View style={[styles.modalHandle, { backgroundColor: userTokens.border }]} />
              <Text style={[styles.modalTitle, { color: userTokens.textPrimary }]}>
                {t(dictionary, "projects.create.title")}
              </Text>
              <Text style={[styles.modalDescription, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.create.description")}
              </Text>

              <Input
                label={t(dictionary, "projects.create.nameLabel")}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={t(dictionary, "projects.create.namePlaceholder")}
              />

              <Input
                label={t(dictionary, "projects.create.emojiLabel")}
                value={emojiInput}
                onChangeText={setEmojiInput}
                maxLength={8}
              />
              <View style={styles.emojiRow}>
                {PROJECT_EMOJI_SUGGESTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiChip,
                      {
                        borderColor: emojiInput === emoji ? primaryActionColor : userTokens.border,
                        backgroundColor:
                          emojiInput === emoji ? userTokens.surfaceAlt : userTokens.surface,
                      },
                    ]}
                    onPress={() => setEmojiInput(emoji)}
                  >
                    <Text style={styles.emojiChipText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label={t(dictionary, "projects.create.targetLabel")}
                value={targetInput}
                onChangeText={(value) => setTargetInput(sanitizeNumericInput(value))}
                keyboardType="numeric"
                placeholder={t(dictionary, "projects.create.targetPlaceholder")}
              />

              <Input
                label={t(dictionary, "projects.create.priorityLabel")}
                value={priorityInput}
                onChangeText={(value) => setPriorityInput(value.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                placeholder={String(nextPriority)}
              />

              {createError ? <Text style={styles.createError}>{createError}</Text> : null}

              <View style={styles.modalActions}>
                <Button
                  variant="secondary"
                  title={t(dictionary, "common.cancel")}
                  onPress={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                />
                <Button
                  title={
                    isCreating
                      ? t(dictionary, "common.creating")
                      : t(dictionary, "projects.create.submit")
                  }
                  onPress={() => void handleCreate()}
                  disabled={!canEdit || isCreating}
                  loading={isCreating}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const addMonths = (monthKey: string, delta: number) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const date = new Date(year, month - 1 + delta, 1);
  return toMonthKey(date);
};

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
  actions: {
    gap: tokens.spacing.sm,
  },
  huchaCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  huchaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  huchaTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  huchaSubtitle: {
    marginTop: 2,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  huchaAmountBlock: {
    alignItems: "flex-end",
  },
  huchaAmount: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  huchaAmountLabel: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
  },
  huchaStatsRow: {
    gap: 4,
  },
  huchaStatText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  pendingTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
    marginBottom: 4,
  },
  pendingDescription: {
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  pendingCta: {
    marginTop: tokens.spacing.md,
  },
  activeProjectsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  activeProjectsTitle: {
    fontSize: 11,
    fontFamily: "DMSans-SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  addProjectPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addProjectPillText: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
  },
  emptyTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  projectsList: {
    gap: tokens.spacing.sm,
  },
  projectCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  projectLeft: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    flex: 1,
  },
  projectEmoji: {
    fontSize: 28,
    lineHeight: 30,
  },
  projectCopy: {
    flex: 1,
    minWidth: 0,
  },
  projectName: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
  },
  projectAmounts: {
    marginTop: 2,
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  projectMeta: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  projectRight: {
    width: 88,
    alignItems: "flex-end",
  },
  projectPercent: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
  },
  projectEta: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
    textAlign: "right",
    fontFamily: "DMSans-Regular",
  },
  projectNoPlan: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
  },
  commitmentCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
  },
  commitmentContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  commitmentLeft: {
    flex: 1,
  },
  commitmentLabel: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
    marginBottom: 4,
  },
  commitmentValue: {
    fontSize: tokens.typography.size.xl,
    fontFamily: "DMSans-Bold",
  },
  commitmentSuffix: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Medium",
  },
  commitmentChevron: {
    fontSize: 28,
    lineHeight: 28,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  modalSheet: {
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: tokens.spacing.lg,
  },
  modalHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    marginBottom: tokens.spacing.md,
  },
  modalTitle: {
    fontSize: tokens.typography.size.xl,
    fontFamily: "DMSans-Bold",
  },
  modalDescription: {
    marginTop: 4,
    marginBottom: tokens.spacing.md,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  emojiChip: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emojiChipText: {
    fontSize: 20,
  },
  createError: {
    color: "#DC2626",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  modalActions: {
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
});
