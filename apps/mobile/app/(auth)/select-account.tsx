import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { useAuth } from "../../src/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useCopy, t } from "../../src/lib/i18n";
import { themeTokens } from "@poleursus/shared";
import { useNetworkNotice } from "../../src/contexts/NetworkNoticeContext";

interface Account {
  id: string;
  name: string;
  base_currency: string;
}

const tokens = themeTokens.light;
const colors = tokens.colors;

export default function SelectAccountScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const { user, setSelectedAccountId } = useAuth();
  const router = useRouter();
  const { dictionary } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    if (!user) {
      setError(t(dictionary, "mobile.selectAccount.noSessionError"));
      setLoading(false);
      return;
    }

    try {
      // Get all accounts where user is a member
      const { data: memberships, error: membershipsError } = await supabase
        .from("account_members")
        .select("account_id, accounts(id, name, base_currency)")
        .eq("user_id", user.id);

      if (membershipsError) throw membershipsError;

      const accountsList =
        memberships
          ?.map((m: any) => m.accounts)
          .filter((a: any) => a !== null) || [];

      setAccounts(accountsList);
    } catch (err) {
      console.error("Error loading accounts:", err);
      setError(err instanceof Error ? err.message : t(dictionary, "mobile.selectAccount.loadError"));
      reportNetworkIssue({ onRetry: loadAccounts });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = async (accountId: string) => {
    console.log("[SelectAccount] Selected account:", accountId);
    setIsSwitching(true);
    try {
      await setSelectedAccountId(accountId);
      router.replace("/(auth)/(tabs)/home");
    } catch (err) {
      console.error("Error switching account:", err);
      reportNetworkIssue({ onRetry: () => handleSelectAccount(accountId) });
      setIsSwitching(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card title={t(dictionary, "mobile.selectAccount.errorTitle")} description={error}>
          <Text style={styles.errorText}>
            {t(dictionary, "mobile.selectAccount.errorDescription")}
          </Text>
        </Card>
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card
          title={t(dictionary, "mobile.selectAccount.emptyTitle")}
          description={t(dictionary, "mobile.selectAccount.emptyDescription")}
        >
          <Button
            title={t(dictionary, "mobile.selectAccount.createCta")}
            onPress={() => router.push("/(auth)/onboarding")}
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Card
        title={t(dictionary, "mobile.selectAccount.title")}
        description={t(dictionary, "mobile.selectAccount.description")}
      >
        {isSwitching && (
          <Text style={styles.switchingText}>{t(dictionary, "common.loading")}</Text>
        )}
        <View style={styles.accountsList}>
          {accounts.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={[
                styles.accountItem,
                isSwitching && styles.accountItemDisabled,
              ]}
              onPress={() => handleSelectAccount(account.id)}
              disabled={isSwitching}
            >
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountCurrency}>
                  {account.base_currency}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
    padding: tokens.spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
    backgroundColor: colors.bg.secondary,
  },
  accountsList: {
    gap: tokens.spacing.sm,
  },
  accountItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bg.surface,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  accountItemDisabled: {
    opacity: 0.6,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  accountCurrency: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  arrow: {
    fontSize: 24,
    color: colors.action.primary,
    marginLeft: tokens.spacing.sm,
  },
  errorText: {
    color: colors.state.negative,
    fontSize: tokens.typography.size.sm,
    textAlign: "center",
  },
  switchingText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    marginBottom: tokens.spacing.sm,
  },
});
