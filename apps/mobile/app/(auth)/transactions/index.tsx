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
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { CategoryIcon } from "../../../src/components/CategoryIcon";
import { TransactionTile } from "../../../src/components/TransactionTile";
import { useNetworkNotice } from "../../../src/contexts/NetworkNoticeContext";
import {
  addMonths,
  formatMoneyWithSymbol,
  formatMinorToMoney,
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
  const isFocused = useIsFocused();
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
    if (!isFocused) return;
    loadData();
  }, [selectedAccountId, selectedMonth, isFocused]);

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

  const handleAddTransaction = () => {
    router.push("/(auth)/(tabs)/transactions/create");
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
            <TouchableOpacity
              onPress={() => router.push("/(auth)/recurrentes")}
              style={styles.filterButton}
              accessibilityRole="button"
              accessibilityLabel={t(dictionary, "recurrentes.title")}
            >
              <View style={styles.filterIcon}>
                <MaterialCommunityIcons
                  name="repeat"
                  size={18}
                  color={colors.text.primary}
                />
              </View>
              <View style={styles.filterText}>
                <Text style={styles.filterLabel}>
                  {t(dictionary, "recurrentes.title")}
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
            <Text style={styles.sectionHint}>
              {t(dictionary, "transactions.futureLegend")}
            </Text>

            <View style={styles.listContainer}>
              {mergedItems.length === 0 ? (
                <Text style={styles.emptyText}>
                  {t(dictionary, "transactions.emptyList")}
                </Text>
              ) : (
                <View>
                  {mergedItems.map((entry, index) => {
                    const isLast = index === mergedItems.length - 1;

                    if (entry.kind === "transaction") {
                      const transaction = entry.transaction;
                      const category = transaction.category;
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
                        <View
                          key={transaction.id}
                          style={[
                            styles.listRow,
                            isLast && styles.listRowLast,
                          ]}
                        >
                          <TransactionTile
                            transaction={{
                              id: transaction.id,
                              merchant: displayName,
                              category: category
                                ? {
                                    id: category.id,
                                    name: category.name,
                                    icon: category.icon_id,
                                  }
                                : undefined,
                              notes: transaction.notes,
                              date: transaction.date,
                              amount: BigInt(transaction.amount_base_minor),
                              currency: baseCurrency,
                              createdBy: {
                                initial: creatorName.slice(0, 2),
                                userId: transaction.created_by,
                                email: profile?.email ?? null,
                                avatarPath: profile?.avatar_path ?? null,
                                fallbackText: profile?.avatar_fallback_text ?? null,
                                fallbackBgToken:
                                  (profile?.avatar_fallback_bg_token as AvatarColorToken | null) ??
                                  null,
                                label: creatorLabel,
                              },
                              type: transaction.type,
                            }}
                            onPress={(id) =>
                              router.push(`/(auth)/(tabs)/transactions/${id}`)
                            }
                            onEdit={(id) =>
                              router.push(`/(auth)/(tabs)/transactions/${id}`)
                            }
                            onDelete={(_id) => handleDelete(transaction)}
                          />
                        </View>
                      );
                    }

                    const pending = entry.recurring;
                    const category = pending.item.category_id
                      ? categoriesById[pending.item.category_id]
                      : undefined;
                    const displayName =
                      pending.item.merchant ||
                      category?.name ||
                      t(dictionary, "transactions.uncategorized");
                    const confirmKey = getOccurrenceKey(
                      pending.item.id,
                      pending.occurrenceDate
                    );
                    const pendingCurrencySymbol =
                      CURRENCIES.find((c) => c.code === pending.item.currency)?.symbol ||
                      pending.item.currency;
                    const pendingAmount = formatMinorToMoney(
                      BigInt(pending.item.amount_minor),
                      pending.item.currency
                    );
                    const pendingMeta = [
                      new Date(pending.occurrenceDate).toLocaleDateString(locale),
                      t(dictionary, "transactions.recurring.pendingLabel"),
                    ];

                    if (pending.item.notes?.trim()) {
                      pendingMeta.push(pending.item.notes.trim());
                    }

                    return (
                      <View
                        key={confirmKey}
                        style={[
                          styles.listRow,
                          isLast && styles.listRowLast,
                        ]}
                      >
                        <View style={styles.pendingItem}>
                          <View style={styles.pendingLeading}>
                            <View style={styles.pendingBadge}>
                              <CategoryIcon
                                iconId={category?.icon_id}
                                size={18}
                                tone="muted"
                                accessibilityLabel={category?.name}
                              />
                            </View>
                            <View style={styles.pendingContent}>
                              <Text
                                style={styles.pendingMerchant}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {displayName}
                              </Text>
                              <Text
                                style={styles.pendingMeta}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {pendingMeta.join(" • ")}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.pendingTrailing}>
                            <View style={styles.pendingAmountRow}>
                              <Text style={styles.pendingAmountMuted}>
                                {pending.item.type === "expense" ? "-" : ""}
                                {pendingCurrencySymbol}
                              </Text>
                              <Text
                                style={[
                                  styles.pendingAmountValue,
                                  pending.item.type === "income"
                                    ? styles.incomeText
                                    : styles.expenseText,
                                ]}
                              >
                                {pendingAmount}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => handleConfirmRecurring(pending)}
                              style={styles.pendingAction}
                              disabled={confirmingKey === confirmKey}
                              accessibilityRole="button"
                              accessibilityLabel={t(
                                dictionary,
                                "transactions.recurring.confirmAction"
                              )}
                            >
                              <Text style={styles.pendingActionText}>
                                {confirmingKey === confirmKey
                                  ? t(dictionary, "transactions.recurring.confirming")
                                  : t(dictionary, "transactions.recurring.confirmAction")}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
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
  sectionHint: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: spacing.xxl,
  },
  listContainer: {
    backgroundColor: colors.bg.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    overflow: "hidden",
  },
  listRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  pendingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: colors.bg.primary,
  },
  pendingLeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
  },
  pendingBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.secondary,
  },
  pendingContent: {
    flex: 1,
    minWidth: 0,
  },
  pendingMerchant: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  pendingMeta: {
    marginTop: spacing.xs,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
  pendingTrailing: {
    alignItems: "flex-end",
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
  pendingAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  pendingAmountMuted: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.muted,
  },
  pendingAmountValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  pendingAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  pendingActionText: {
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
