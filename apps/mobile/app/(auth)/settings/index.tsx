import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { buildSettingsMenuVM, themeTokens } from "@poleursus/shared";
import { useCopy } from "../../../src/lib/i18n";
import { SettingsRow } from "../../../src/components/SettingsRow";
import { useAuth } from "../../../src/contexts/AuthContext";

const tokens = themeTokens.light;

export default function SettingsMenuScreen() {
  const router = useRouter();
  const { dictionary } = useCopy();
  const { selectedAccountId } = useAuth();

  const viewModel = buildSettingsMenuVM(dictionary, "mobile", {
    accountId: selectedAccountId,
  });

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  const resolveIcon = (itemId: string) => {
    switch (itemId) {
      case "user-details":
        return "account-circle-outline" as const;
      case "language":
        return "translate" as const;
      case "general":
        return "cog-outline" as const;
      case "members":
        return "account-group-outline" as const;
      case "categories":
        return "tag-outline" as const;
      default:
        return undefined;
    }
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
                iconName={resolveIcon(item.id)}
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
