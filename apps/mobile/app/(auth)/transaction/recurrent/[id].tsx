import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { DatePickerField } from "../../../src/components/DatePickerField";
import { TopCategorySelector } from "../../../src/components/TopCategorySelector";
import { MerchantAutocomplete } from "../../../src/components/MerchantAutocomplete";
import {
  themeTokens,
  type RecurringItem,
  type TopCategory,
  type MerchantSuggestion,
  formatMinorToMoney,
  parseMoneyToMinor,
  CURRENCY_MINOR_UNITS,
} from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type RecurringItemWithCategory = RecurringItem & {
  category?: Category | null;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const spacing = tokens.spacing;
const typography = tokens.typography;
const radii = tokens.radii;

export default function EditRecurringScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedAccountId } = useAuth();
  const { tokens: userThemeTokens } = useUserTheme();
  const { dictionary } = useCopy();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recurringItem, setRecurringItem] =
    useState<RecurringItemWithCategory | null>(null);

  // Form state
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Categories & merchant suggestions
  const [categories, setCategories] = useState<Category[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [showFullCategorySelector, setShowFullCategorySelector] = useState(false);
  const [merchantSuggestions, setMerchantSuggestions] = useState<MerchantSuggestion[]>([]);
  const topCategoriesCache = useRef<Record<string, TopCategory[]>>({});
  const merchantSuggestionsCache = useRef<Record<string, MerchantSuggestion[]>>({});

  const loadData = useCallback(async () => {
    if (!id || !selectedAccountId) {
      setError(t(dictionary, "recurrentes.loadError"));
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("recurring_items")
        .select(
          `
          *,
          category:categories(id, name, icon_id, type)
        `
        )
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Not found");

      setRecurringItem(data);

      // Populate form
      const amountMinor =
        typeof data.amount_minor === "bigint"
          ? data.amount_minor
          : BigInt(data.amount_minor);
      setMerchant(data.merchant || "");
      setAmount(formatMinorToMoney(amountMinor, data.currency));
      setCategoryId(data.category?.id || "");
      setStartDate(data.start_date);
      setEndDate(data.end_date || "");
      setError(null);
    } catch (e: any) {
      setError(e?.message || t(dictionary, "recurrentes.loadError"));
    } finally {
      setLoading(false);
    }
  }, [id, selectedAccountId, dictionary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchCategories = useCallback(async () => {
    if (!selectedAccountId) return;
    const { data } = await supabase
      .from("categories")
      .select("id, name, icon_id, type")
      .eq("account_id", selectedAccountId)
      .order("name", { ascending: true });
    if (data) setCategories(data);
  }, [selectedAccountId]);

  const fetchTopCategories = useCallback(
    async (txType: string) => {
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
        topCategoriesCache.current[cacheKey] = data as TopCategory[];
        setTopCategories(data as TopCategory[]);
      }
    },
    [selectedAccountId]
  );

  const fetchMerchantSuggestions = useCallback(
    async (txType: string) => {
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
        merchantSuggestionsCache.current[cacheKey] = data as MerchantSuggestion[];
        setMerchantSuggestions(data as MerchantSuggestion[]);
      }
    },
    [selectedAccountId]
  );

  useEffect(() => {
    if (!recurringItem || !selectedAccountId) return;
    fetchCategories();
    fetchTopCategories(recurringItem.type);
    fetchMerchantSuggestions(recurringItem.type);
  }, [recurringItem?.type, selectedAccountId, fetchCategories, fetchTopCategories, fetchMerchantSuggestions]);

  const handleSave = async () => {
    if (!recurringItem) return;

    setSaving(true);
    try {
      // Parse amount to minor units
      const amountMinor = parseMoneyToMinor(
        amount,
        recurringItem.currency,
        CURRENCY_MINOR_UNITS
      );

      if (typeof amountMinor === "object" && "error" in amountMinor) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "transactions.amountRequired")
        );
        setSaving(false);
        return;
      }

      // Validate effective_from
      const today = new Date().toISOString().slice(0, 10);
      if (effectiveFrom < today) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "errors.invalidRequest")
        );
        setSaving(false);
        return;
      }

      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (merchant !== recurringItem.merchant) {
        updatePayload.merchant = merchant || null;
      }

      if (Number(amountMinor) !== Number(recurringItem.amount_minor)) {
        updatePayload.amount_minor = amountMinor.toString();
      }

      if (startDate !== recurringItem.start_date) {
        updatePayload.start_date = startDate;
      }

      if (endDate !== (recurringItem.end_date || "")) {
        updatePayload.end_date = endDate || null;
      }

      const currentCategoryId = recurringItem.category?.id || "";
      if (categoryId !== currentCategoryId) {
        updatePayload.category_id = categoryId || null;
      }

      const { data, error: updateError } = await supabase
        .from("recurring_items")
        .update(updatePayload)
        .eq("id", recurringItem.id)
        .select()
        .single();

      if (updateError) throw updateError;

      Alert.alert(
        t(dictionary, "common.successTitle"),
        t(dictionary, "recurrentes.updateSuccess"),
        [{ text: t(dictionary, "common.ok"), onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "recurrentes.updateError")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/transaction/recurrent");
    }
  };

  const sanitizeNumericInput = (value: string) =>
    value.replace(/[^0-9.,]/g, "");

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const screenTitle = t(dictionary, "recurrentes.edit");
  const screenOptions = {
    title: screenTitle,
    headerStyle: { backgroundColor: userThemeTokens.background },
    headerTitleStyle: { color: userThemeTokens.textPrimary },
    headerLeft: () => (
      <TouchableOpacity
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel={t(dictionary, "common.back")}
        style={styles.headerBackButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={22}
          color={userThemeTokens.textPrimary}
        />
      </TouchableOpacity>
    ),
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={[styles.loading, { backgroundColor: userThemeTokens.background }]}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error || !recurringItem) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={[styles.container, { backgroundColor: userThemeTokens.background }]}>
          <Card
            title={t(dictionary, "common.errorTitle")}
            description={error || t(dictionary, "recurrentes.loadError")}
          >
            <Button title={t(dictionary, "common.back")} onPress={handleBack} />
          </Card>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <View style={[styles.screen, { backgroundColor: userThemeTokens.background }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.subtitle}>
              {t(dictionary, "recurrentes.editDescription")}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Category */}
            <View style={styles.field}>
              <Text style={styles.label}>
                {t(dictionary, "transactions.categoryOptionalLabel")}
              </Text>
              {topCategories.length > 0 && (
                <TopCategorySelector
                  topCategories={topCategories}
                  selectedCategoryId={categoryId || undefined}
                  onSelect={(id) => setCategoryId(id)}
                  onToggleAll={() => setShowFullCategorySelector((prev) => !prev)}
                  isExpanded={showFullCategorySelector}
                  seeOthersLabel={t(dictionary, "transactions.create.categorySeeOthers")}
                  hideOthersLabel={t(dictionary, "transactions.create.categoryHideOthers")}
                />
              )}
              {(showFullCategorySelector || topCategories.length === 0) && (
                <View style={styles.categoryList}>
                  <Pressable
                    style={[
                      styles.categoryItem,
                      !categoryId && styles.categoryItemSelected,
                    ]}
                    onPress={() => setCategoryId("")}
                  >
                    <Text style={[
                      styles.categoryItemText,
                      !categoryId && styles.categoryItemTextSelected,
                    ]}>
                      {t(dictionary, "common.noneOption")}
                    </Text>
                  </Pressable>
                  {categories
                    .filter((cat) => cat.type === recurringItem.type)
                    .map((cat) => {
                      const isSelected = categoryId === cat.id;
                      return (
                        <Pressable
                          key={cat.id}
                          style={[
                            styles.categoryItem,
                            isSelected && styles.categoryItemSelected,
                          ]}
                          onPress={() => setCategoryId(cat.id)}
                        >
                          <Text style={[
                            styles.categoryItemText,
                            isSelected && styles.categoryItemTextSelected,
                          ]}>
                            {cat.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
              )}
            </View>

            {/* Name / Merchant */}
            <MerchantAutocomplete
              label={t(dictionary, "recurrentes.nameLabel")}
              value={merchant}
              onChangeText={setMerchant}
              suggestions={merchantSuggestions}
              placeholder={t(dictionary, "recurrentes.namePlaceholder")}
            />

            {/* Amount */}
            <View style={styles.field}>
              <Text style={styles.label}>
                {t(dictionary, "recurrentes.amountLabel")}
              </Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  value={amount}
                  onChangeText={(value) =>
                    setAmount(sanitizeNumericInput(value))
                  }
                  placeholder="0,00"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.currencyLabel}>
                  {recurringItem.currency}
                </Text>
              </View>
            </View>

            {/* Start Date */}
            <View style={styles.field}>
              <DatePickerField
                label={t(dictionary, "recurrentes.startDateLabel")}
                value={startDate}
                onChangeText={setStartDate}
                placeholder={t(dictionary, "transactions.datePlaceholder")}
                formatValue={formatDateForDisplay}
              />
            </View>

            {/* End Date */}
            <View style={styles.field}>
              <DatePickerField
                label={t(dictionary, "recurrentes.endDateLabel")}
                value={endDate}
                onChangeText={setEndDate}
                placeholder={t(dictionary, "common.optionalSuffix")}
                formatValue={formatDateForDisplay}
                allowClear
              />
            </View>

            {/* Effective From */}
            <View style={styles.field}>
              <DatePickerField
                label={t(dictionary, "recurrentes.applyFrom")}
                value={effectiveFrom}
                onChangeText={setEffectiveFrom}
                helperText={t(dictionary, "recurrentes.applyFromHint")}
                formatValue={formatDateForDisplay}
              />
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={t(dictionary, "common.cancel")}
              variant="outline"
              onPress={handleBack}
              disabled={saving}
            />
            <Button
              title={
                saving
                  ? t(dictionary, "common.saving")
                  : t(dictionary, "common.saveChanges")
              }
              onPress={handleSave}
              disabled={saving}
            />
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  form: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
  },
  input: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  amountInput: {
    flex: 1,
  },
  currencyLabel: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
  },
  categoryList: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: radii.md,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  categoryItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.state.neutral,
  },
  categoryItemSelected: {
    backgroundColor: colors.action.secondary,
  },
  categoryItemText: {
    fontSize: typography.size.md,
    color: colors.text.primary,
  },
  categoryItemTextSelected: {
    color: colors.action.primary,
    fontWeight: typography.weight.semibold,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  headerBackButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
