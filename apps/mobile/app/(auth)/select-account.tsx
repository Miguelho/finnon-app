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
import { useAuth } from "../../src/contexts/AuthContext";
import { Redirect } from "expo-router";

interface Account {
  id: string;
  name: string;
  base_currency: string;
}

export default function SelectAccountScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, setSelectedAccountId } = useAuth();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    if (!user) {
      setError("No user session found");
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
      setError(err instanceof Error ? err.message : "Error loading accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = async (accountId: string) => {
    console.log("[SelectAccount] Selected account:", accountId);
    await setSelectedAccountId(accountId);
    return <Redirect href="/(auth)/home" />;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card title="Error" description={error}>
          <Text style={styles.errorText}>
            No se pudieron cargar las cuentas
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Card
        title="Selecciona una cuenta"
        description="Elige la cuenta con la que deseas trabajar"
      >
        <View style={styles.accountsList}>
          {accounts.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={styles.accountItem}
              onPress={() => handleSelectAccount(account.id)}
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
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  accountsList: {
    gap: 12,
  },
  accountItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  accountCurrency: {
    fontSize: 14,
    color: "#666",
  },
  arrow: {
    fontSize: 24,
    color: "#007AFF",
    marginLeft: 8,
  },
  errorText: {
    color: "#ff3b30",
    fontSize: 14,
    textAlign: "center",
  },
});
