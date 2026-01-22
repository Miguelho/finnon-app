import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useNetworkNotice } from "../../../../src/contexts/NetworkNoticeContext";
import { Button } from "../../../../src/components/Button";
import { Card } from "../../../../src/components/Card";
import { Input } from "../../../../src/components/Input";
import { InsightsCarousel } from "../../../../src/components/goal/InsightsCarousel";
import {
  addMonths,
  computeGoalInsights,
  computeGoalProgress,
  createTypographyStyles,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getGoalTotalsFromTransactions,
  getMonthlyGoal,
  parseMoneyToMinor,
  themeTokens,
  toMonthKey,
  type FinancialGoal,
  type GoalTransaction,
  type UserRole,
  upsertMonthlyGoal,
  CURRENCIES,
  getMonthRangeFromKey,
} from "@poleursus/shared";
import { useCopy, t } from "../../../../src/lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

const formatAbs = (value: bigint) => (value < 0n ? -value : value);

const getStatusColor = (status: "positive" | "negative" | "neutral") => {
  if (status === "positive") return colors.state.positive;
  if (status === "negative") return colors.state.negative;
  return colors.state.neutral;
};

const formatSignedMoney = (
  value: bigint,
  currency: string,
  currencySymbol: string
) => {
  const formatted = formatMoneyWithSymbol(
    formatAbs(value),
    currency,
    currencySymbol
  );
  return value < 0n ? `-${formatted}` : formatted;
};

type AccountInfo = {
  id: string;
  base_currency: string;
  account_members?: { role: UserRole; user_id: string }[];
};

function GoalSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export default function GoalScreen() {
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [goal, setGoal] = useState<FinancialGoal | null>(null);
  const [transactions, setTransactions] = useState<GoalTransaction[]>([]);
  const [previousExpenseTotalMinor, setPreviousExpenseTotalMinor] = useState<bigint | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [userRole, setUserRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const monthKey = useMemo(() => toMonthKey(new Date()), []);
  const monthLabel = useMemo(() => formatMonthLabel(monthKey, locale), [monthKey, locale]);
  const canEdit = userRole !== "viewer";

  const currencySymbol = useMemo(() => {
    return CURRENCIES.find((currency) => currency.code === baseCurrency)?.symbol ?? baseCurrency;
  }, [baseCurrency]);

  const totals = useMemo(() => getGoalTotalsFromTransactions(transactions), [transactions]);
  const progress = useMemo(() => computeGoalProgress({ goal, totals }), [goal, totals]);
  const insightCopy = useMemo(
    () => ({
      forecast: (amount: string) => t(dictionary, "goal.insights.forecast", { amount }),
      expenseUp: (amount: string) => t(dictionary, "goal.insights.expenseUp", { amount }),
      expenseDown: (amount: string) => t(dictionary, "goal.insights.expenseDown", { amount }),
      expenseEven: t(dictionary, "goal.insights.expenseEven"),
      topCategories: (categories: string) =>
        t(dictionary, "goal.insights.topCategories", { categories }),
    }),
    [dictionary]
  );
  const insightFormatters = useMemo(
    () => ({
      formatSignedMoney: (value: bigint) =>
        formatSignedMoney(value, baseCurrency, currencySymbol),
      formatMoney: (value: bigint) =>
        formatMoneyWithSymbol(value, baseCurrency, currencySymbol),
    }),
    [baseCurrency, currencySymbol]
  );
  const insights = useMemo(
    () =>
      computeGoalInsights({
        progress,
        totals,
        transactions,
        previousExpenseTotalMinor,
        uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
        copy: insightCopy,
        formatters: insightFormatters,
      }),
    [
      dictionary,
      previousExpenseTotalMinor,
      progress,
      totals,
      transactions,
      insightCopy,
      insightFormatters,
    ]
  );

  const formattedTarget = progress
    ? formatMoneyWithSymbol(progress.targetMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedSaved = progress
    ? formatSignedMoney(progress.savedMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedRemaining = progress
    ? formatMoneyWithSymbol(progress.remainingMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedRate = progress
    ? formatMoneyWithSymbol(progress.ratePerDayMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const progressColor = getStatusColor(progress?.status ?? "neutral");
  const progressWidth = progress ? `${Math.round(progress.progressRatio * 100)}%` : "0%";
  const hasTransactions = transactions.length > 0;

  const loadData = useCallback(async () => {
    if (!selectedAccountId || !user) return;

    setLoading(true);
    setError(null);

    try {
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("id, base_currency, account_members!inner(role, user_id)")
        .eq("id", selectedAccountId)
        .eq("account_members.user_id", user.id)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!accountData) {
        setError(t(dictionary, "errors.accountNotFound"));
        return;
      }

      const account = accountData as AccountInfo;
      setBaseCurrency(account.base_currency);
      setUserRole(account.account_members?.[0]?.role ?? "viewer");

      const { start, end } = getMonthRangeFromKey(monthKey);
      const goalData = await getMonthlyGoal(supabase, selectedAccountId, monthKey);
      setGoal(goalData);

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("type, amount_minor, amount_base_minor, category:categories(id, name, icon_id)")
        .eq("account_id", selectedAccountId)
        .gte("date", start)
        .lte("date", end);

      if (transactionsError) throw transactionsError;
      setTransactions((transactionsData as GoalTransaction[]) ?? []);

      const previousMonthKey = addMonths(monthKey, -1);
      const previousRange = getMonthRangeFromKey(previousMonthKey);
      const { data: previousExpenses, error: previousError } = await supabase
        .from("transactions")
        .select("amount_minor, amount_base_minor")
        .eq("account_id", selectedAccountId)
        .eq("type", "expense")
        .gte("date", previousRange.start)
        .lte("date", previousRange.end);

      if (previousError) throw previousError;

      const previousTotal = (previousExpenses ?? []).reduce((total, item) => {
        const raw = item.amount_base_minor ?? item.amount_minor ?? "0";
        try {
          return total + BigInt(raw);
        } catch {
          return total;
        }
      }, 0n);
      setPreviousExpenseTotalMinor(previousTotal);

      setError(null);
    } catch (err: any) {
      console.error("[GoalScreen] Error:", err);
      setError(err?.message ?? t(dictionary, "errors.internalServer"));
      reportNetworkIssue({ onRetry: loadData });
    } finally {
      setLoading(false);
    }
  }, [dictionary, monthKey, reportNetworkIssue, selectedAccountId, user]);

  useEffect(() => {
    if (!isFocused) return;
    loadData();
  }, [isFocused, loadData]);

  const handleOpenEditor = () => {
    setFormError(null);
    if (goal) {
      const value = formatMinorToMoney(progress?.targetMinor ?? 0n, baseCurrency);
      setAmountInput(value);
    } else {
      setAmountInput("");
    }
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!canEdit || !user || !selectedAccountId) return;

    const cleaned = amountInput.trim();
    const parsed = parseMoneyToMinor(cleaned, baseCurrency);
    if (typeof parsed === "object" && "error" in parsed) {
      setFormError(t(dictionary, parsed.error.key, parsed.error.params));
      return;
    }

    if (parsed <= 0n) {
      setFormError(t(dictionary, "money.invalidAmount"));
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const nextGoal = await upsertMonthlyGoal({
        client: supabase,
        accountId: selectedAccountId,
        month: monthKey,
        targetAmountBaseMinor: parsed,
        createdBy: user.id,
      });
      setGoal(nextGoal);
      setIsSheetOpen(false);
    } catch (err: any) {
      console.error("[GoalScreen] Save error:", err);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        err?.message ?? t(dictionary, "errors.internalServer")
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  if (loading) {
    return (
      <View style={[styles.loading, { paddingTop: tokens.spacing.lg }]}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { paddingTop: tokens.spacing.lg }]}>
        <Text style={styles.errorTitle}>{t(dictionary, "common.errorTitle")}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>{t(dictionary, "common.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: tokens.spacing.lg, paddingBottom: 120 + insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t(dictionary, "goal.pageTitle")}</Text>
          <Text style={styles.subtitle}>{monthLabel}</Text>
        </View>

        {goal ? (
          <Card>
            <View style={styles.cardSection}>
              <Text style={styles.heroLabel}>{t(dictionary, "goal.heroTitle")}</Text>
              <Text style={styles.heroValue}>
                {t(dictionary, "goal.heroTarget", { amount: formattedTarget })}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: progressWidth, backgroundColor: progressColor },
                ]}
              />
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t(dictionary, "goal.progressLabel")}</Text>
                <Text style={styles.metricValue}>
                  {formattedSaved} / {formattedTarget}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t(dictionary, "goal.remainingTitle")}</Text>
                <Text
                  style={
                    progress?.remainingMinor === 0n
                      ? [styles.metricValue, { color: colors.state.positive }]
                      : styles.metricValue
                  }
                >
                  {progress?.remainingMinor === 0n
                    ? t(dictionary, "goal.remainingComplete")
                    : t(dictionary, "goal.remainingLabel", { amount: formattedRemaining })}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t(dictionary, "goal.rateTitle")}</Text>
                <Text style={styles.metricValue}>
                  {t(dictionary, "goal.rateLabel", { amount: formattedRate })}
                </Text>
              </View>
            </View>

            {!hasTransactions && (
              <Text style={styles.helperText}>{t(dictionary, "goal.noTransactions")}</Text>
            )}

            <View style={styles.cardActions}>
              <Button
                title={t(dictionary, "goal.editCta")}
                onPress={handleOpenEditor}
                disabled={!canEdit}
                variant="secondary"
              />
            </View>
          </Card>
        ) : (
          <Card>
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t(dictionary, "goal.emptyTitle")}</Text>
              <Text style={styles.emptyDescription}>{t(dictionary, "goal.emptyDescription")}</Text>
              <Button
                title={t(dictionary, "goal.createCta")}
                onPress={handleOpenEditor}
                disabled={!canEdit}
                variant="secondary"
              />
            </View>
          </Card>
        )}

        {goal && hasTransactions && insights.length > 0 && (
          <Card>
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>{t(dictionary, "goal.insightsTitle")}</Text>
              <InsightsCarousel insights={insights} />
            </View>
          </Card>
        )}
      </ScrollView>

      <GoalSheet
        visible={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={t(dictionary, "goal.editorTitle")}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetDescription}>{t(dictionary, "goal.editorDescription")}</Text>
          <Input
            label={t(dictionary, "goal.amountLabel")}
            value={amountInput}
            onChangeText={(value) => setAmountInput(sanitizeNumericInput(value))}
            placeholder={t(dictionary, "goal.amountPlaceholder")}
            keyboardType="numeric"
            error={formError ?? undefined}
          />
          <View style={styles.sheetActions}>
            <Button
              title={t(dictionary, "common.cancel")}
              onPress={() => setIsSheetOpen(false)}
              variant="secondary"
              disabled={isSaving}
            />
            <Button
              title={isSaving ? t(dictionary, "goal.savingCta") : t(dictionary, "goal.saveCta")}
              onPress={handleSave}
              loading={isSaving}
              disabled={isSaving || !canEdit}
            />
          </View>
        </View>
      </GoalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  header: {
    gap: tokens.spacing.xs,
  },
  title: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    color: colors.text.secondary,
  },
  cardSection: {
    gap: tokens.spacing.sm,
  },
  heroLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
  },
  heroValue: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: tokens.radii.pill,
    backgroundColor: colors.state.neutral,
    overflow: "hidden",
    marginTop: tokens.spacing.md,
  },
  progressFill: {
    height: "100%",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.lg,
    marginTop: tokens.spacing.lg,
  },
  metricItem: {
    minWidth: 120,
    gap: tokens.spacing.xs,
  },
  metricLabel: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
  },
  metricValue: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  helperText: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  cardActions: {
    marginTop: tokens.spacing.lg,
  },
  emptyState: {
    gap: tokens.spacing.sm,
  },
  emptyTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  emptyDescription: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheetContainer: {
    backgroundColor: colors.bg.surface,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    gap: tokens.spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 4,
    borderRadius: tokens.radii.pill,
    backgroundColor: colors.state.neutral,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  sheetContent: {
    gap: tokens.spacing.lg,
  },
  sheetDescription: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  sheetActions: {
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  errorTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  retryButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
});
