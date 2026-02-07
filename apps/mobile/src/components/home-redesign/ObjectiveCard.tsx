import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { formatCurrencyParts, toMinor } from "./utils";

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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Objetivo</Text>
        <TouchableOpacity onPress={onNavigate}>
          <Text style={styles.link}>Ver detalle →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusIcon, { backgroundColor: config.bgColor }]}
        >
          <Text style={styles.statusIconText}>{config.icon}</Text>
        </View>
        <View>
          <Text style={styles.statusLabel}>{objective.statusLabel}</Text>
          <Text style={styles.statusDescription}>{objective.description}</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${objective.progressPercent}%`, backgroundColor: config.progressColor },
            ]}
          />
          <View
            style={[
              styles.progressMarker,
              { left: `${objective.expectedPercent}%` },
            ]}
          />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.progressText}>
            <Text style={styles.progressStrong}>{current.full}</Text> ahorrado
          </Text>
          <Text style={styles.progressText}>de {target.full}</Text>
        </View>
      </View>

      <View style={styles.messageBox}>
        <Text style={styles.messageText}>
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
              ]}
            />
          ))}
          <Text style={styles.streakLabel}>
            {objective.streak.filter((m) => m.hit).length} de {objective.streak.length} meses
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    backgroundColor: colors.bg.surface,
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
    color: colors.text.primary,
    fontFamily: "DMSans-SemiBold",
  },
  link: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
    color: colors.action.primary,
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
    color: colors.text.primary,
  },
  statusLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    fontFamily: "DMSans-SemiBold",
  },
  statusDescription: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
    fontFamily: "DMSans",
  },
  progressSection: {
    marginBottom: tokens.spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.bg.secondary,
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
    backgroundColor: colors.text.secondary,
    borderRadius: 2,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressText: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
    fontFamily: "DMSans",
  },
  progressStrong: {
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    fontFamily: "JetBrainsMono-Medium",
  },
  messageBox: {
    backgroundColor: colors.bg.secondary,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  messageText: {
    fontSize: 13,
    color: colors.text.secondary,
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
    color: colors.text.secondary,
    fontFamily: "DMSans",
  },
});
