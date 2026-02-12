import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowDownRight, ArrowUpRight } from "phosphor-react-native";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { Button } from "../../../src/components/Button";
import { AddTransactionForm } from "../../../src/components/add-transaction";
import { Input } from "../../../src/components/Input";
import { Card } from "../../../src/components/Card";
import { DatePickerField } from "../../../src/components/DatePickerField";
import {
  type TransactionType,
  type RecurringFrequency,
  type TopCategory,
  type MerchantSuggestion,
  parseMoneyToMinor,
  computeAmountBaseMinor,
  parseFxRate,
  formatMinorToMoney,
  CURRENCY_MINOR_UNITS,
  themeTokens,
} from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";
import { TopCategorySelector } from "../../../src/components/TopCategorySelector";
import { MerchantAutocomplete } from "../../../src/components/MerchantAutocomplete";
import { CurrencySelector } from "../../../src/components/CurrencySelector";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

export default function CreateTransactionScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = Array.isArray(params.kind) ? params.kind[0] : params.kind;

  if (kind === "recurring") {
    return <CreateRecurringTransactionScreen />;
  }

  return <CreateMovementTransactionScreen />;
}

function CreateMovementTransactionScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { selectedAccountId } = useAuth();
  const { tokens: userThemeTokens } = useUserTheme();
  const { dictionary } = useCopy();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [categories, setCategories] = useState<Category[]>([]);
  const [topCategories, setTopCategories] = useState<{
    expense: TopCategory[];
    income: TopCategory[];
  }>({ expense: [], income: [] });
  const [merchantSuggestions, setMerchantSuggestions] = useState<{
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  }>({ expense: [], income: [] });
  const [isLoading, setIsLoading] = useState(true);

  const resolvedType = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType: TransactionType =
    resolvedType === "income" ? "income" : "expense";

  useEffect(() => {
    if (!isFocused || !selectedAccountId) return;
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [
          accountResult,
          categoriesResult,
          topExpenseResult,
          topIncomeResult,
          merchantExpenseResult,
          merchantIncomeResult,
        ] = await Promise.all([
          supabase
            .from("accounts")
            .select("base_currency")
            .eq("id", selectedAccountId)
            .single(),
          supabase
            .from("categories")
            .select("id, name, icon_id, type")
            .eq("account_id", selectedAccountId)
            .order("name", { ascending: true }),
          supabase.rpc("get_top_categories", {
            p_account_id: selectedAccountId,
            p_tx_type: "expense",
            p_limit: 3,
          }),
          supabase.rpc("get_top_categories", {
            p_account_id: selectedAccountId,
            p_tx_type: "income",
            p_limit: 3,
          }),
          supabase.rpc("get_merchant_suggestions", {
            p_account_id: selectedAccountId,
            p_tx_type: "expense",
            p_limit: 20,
          }),
          supabase.rpc("get_merchant_suggestions", {
            p_account_id: selectedAccountId,
            p_tx_type: "income",
            p_limit: 20,
          }),
        ]);

        if (accountResult.error) throw accountResult.error;
        if (categoriesResult.error) throw categoriesResult.error;
        if (topExpenseResult.error) throw topExpenseResult.error;
        if (topIncomeResult.error) throw topIncomeResult.error;
        if (merchantExpenseResult.error) throw merchantExpenseResult.error;
        if (merchantIncomeResult.error) throw merchantIncomeResult.error;

        if (cancelled) return;

        setBaseCurrency(accountResult.data?.base_currency ?? "EUR");
        setCategories((categoriesResult.data ?? []) as Category[]);
        setTopCategories({
          expense: (topExpenseResult.data ?? []) as TopCategory[],
          income: (topIncomeResult.data ?? []) as TopCategory[],
        });
        setMerchantSuggestions({
          expense: (merchantExpenseResult.data ?? []) as MerchantSuggestion[],
          income: (merchantIncomeResult.data ?? []) as MerchantSuggestion[],
        });
      } catch (error) {
        console.error("[CreateMovementTransaction] Error loading data:", error);
        if (!cancelled) {
          Alert.alert(
            t(dictionary, "common.errorTitle"),
            t(dictionary, "errors.internalServer")
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [dictionary, isFocused, selectedAccountId]);

  if (!selectedAccountId) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, backgroundColor: userThemeTokens.background },
        ]}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadErrorText}>
            {t(dictionary, "transactions.noAccountSelected")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: userThemeTokens.background },
      ]}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.action.primary} />
        </View>
      ) : (
        <AddTransactionForm
          key={`${selectedAccountId}-${initialType}`}
          type={initialType}
          accountId={selectedAccountId}
          currency={baseCurrency}
          categories={categories}
          topCategories={topCategories}
          merchantSuggestions={merchantSuggestions}
          onSuccess={() => router.back()}
          onCancel={() => router.back()}
        />
      )}
    </View>
  );
}

function CreateRecurringTransactionScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; kind?: string }>();
  const { selectedAccountId } = useAuth();
  const { tokens: userThemeTokens } = useUserTheme();
  const { dictionary } = useCopy();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [fxRate, setFxRate] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatLocked, setRepeatLocked] = useState(false);
  const [repeatFrequency, setRepeatFrequency] =
    useState<RecurringFrequency>("monthly");
  const [repeatInterval, setRepeatInterval] = useState("1");
  const [repeatStartDate, setRepeatStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [repeatEndDate, setRepeatEndDate] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [fxRateError, setFxRateError] = useState<string | null>(null);

  // Top categories state
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [showFullCategorySelector, setShowFullCategorySelector] = useState(false);
  const topCategoriesCache = useRef<Record<string, TopCategory[]>>({});

  // Merchant suggestions state
  const [merchantSuggestions, setMerchantSuggestions] = useState<MerchantSuggestion[]>([]);
  const merchantSuggestionsCache = useRef<Record<string, MerchantSuggestion[]>>({});

  const sanitizeNumericInput = (value: string) =>
    value.replace(/[^0-9.,]/g, "");

  useEffect(() => {
    if (isFocused) {
      loadCategories();
      loadAccount();
    }
  }, [selectedAccountId, isFocused]);

  useEffect(() => {
    if (params.type === "income" || params.type === "expense") {
      setType(params.type);
      setCategoryId("");
    }
  }, [params.type]);

  useEffect(() => {
    if (params.kind === "recurring") {
      setRepeatEnabled(true);
      setRepeatLocked(true);
      setRepeatStartDate(date);
      if (currency !== baseCurrency) {
        setCurrency(baseCurrency);
        setFxRate("1");
        setFxRateError(null);
      }
    } else {
      setRepeatLocked(false);
    }
  }, [params.kind]);

  const loadCategories = async () => {
    if (!selectedAccountId) return;

    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("account_id", selectedAccountId)
        .order("name", { ascending: true });

      if (error) throw error;

      setCategories(data || []);
    } catch (e: any) {
      console.error("Error loading categories:", e);
    }
  };

  const loadAccount = async () => {
    if (!selectedAccountId) return;

    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("base_currency")
        .eq("id", selectedAccountId)
        .single();

      if (error) throw error;

      setBaseCurrency(data.base_currency);
      setCurrency(data.base_currency); // Default to base currency
      setFxRate("1");
    } catch (e: any) {
      console.error("Error loading account:", e);
    }
  };

  const fetchTopCategories = useCallback(
    async (txType: TransactionType) => {
      if (!selectedAccountId) return;

      const cacheKey = `${selectedAccountId}:${txType}`;
      if (topCategoriesCache.current[cacheKey]) {
        setTopCategories(topCategoriesCache.current[cacheKey]);
        return;
      }

      const { data, error } = await supabase.rpc("get_top_categories", {
        p_account_id: selectedAccountId,
        p_tx_type: txType,
        p_limit: 3,
      });

      if (!error && data) {
        const categories = data as TopCategory[];
        topCategoriesCache.current[cacheKey] = categories;
        setTopCategories(categories);
      }
    },
    [selectedAccountId]
  );

  const fetchMerchantSuggestions = useCallback(
    async (txType: TransactionType) => {
      if (!selectedAccountId) return;

      const cacheKey = `${selectedAccountId}:${txType}`;
      if (merchantSuggestionsCache.current[cacheKey]) {
        setMerchantSuggestions(merchantSuggestionsCache.current[cacheKey]);
        return;
      }

      const { data, error } = await supabase.rpc("get_merchant_suggestions", {
        p_account_id: selectedAccountId,
        p_tx_type: txType,
        p_limit: 20,
      });

      if (!error && data) {
        const suggestions = data as MerchantSuggestion[];
        merchantSuggestionsCache.current[cacheKey] = suggestions;
        setMerchantSuggestions(suggestions);
      }
    },
    [selectedAccountId]
  );

  useEffect(() => {
    if (isFocused && selectedAccountId) {
      fetchTopCategories(type);
      fetchMerchantSuggestions(type);
      setShowFullCategorySelector(false);
    }
  }, [isFocused, type, selectedAccountId, fetchTopCategories, fetchMerchantSuggestions]);

  const handleCreate = async () => {
    if (!amount.trim()) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "transactions.amountRequired")
      );
      return;
    }

    if (!selectedAccountId) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "transactions.noAccountSelected")
      );
      return;
    }

    if (repeatEnabled && currency !== baseCurrency) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "transactions.repeat.baseCurrencyOnly")
      );
      return;
    }

    if (repeatEnabled && Number(repeatInterval) < 1) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "errors.invalidRequest")
      );
      return;
    }

    if (!repeatEnabled && currency !== baseCurrency) {
      if (!fxRate.trim()) {
        setFxRateError(t(dictionary, "transactions.fxRateRequired"));
        return;
      }
      const parsedFx = parseFxRate(fxRate);
      if (typeof parsedFx === "object" && "error" in parsedFx) {
        setFxRateError(t(dictionary, parsedFx.error.key));
        return;
      }
    }

    setFxRateError(null);
    const fxRateValue =
      currency === baseCurrency ? "1" : fxRate.replace(",", ".");

    setIsSubmitting(true);

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "transactions.notAuthenticated")
        );
        setIsSubmitting(false);
        return;
      }

      // Parse amount to minor units
      const amountMinor = parseMoneyToMinor(
        amount,
        currency,
        CURRENCY_MINOR_UNITS
      );
      if (typeof amountMinor === "object" && "error" in amountMinor) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, amountMinor.error.key, amountMinor.error.params)
        );
        setIsSubmitting(false);
        return;
      }

      if (repeatEnabled) {
        const { error } = await supabase
          .from("recurring_items")
          .insert([
            {
              account_id: selectedAccountId,
              type,
              amount_minor: amountMinor.toString(),
              currency,
              category_id: categoryId || null,
              start_date: repeatStartDate,
              frequency: repeatFrequency,
              interval: Number(repeatInterval),
              end_date: repeatEndDate.trim() || null,
              merchant: merchant.trim() || null,
              notes: notes.trim() || null,
              is_paused: false,
              created_by: user.id,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        // Invalidate top categories cache for next form opening
        delete topCategoriesCache.current[`${selectedAccountId}:${type}`];

        Alert.alert(
          t(dictionary, "common.successTitle"),
          t(dictionary, "transactions.repeat.createSuccess"),
          [
            {
              text: t(dictionary, "common.ok"),
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        // Calculate amount_base_minor
        let amountBaseMinor: bigint;
        if (currency === baseCurrency) {
          amountBaseMinor = amountMinor;
        } else {
          const computed = computeAmountBaseMinor({
            amountMinor,
            currency,
            baseCurrency,
            fxRate: fxRateValue,
            currencyMeta: CURRENCY_MINOR_UNITS,
          });
          if (typeof computed === "object" && "error" in computed) {
            Alert.alert(
              t(dictionary, "common.errorTitle"),
              t(dictionary, computed.error.key)
            );
            setIsSubmitting(false);
            return;
          }
          amountBaseMinor = computed;
        }

        const { error } = await supabase
          .from("transactions")
          .insert([
            {
              account_id: selectedAccountId,
              type,
              amount_minor: amountMinor.toString(),
              currency,
              amount_base_minor: amountBaseMinor.toString(),
              fx_rate: fxRateValue,
              fx_date: date,
              category_id: categoryId || null,
              date,
              merchant: merchant.trim() || null,
              notes: notes.trim() || null,
              created_by: user.id,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        // Invalidate top categories cache for next form opening
        delete topCategoriesCache.current[`${selectedAccountId}:${type}`];

        Alert.alert(
          t(dictionary, "common.successTitle"),
          t(dictionary, "transactions.createSuccess"),
          [
            {
              text: t(dictionary, "common.ok"),
              onPress: () => router.back(),
            },
          ]
        );
      }

    } catch (e: any) {
      console.error("Error creating transaction:", e);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message ||
          t(
            dictionary,
            repeatEnabled
              ? "transactions.repeat.createError"
              : "transactions.createError"
          )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter categories by type
  const availableCategories = categories.filter((cat) => cat.type === type);
  const previewBaseAmount = useMemo(() => {
    if (currency === baseCurrency) return null;
    if (!amount.trim() || !fxRate.trim()) return null;

    const amountMinor = parseMoneyToMinor(
      amount,
      currency,
      CURRENCY_MINOR_UNITS
    );
    if (typeof amountMinor === "object" && "error" in amountMinor) {
      return null;
    }

    const computed = computeAmountBaseMinor({
      amountMinor,
      currency,
      baseCurrency,
      fxRate,
      currencyMeta: CURRENCY_MINOR_UNITS,
    });
    if (typeof computed === "object" && "error" in computed) {
      return null;
    }

    return formatMinorToMoney(computed, baseCurrency, CURRENCY_MINOR_UNITS);
  }, [amount, currency, baseCurrency, fxRate]);

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: userThemeTokens.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
    >
        <Card
          title={t(dictionary, "transactions.newTransaction")}
          description={t(dictionary, "transactions.create.description")}
        >
          <View style={styles.form}>
          {/* Type - Toggle */}
          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "transactions.create.typeLabel")}</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  type === "expense" && styles.typeOptionActive,
                ]}
                onPress={() => {
                  setType("expense");
                  setCategoryId(""); // Reset category when type changes
                }}
              >
                <ArrowDownRight
                  size={18}
                  weight="regular"
                  color={type === "expense" ? colors.text.primary : colors.text.muted}
                />
                <Text
                  style={[
                    styles.typeOptionText,
                    type === "expense" && styles.typeOptionTextActive,
                  ]}
                >
                  {t(dictionary, "transactions.create.typeExpense")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  type === "income" && styles.typeOptionActive,
                ]}
                onPress={() => {
                  setType("income");
                  setCategoryId(""); // Reset category when type changes
                }}
              >
                <ArrowUpRight
                  size={18}
                  weight="regular"
                  color={type === "income" ? colors.text.primary : colors.text.muted}
                />
                <Text
                  style={[
                    styles.typeOptionText,
                    type === "income" && styles.typeOptionTextActive,
                  ]}
                >
                  {t(dictionary, "transactions.create.typeIncome")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount + Currency */}
          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "transactions.create.amountLabel")}</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(value) => setAmount(sanitizeNumericInput(value))}
                placeholder={t(dictionary, "transactions.create.amountPlaceholder")}
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <CurrencySelector
                value={currency}
                onChange={(value) => {
                  setCurrency(value);
                  if (value === baseCurrency) {
                    setFxRate("1");
                    setFxRateError(null);
                  }
                }}
                disabled={repeatEnabled}
              />
            </View>
          </View>

          {currency !== baseCurrency && (
            <>
              <Input
                label={t(dictionary, "transactions.fxRateLabel")}
                value={fxRate}
                onChangeText={(value) => {
                  setFxRateError(null);
                  setFxRate(sanitizeNumericInput(value));
                }}
                placeholder={t(dictionary, "transactions.fxRatePlaceholder")}
                keyboardType="numeric"
                error={fxRateError ?? undefined}
                helperText={t(dictionary, "transactions.fxRateHelper", {
                  currency,
                  baseCurrency,
                })}
              />
              <Text style={styles.previewText}>
                {t(dictionary, "transactions.baseAmountPreview", {
                  amount: previewBaseAmount ?? "-",
                  baseCurrency,
                })}
              </Text>
            </>
          )}

          {/* Date */}
          <DatePickerField
            label={t(dictionary, "transactions.create.dateLabel")}
            value={date}
            onChangeText={setDate}
            placeholder={t(dictionary, "transactions.datePlaceholder")}
          />

          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "transactions.repeat.label")}</Text>
            <TouchableOpacity
              style={[
                styles.toggleRow,
                repeatLocked && styles.toggleRowDisabled,
              ]}
              onPress={() => {
                if (repeatLocked) return;
                const next = !repeatEnabled;
                setRepeatEnabled(next);
                if (next) {
                  setRepeatStartDate(date);
                  if (currency !== baseCurrency) {
                    setCurrency(baseCurrency);
                    setFxRate("1");
                    setFxRateError(null);
                  }
                }
              }}
              disabled={repeatLocked}
            >
              <View style={styles.toggleChip}>
                <Text style={styles.toggleChipText}>
                  {repeatEnabled
                    ? t(dictionary, "common.on")
                    : t(dictionary, "common.off")}
                </Text>
              </View>
              <Text style={styles.toggleHelper}>
                {t(dictionary, "transactions.repeat.helper")}
              </Text>
            </TouchableOpacity>
          </View>

          {repeatEnabled && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t(dictionary, "transactions.repeat.frequencyLabel")}
                </Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={repeatFrequency}
                    onValueChange={(value) =>
                      setRepeatFrequency(value as RecurringFrequency)
                    }
                    style={styles.picker}
                  >
                    <Picker.Item
                      label={t(dictionary, "transactions.repeat.weekly")}
                      value="weekly"
                    />
                    <Picker.Item
                      label={t(dictionary, "transactions.repeat.monthly")}
                      value="monthly"
                    />
                    <Picker.Item
                      label={t(dictionary, "transactions.repeat.yearly")}
                      value="yearly"
                    />
                  </Picker>
                </View>
              </View>

              <Input
                label={t(dictionary, "transactions.repeat.intervalLabel")}
                value={repeatInterval}
                onChangeText={(value) =>
                  setRepeatInterval(value.replace(/[^0-9]/g, ""))
                }
                placeholder="1"
                keyboardType="numeric"
              />

              <DatePickerField
                label={t(dictionary, "transactions.repeat.startDateLabel")}
                value={repeatStartDate}
                onChangeText={setRepeatStartDate}
                placeholder={t(dictionary, "transactions.datePlaceholder")}
              />

              <DatePickerField
                label={t(dictionary, "transactions.repeat.endDateLabel")}
                value={repeatEndDate}
                onChangeText={setRepeatEndDate}
                placeholder={t(dictionary, "transactions.datePlaceholder")}
                allowClear
              />
            </>
          )}

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "transactions.categoryOptionalLabel")}</Text>
            {topCategories.length > 0 && (
              <TopCategorySelector
                topCategories={topCategories}
                selectedCategoryId={categoryId || undefined}
                onSelect={(id) => setCategoryId(id)}
                onToggleAll={() => setShowFullCategorySelector((prev) => !prev)}
                isExpanded={showFullCategorySelector}
                seeOthersLabel={t(dictionary, "transactions.create.categorySeeOthers")}
                hideOthersLabel={t(dictionary, "transactions.create.categoryHideOthers")}
                style={styles.topCategorySelector}
              />
            )}
            {(showFullCategorySelector || topCategories.length === 0) && (
              <View style={styles.categoryDropdownContainer}>
                <ScrollView
                  style={styles.categoryDropdownList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.categoryDropdownItem,
                      !categoryId && styles.categoryDropdownItemSelected,
                      pressed && styles.categoryDropdownItemPressed,
                    ]}
                    onPress={() => setCategoryId("")}
                  >
                    <Text style={[
                      styles.categoryDropdownText,
                      !categoryId && styles.categoryDropdownTextSelected,
                    ]}>
                      {t(dictionary, "common.noneOption")}
                    </Text>
                  </Pressable>
                  {availableCategories.length === 0 ? (
                    <View style={styles.categoryDropdownItem}>
                      <Text style={styles.categoryDropdownEmptyText}>
                        {t(dictionary, "transactions.create.categoryEmpty", {
                          type:
                            type === "income"
                              ? t(dictionary, "categories.incomeLabel")
                              : t(dictionary, "categories.expenseLabel"),
                        })}
                      </Text>
                    </View>
                  ) : (
                    availableCategories.map((cat) => {
                      const isSelected = categoryId === cat.id;
                      return (
                        <Pressable
                          key={cat.id}
                          style={({ pressed }) => [
                            styles.categoryDropdownItem,
                            isSelected && styles.categoryDropdownItemSelected,
                            pressed && styles.categoryDropdownItemPressed,
                          ]}
                          onPress={() => setCategoryId(cat.id)}
                        >
                          <Text style={[
                            styles.categoryDropdownText,
                            isSelected && styles.categoryDropdownTextSelected,
                          ]}>
                            {cat.name}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Merchant */}
          <MerchantAutocomplete
            label={t(dictionary, "transactions.merchantOptionalLabel")}
            value={merchant}
            onChangeText={setMerchant}
            suggestions={merchantSuggestions}
            placeholder={t(dictionary, "transactions.create.merchantPlaceholder")}
          />

          {/* Notes */}
          <Input
            label={t(dictionary, "transactions.notesOptionalLabel")}
            value={notes}
            onChangeText={setNotes}
            placeholder={t(dictionary, "transactions.notesPlaceholder")}
            multiline
            numberOfLines={3}
          />

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                title={t(dictionary, "common.cancel")}
                onPress={() => router.back()}
                variant="secondary"
                disabled={isSubmitting}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={
                  isSubmitting
                    ? t(dictionary, "common.creating")
                    : t(dictionary, "common.create")
                }
                onPress={handleCreate}
                disabled={isSubmitting}
              />
            </View>
          </View>
          </View>
        </Card>
      </KeyboardAwareScrollView>
  );
}

const colors = themeTokens.light.colors;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadErrorText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
  },
  content: {
    padding: 16,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: colors.bg.surface,
    color: colors.text.primary,
  },
  topCategorySelector: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  previewText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleRowDisabled: {
    opacity: 0.6,
  },
  toggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.action.secondary,
  },
  toggleChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.primary,
  },
  toggleHelper: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
  },
  // Type toggle styles
  typeToggle: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
  },
  typeOptionActive: {
    backgroundColor: colors.bg.surface,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.muted,
  },
  typeOptionTextActive: {
    color: colors.text.primary,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    height: Platform.OS === "ios" ? 150 : 50,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  // Category dropdown styles (matching MerchantAutocomplete)
  categoryDropdownContainer: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: 8,
    maxHeight: 200,
    overflow: "hidden",
  },
  categoryDropdownList: {
    maxHeight: 200,
  },
  categoryDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.state.neutral,
  },
  categoryDropdownItemSelected: {
    backgroundColor: colors.action.secondary,
  },
  categoryDropdownItemPressed: {
    backgroundColor: colors.bg.secondary,
  },
  categoryDropdownText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text.primary,
  },
  categoryDropdownTextSelected: {
    color: colors.action.primary,
    fontWeight: "600",
  },
  categoryDropdownEmptyText: {
    fontSize: 14,
    color: colors.text.muted,
    fontStyle: "italic",
  },
});
