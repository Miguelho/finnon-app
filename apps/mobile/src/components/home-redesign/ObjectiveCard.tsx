import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens, withAlpha } from "@poleursus/shared";
import { formatCurrencyParts, toMinor } from "./utils";
import { useCopy, t } from "../../lib/i18n";
import { useUserTheme } from "../../contexts/UserThemeContext";

const tokens = themeTokens.light;
const colors = tokens.colors;

type ObjectiveStatus = "on-track" | "at-risk" | "off-track";

type ObjectiveData = {
  status: ObjectiveStatus;
  currentMinor: string;
  targetMinor: string;
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
  const { tokens: userTokens, primaryActionColor, resolvedMode } = useUserTheme();
  const modeColors = themeTokens[resolvedMode].colors;

  if (!objective) return null;

  const statusConfig: Record<
    ObjectiveStatus,
    { icon: string; bgColor: string; progressColor: string; iconColor: string }
  > = {
    "on-track": {
      icon: "✓",
      bgColor: withAlpha(modeColors.state.positive, resolvedMode === "dark" ? 0.32 : 0.16),
      progressColor: modeColors.state.positive,
      iconColor: modeColors.text.primary,
    },
    "at-risk": {
      icon: "⚠",
      bgColor: withAlpha(modeColors.state.warning, resolvedMode === "dark" ? 0.32 : 0.2),
      progressColor: modeColors.state.warning,
      iconColor: modeColors.text.primary,
    },
    "off-track": {
      icon: "✕",
      bgColor: withAlpha(modeColors.state.negative, resolvedMode === "dark" ? 0.32 : 0.16),
      progressColor: modeColors.state.negative,
      iconColor: modeColors.text.primary,
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

  const savedNum = Number(toMinor(objective.currentMinor));
  const targetNum = Number(toMinor(objective.targetMinor));
  const barScale = Math.max(savedNum, targetNum, 1);
  const clampPercent = (v: number) => Math.min(100, Math.max(0, v));
  const fillPercent = clampPercent(Math.round((Math.max(0, savedNum) / barScale) * 100));
  const markerPercent = clampPercent(Math.round((targetNum / barScale) * 100));

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
          <Text style={[styles.statusIconText, { color: config.iconColor }]}>
            {config.icon}
          </Text>
        </View>
        <Text style={[styles.statusLabel, { color: userTokens.textPrimary }]}>
          {t(dictionary, "mobile.home.objectiveHeadlineLabel", {
            amount: target.full,
          })}
        </Text>
      </View>

      <View style={styles.progressSection}>
        <View style={[styles.progressTrack, { backgroundColor: userTokens.surfaceAlt }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${fillPercent}%`, backgroundColor: config.progressColor },
            ]}
          />
          <View
            style={[
              styles.progressMarker,
              { backgroundColor: userTokens.textPrimary },
              { left: `${markerPercent}%` },
            ]}
          />
        </View>
        <View style={styles.progressMeta}>
          {savedNum > targetNum ? (
            <>
              <Text style={[styles.progressText, { color: userTokens.textSecondary, flex: markerPercent, textAlign: "right" }]}>
                {target.full}
              </Text>
              <Text style={[styles.progressStrong, { color: userTokens.textPrimary, flex: 100 - markerPercent, textAlign: "right" }]}>
                {current.full}
              </Text>
            </>
          ) : savedNum < targetNum ? (
            <>
              <Text style={[styles.progressStrong, { color: userTokens.textPrimary }]}>
                {current.full}
              </Text>
              <Text style={[styles.progressText, { color: userTokens.textSecondary, textAlign: "right" }]}>
                {target.full}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.progressText, { color: userTokens.textSecondary }]} />
              <Text style={[styles.progressStrong, { color: colors.state.positive }]}>
                {current.full} ✓
              </Text>
            </>
          )}
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
