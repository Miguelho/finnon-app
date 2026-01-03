import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { mapUserToUserDetailsVM, themeTokens } from "@poleursus/shared";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useCopy, t } from "../../../src/lib/i18n";

const tokens = themeTokens.light;

export default function UserDetailsScreen() {
  const { user, loading } = useAuth();
  const { dictionary } = useCopy();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tokens.colors.text.muted} />
        <Text style={styles.loadingText}>
          {t(dictionary, "settings.userDetails.loading")}
        </Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {t(dictionary, "settings.userDetails.error")}
        </Text>
      </View>
    );
  }

  const viewModel = mapUserToUserDetailsVM(user);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {t(dictionary, "settings.userDetails.subtitle")}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>
            {t(dictionary, "settings.userDetails.fields.email")}
          </Text>
          <Text style={styles.value}>{viewModel.email}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.field}>
          <Text style={styles.label}>
            {t(dictionary, "settings.userDetails.fields.id")}
          </Text>
          <Text style={styles.valueSmall}>{viewModel.userId}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg.secondary,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.colors.bg.secondary,
    padding: tokens.spacing.lg,
  },
  loadingText: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.muted,
  },
  errorText: {
    fontSize: tokens.typography.size.md,
    color: tokens.colors.text.secondary,
    textAlign: "center",
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
  card: {
    backgroundColor: tokens.colors.bg.surface,
    marginTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tokens.colors.state.neutral,
  },
  field: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  label: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.xs,
  },
  value: {
    fontSize: tokens.typography.size.md,
    color: tokens.colors.text.primary,
  },
  valueSmall: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
    fontFamily: "monospace",
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.state.neutral,
    marginHorizontal: tokens.spacing.lg,
  },
});
