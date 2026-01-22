import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../../../src/lib/supabase";
import { useAuth } from "../../../../../../src/contexts/AuthContext";
import { Card } from "../../../../../../src/components/Card";
import { Button } from "../../../../../../src/components/Button";
import { CategoryIcon } from "../../../../../../src/components/CategoryIcon";
import { useCopy, t } from "../../../../../../src/lib/i18n";
import {
  addMonths,
  CURRENCIES,
  formatMonthLabel,
  formatMoneyWithSymbol,
  getMonthRangeFromKey,
  themeTokens,
  toMonthKey,
  type CategoryIconKey,
} from "@poleursus/shared";

type Category = {
  id: string;
  account_id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type Transaction = {
  id: string;
  type: "income" | "expense";
  amount_minor: string;
  amount_base_minor: string | null;
  currency: string;
  date: string;
  merchant: string | null;
  notes: string | null;
  created_at: string;
};

const tokens = themeTokens.light;
const colors = tokens.colors;

const toMinorAmount = (transaction: Transaction): bigint => {
  const value =
    transaction.amount_base_minor ?? transaction.amount_minor ?? "0";
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

export default function CategoryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const categoryId = Array.isArray(id) ? id[0] : id;
  const [category, setCategory] = useState<Category | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentMonth = toMonthKey(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const monthRange = useMemo(
    () => getMonthRangeFromKey(selectedMonth),
    [selectedMonth]
  );

  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === baseCurrency)?.symbol ??
    baseCurrency;

  const loadData = useCallback(async () => {
    if (!selectedAccountId || !categoryId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("base_currency")
        .eq("id", selectedAccountId)
        .maybeSingle();

      if (accountError) throw accountError;
      if (accountData?.base_currency) {
        setBaseCurrency(accountData.base_currency);
      }

      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("id, account_id, name, icon_id, type")
        .eq("id", categoryId)
        .eq("account_id", selectedAccountId)
        .maybeSingle();

      if (categoryError) throw categoryError;
      if (!categoryData) {
        setError(t(dictionary, "categories.notFoundDescription"));
        setLoading(false);
        return;
      }

      setCategory(categoryData);

      const { start, end } = monthRange;
      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .select(
          "id, type, amount_minor, amount_base_minor, currency, date, merchant, notes, created_at"
        )
        .eq("account_id", selectedAccountId)
        .eq("category_id", categoryId)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (transactionError) throw transactionError;

      setTransactions(transactionData || []);
    } catch (e: any) {
      console.error("Error loading category detail:", e);
      setError(e?.message || t(dictionary, "categories.loadError"));
    } finally {
      setLoading(false);
    }
  }, [categoryId, dictionary, monthRange, selectedAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const goToPreviousMonth = () => {
    setSelectedMonth(addMonths(selectedMonth, -1));
  };

  const goToNextMonth = () => {
    setSelectedMonth(addMonths(selectedMonth, 1));
  };

  const handleDelete = async () => {
    if (!category) return;

    Alert.alert(
      t(dictionary, "categories.deleteConfirmTitle"),
      t(dictionary, "categories.deleteConfirmDescription", { name: category.name }),
      [
        { text: t(dictionary, "common.cancel"), style: "cancel" },
        {
          text: t(dictionary, "common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const { error: deleteError } = await supabase
                .from("categories")
                .delete()
                .eq("id", category.id);

              if (deleteError) {
                if (deleteError.code === "23503") {
                  Alert.alert(
                    t(dictionary, "common.errorTitle"),
                    t(dictionary, "categories.error.inUse")
                  );
                  return;
                }
                throw deleteError;
              }

              router.back();
            } catch (e: any) {
              Alert.alert(
                t(dictionary, "common.errorTitle"),
                e?.message || t(dictionary, "categories.deleteError")
              );
            }
          },
        },
      ]
    );
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

  if (!category) {
    return (
      <View style={styles.container}>
        <Card
          title={t(dictionary, "categories.notFoundTitle")}
          description={t(dictionary, "categories.notFoundDescription")}
        >
          <Button title={t(dictionary, "common.back")} onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: category.name,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <CategoryIcon
              iconKey={category.icon_id as CategoryIconKey}
              size={28}
              tone="muted"
              accessibilityLabel={category.name}
            />
            <View style={styles.headerText}>
              <Text style={styles.title}>{category.name}</Text>
              <Text style={styles.subtitle}>
                {category.type === "income"
                  ? t(dictionary, "categories.incomeLabel")
                  : t(dictionary, "categories.expenseLabel")}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/(auth)/categories/${category.id}/edit`)}
            >
              <Text style={styles.actionButtonText}>
                {t(dictionary, "common.edit")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
            >
              <Text style={styles.deleteButtonText}>
                {t(dictionary, "common.delete")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Card>
          <View style={styles.filterCard}>
            <View>
              <Text style={styles.filterLabel}>
                {t(dictionary, "categories.currentMonthLabel")}
              </Text>
              <Text style={styles.filterValue}>
                {formatMonthLabel(monthRange.monthKey, locale)}
              </Text>
            </View>
            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={goToPreviousMonth}
              >
                <Text style={styles.filterButtonText}>
                  {t(dictionary, "transactions.previousMonth")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={goToNextMonth}
              >
                <Text style={styles.filterButtonText}>
                  {t(dictionary, "transactions.nextMonth")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t(dictionary, "transactions.movimientosCount", {
              count: transactions.length,
            })}
          </Text>

          <Card>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>
                {t(dictionary, "categories.transactionsEmptyRange")}
              </Text>
            ) : (
              <View style={styles.list}>
                {transactions.map((transaction) => {
                  const amountMinor = toMinorAmount(transaction);
                  const amountLabel = formatMoneyWithSymbol(
                    amountMinor,
                    baseCurrency,
                    currencySymbol
                  );
                  const displayName =
                    transaction.merchant || category.name || "";

                  return (
                    <TouchableOpacity
                      key={transaction.id}
                      style={styles.transactionItem}
                      onPress={() =>
                        router.push(
                          `/(auth)/(tabs)/transactions/${transaction.id}`
                        )
                      }
                    >
                      <View style={styles.transactionLeft}>
                        <CategoryIcon
                          iconKey={category.icon_id as CategoryIconKey}
                          size={22}
                          tone="muted"
                          accessibilityLabel={category.name}
                        />
                        <View>
                          <Text style={styles.transactionTitle}>{displayName}</Text>
                          <Text style={styles.transactionMeta}>
                            {new Date(transaction.date).toLocaleDateString(locale)}
                            {transaction.notes ? ` • ${transaction.notes}` : ""}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.transactionAmount,
                          transaction.type === "income"
                            ? styles.incomeText
                            : styles.expenseText,
                        ]}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {amountLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  header: {
    gap: tokens.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: tokens.typography.size.display,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  actionButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.action.primary,
  },
  actionButtonText: {
    color: colors.action.primary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  deleteButton: {
    borderColor: colors.state.negative,
  },
  deleteButtonText: {
    color: colors.state.negative,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  filterCard: {
    gap: tokens.spacing.md,
  },
  filterLabel: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  filterValue: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginTop: 4,
  },
  filterActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  filterButton: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  filterButtonText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.primary,
  },
  section: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    paddingVertical: tokens.spacing.lg,
    textAlign: "center",
  },
  list: {
    gap: tokens.spacing.sm,
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
  },
  transactionTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  transactionMeta: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  transactionAmount: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  incomeText: {
    color: colors.state.positive,
  },
  expenseText: {
    color: colors.state.negative,
  },
});
