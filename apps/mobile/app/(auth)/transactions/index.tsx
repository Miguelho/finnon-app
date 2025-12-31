import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import {
  getIconById,
  formatMoneyWithSymbol,
  CURRENCIES,
} from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type Transaction = {
  id: string;
  account_id: string;
  type: "income" | "expense";
  amount_minor: string;
  currency: string;
  amount_base_minor: string;
  category_id: string | null;
  date: string;
  merchant: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  category?: Category | null;
};

export default function TransactionsScreen(): React.JSX.Element {
  const router = useRouter();
  const { selectedAccountId } = useAuth();
  const { dictionary } = useCopy();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Month filter (format: YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    loadData();
  }, [selectedAccountId]);

  const loadData = async () => {
    if (!selectedAccountId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch account to get base_currency
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("base_currency")
        .eq("id", selectedAccountId)
        .single();

      if (accountError) throw accountError;
      setBaseCurrency(accountData.base_currency);

      // Fetch transactions
      const { data, error: fetchError } = await supabase
        .from("transactions")
        .select(
          `
          *,
          category:categories(id, name, icon_id, type)
        `
        )
        .eq("account_id", selectedAccountId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setTransactions(data || []);
    } catch (e: any) {
      console.error("Error loading transactions:", e);
      setError(e?.message || t(dictionary, "transactions.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    Alert.alert(
      t(dictionary, "transactions.deleteConfirmTitle"),
      t(dictionary, "transactions.deleteConfirmDescription"),
      [
        { text: t(dictionary, "common.cancel"), style: "cancel" },
        {
          text: t(dictionary, "common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("transactions")
                .delete()
                .eq("id", transaction.id);

              if (error) throw error;

              setTransactions(transactions.filter((t) => t.id !== transaction.id));
            } catch (e: any) {
              Alert.alert(
                t(dictionary, "common.errorTitle"),
                e?.message || t(dictionary, "transactions.deleteError")
              );
            }
          },
        },
      ]
    );
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    const parts = selectedMonth.split("-").map(Number);
    const year = parts[0] || new Date().getFullYear();
    const month = parts[1] || new Date().getMonth() + 1;
    const date = new Date(year, month - 2, 1); // month - 2 because month is 1-indexed but Date uses 0-indexed
    const newMonth = date.toISOString().slice(0, 7);
    setSelectedMonth(newMonth);
  };

  // Navigate to next month
  const goToNextMonth = () => {
    const parts = selectedMonth.split("-").map(Number);
    const year = parts[0] || new Date().getFullYear();
    const month = parts[1] || new Date().getMonth() + 1;
    const date = new Date(year, month, 1); // month is already correct for next month
    const newMonth = date.toISOString().slice(0, 7);
    setSelectedMonth(newMonth);
  };

  // Filter transactions by selected month
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Calculate monthly summary
  const monthlySummary = useMemo(() => {
    let income = 0n;
    let expense = 0n;

    filteredTransactions.forEach((t) => {
      const amount = BigInt(t.amount_base_minor);
      if (t.type === "income") {
        income += amount;
      } else {
        expense += amount;
      }
    });

    const balance = income - expense;

    return { income, expense, balance };
  }, [filteredTransactions]);

  // Get currency symbol
  const currencySymbol =
    CURRENCIES.find((c) => c.code === baseCurrency)?.symbol || baseCurrency;

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr + "-01");
    return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card title={t(dictionary, "common.errorTitle")} description={error}>
          <Button title={t(dictionary, "common.retry")} onPress={loadData} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t(dictionary, "transactions.pageTitle")}</Text>
        <Text style={styles.subtitle}>{t(dictionary, "transactions.pageDescription")}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={t(dictionary, "transactions.newTransaction")}
          onPress={() => router.push("/(auth)/transactions/create")}
        />
        <Button
          title={t(dictionary, "common.back")}
          onPress={() => router.back()}
          variant="secondary"
        />
      </View>

      {/* Month Selector */}
      <Card title={t(dictionary, "transactions.filterByMonth")}>
        <View style={styles.monthSelector}>
          <TouchableOpacity
            onPress={goToPreviousMonth}
            style={styles.monthButton}
          >
            <Text style={styles.monthButtonText}>{t(dictionary, "transactions.previousMonth")}</Text>
          </TouchableOpacity>
          <Text style={styles.monthText}>{formatMonth(selectedMonth)}</Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.monthButton}>
            <Text style={styles.monthButtonText}>{t(dictionary, "transactions.nextMonth")}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Monthly Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t(dictionary, "transactions.income")}</Text>
          <Text style={[styles.summaryValue, styles.incomeText]}>
            {formatMoneyWithSymbol(
              monthlySummary.income,
              baseCurrency,
              currencySymbol
            )}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t(dictionary, "transactions.expenses")}</Text>
          <Text style={[styles.summaryValue, styles.expenseText]}>
            {formatMoneyWithSymbol(
              monthlySummary.expense,
              baseCurrency,
              currencySymbol
            )}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t(dictionary, "transactions.balance")}</Text>
          <Text
            style={[
              styles.summaryValue,
              monthlySummary.balance >= 0n
                ? styles.incomeText
                : styles.expenseText,
            ]}
          >
            {monthlySummary.balance >= 0n ? "+" : "-"}
            {formatMoneyWithSymbol(
              monthlySummary.balance >= 0n
                ? monthlySummary.balance
                : -monthlySummary.balance,
              baseCurrency,
              currencySymbol
            )}
          </Text>
        </View>
      </View>

      {/* Transactions List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t(dictionary, "transactions.listTitle", {
            count: filteredTransactions.length,
          })}
        </Text>

        {filteredTransactions.length === 0 ? (
          <Text style={styles.emptyText}>
            {t(dictionary, "transactions.emptyList")}
          </Text>
        ) : (
          <View style={styles.list}>
            {filteredTransactions.map((transaction) => {
              const category = transaction.category;
              const icon = category ? getIconById(category.icon_id) : null;
              const amount = formatMoneyWithSymbol(
                BigInt(transaction.amount_base_minor),
                baseCurrency,
                currencySymbol
              );
              const displayName =
                transaction.merchant ||
                category?.name ||
                t(dictionary, "transactions.uncategorized");

              return (
                <View key={transaction.id} style={styles.transactionItem}>
                  {/* Left: Icon + Details */}
                  <View style={styles.transactionLeft}>
                    <Text style={styles.emoji}>
                      {icon?.emoji ||
                        (transaction.type === "income" ? "💰" : "💸")}
                    </Text>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionName}>{displayName}</Text>
                      <Text style={styles.transactionDate}>
                        {new Date(transaction.date).toLocaleDateString()}
                        {transaction.notes && ` • ${transaction.notes}`}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Amount + Actions */}
                  <View style={styles.transactionRight}>
                    <Text
                      style={[
                        styles.transactionAmount,
                        transaction.type === "income"
                          ? styles.incomeText
                          : styles.expenseText,
                      ]}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {amount}
                    </Text>
                    <View style={styles.transactionActions}>
                      <TouchableOpacity
                        onPress={() =>
                          router.push(`/(auth)/transactions/${transaction.id}`)
                        }
                        style={styles.actionButton}
                      >
                        <Text style={styles.actionButtonText}>
                          {t(dictionary, "transactions.editActionShort")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(transaction)}
                        style={[styles.actionButton, styles.deleteButton]}
                      >
                        <Text style={styles.deleteButtonText}>
                          {t(dictionary, "transactions.deleteActionShort")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// Finnon Color Tokens (color-guide.md)
const colors = {
  bg: {
    primary: "#FFFFFF",
    secondary: "#F7F8FA",
    surface: "#FFFFFF",
  },
  text: {
    primary: "#1C1E21",
    secondary: "#5F6368",
    muted: "#9AA0A6",
  },
  action: {
    primary: "#5B8DFF",
    secondary: "#E8EEFF",
    disabled: "#C7D2FE",
  },
  state: {
    positive: "#2E7D65",
    negative: "#B23B3B",
    neutral: "#DADCE0",
  },
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  monthSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  monthButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.action.primary,
  },
  monthButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  monthText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
  summaryContainer: {
    flexDirection: "row",
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.bg.secondary,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  incomeText: {
    color: colors.state.positive,
  },
  expenseText: {
    color: colors.state.negative,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 32,
  },
  list: {
    gap: 8,
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: 8,
    backgroundColor: colors.bg.primary,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
  },
  emoji: {
    fontSize: 24,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
    color: colors.text.primary,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  transactionRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  transactionActions: {
    flexDirection: "row",
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.action.primary,
  },
  actionButtonText: {
    color: colors.action.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  deleteButton: {
    borderColor: colors.state.negative,
  },
  deleteButtonText: {
    color: colors.state.negative,
    fontSize: 12,
    fontWeight: "600",
  },
});
