import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ChevronRight } from "lucide-react-native";
import { HUCHA_PROJECT_COLOR, PROJECT_PALETTE, themeTokens, withAlpha } from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { useCopy, t } from "../../lib/i18n";
import { formatCurrencyParts, toMinor } from "./utils";

const tokens = themeTokens.light;

type ProjectRowItem = {
  id: string;
  name: string;
  emoji: string;
  currentAmountMinor: bigint;
  goalAmountMinor: bigint;
  color: string;
};

type ProjectsRowProps = {
  projects: ProjectRowItem[];
  huchaAmountMinor: bigint;
  totalSavingsMinor: bigint;
  plannedMinor?: bigint;
  availableMinor?: bigint;
  needsRebalance?: boolean;
  currentMonth: string;
  currencySymbol: string;
  onPress: () => void;
  locale?: "es" | "en";
};

const clampProgress = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

function ProjectRing({
  progress,
  size,
  color,
  trackColor,
  emoji,
  completed,
}: {
  progress: number;
  size: number;
  color: string;
  trackColor: string;
  emoji: string;
  completed: boolean;
}) {
  const normalized = clampProgress(progress);
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - normalized * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.ringSvg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {completed ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth + 2}
            strokeOpacity={0.32}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        ) : null}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringEmoji}>{emoji}</Text>
      </View>
      {completed ? (
        <View style={styles.completedBadge}>
          <Text style={styles.completedBadgeText}>✓</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ProjectsRow({
  projects,
  huchaAmountMinor,
  totalSavingsMinor,
  plannedMinor = 0n,
  availableMinor = 0n,
  needsRebalance = false,
  currentMonth,
  currencySymbol,
  onPress,
  locale = "es",
}: ProjectsRowProps) {
  const { tokens: userTokens, resolvedMode } = useUserTheme();
  const { dictionary } = useCopy();
  const isHero = projects.length === 1;
  const ringTrack =
    resolvedMode === "dark" ? "rgba(255,255,255,0.06)" : withAlpha(userTokens.textPrimary, 0.1);
  const totalParts = formatCurrencyParts(totalSavingsMinor, currencySymbol);
  const huchaParts = formatCurrencyParts(huchaAmountMinor, currencySymbol);
  const plannedParts = formatCurrencyParts(plannedMinor, currencySymbol);
  const availableParts = formatCurrencyParts(availableMinor, currencySymbol);
  const hero = projects[0] ?? null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: userTokens.surface,
            borderColor: withAlpha(userTokens.textPrimary, 0.14),
          },
        ]}
      >
        {isHero && hero ? (
          <>
            <View style={styles.heroTop}>
              <ProjectRing
                progress={Number(hero.currentAmountMinor) / Number(hero.goalAmountMinor || 1n)}
                size={50}
                color={hero.color}
                trackColor={ringTrack}
                emoji={hero.emoji}
                completed={hero.currentAmountMinor >= hero.goalAmountMinor}
              />
              <View style={styles.heroBody}>
                <Text style={[styles.heroName, { color: userTokens.textPrimary }]} numberOfLines={1}>
                  {hero.name}
                </Text>
                <Text style={[styles.heroProgress, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "home.savings.summary.progress", {
                    current: formatCurrencyParts(hero.currentAmountMinor, currencySymbol).full,
                    goal: formatCurrencyParts(hero.goalAmountMinor, currencySymbol).full,
                  })}
                  {hero.currentAmountMinor >= hero.goalAmountMinor
                    ? ` · ${t(dictionary, "home.savings.summary.completed")}! 🎉`
                    : ""}
                </Text>
              </View>
              <Text
                style={[
                  styles.projectPercent,
                  { color: hero.color },
                ]}
              >
                {hero.currentAmountMinor >= hero.goalAmountMinor
                  ? "✓"
                  : `${Math.round(
                      (Number(hero.currentAmountMinor) /
                        Number(hero.goalAmountMinor || 1n)) *
                        100
                    )}%`}
              </Text>
              <ChevronRight size={16} color={userTokens.textTertiary} />
            </View>

            <View style={[styles.heroBottom, { borderTopColor: withAlpha(userTokens.textPrimary, 0.14) }]}>
              <Text style={[styles.huchaText, { color: userTokens.textSecondary }]}>
                🐷 {t(dictionary, "home.savings.hucha")}{" "}
                <Text style={[styles.huchaAmount, { color: HUCHA_PROJECT_COLOR }]}>{huchaParts.full}</Text>
              </Text>
              <Text style={[styles.huchaText, { color: userTokens.textSecondary }]}>
                {t(dictionary, "home.savings.summary.totalLabel")}{" "}
                <Text style={[styles.huchaAmount, { color: userTokens.textPrimary }]}>{totalParts.full}</Text>
              </Text>
            </View>
            <Text
              style={[
                styles.statusLine,
                { color: needsRebalance ? "#E0956A" : userTokens.textSecondary },
              ]}
            >
              {needsRebalance
                ? `${t(dictionary, "projects.monthClose.deficit", { amount: plannedParts.full })}`
                : `${t(dictionary, "home.savings.savedThisMonth")}: ${totalParts.full} · ${t(dictionary, "projects.monthClose.projectAssigned")}: ${plannedParts.full} · ${t(dictionary, "projects.monthClose.allocatable")}: ${availableParts.full}`}
            </Text>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.ringsRow}>
                {projects.slice(0, 4).map((project) => {
                  const progress =
                    Number(project.currentAmountMinor) / Number(project.goalAmountMinor || 1n);
                  return (
                    <View key={project.id} style={styles.ringBlock}>
                      <ProjectRing
                        progress={progress}
                        size={projects.length <= 2 ? 43 : 35}
                        color={project.color}
                        trackColor={ringTrack}
                        emoji={project.emoji}
                        completed={project.currentAmountMinor >= project.goalAmountMinor}
                      />
                      <Text style={[styles.projectName, { color: project.color }]} numberOfLines={1}>
                        {project.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.headerRight}>
                <Text style={[styles.label, { color: userTokens.textTertiary }]}>
                  {t(dictionary, "home.savings.summary.totalAmountLabel")}
                </Text>
                <Text style={styles.totalAmount}>
                  {totalParts.integer}
                  <Text style={styles.totalDecimals}>,{totalParts.decimals}</Text>
                </Text>
                <Text style={[styles.monthText, { color: userTokens.textSecondary }]}>{currentMonth}</Text>
              </View>
              <ChevronRight size={16} color={userTokens.textTertiary} />
            </View>
            <Text style={[styles.huchaText, { color: userTokens.textSecondary }]}>
              🐷 {t(dictionary, "home.savings.hucha")}:{" "}
              <Text style={[styles.huchaAmount, { color: HUCHA_PROJECT_COLOR }]}>{huchaParts.full}</Text>
            </Text>
            <Text
              style={[
                styles.statusLine,
                { color: needsRebalance ? "#E0956A" : userTokens.textSecondary },
              ]}
            >
              {needsRebalance
                ? `${t(dictionary, "home.savings.statusPending")} · ${plannedParts.full}`
                : `${t(dictionary, "home.savings.savedThisMonth")}: ${totalParts.full} · ${t(dictionary, "projects.monthClose.projectAssigned")}: ${plannedParts.full} · ${t(dictionary, "projects.monthClose.allocatable")}: ${availableParts.full}`}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

// Backward-compatible alias used by existing imports.
export const SavingsMonthCard = ({
  projectsMinor,
  huchaMinor,
  savingsMinor,
  onPress,
  monthLabel,
  currencySymbol,
}: {
  projectsMinor: bigint | number | string;
  huchaMinor: bigint | number | string;
  savingsMinor: bigint | number | string;
  onPress: () => void;
  monthLabel: string;
  currencySymbol: string;
}) => {
  const { dictionary } = useCopy();
  const projectsValue = toMinor(projectsMinor);
  const project = {
    id: "fallback",
    name: t(dictionary, "home.savings.summary.fallbackProjectName" as any),
    emoji: "🎯",
    currentAmountMinor: projectsValue,
    goalAmountMinor: projectsValue > 0n ? projectsValue : 1n,
    color: PROJECT_PALETTE[0],
  };

  return (
    <ProjectsRow
      projects={[project]}
      huchaAmountMinor={toMinor(huchaMinor)}
      totalSavingsMinor={toMinor(savingsMinor)}
      currentMonth={monthLabel}
      currencySymbol={currencySymbol}
      onPress={onPress}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    gap: 8,
  },
  pressed: {
    opacity: 0.92,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headerRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  label: {
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontFamily: "DMSans-SemiBold",
  },
  totalAmount: {
    fontSize: 19,
    lineHeight: 22,
    fontFamily: "JetBrainsMono-Medium",
    color: "#6DC9A0",
    letterSpacing: -0.4,
  },
  totalDecimals: {
    fontSize: 13,
    color: "#6DC9A0",
    fontFamily: "JetBrainsMono-Medium",
  },
  monthText: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: "DMSans-Medium",
  },
  ringsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    maxWidth: "56%",
  },
  ringBlock: {
    width: 50,
    alignItems: "center",
    gap: 2,
  },
  ringSvg: {
    transform: [{ rotate: "-90deg" }],
  },
  ringCenter: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ringEmoji: {
    fontSize: 15,
  },
  projectName: {
    fontSize: 8,
    lineHeight: 10,
    fontFamily: "DMSans-Medium",
    textAlign: "center",
  },
  completedBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#6DC9A0",
    alignItems: "center",
    justifyContent: "center",
  },
  completedBadgeText: {
    fontSize: 9,
    lineHeight: 11,
    color: "#0E1A27",
    fontFamily: "DMSans-Bold",
  },
  huchaText: {
    fontSize: 10,
    fontFamily: "DMSans-Medium",
  },
  huchaAmount: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Medium",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroBody: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontSize: 13,
    fontFamily: "DMSans-SemiBold",
  },
  projectPercent: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: "JetBrainsMono-Medium",
  },
  heroProgress: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: "DMSans-Medium",
  },
  heroProgressAmount: {
    fontFamily: "JetBrainsMono-Medium",
  },
  heroBottom: {
    marginTop: 2,
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusLine: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: "DMSans-Medium",
  },
});
