import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { HomeProjectWidgetState, Project, ProjectProgress } from "@poleursus/shared";
import { themeTokens, withAlpha } from "@poleursus/shared";
import { useCopy, t } from "../../lib/i18n";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { formatCurrencyParts, toMinor } from "./utils";

const tokens = themeTokens.light;

type ObjectiveStatus = "on-track" | "at-risk" | "off-track";

type ObjectiveData = {
  status: ObjectiveStatus;
  currentMinor: bigint | string | number;
  targetMinor: bigint | string | number;
  messageHtml: string;
  streak?: Array<{ hit: boolean }>;
};

type ActiveProjectData = {
  project: Project;
  progress: ProjectProgress;
  monthlyImpactPercent: number;
};

type ProjectObjectiveWidgetProps = {
  widgetState: HomeProjectWidgetState;
  activeProject: ActiveProjectData | null;
  objective: ObjectiveData | null;
  participantCount?: number;
  onViewProject: (projectId: string) => void;
  onCreateProject: () => void;
  onCreateGoal: () => void;
  currencySymbol: string;
  locale?: string;
};

const statusConfig: Record<
  ObjectiveStatus,
  { fillKey: "positive" | "warning" | "negative" }
> = {
  "on-track": { fillKey: "positive" },
  "at-risk": { fillKey: "warning" },
  "off-track": { fillKey: "negative" },
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const formatMonthYear = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);

export function ProjectObjectiveWidget({
  widgetState,
  activeProject,
  objective,
  participantCount,
  onViewProject,
  onCreateProject,
  onCreateGoal,
  currencySymbol,
  locale = "es",
}: ProjectObjectiveWidgetProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor, resolvedMode } = useUserTheme();
  const modeColors = themeTokens[resolvedMode].colors;
  const safeParticipantCount = Math.max(1, participantCount ?? 1);

  if (widgetState.state === "empty") {
    return (
      <View
        style={[
          styles.card,
          styles.centered,
          { backgroundColor: userTokens.surface, borderColor: userTokens.border },
        ]}
      >
        <Text style={styles.heroEmoji}>✨</Text>
        <Text style={[styles.heroTitle, { color: userTokens.textPrimary }]}>
          {t(dictionary, "mobile.home.projectEmptyTitle", {
            participants: safeParticipantCount,
          })}
        </Text>
        <Text style={[styles.heroDescription, { color: userTokens.textSecondary }]}>
          {t(dictionary, "mobile.home.projectEmptyDescription", {
            participants: safeParticipantCount,
          })}
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: primaryActionColor }]}
          onPress={onCreateProject}
        >
          <Text style={styles.primaryButtonText}>
            {t(dictionary, "mobile.home.projectCreateCta")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (widgetState.state === "completed") {
    const completedProject = widgetState.project;
    const completedAmount = formatCurrencyParts(
      toMinor(completedProject.target_amount_base_minor),
      currencySymbol
    ).full;

    return (
      <View
        style={[
          styles.card,
          styles.centered,
          {
            backgroundColor: withAlpha(modeColors.state.positive, 0.13),
            borderColor: withAlpha(modeColors.state.positive, 0.3),
          },
        ]}
      >
        <Text style={styles.heroEmoji}>{completedProject.emoji || "🎯"}</Text>
        <Text style={[styles.heroTitle, { color: modeColors.state.positive }]}>
          {t(dictionary, "mobile.home.projectCompletedTitle", {
            name: completedProject.name,
            participants: safeParticipantCount,
          })}
        </Text>
        <Text style={[styles.heroDescription, { color: userTokens.textSecondary }]}>
          {t(dictionary, "mobile.home.projectCompletedDescription", {
            amount: completedAmount,
            participants: safeParticipantCount,
          })}
        </Text>
        <Text style={styles.heroEmoji}>🎉</Text>
        <TouchableOpacity
          style={[
            styles.secondaryButton,
            { borderColor: withAlpha(modeColors.state.positive, 0.35) },
        ]}
        onPress={() => onViewProject(completedProject.id)}
      >
        <Text style={[styles.secondaryButtonText, { color: modeColors.state.positive }]}>
          {t(dictionary, "mobile.home.projectCompletedCta", {
            participants: safeParticipantCount,
          })}
        </Text>
      </TouchableOpacity>
      </View>
    );
  }

  if (widgetState.state === "all_done") {
    return (
      <View
        style={[
          styles.card,
          styles.centered,
          { backgroundColor: userTokens.surface, borderColor: userTokens.border },
        ]}
      >
        <Text style={styles.heroEmoji}>🌟</Text>
        <Text style={[styles.heroTitle, { color: userTokens.textPrimary }]}>
          {t(dictionary, "mobile.home.projectAllDoneTitle", {
            participants: safeParticipantCount,
          })}
        </Text>
        <Text style={[styles.heroDescription, { color: userTokens.textSecondary }]}>
          {t(dictionary, "mobile.home.projectAllDoneDescription", {
            participants: safeParticipantCount,
          })}
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: primaryActionColor }]}
          onPress={onCreateProject}
        >
          <Text style={styles.primaryButtonText}>
            {t(dictionary, "mobile.home.projectAllDoneCta", {
              participants: safeParticipantCount,
            })}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!activeProject) return null;

  const projectProgressPercent = clampPercent(
    Math.round(activeProject.progress.progressRatio * 100)
  );
  const saved = formatCurrencyParts(activeProject.progress.savedMinor, currencySymbol).full;
  const target = formatCurrencyParts(activeProject.progress.targetMinor, currencySymbol).full;

  const objectiveConfig = objective
    ? statusConfig[objective.status] ?? statusConfig["at-risk"]
    : null;
  const objectiveFillColor = objectiveConfig
    ? modeColors.state[objectiveConfig.fillKey]
    : modeColors.state.positive;

  const savedNum = objective ? Number(toMinor(objective.currentMinor)) : 0;
  const targetNum = objective ? Number(toMinor(objective.targetMinor)) : 0;
  const barScale = Math.max(savedNum, targetNum, 1);
  const fillPercent = clampPercent(Math.round((Math.max(0, savedNum) / barScale) * 100));
  const markerPercent = clampPercent(Math.round((targetNum / barScale) * 100));

  const statusIconChar =
    objective?.status === "on-track" ? "✓" : objective?.status === "off-track" ? "✕" : "!";

  const objectiveCurrent = objective
    ? formatCurrencyParts(toMinor(objective.currentMinor), currencySymbol).full
    : "";
  const objectiveTarget = objective
    ? formatCurrencyParts(toMinor(objective.targetMinor), currencySymbol).full
    : "";

  return (
    <View
      style={[
        styles.card,
        styles.activeCard,
        { backgroundColor: userTokens.surface, borderColor: userTokens.border },
      ]}
    >
      <View style={styles.projectHeader}>
        <View style={styles.projectHeaderLeft}>
          <Text style={styles.projectEmoji}>{activeProject.project.emoji || "🎯"}</Text>
          <View style={styles.projectHeaderText}>
            <Text
              style={[styles.projectName, { color: userTokens.textPrimary }]}
              numberOfLines={1}
            >
              {activeProject.project.name}
            </Text>
            <Text style={[styles.projectAmounts, { color: userTokens.textSecondary }]}>
              {saved} {t(dictionary, "projects.of")} {target}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => onViewProject(activeProject.project.id)}>
          <Text style={[styles.link, { color: primaryActionColor }]}>
            {t(dictionary, "mobile.home.projectViewDetail", {
              participants: safeParticipantCount,
            })}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: userTokens.surfaceAlt }]}>
        <View
          style={[
            styles.projectProgressFill,
            { width: `${projectProgressPercent}%`, backgroundColor: primaryActionColor },
          ]}
        />
      </View>

      <View style={styles.projectMeta}>
        <Text style={[styles.projectPercent, { color: modeColors.state.positive }]}>
          {projectProgressPercent}%
        </Text>
        <Text style={[styles.projectEta, { color: userTokens.textSecondary }]}>
          {activeProject.progress.estimatedCompletionDate
            ? `📅 ${formatMonthYear(activeProject.progress.estimatedCompletionDate, locale)}`
            : t(dictionary, "mobile.home.projectNoPlan", {
                participants: safeParticipantCount,
              })}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: userTokens.border }]} />

      {objective ? (
        <View>
          <View style={styles.objectiveHeader}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: withAlpha(objectiveFillColor, 0.2) },
                { borderColor: withAlpha(objectiveFillColor, 0.35) },
              ]}
            >
              <Text style={[styles.statusIconText, { color: objectiveFillColor }]}>
                {statusIconChar}
              </Text>
            </View>
            <Text style={[styles.objectiveHeadline, { color: userTokens.textPrimary, fontWeight: tokens.typography.weight.semibold, fontFamily: "DMSans-SemiBold" }]}>
              {t(dictionary, "mobile.home.objectiveHeadlineLabel", {
                amount: objectiveTarget,
              })}
            </Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: userTokens.surfaceAlt }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${fillPercent}%`, backgroundColor: objectiveFillColor },
              ]}
            />
            <View
              style={[
                styles.expectedMarker,
                { left: `${markerPercent}%`, backgroundColor: userTokens.textPrimary },
              ]}
            />
          </View>

          <View style={styles.objectiveMeta}>
            {savedNum > targetNum ? (
              <>
                <Text style={[styles.objectiveMetaText, { color: userTokens.textSecondary, flex: markerPercent, textAlign: "right" }]}>
                  {objectiveTarget}
                </Text>
                <Text style={[styles.objectiveMetaStrong, { color: userTokens.textPrimary, flex: 100 - markerPercent, textAlign: "right" }]}>
                  {objectiveCurrent}
                </Text>
              </>
            ) : savedNum < targetNum ? (
              <>
                <Text style={[styles.objectiveMetaStrong, { color: userTokens.textPrimary }]}>
                  {objectiveCurrent}
                </Text>
                <Text style={[styles.objectiveMetaText, { color: userTokens.textSecondary, textAlign: "right" }]}>
                  {objectiveTarget}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.objectiveMetaText, { color: userTokens.textSecondary }]} />
                <Text style={[styles.objectiveMetaStrong, { color: modeColors.state.positive }]}>
                  {objectiveCurrent} ✓
                </Text>
              </>
            )}
          </View>

          <View style={[styles.messageBox, { backgroundColor: userTokens.surfaceAlt }]}>
            <Text style={[styles.messageText, { color: userTokens.textSecondary }]}>
              {t(dictionary, "mobile.home.projectMotivationMessage", {
                project: activeProject.project.name,
                percent: activeProject.monthlyImpactPercent,
                participants: safeParticipantCount,
              })}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.messageBox, { backgroundColor: userTokens.surfaceAlt }]}>
          <Text style={[styles.messageText, { color: userTokens.textSecondary }]}>
            {t(dictionary, "mobile.home.emptyGoalDescription")}
          </Text>
          <TouchableOpacity onPress={onCreateGoal}>
            <Text style={[styles.link, { color: primaryActionColor }]}>
              {t(dictionary, "mobile.home.emptyGoalCta")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
  },
  activeCard: {
    gap: tokens.spacing.sm,
  },
  centered: {
    alignItems: "center",
  },
  heroEmoji: {
    fontSize: 36,
    marginBottom: tokens.spacing.sm,
  },
  heroTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    textAlign: "center",
    fontFamily: "DMSans-SemiBold",
  },
  heroDescription: {
    marginTop: 4,
    fontSize: tokens.typography.size.sm,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  primaryButton: {
    marginTop: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  secondaryButton: {
    marginTop: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
  },
  secondaryButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  projectHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  projectEmoji: {
    fontSize: 28,
    marginRight: tokens.spacing.sm,
  },
  projectHeaderText: {
    flex: 1,
  },
  projectName: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  projectAmounts: {
    fontSize: tokens.typography.size.xs,
    marginTop: 1,
    fontFamily: "DMSans-Regular",
  },
  link: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
  },
  projectProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  expectedMarker: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  projectMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  projectPercent: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  projectEta: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  divider: {
    height: 1,
    marginVertical: tokens.spacing.xs,
  },
  objectiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.spacing.xs,
  },
  statusIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.xs,
  },
  statusIconText: {
    fontSize: 12,
    fontFamily: "DMSans-SemiBold",
  },
  objectiveHeadline: {
    flex: 1,
    fontSize: tokens.typography.size.sm,
    lineHeight: 18,
    fontFamily: "DMSans-Regular",
  },
  objectiveHeadlineStrong: {
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  objectiveMeta: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  objectiveMetaText: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  objectiveMetaStrong: {
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "JetBrainsMono-Medium",
  },
  messageBox: {
    marginTop: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: 8,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "DMSans-Regular",
  },
});
