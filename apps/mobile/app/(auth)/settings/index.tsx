import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { buildSettingsMenuVM, themeTokens } from "@poleursus/shared";
import { useCopy } from "../../../src/lib/i18n";
import { SettingsRow } from "../../../src/components/SettingsRow";

const tokens = themeTokens.light;

export default function SettingsMenuScreen() {
  const router = useRouter();
  const { dictionary } = useCopy();

  const viewModel = buildSettingsMenuVM(dictionary, "mobile");

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>{viewModel.subtitle}</Text>
      </View>

      {viewModel.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionContent}>
            {section.items.map((item) => (
              <SettingsRow
                key={item.id}
                title={item.title}
                description={item.description}
                onPress={() => handleNavigate(item.route)}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg.secondary,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
  },
  section: {
    marginTop: tokens.spacing.xl,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  sectionContent: {
    backgroundColor: tokens.colors.bg.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.state.neutral,
  },
});
