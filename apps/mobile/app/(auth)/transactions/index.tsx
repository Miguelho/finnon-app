import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Stack, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { CategoryIcon } from "../../../src/components/CategoryIcon";
import { UserAvatar } from "../../../src/components/UserAvatar";
import { useNetworkNotice } from "../../../src/contexts/NetworkNoticeContext";
import {
  addMonths,
  formatMoneyWithSymbol,
  CURRENCIES,
  formatMonthLabel,
  themeTokens,
  toMonthKey,
  type RecurringItem,
  getOccurrencesBetween,
  getOccurrenceKey,
  type AvatarColorToken,
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
  recurring_item_id?: string | null;
  recurring_occurrence_date?: string | null;
};

type RecurringOccurrenceItem = {
  occurrenceDate: string;
  item: RecurringItem;
};

type Profile = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: AvatarColorToken | null;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const spacing = tokens.spacing;
const radii = tokens.radii;
const typography = tokens.typography;

const parseMonthKey = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    monthIndex: Number.isFinite(monthIndex) ? monthIndex : new Date().getMonth(),
  };
};

const getMonthRangeFromKey = (monthKey: string) => {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const start = `${monthKey}-01`;
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
    .toISOString()
    .slice(0, 10);
  return { start, end };
};

export default function TransactionsScreen(): React.JSX.Element {
  const router = useRouter();
  const { selectedAccountId, user } = useAuth();
  const { dictionary, locale } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  // Month filter (format: YYYY-MM)
  const currentMonth = toMonthKey(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isMonthActionsOpen, setIsMonthActionsOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonthIndex, setPickerMonthIndex] = useState(new Date().getMonth());
  const insets = useSafeAreaInsets();

  const monthRange = useMemo(
    () => getMonthRangeFromKey(selectedMonth),
    [selectedMonth]
  );
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        new Date(2000, index, 1).toLocaleDateString(locale, {
          month: "long",
        })
      ),
    [locale]
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    return Array.from({ length: 11 }, (_, index) => startYear + index);
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedAccountId, selectedMonth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [selectedAccountId, selectedMonth, monthRange]);

  const loadData = async () => {
    if (!selectedAccountId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { start, end } = monthRange;

      // Fetch account to get base_currency
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("base_currency")
        .eq("id", selectedAccountId)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!accountData) {
        setError(t(dictionary, "transactions.noAccountSelected"));
        setLoading(false);
        return;
      }
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
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setTransactions(data || []);

      const createdByIds = Array.from(
        new Set([
          ...(data || []).map((transaction) => transaction.created_by),
          ...(user?.id ? [user.id] : []),
        ])
      );
      if (createdByIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token"
          )
          .in("user_id", createdByIds);
        if (profileError) throw profileError;
        if (profileData) {
          setProfilesById((prev) => {
            const next = { ...prev };
            profileData.forEach((profile) => {
              next[profile.user_id] = profile as Profile;
            });
            return next;
          });
        }
      }

      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("id, name, icon_id, type")
        .eq("account_id", selectedAccountId);

      if (categoryError) throw categoryError;

      setCategories((categoryData as Category[]) || []);

      const { data: recurringData, error: recurringError } = await supabase
        .from("recurring_items")
        .select(
          "id, account_id, type, amount_minor, currency, category_id, merchant, notes, start_date, frequency, interval, day_of_month, end_date, is_paused, created_by"
        )
        .eq("account_id", selectedAccountId);

      if (recurringError) throw recurringError;

      setRecurringItems((recurringData as RecurringItem[]) || []);
    } catch (e: any) {
      console.error("Error loading transactions:", e);
      setError(e?.message || t(dictionary, "transactions.loadError"));
      reportNetworkIssue({ onRetry: loadData });
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
    setSelectedMonth(addMonths(selectedMonth, -1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setSelectedMonth(addMonths(selectedMonth, 1));
  };

  const openMonthActions = () => {
    setIsMonthActionsOpen(true);
  };

  const closeMonthActions = () => {
    setIsMonthActionsOpen(false);
  };

  const openMonthPicker = () => {
    const { year, monthIndex } = parseMonthKey(selectedMonth);
    setPickerYear(year);
    setPickerMonthIndex(monthIndex);
    setIsMonthPickerOpen(true);
    setIsMonthActionsOpen(false);
  };

  const applyMonthPicker = () => {
    const nextMonth = toMonthKey(new Date(pickerYear, pickerMonthIndex, 1));
    setSelectedMonth(nextMonth);
    setIsMonthPickerOpen(false);
  };

  // Filter transactions by selected month
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const pendingOccurrences = useMemo<RecurringOccurrenceItem[]>(() => {
    if (!recurringItems.length) return [];
    const existingKeys = new Set(
      filteredTransactions
        .filter(
          (transaction) =>
            transaction.recurring_item_id && transaction.recurring_occurrence_date
        )
        .map((transaction) =>
          getOccurrenceKey(
            transaction.recurring_item_id!,
            transaction.recurring_occurrence_date!
          )
        )
    );

    return recurringItems
      .filter((item) => !item.is_paused)
      .flatMap((item) =>
        getOccurrencesBetween(item, monthRange.start, monthRange.end)
          .filter((occurrence) => !existingKeys.has(occurrence.key))
          .map((occurrence) => ({
            occurrenceDate: occurrence.date,
            item,
          }))
      );
  }, [filteredTransactions, monthRange.end, monthRange.start, recurringItems]);

  const mergedItems = useMemo(() => {
    const mappedTransactions = filteredTransactions.map((transaction) => ({
      kind: "transaction" as const,
      date: transaction.date,
      transaction,
    }));

    const mappedRecurring = pendingOccurrences.map((pending) => ({
      kind: "recurring" as const,
      date: pending.occurrenceDate,
      recurring: pending,
    }));

    return [...mappedTransactions, ...mappedRecurring].sort((a, b) => {
      const timeA = new Date(`${a.date}T00:00:00Z`).getTime();
      const timeB = new Date(`${b.date}T00:00:00Z`).getTime();
      if (timeA !== timeB) return timeB - timeA;
      if (a.kind === b.kind) return 0;
      return a.kind === "transaction" ? -1 : 1;
    });
  }, [filteredTransactions, pendingOccurrences]);

  const categoriesById = useMemo(() => {
    return categories.reduce<Record<string, Category>>((acc, category) => {
      acc[category.id] = category;
      return acc;
    }, {});
  }, [categories]);

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

  const handleConfirmRecurring = async (pending: RecurringOccurrenceItem) => {
    if (!selectedAccountId) return;

    const confirmKey = getOccurrenceKey(
      pending.item.id,
      pending.occurrenceDate
    );
    setConfirmingKey(confirmKey);

    try {
      if (pending.item.currency !== baseCurrency) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "transactions.repeat.baseCurrencyOnly")
        );
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "transactions.notAuthenticated")
        );
        return;
      }

      const amountMinor = String(pending.item.amount_minor);
      const payload = {
        account_id: selectedAccountId,
        type: pending.item.type,
        amount_minor: amountMinor,
        currency: pending.item.currency,
        amount_base_minor: amountMinor,
        fx_rate: "1",
        fx_date: pending.occurrenceDate,
        category_id: pending.item.category_id,
        date: pending.occurrenceDate,
        merchant: pending.item.merchant,
        notes: pending.item.notes,
        created_by: user.id,
        recurring_item_id: pending.item.id,
        recurring_occurrence_date: pending.occurrenceDate,
      };

      const { data, error: confirmError } = await supabase
        .from("transactions")
        .upsert([payload], {
          onConflict: "account_id,recurring_item_id,recurring_occurrence_date",
          ignoreDuplicates: true,
        })
        .select()
        .single();

      if (confirmError) throw confirmError;

      if (data) {
        setTransactions([data as Transaction, ...transactions]);
      } else {
        await loadData();
      }
    } catch (e: any) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "transactions.recurring.confirmError")
      );
    } finally {
      setConfirmingKey(null);
    }
  };

  const screenTitle = t(dictionary, "transactions.pageTitle");
  const handleAddTransaction = () => {
    router.push("/(auth)/(tabs)/transactions/create");
  };
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(auth)/(tabs)/home");
  };
  const screenOptions = {
    title: screenTitle,
    headerLeft: () => (
      <TouchableOpacity
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel={t(dictionary, "common.back")}
        style={styles.headerBackButton}
        hitSlop={{
          top: spacing.sm,
          bottom: spacing.sm,
          left: spacing.sm,
          right: spacing.sm,
        }}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={22}
          color={colors.text.primary}
        />
      </TouchableOpacity>
    ),
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.container}>
          <Card title={t(dictionary, "common.errorTitle")} description={error}>
            <Button title={t(dictionary, "common.retry")} onPress={loadData} />
          </Card>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <View style={styles.screen}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.subtitle}>{t(dictionary, "transactions.pageDescription")}</Text>
          </View>

          {/* Toolbar */}
          <View style={styles.toolbar}>
            <TouchableOpacity
              onPress={openMonthActions}
              style={styles.filterButton}
              accessibilityRole="button"
              accessibilityLabel={t(dictionary, "transactions.filtersButton")}
            >
              <View style={styles.filterIcon}>
                <MaterialCommunityIcons
                  name="calendar-month"
                  size={18}
                  color={colors.text.primary}
                />
              </View>
              <View style={styles.filterText}>
                <Text style={styles.filterLabel}>
                  {t(dictionary, "transactions.filtersButton")}
                </Text>
                <Text style={styles.filterValue}>
                  {formatMonthLabel(selectedMonth, locale)}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Month Summary */}
          <View style={styles.monthHeader}>
            <Text style={styles.monthHeaderText}>
              {t(dictionary, "transactions.transactionsFor", {
                month: formatMonthLabel(selectedMonth, locale),
              })}
            </Text>
          </View>

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
                count: mergedItems.length,
              })}
            </Text>

            <Card>
            {mergedItems.length === 0 ? (
              <Text style={styles.emptyText}>
                {t(dictionary, "transactions.emptyList")}
              </Text>
            ) : (
              <View style={styles.list}>
                {mergedItems.map((entry) => {
                  if (entry.kind === "transaction") {
                    const transaction = entry.transaction;
                    const category = transaction.category;
                    const amount = formatMoneyWithSymbol(
                      BigInt(transaction.amount_base_minor),
                      baseCurrency,
                      currencySymbol
                    );
                    const displayName =
                      transaction.merchant ||
                      category?.name ||
                      t(dictionary, "transactions.uncategorized");
                    const profile = profilesById[transaction.created_by];
                    const creatorName =
                      profile?.display_name ||
                      profile?.email ||
                      transaction.created_by.slice(0, 6);
                    const creatorLabel = t(dictionary, "transactions.createdBy", {
                      name: creatorName,
                    });

                    return (
                      <TouchableOpacity
                        key={transaction.id}
                        style={styles.transactionItem}
                        onPress={() =>
                          router.push(`/(auth)/(tabs)/transactions/${transaction.id}`)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={displayName}
                      >
                        <View style={styles.transactionLeft}>
                          <CategoryIcon
                            iconId={category?.icon_id}
                            size={24}
                            tone="muted"
                            accessibilityLabel={category?.name}
                          />
                          <View style={styles.transactionInfo}>
                            <Text style={styles.transactionName}>{displayName}</Text>
                            <Text style={styles.transactionDate}>
                              {new Date(transaction.date).toLocaleDateString()}
                              {transaction.notes && ` • ${transaction.notes}`}
                            </Text>
                          </View>
                        </View>

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
                          <UserAvatar
                            email={profile?.email}
                            userId={transaction.created_by}
                            avatarPath={profile?.avatar_path}
                            fallbackText={profile?.avatar_fallback_text ?? null}
                            fallbackBgToken={
                              (profile?.avatar_fallback_bg_token as AvatarColorToken | null) ??
                              null
                            }
                            size={24}
                            label={creatorLabel}
                          />
                          <TouchableOpacity
                            onPress={() => handleDelete(transaction)}
                            style={styles.deleteAction}
                            accessibilityRole="button"
                            accessibilityLabel={t(dictionary, "transactions.deleteButton")}
                          >
                            <Text style={styles.deleteActionText}>
                              {t(dictionary, "transactions.deleteActionShort")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  const pending = entry.recurring;
                  const category = pending.item.category_id
                    ? categoriesById[pending.item.category_id]
                    : undefined;
                  const amount = formatMoneyWithSymbol(
                    BigInt(pending.item.amount_minor),
                    pending.item.currency,
                    CURRENCIES.find((c) => c.code === pending.item.currency)?.symbol ||
                      pending.item.currency
                  );
                  const displayName =
                    pending.item.merchant ||
                    category?.name ||
                    t(dictionary, "transactions.uncategorized");
                  const confirmKey = getOccurrenceKey(
                    pending.item.id,
                    pending.occurrenceDate
                  );

                  return (
                    <View key={confirmKey} style={styles.transactionItem}>
                      <View style={styles.transactionLeft}>
                        <CategoryIcon
                          iconId={category?.icon_id}
                          size={24}
                          tone="muted"
                          accessibilityLabel={category?.name}
                        />
                        <View style={styles.transactionInfo}>
                          <Text style={styles.transactionName}>{displayName}</Text>
                          <Text style={styles.transactionDate}>
                            {new Date(pending.occurrenceDate).toLocaleDateString()} •{" "}
                            {t(dictionary, "transactions.recurring.pendingLabel")}
                            {pending.item.notes && ` • ${pending.item.notes}`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.transactionRight}>
                        <Text
                          style={[
                            styles.transactionAmount,
                            pending.item.type === "income"
                              ? styles.incomeText
                              : styles.expenseText,
                          ]}
                        >
                          {pending.item.type === "income" ? "+" : "-"}
                          {amount}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleConfirmRecurring(pending)}
                          style={styles.secondaryAction}
                          disabled={confirmingKey === confirmKey}
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            dictionary,
                            "transactions.recurring.confirmAction"
                          )}
                        >
                          <Text style={styles.secondaryActionText}>
                            {confirmingKey === confirmKey
                              ? t(dictionary, "transactions.recurring.confirming")
                              : t(dictionary, "transactions.recurring.confirmAction")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
          </View>
        </ScrollView>

        <TouchableOpacity
          onPress={handleAddTransaction}
          style={[styles.addFab, { bottom: spacing.lg + insets.bottom }]}
          accessibilityRole="button"
          accessibilityLabel={t(dictionary, "transactions.newTransaction")}
        >
          <MaterialCommunityIcons
            name="plus"
            size={24}
            color={colors.bg.primary}
          />
        </TouchableOpacity>

        <Modal
          transparent
          visible={isMonthActionsOpen}
          animationType="fade"
          onRequestClose={closeMonthActions}
        >
          <View style={styles.sheetOverlay}>
            <Pressable style={styles.sheetBackdrop} onPress={closeMonthActions} />
            <View style={styles.actionSheet}>
              <Button
                title={t(dictionary, "transactions.previousMonth")}
                onPress={() => {
                  goToPreviousMonth();
                  closeMonthActions();
                }}
                variant="secondary"
              />
              <Button
                title={t(dictionary, "transactions.nextMonth")}
                onPress={() => {
                  goToNextMonth();
                  closeMonthActions();
                }}
                variant="secondary"
              />
              <Button
                title={t(dictionary, "transactions.openMonthPicker")}
                onPress={openMonthPicker}
              />
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          visible={isMonthPickerOpen}
          animationType="slide"
          onRequestClose={() => setIsMonthPickerOpen(false)}
        >
          <View style={styles.sheetOverlay}>
            <Pressable
              style={styles.sheetBackdrop}
              onPress={() => setIsMonthPickerOpen(false)}
            />
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {t(dictionary, "transactions.openMonthPicker")}
                </Text>
              </View>
              <View style={styles.pickerContent}>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>
                    {t(dictionary, "transactions.monthPickerLabel")}
                  </Text>
                  <Picker
                    selectedValue={pickerMonthIndex}
                    onValueChange={(value) => setPickerMonthIndex(Number(value))}
                    style={styles.picker}
                    accessibilityLabel={t(dictionary, "transactions.monthPickerLabel")}
                  >
                    {monthOptions.map((label, index) => (
                      <Picker.Item key={label} label={label} value={index} />
                    ))}
                  </Picker>
                </View>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>
                    {t(dictionary, "transactions.yearPickerLabel")}
                  </Text>
                  <Picker
                    selectedValue={pickerYear}
                    onValueChange={(value) => setPickerYear(Number(value))}
                    style={styles.picker}
                    accessibilityLabel={t(dictionary, "transactions.yearPickerLabel")}
                  >
                    {yearOptions.map((year) => (
                      <Picker.Item key={year} label={String(year)} value={year} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={styles.sheetActions}>
                <Button
                  title={t(dictionary, "common.cancel")}
                  onPress={() => setIsMonthPickerOpen(false)}
                  variant="secondary"
                />
                <Button
                  title={t(dictionary, "transactions.applyMonthPicker")}
                  onPress={applyMonthPicker}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  header: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.surface,
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.secondary,
  },
  filterText: {
    flex: 1,
  },
  filterLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  filterValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  inlineAddButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.action.secondary,
  },
  monthHeader: {
    marginTop: spacing.xs,
  },
  monthHeaderText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
  },
  summaryContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bg.secondary,
  },
  summaryLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  incomeText: {
    color: colors.state.positive,
  },
  expenseText: {
    color: colors.state.negative,
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.md,
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: spacing.xxl,
  },
  list: {
    gap: spacing.sm,
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: radii.sm,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    flex: 1,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  transactionDate: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  transactionRight: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  transactionAmount: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  deleteAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  deleteActionText: {
    color: colors.state.negative,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  secondaryAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  secondaryActionText: {
    color: colors.text.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  addFab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.action.primary,
    shadowColor: colors.shadow.soft,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  headerBackButton: {
    padding: spacing.sm,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.shadow.soft,
  },
  sheetBackdrop: {
    flex: 1,
  },
  actionSheet: {
    backgroundColor: colors.bg.surface,
    padding: spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.sm,
  },
  sheetContainer: {
    backgroundColor: colors.bg.surface,
    padding: spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  sheetHandle: {
    width: 48,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.state.neutral,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    textAlign: "center",
  },
  pickerContent: {
    flexDirection: "row",
    gap: spacing.md,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  picker: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.md,
  },
  sheetActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
