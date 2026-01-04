import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { AccountDetails } from "../../../src/components/AccountDetails";

export default function AccountTabScreen() {
  const { selectedAccountId, isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  return <AccountDetails accountId={selectedAccountId} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
