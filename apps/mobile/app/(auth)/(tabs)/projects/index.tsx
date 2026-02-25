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
  CURRENCIES,
  computeProjectProgress,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getMonthRangeFromKey,
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
      const pendingRange = getMonthRangeFromKey(currentPendingMonthKey);

      const projectsWithCommitment = currentProjects.filter((project) => {
        return toMinor(project.monthly_commitment_base_minor) > 0n;
      });
      const commitmentProjectIds = projectsWithCommitment.map((project) => project.id);

      const { data: pendingMonthConfirmed, error: pendingError } =
        commitmentProjectIds.length > 0
          ? await supabase
              .from("project_contributions")
              .select("project_id")
              .eq("account_id", selectedAccountId)
              .eq("period", pendingRange.start)
              .eq("confirmed", true)
              .in("project_id", commitmentProjectIds)
          : { data: [] as Array<{ project_id: string }>, error: null };

      if (pendingError) throw pendingError;

      const confirmedProjectIds = new Set(
        (pendingMonthConfirmed ?? []).map((item) => item.project_id)
      );
      const pending =
        commitmentProjectIds.length > 0 &&
        commitmentProjectIds.some((projectId) => !confirmedProjectIds.has(projectId));

      setRole(currentRole);
      setBaseCurrency(currentCurrency);
      setCurrencySymbol(currentSymbol);
      setProjects(currentProjects);
      setContributions((contributionRows ?? []) as ProjectContribution[]);
      setHasPendingMonthlyClose(pending);
      setPendingMonthKey(currentPendingMonthKey);
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
    try {
      const { data, error: insertError } = await supabase
        .from("projects")
        .insert({
          account_id: selectedAccountId,
          name: trimmedName,
          emoji: emojiInput.trim() || DEFAULT_EMOJI,
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
            <View style={styles.header}>
              <Text style={[styles.title, { color: userTokens.textPrimary }]}>
                {t(dictionary, "projects.pageTitle")}
              </Text>
              <Text style={[styles.description, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.pageDescription")}
              </Text>
            </View>

            <View style={styles.actions}>
              <Button
                variant="secondary"
                title={t(dictionary, "projects.monthClose.openCta")}
                onPress={() =>
                  router.push(`/(auth)/(tabs)/projects/month-close?month=${pendingMonthKey}`)
                }
              />
              <Button
                title={t(dictionary, "projects.newProject")}
                onPress={openCreate}
                disabled={!canEdit}
              />
            </View>

            <Card>
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
            </Card>

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
                          progressColor={primaryActionColor}
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
                        <Text style={[styles.projectPercent, { color: userTokens.textPrimary }]}>
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
  header: {
    gap: tokens.spacing.xs,
  },
  actions: {
    gap: tokens.spacing.sm,
  },
  title: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    fontFamily: "DMSans-Bold",
  },
  description: {
    fontSize: tokens.typography.size.md,
    lineHeight: 22,
    fontFamily: "DMSans-Regular",
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
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
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
