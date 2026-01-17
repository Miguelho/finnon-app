import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { AccountDetails } from "../../../src/components/AccountDetails";
import { themeTokens } from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

export default function AccountDetailsSettingsScreen() {
  const { selectedAccountId, isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  return <AccountDetails accountId={selectedAccountId} showSignOut />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.secondary,
  },
});
