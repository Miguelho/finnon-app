import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { formatCurrencyParts, toMinor } from "./utils";
import { useCopy, t } from "../../lib/i18n";
import { useUserTheme } from "../../contexts/UserThemeContext";

const tokens = themeTokens.light;
const colors = tokens.colors;

type ObjectiveStatus = "on-track" | "at-risk" | "off-track";

type ObjectiveData = {
  status: ObjectiveStatus;
  statusLabel: string;
  description: string;
  currentMinor: string;
  targetMinor: string;
  progressPercent: number;
  expectedPercent: number;
  messageHtml: string;
  streak: Array<{ hit: boolean }>;
};

type ObjectiveCardProps = {
  objective: ObjectiveData | null;
  onNavigate: () => void;
  currencySymbol: string;
};

export function ObjectiveCard({
  objective,
  onNavigate,
  currencySymbol,
}: ObjectiveCardProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  if (!objective) return null;

  const statusConfig: Record<
    ObjectiveStatus,
    { icon: string; bgColor: string; progressColor: string }
  > = {
    "on-track": {
      icon: "✓",
      bgColor: "#F0FDF4",
      progressColor: colors.state.positive,
    },
    "at-risk": {
      icon: "⚠",
      bgColor: "#FFFBEB",
      progressColor: colors.state.warning,
    },
    "off-track": {
      icon: "✕",
      bgColor: "#FEF2F2",
      progressColor: colors.state.negative,
    },
  };

  const config = statusConfig[objective.status] ?? statusConfig["at-risk"];
  const current = formatCurrencyParts(
    toMinor(objective.currentMinor),
    currencySymbol
  );
  const target = formatCurrencyParts(
    toMinor(objective.targetMinor),
    currencySymbol
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: userTokens.surface, borderColor: userTokens.border },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: userTokens.textPrimary }]}>
          {t(dictionary, "mobile.home.objectiveTitle")}
        </Text>
        <TouchableOpacity onPress={onNavigate}>
          <Text style={[styles.link, { color: primaryActionColor }]}>
            {t(dictionary, "mobile.home.objectiveViewDetail")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusIcon, { backgroundColor: config.bgColor }]}
        >
          <Text style={[styles.statusIconText, { color: userTokens.textPrimary }]}>
            {config.icon}
          </Text>
        </View>
        <View>
          <Text style={[styles.statusLabel, { color: userTokens.textPrimary }]}>
            {objective.statusLabel}
          </Text>
          <Text style={[styles.statusDescription, { color: userTokens.textSecondary }]}>
            {objective.description}
          </Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={[styles.progressTrack, { backgroundColor: userTokens.surfaceAlt }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${objective.progressPercent}%`, backgroundColor: config.progressColor },
            ]}
          />
          <View
            style={[
              styles.progressMarker,
              { backgroundColor: userTokens.textSecondary },
              { left: `${objective.expectedPercent}%` },
            ]}
          />
        </View>
        <View style={styles.progressMeta}>
          <Text style={[styles.progressText, { color: userTokens.textSecondary }]}>
            <Text style={[styles.progressStrong, { color: userTokens.textPrimary }]}>
              {current.full}
            </Text>{" "}
            {t(dictionary, "mobile.home.objectiveSavedSuffix")}
          </Text>
          <Text style={[styles.progressText, { color: userTokens.textSecondary }]}>
            {t(dictionary, "mobile.home.objectiveOfPrefix")} {target.full}
          </Text>
        </View>
      </View>

      <View style={[styles.messageBox, { backgroundColor: userTokens.surfaceAlt }]}>
        <Text style={[styles.messageText, { color: userTokens.textSecondary }]}>
          {objective.messageHtml.replace(/<[^>]+>/g, "")}
        </Text>
      </View>

      {objective.streak?.length ? (
        <View style={styles.streakRow}>
          {objective.streak.map((month, index) => (
            <View
              key={`streak-${index}`}
              style={[
                styles.streakDot,
                month.hit ? styles.streakDotHit : styles.streakDotMiss,
                !month.hit && { backgroundColor: userTokens.border },
              ]}
            />
          ))}
          <Text style={[styles.streakLabel, { color: userTokens.textSecondary }]}>
            {t(dictionary, "mobile.home.objectiveStreak", {
              hit: objective.streak.filter((m) => m.hit).length,
              total: objective.streak.length,
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  link: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
    fontFamily: "DMSans-Medium",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.spacing.md,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.sm,
  },
  statusIconText: {
    fontSize: 16,
  },
  statusLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  statusDescription: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans",
  },
  progressSection: {
    marginBottom: tokens.spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressMarker: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 10,
    borderRadius: 2,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressText: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans",
  },
  progressStrong: {
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "JetBrainsMono-Medium",
  },
  messageBox: {
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "DMSans",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: tokens.spacing.xs,
  },
  streakDotHit: {
    backgroundColor: colors.state.positive,
  },
  streakDotMiss: {
    backgroundColor: colors.state.neutral,
  },
  streakLabel: {
    marginLeft: tokens.spacing.xs,
    fontSize: 11,
    fontFamily: "DMSans",
  },
});
