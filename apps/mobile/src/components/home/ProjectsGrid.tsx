import { Pressable, StyleSheet, Text, View } from "react-native";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { useCopy, t } from "../../lib/i18n";
import { ProjectRing } from "./ProjectRing";
import { MobileHomeProjectPreview, formatEta } from "./homeResponsive";

type ProjectsGridProps = {
  projects: MobileHomeProjectPreview[];
  onViewAll: () => void;
  onProjectPress: (projectId: string) => void;
};

export function ProjectsGrid({
  projects,
  onViewAll,
  onProjectPress,
}: ProjectsGridProps) {
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const { dictionary, locale } = useCopy();
  const etaLabel = (value: string | Date | null) =>
    formatEta(value, locale, t(dictionary, "home.noDateLabel"));

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: userTokens.textTertiary }]}>
          {t(dictionary, "navigation.projects")}
        </Text>
        <Pressable onPress={onViewAll}>
          <Text style={[styles.link, { color: primaryActionColor }]}>
            {t(dictionary, "home.viewAllCta")} →
          </Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {projects.map((project) => (
          <Pressable
            key={project.id}
            onPress={() => onProjectPress(project.id)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: userTokens.surface,
                borderColor: userTokens.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <View style={styles.ringWrap}>
              <ProjectRing
                progress={project.progressRatio}
                color={project.color}
                radius={22}
                strokeWidth={4}
                emoji={project.emoji}
              />
            </View>
            <Text style={[styles.name, { color: userTokens.textPrimary }]} numberOfLines={2}>
              {project.name}
            </Text>
            <Text style={[styles.eta, { color: userTokens.textSecondary }]} numberOfLines={2}>
              {t(dictionary, "home.projectEtaPrefix")}{" "}
              <Text style={[styles.etaHighlight, { color: primaryActionColor }]}>
                {etaLabel(project.estimatedCompletion)}
              </Text>
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontFamily: "DMSans-SemiBold",
  },
  link: {
    fontSize: 12,
    fontFamily: "DMSans-Medium",
  },
  grid: {
    flexDirection: "row",
    gap: 8,
  },
  card: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: "center",
  },
  ringWrap: {
    marginBottom: 8,
  },
  name: {
    minHeight: 28,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "DMSans-Medium",
  },
  eta: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 13,
    fontFamily: "DMSans",
  },
  etaHighlight: {
    fontFamily: "DMSans-Medium",
  },
});
