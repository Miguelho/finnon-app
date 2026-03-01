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
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addMonths,
  assignProjectColor,
  buildProjectColorMap,
  CURRENCIES,
  computePendingMonthCloseKeys,
  computeProjectProgress,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getProjectColor,
  getHuchaStats,
  HUCHA_PROJECT_COLOR,
  getMonthlyProjectCommitmentTotal,
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
import { ProjectProgressRing } from "../../../../src/components/projects/ProjectProgressRing";

const tokens = themeTokens.light;
const DEFAULT_EMOJI = "\u{1F3AF}";
const EMOJI_SUGGESTIONS = [
  "\u{1F3AF}",
  "\u{1F3F0}",
  "\u{1F4BB}",
  "\u{1F697}",
  "\u{1F3E0}",
  "\u{2708}\u{FE0F}",
  "\u{1F3D6}\u{FE0F}",
  "\u{1F6B2}",
  "\u{1F4CD}",
];

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

export default function ProjectsScreen() {
  const router = useRouter();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contributions, setContributions] = useState<ProjectContribution[]>([]);
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [hasPendingMonthlyClose, setHasPendingMonthlyClose] = useState(false);
  const [pendingMonthKey, setPendingMonthKey] = useState(
    addMonths(toMonthKey(new Date()), -1)
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [emojiInput, setEmojiInput] = useState(DEFAULT_EMOJI);
  const [targetInput, setTargetInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("");

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId) {
      setLoading(false);
      setProjects([]);
      setContributions([]);
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

      const { data: projectRows, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("account_id", selectedAccountId)
        .eq("status", "active")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (projectsError) throw projectsError;

      const currentProjects = (projectRows ?? []) as Project[];
      const projectIds = currentProjects.map((project) => project.id);

      const { data: contributionRows, error: contributionsError } =
        projectIds.length > 0
          ? await supabase
              .from("project_contributions")
              .select("*")
              .in("project_id", projectIds)
          : { data: [] as ProjectContribution[], error: null };

      if (contributionsError) throw contributionsError;

      const currentMonthKey = toMonthKey(new Date());
      const currentPendingMonthKey = addMonths(currentMonthKey, -1);

      const projectsWithCommitment = currentProjects.filter((project) => {
        return !project.is_hucha && toMinor(project.monthly_commitment_base_minor) > 0n;
      });
      const pendingMonthKeys = computePendingMonthCloseKeys({
        commitmentProjects: projectsWithCommitment.map((project) => ({
          projectId: project.id,
          createdAt: project.created_at ?? null,
        })),
        confirmedContributions: ((contributionRows ?? []) as Array<{
          project_id: string;
          confirmed?: boolean;
          period: string | Date;
        }>)
          .filter((row) => Boolean(row.confirmed))
          .map((row) => ({
            projectId: row.project_id,
            period: row.period,
          })),
        currentMonthKey,
      });
      const pending = pendingMonthKeys.length > 0;
      const latestPendingMonthKey = pendingMonthKeys[0] ?? currentPendingMonthKey;

      setRole(currentRole);
      setBaseCurrency(currentCurrency);
      setCurrencySymbol(currentSymbol);
      setProjects(currentProjects);
      setContributions((contributionRows ?? []) as ProjectContribution[]);
      setHasPendingMonthlyClose(pending);
      setPendingMonthKey(latestPendingMonthKey);
    } catch (loadError) {
      console.error("[Projects][mobile] loadData error", loadError);
      setError(t(dictionary, "errors.internalServer"));
      setProjects([]);
      setContributions([]);
    } finally {
      setLoading(false);
    }
  }, [dictionary, selectedAccountId, user]);

  useEffect(() => {
    if (isFocused) {
      void loadData();
    }
  }, [isFocused, loadData]);

  const canEdit = role !== "viewer";

  const contributionsByProject = useMemo(() => {
    const byProject = new Map<string, ProjectContribution[]>();
    contributions.forEach((entry) => {
      const list = byProject.get(entry.project_id) ?? [];
      list.push(entry);
      byProject.set(entry.project_id, list);
    });
    return byProject;
  }, [contributions]);

  const totalCommitmentMinor = useMemo(
    () => getMonthlyProjectCommitmentTotal(projects, { activeOnly: true }),
    [projects]
  );

  const huchaProject = useMemo(
    () => projects.find((project) => project.is_hucha) ?? null,
    [projects]
  );

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.is_hucha),
    [projects]
  );
  const projectColorMap = useMemo(() => buildProjectColorMap(projects), [projects]);

  const huchaStats = useMemo(
    () =>
      getHuchaStats({
        huchaProjectId: huchaProject?.id,
        contributions,
        currentPeriod: toMonthKey(new Date()),
      }),
    [contributions, huchaProject?.id]
  );

  const nextPriority = useMemo(() => {
    const highest = activeProjects.reduce(
      (currentHighest, project) => Math.max(currentHighest, project.priority),
      0
    );
    return highest + 1;
  }, [activeProjects]);

  const openCreate = () => {
    setCreateError(null);
    setNameInput("");
    setEmojiInput(DEFAULT_EMOJI);
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
    const nextColor = assignProjectColor(
      projects.filter((project) => !project.is_hucha)
    );
    try {
      const { data, error: insertError } = await supabase
        .from("projects")
        .insert({
          account_id: selectedAccountId,
          name: trimmedName,
          emoji: emojiInput.trim() || DEFAULT_EMOJI,
          color: nextColor,
          is_hucha: false,
          target_amount_base_minor: String(parsedTarget),
          priority: safePriority,
          status: "active",
          created_by: user.id,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      setProjects((previous) =>
        [...previous, data as Project].sort((a, b) => a.priority - b.priority)
      );
      setIsCreateOpen(false);
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
            <Card title={t(dictionary, "common.errorTitle")} description={error}>
              <Button onPress={() => void loadData()} title={t(dictionary, "common.retry")} />
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
                title={t(dictionary, "projects.monthClose.openCta")}
                onPress={() => router.push("/(auth)/(tabs)/projects/month-close")}
              />
            </View>

            {huchaProject ? (
              <TouchableOpacity
                style={[
                  styles.huchaCard,
                  {
                    backgroundColor: userTokens.surface,
                    borderColor: "rgba(109, 201, 160, 0.45)",
                  },
                ]}
                activeOpacity={0.82}
                onPress={() => router.push(`/(auth)/(tabs)/projects/${huchaProject.id}`)}
              >
                <View style={styles.huchaFrameTop}>
                  <View style={styles.huchaFrameTopLeft} />
                  <View style={styles.huchaFrameTopRight} />
                </View>
                <View style={styles.huchaBody}>
                  <View style={styles.huchaHeader}>
                    <View style={styles.huchaHeaderLeft}>
                      <Text style={[styles.huchaTitle, { color: userTokens.textPrimary }]}>
                        {huchaProject.emoji || "🐷"} {t(dictionary, "home.savings.hucha")}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[styles.huchaSubtitle, { color: userTokens.textSecondary }]}
                      >
                        {t(dictionary, "projects.hucha.subtitle")}
                      </Text>
                    </View>
                    <View style={styles.huchaAmountBlock}>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={[styles.huchaAmount, { color: HUCHA_PROJECT_COLOR }]}
                      >
                        {formatMoneyWithSymbol(
                          huchaStats.accumulatedMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.huchaAmountLabel, { color: userTokens.textSecondary }]}
                      >
                        {t(dictionary, "projects.hucha.accumulated")}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.huchaStatsRow}>
                    <View style={styles.huchaStatItem}>
                      <Text style={[styles.huchaStatLabel, { color: userTokens.textSecondary }]}>
                        {t(dictionary, "projects.hucha.thisMonth")}
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                        style={[styles.huchaStatValue, { color: HUCHA_PROJECT_COLOR }]}
                      >
                        +{formatMoneyWithSymbol(
                          huchaStats.currentMonthContributionMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                      </Text>
                    </View>
                    <View style={styles.huchaStatItem}>
                      <Text style={[styles.huchaStatLabel, { color: userTokens.textSecondary }]}>
                        {t(dictionary, "projects.hucha.monthlyAverage")}
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                        style={[styles.huchaStatValue, { color: HUCHA_PROJECT_COLOR }]}
                      >
                        {formatMoneyWithSymbol(
                          huchaStats.averageMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}

            {hasPendingMonthlyClose ? (
              <Card>
                <Text style={[styles.pendingTitle, { color: userTokens.textPrimary }]}>
                  {t(dictionary, "projects.monthClose.pendingTitle")}
                </Text>
                <Text style={[styles.pendingDescription, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.monthClose.pendingDescription", {
                    month: formatMonthLabel(pendingMonthKey, locale),
                  })}
                </Text>
                <View style={styles.pendingCta}>
                  <Button
                    title={t(dictionary, "projects.monthClose.reviewCta")}
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

            {activeProjects.length === 0 ? (
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
                {activeProjects.map((project) => {
                  const projectColor = getProjectColor(project, projectColorMap);
                  const progress = computeProjectProgress({
                    project,
                    contributions: contributionsByProject.get(project.id) ?? [],
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
                          center={<Text style={styles.projectEmoji}>{project.emoji || DEFAULT_EMOJI}</Text>}
                        />
                        <View style={styles.projectCopy}>
                          <Text
                            numberOfLines={1}
                            style={[styles.projectName, { color: userTokens.textPrimary }]}
                          >
                            {project.name}
                          </Text>
                          <Text style={[styles.projectAmounts, { color: userTokens.textSecondary }]}>
                            {formatMoneyWithSymbol(progress.savedMinor, baseCurrency, currencySymbol)}{" "}
                            {t(dictionary, "projects.of")}{" "}
                            {formatMoneyWithSymbol(progress.targetMinor, baseCurrency, currencySymbol)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.projectRight}>
                        <Text style={[styles.projectPercent, { color: projectColor }]}>
                          {progressPercent}%
                        </Text>
                        {progress.monthsLeft !== null && progress.estimatedCompletionDate ? (
                          <Text style={[styles.projectEta, { color: userTokens.textSecondary }]}>
                            {t(dictionary, "projects.estimatedDate", {
                              duration: formatDuration(progress.monthsLeft, dictionary),
                              date: formatEstimatedDate(progress.estimatedCompletionDate, locale),
                            })}
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
                    {t(dictionary, "projects.totalCommitment")}
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
                {EMOJI_SUGGESTIONS.map((emoji) => (
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
                onChangeText={(value) =>
                  setPriorityInput(value.replace(/[^0-9]/g, ""))
                }
                keyboardType="numeric"
                placeholder={String(nextPriority)}
              />

              {createError ? (
                <Text style={styles.createError}>{createError}</Text>
              ) : null}

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
                  onPress={handleCreate}
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

const formatEstimatedDate = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);

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
  actions: {
    gap: tokens.spacing.sm,
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
  huchaCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    overflow: "hidden",
  },
  huchaFrameTop: {
    height: 6,
    flexDirection: "row",
  },
  huchaFrameTopLeft: {
    flex: 1,
    backgroundColor: HUCHA_PROJECT_COLOR,
  },
  huchaFrameTopRight: {
    flex: 1,
    backgroundColor: "#5ECBA1",
  },
  huchaBody: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  huchaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.md,
  },
  huchaHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  huchaTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  huchaSubtitle: {
    marginTop: 2,
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  huchaAmountBlock: {
    alignItems: "flex-end",
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "46%",
  },
  huchaAmount: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
    textAlign: "right",
    flexShrink: 1,
  },
  huchaAmountLabel: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
    textAlign: "right",
  },
  huchaStatsRow: {
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  huchaStatItem: {
    flex: 1,
    minWidth: 0,
  },
  huchaStatLabel: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  huchaStatValue: {
    marginTop: 2,
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-SemiBold",
    flexShrink: 1,
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
    gap: tokens.spacing.sm,
  },
  commitmentLeft: {
    flex: 1,
    minWidth: 0,
  },
  commitmentLabel: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  commitmentValue: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: tokens.typography.weight.bold,
    fontFamily: "DMSans-Bold",
  },
  commitmentSuffix: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    fontFamily: "DMSans-Medium",
  },
  commitmentChevron: {
    fontSize: 24,
    fontFamily: "DMSans-Regular",
  },
  pendingTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  pendingDescription: {
    marginTop: 4,
    fontSize: tokens.typography.size.sm,
    lineHeight: 18,
    fontFamily: "DMSans-Regular",
  },
  pendingCta: {
    marginTop: tokens.spacing.sm,
  },
  emptyTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-SemiBold",
  },
  emptyDescription: {
    marginTop: 4,
    fontSize: tokens.typography.size.sm,
    lineHeight: 18,
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  projectLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  projectEmoji: {
    fontSize: 24,
  },
  projectCopy: {
    flex: 1,
    minWidth: 0,
  },
  projectName: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-SemiBold",
  },
  projectAmounts: {
    marginTop: 2,
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  projectRight: {
    alignItems: "flex-end",
    maxWidth: "38%",
  },
  projectPercent: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Bold",
  },
  projectEta: {
    marginTop: 2,
    fontSize: 11,
    textAlign: "right",
    fontFamily: "DMSans-Regular",
  },
  projectNoPlan: {
    marginTop: 2,
    fontSize: 11,
    textAlign: "right",
    fontFamily: "DMSans-SemiBold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.xs,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    marginBottom: tokens.spacing.xs,
  },
  modalTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  modalDescription: {
    marginBottom: tokens.spacing.sm,
    fontSize: tokens.typography.size.sm,
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
    paddingVertical: 6,
  },
  emojiChipText: {
    fontSize: 18,
  },
  createError: {
    marginTop: 4,
    color: "#DC2626",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  modalActions: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
});
