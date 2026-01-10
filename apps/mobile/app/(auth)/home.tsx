import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/contexts/AuthContext";
import { Button } from "../../src/components/Button";
import { AddMenuItem } from "../../src/components/AddMenuItem";
import { FinnonMark } from "../../src/components/FinnonMark";
import { CashFlowArrows } from "../../src/components/home/CashFlowArrows";
import { MonthMap } from "../../src/components/home/MonthMap";
import { DayDetailPanel } from "../../src/components/home/DayDetailPanel";
import {
  ADD_ACTIONS,
  buildHomeViewModel,
  CURRENCIES,
  createTypographyStyles,
  formatMoneyWithSymbol,
  getIconById,
  getMonthRange,
  getSummaryForDay,
  markObligationPaid,
  themeTokens,
  type AddActionKey,
  type UserRole,
  type Obligation,
} from "@poleursus/shared";
import { useCopy, t } from "../../src/lib/i18n";

type AccountMember = {
  account_id: string;
  user_id: string;
  role: UserRole;
};

type Account = {
  id: string;
  name: string;
  base_currency: string;
  account_members?: AccountMember[];
};

type Category = {
  id: string;
  name: string;
  icon_id: string;
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

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);
const CASHFLOW_DAYS_OPTIONS = [7, 14, 30] as const;

function formatDateShort(value: Date, locale: string) {
  return value.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
}

function HomeSheet({
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
          <ScrollView contentContainerStyle={styles.sheetContent}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, session, selectedAccountId, setSelectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [monthlyTransactions, setMonthlyTransactions] = useState<Transaction[]>(
    []
  );
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [upcomingTransactions, setUpcomingTransactions] = useState<Transaction[]>(
    []
  );
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [updatingObligationId, setUpdatingObligationId] = useState<string | null>(
    null
  );
  const [nextDays, setNextDays] = useState<number>(CASHFLOW_DAYS_OPTIONS[0]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayPanelOpen, setIsDayPanelOpen] = useState(false);

  const mainAccount = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;
    if (selectedAccountId) {
      return accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
    }
    return accounts[0];
  }, [accounts, selectedAccountId]);

  const activeRole = useMemo<UserRole>(() => {
    if (!mainAccount || !user) return "viewer";
    return (
      mainAccount.account_members?.find((member) => member.user_id === user.id)
        ?.role ?? "viewer"
    );
  }, [mainAccount, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      if (!session || !user) {
        setLoadingAccounts(false);
        return;
      }

      setLoadingAccounts(true);
      setError(null);

      try {
        const { data, error: accountsError } = await supabase
          .from("accounts")
          .select("id, name, base_currency, account_members!inner(role, user_id)")
          .eq("account_members.user_id", user.id);

        if (accountsError) throw accountsError;

        const accountsList = (data as Account[]) ?? [];

        if (!cancelled) {
          setAccounts(accountsList);
        }
      } catch (e: any) {
        console.error("[Home] Error loading accounts:", e);
        if (!cancelled) {
          setError(e?.message ?? t(dictionary, "mobile.home.errorLoadAccounts"));
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    }

    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, user?.id]);

  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0]?.id ?? null);
    }
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      if (!mainAccount || !isFocused) return;

      setLoadingTransactions(true);
      setError(null);

      const monthRange = getMonthRange(new Date());
      const startDate = monthRange.start.toISOString().slice(0, 10);
      const endDate = monthRange.end.toISOString().slice(0, 10);
      const today = new Date();
      const maxUpcomingDays = Math.max(...CASHFLOW_DAYS_OPTIONS);
      const upcomingEnd = new Date(today);
      upcomingEnd.setDate(upcomingEnd.getDate() + maxUpcomingDays);
      const obligationsEnd =
        upcomingEnd > monthRange.end ? upcomingEnd : monthRange.end;
      const obligationsEndDate = obligationsEnd.toISOString().slice(0, 10);
      const upcomingStartDate = today.toISOString().slice(0, 10);
      const upcomingEndDate = upcomingEnd.toISOString().slice(0, 10);

      try {
        const { data: monthData, error: monthError } = await supabase
          .from("transactions")
          .select(
            "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at"
          )
          .eq("account_id", mainAccount.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (monthError) throw monthError;

        const { data: recentData, error: recentError } = await supabase
          .from("transactions")
          .select(
            "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)"
          )
          .eq("account_id", mainAccount.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(10);

        if (recentError) throw recentError;

        const { data: upcomingData, error: upcomingError } = await supabase
          .from("transactions")
          .select(
            "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)"
          )
          .eq("account_id", mainAccount.id)
          .gte("date", upcomingStartDate)
          .lte("date", upcomingEndDate)
          .order("date", { ascending: true });

        if (upcomingError) throw upcomingError;

        const { data: obligationsData, error: obligationsError } = await supabase
          .from("obligations")
          .select(
            "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
          )
          .eq("account_id", mainAccount.id)
          .gte("due_date", startDate)
          .lte("due_date", obligationsEndDate)
          .order("due_date", { ascending: true });

        if (obligationsError) throw obligationsError;

        if (!cancelled) {
          setMonthlyTransactions((monthData as Transaction[]) ?? []);
          setRecentTransactions((recentData as Transaction[]) ?? []);
          setUpcomingTransactions((upcomingData as Transaction[]) ?? []);
          setObligations((obligationsData as Obligation[]) ?? []);
        }
      } catch (e: any) {
        console.error("[Home] Error loading transactions:", e);
        if (!cancelled) {
          setError(e?.message ?? t(dictionary, "mobile.home.errorLoadTransactions"));
        }
      } finally {
        if (!cancelled) setLoadingTransactions(false);
      }
    }

    loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [mainAccount?.id, isFocused]);

  const daySummary = useMemo(() => {
    if (!selectedDay || !mainAccount) return null;
    return getSummaryForDay(
      selectedDay,
      obligations,
      monthlyTransactions,
      mainAccount.base_currency,
      t(dictionary, "home.recentFallbackTitle")
    );
  }, [
    selectedDay,
    obligations,
    monthlyTransactions,
    mainAccount,
    dictionary,
  ]);

  if (!session || !user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loadingAccounts || loadingTransactions) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>{t(dictionary, "common.errorTitle")}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <View style={{ height: tokens.spacing.md }} />
          <Button
            title={t(dictionary, "mobile.home.retry")}
            onPress={() => {
              setError(null);
              router.replace("/(auth)/(tabs)/home");
            }}
          />
        </View>
      </View>
    );
  }

  if (!accounts || accounts.length === 0) {
    router.replace("/(auth)/select-account");
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!mainAccount) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const currencySymbol =
    CURRENCIES.find((c) => c.code === mainAccount.base_currency)?.symbol ||
    mainAccount.base_currency;

  const today = new Date();
  const viewModel = buildHomeViewModel({
    account: mainAccount,
    role: activeRole,
    dictionary,
    obligations,
    monthlyTransactions,
    upcomingTransactions,
    recentTransactions,
    month: today,
    nextDays,
    recentLimit: 6,
    now: today,
  });
  const cashflowNetMinor =
    viewModel.cashflow.incomeMinor - viewModel.cashflow.expenseMinor;

  const handleToggleObligationStatus = async (item: {
    id: string;
    status?: "pending" | "paid";
  }) => {
    if (!viewModel.permissions.canEdit) return;
    setUpdatingObligationId(item.id);
    try {
      const update = await markObligationPaid(supabase, item.id, item.status);

      setObligations((prev) =>
        prev.map((obligation) =>
          obligation.id === item.id
            ? {
                ...obligation,
                status: update.status,
                paid_at: update.paidAt,
              }
            : obligation
        )
      );
    } catch (e: any) {
      console.error("[Home] Error updating obligation:", e);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message ?? t(dictionary, "errors.internalServer")
      );
    } finally {
      setUpdatingObligationId(null);
    }
  };

  const handleSelectDay = (date: Date) => {
    setSelectedDay(date);
    setIsDayPanelOpen(true);
  };

  const handleAddAction = (key: AddActionKey) => {
    if (!viewModel.permissions.canEdit) return;
    setIsAddSheetOpen(false);

    switch (key) {
      case "expense":
        router.push("/(auth)/(tabs)/transactions/create?type=expense");
        return;
      case "income":
        router.push("/(auth)/(tabs)/transactions/create?type=income");
        return;
      case "category":
        router.push("/(auth)/categories/create");
        return;
      case "one_off_obligation":
        router.push("/(auth)/obligations/create");
        return;
      case "recurring":
        router.push(
          "/(auth)/(tabs)/transactions/create?type=expense&kind=recurring"
        );
        return;
    }
  };

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.headerContainer,
          { paddingTop: tokens.spacing.lg + insets.top },
        ]}
      >
        {/* Header */}
        <View style={styles.headerBlock}>
          <View style={styles.header}>
            {/* Izquierda: Logo + Finnon */}
            <View style={styles.headerLeft}>
              <FinnonMark mode="iconWordmark" size="md" />
            </View>

            {/* Derecha: Settings */}
            <TouchableOpacity
              style={styles.headerRight}
              onPress={() => router.push("/(auth)/settings")}
            >
              <Text style={styles.profileButtonText}>
                {t(dictionary, "mobile.home.settingsTitle")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Badge read-only (debajo del header si aplica) */}
          {viewModel.permissions.isGuestReadOnly && (
            <View style={styles.readOnlyBadgeRow}>
              <View style={styles.readOnlyBadge}>
                <Text style={styles.readOnlyBadgeText}>
                  {viewModel.copy.guestBadge}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={[styles.heroSection, styles.heroSectionFirst]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{viewModel.copy.cashflowTitle}</Text>
              <View style={styles.daySelector}>
                {CASHFLOW_DAYS_OPTIONS.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.dayOption,
                      nextDays === days && styles.dayOptionActive,
                    ]}
                    onPress={() => setNextDays(days)}
                  >
                    <Text
                      style={[
                        styles.dayOptionText,
                        nextDays === days && styles.dayOptionTextActive,
                      ]}
                    >
                      {days}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {viewModel.cashflow.items.length === 0 ? (
              <Text style={styles.emptyText}>{viewModel.emptyStates.upcoming}</Text>
            ) : (
              <CashFlowArrows
                incomeMinor={viewModel.cashflow.incomeMinor}
                expenseMinor={viewModel.cashflow.expenseMinor}
                netMinor={cashflowNetMinor}
                currency={mainAccount.base_currency}
                currencySymbol={currencySymbol}
                incomeLabel={viewModel.copy.incomeLabel}
                expenseLabel={viewModel.copy.expenseLabel}
                balanceLabel={viewModel.copy.balanceLabel}
              />
            )}
          </View>

          <View style={styles.heroSection}>
            <View style={styles.monthHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  {t(dictionary, "mobile.home.monthTitle")}
                </Text>
                <Text style={styles.monthMeta}>
                  {today.toLocaleDateString(locale, {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>

            <MonthMap
              month={today}
              locale={locale}
              events={viewModel.calendar.events}
              highlightRange={viewModel.calendar.highlightRange}
              selectedDate={selectedDay}
              onSelectDate={handleSelectDay}
            />

            {viewModel.calendar.events.length === 0 && (
              <Text style={styles.emptyText}>{viewModel.copy.monthEmpty}</Text>
            )}

            <View style={styles.monthSummaryRow}>
              <View style={styles.monthSummaryItem}>
                <Text style={styles.summaryLabel}>
                  {viewModel.copy.committedLabel}
                </Text>
                <Text style={styles.summaryValue}>
                  {formatMoneyWithSymbol(
                    viewModel.monthlyHero.committedMinor,
                    mainAccount.base_currency,
                    currencySymbol
                  )}
                </Text>
              </View>
              <View style={styles.monthSummaryItem}>
                <Text style={styles.summaryLabel}>
                  {viewModel.copy.pendingLabel}
                </Text>
                <Text style={styles.summaryValue}>
                  {formatMoneyWithSymbol(
                    viewModel.monthlyHero.pendingMinor,
                    mainAccount.base_currency,
                    currencySymbol
                  )}
                </Text>
              </View>
              <View style={styles.monthSummaryItem}>
                <Text style={styles.summaryLabel}>
                  {viewModel.monthlyHero.paidLabel}
                </Text>
                <Text style={styles.summaryValue}>
                  {formatMoneyWithSymbol(
                    viewModel.monthlyHero.paidMinor,
                    mainAccount.base_currency,
                    currencySymbol
                  )}
                </Text>
              </View>
            </View>

            {!viewModel.monthlyHero.hasActivity && (
              <View style={styles.heroActivityEmpty}>
                <Text style={styles.heroEmptyText}>
                  {viewModel.emptyStates.activity.title}
                </Text>
                <TouchableOpacity
                  style={styles.heroEmptyCta}
                  onPress={() => setIsAddSheetOpen(true)}
                >
                  <Text style={styles.heroEmptyCtaText}>
                    {viewModel.emptyStates.activity.cta}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {viewModel.permissions.isGuestReadOnly && (
            <View style={styles.readOnlyRow}>
              <Text style={styles.readOnlyText}>{viewModel.copy.guestBlurb}</Text>
              <TouchableOpacity
                style={styles.readOnlyCta}
                onPress={() => router.push("/(auth)/onboarding")}
              >
                <Text style={styles.readOnlyCtaText}>
                  {viewModel.copy.guestCta}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{viewModel.copy.recentActivityTitle}</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/(tabs)/transactions")}>
              <Text style={styles.sectionCta} numberOfLines={1}>
                {viewModel.copy.recentCta}
              </Text>
            </TouchableOpacity>
          </View>
          {viewModel.recentActivity.items.length === 0 ? (
            <Text style={styles.emptyText}>{viewModel.emptyStates.recent}</Text>
          ) : (
            <View style={styles.list}>
              {viewModel.recentActivity.items.map((item) => {
                const icon = item.iconId ? getIconById(item.iconId) : null;
                return (
                  <View key={item.id} style={styles.listRow}>
                    <View style={styles.listRowInfo}>
                      <View style={styles.listRowTitleRow}>
                        <Text style={styles.listRowIcon}>
                          {icon?.emoji || (item.type === "income" ? "↑" : "↓")}
                        </Text>
                        <Text style={styles.listRowTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                      </View>
                      <Text style={styles.listRowMeta}>
                        {formatDateShort(item.date, locale)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.listRowAmount,
                        item.type === "income"
                          ? styles.amountPositive
                          : styles.amountNegative,
                      ]}
                    >
                      {item.type === "income" ? "+" : "-"}
                      {formatMoneyWithSymbol(
                        item.amountMinor,
                        mainAccount.base_currency,
                        currencySymbol
                      )}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <DayDetailPanel
        visible={isDayPanelOpen}
        summary={daySummary}
        locale={locale}
        currency={mainAccount.base_currency}
        currencySymbol={currencySymbol}
        canEdit={viewModel.permissions.canEdit && !updatingObligationId}
        onClose={() => {
          setIsDayPanelOpen(false);
          setSelectedDay(null);
        }}
        onToggleObligation={handleToggleObligationStatus}
        copy={{
          balanceLabel: viewModel.copy.balanceLabel,
          incomeLabel: viewModel.copy.incomeLabel,
          expenseLabel: viewModel.copy.expenseLabel,
          markPaid: viewModel.copy.markPaid,
          markPending: viewModel.copy.markPending,
          daySummaryTitle: viewModel.copy.daySummaryTitle,
          dayObligationsTitle: viewModel.copy.dayObligationsTitle,
          dayRecurringTitle: viewModel.copy.dayRecurringTitle,
          dayTransactionsTitle: viewModel.copy.dayTransactionsTitle,
          dayEmpty: viewModel.copy.dayEmpty,
          closeLabel: t(dictionary, "common.close"),
          statusPaidLabel: t(dictionary, "obligations.create.statusPaid"),
          statusPendingLabel: t(dictionary, "obligations.create.statusPending"),
        }}
      />

      {/* Add Action */}
      <TouchableOpacity
        style={[
          styles.addFab,
          !viewModel.permissions.canEdit && styles.addFabDisabled,
        ]}
        onPress={() => setIsAddSheetOpen(true)}
      >
        <Text style={styles.addFabText}>+ {viewModel.copy.addCta}</Text>
      </TouchableOpacity>

      {/* Add Sheet */}
      <HomeSheet
        visible={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        title={t(dictionary, "mobile.home.addTitle")}
      >
        {viewModel.permissions.isGuestReadOnly && (
          <Text style={styles.sheetNotice}>{viewModel.copy.guestBlurb}</Text>
        )}
        <View style={styles.sheetActions}>
          {ADD_ACTIONS.map((action) => (
            <AddMenuItem
              key={action.key}
              meta={action}
              onPress={() => handleAddAction(action.key)}
              disabled={!viewModel.permissions.canEdit}
            />
          ))}
        </View>
      </HomeSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  headerContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
    backgroundColor: colors.bg.primary,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
  },
  container: {
    flex: 1,
    padding: tokens.spacing.lg,
    backgroundColor: colors.bg.primary,
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: 120,
    gap: tokens.spacing.lg,
  },
  headerBlock: {
    gap: tokens.spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  readOnlyBadgeRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  readOnlyBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    backgroundColor: colors.action.secondary,
  },
  readOnlyBadgeText: {
    ...typography.meta,
    color: colors.text.primary,
  },
  profileButtonText: {
    ...typography.body,
    color: colors.text.primary,
  },
  heroCard: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    backgroundColor: colors.bg.surface,
  },
  heroSection: {
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    paddingTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  heroSectionFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthMeta: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  monthSummaryRow: {
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
  },
  monthSummaryItem: {
    flex: 1,
    gap: 4,
  },
  summaryLabel: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  heroActivityEmpty: {
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    paddingTop: tokens.spacing.md,
    gap: 6,
  },
  heroEmptyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  heroEmptyCta: {
    alignSelf: "flex-start",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.action.primary,
  },
  heroEmptyCtaText: {
    ...typography.body,
    color: colors.action.primary,
  },
  readOnlyRow: {
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    paddingTop: tokens.spacing.md,
    gap: 6,
  },
  readOnlyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  readOnlyCta: {
    alignSelf: "flex-start",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.pill,
    backgroundColor: colors.action.secondary,
  },
  readOnlyCtaText: {
    ...typography.body,
    color: colors.text.primary,
  },
  daySelector: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  dayOption: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
  },
  dayOptionActive: {
    backgroundColor: colors.action.secondary,
    borderColor: colors.action.primary,
  },
  dayOptionText: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  dayOptionTextActive: {
    color: colors.text.primary,
  },
  section: {
    gap: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  sectionCta: {
    ...typography.body,
    color: colors.action.primary,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  list: {
    gap: tokens.spacing.sm,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
    gap: tokens.spacing.md,
  },
  listRowInfo: {
    flex: 1,
    gap: 4,
  },
  listRowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  listRowIcon: {
    fontSize: tokens.typography.size.md,
    color: colors.text.secondary,
  },
  listRowTitle: {
    ...typography.body,
    color: colors.text.primary,
    flexShrink: 1,
  },
  listRowMeta: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  listRowAmount: {
    ...typography.body,
    color: colors.text.primary,
  },
  amountPositive: {
    color: colors.state.positive,
  },
  amountNegative: {
    color: colors.state.negative,
  },
  addFab: {
    position: "absolute",
    right: tokens.spacing.lg,
    bottom: tokens.spacing.xxl,
    backgroundColor: colors.action.primary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.pill,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  addFabDisabled: {
    backgroundColor: colors.action.disabled,
  },
  addFabText: {
    ...typography.body,
    color: colors.bg.primary,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    maxHeight: "80%",
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    paddingBottom: tokens.spacing.lg,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.state.neutral,
    marginTop: tokens.spacing.sm,
  },
  sheetHeader: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  sheetContent: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  sheetList: {
    gap: tokens.spacing.sm,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    backgroundColor: colors.bg.secondary,
  },
  sheetRowActive: {
    borderColor: colors.action.primary,
    backgroundColor: colors.action.secondary,
  },
  sheetRowInfo: {
    flex: 1,
    gap: 4,
  },
  sheetRowTitle: {
    ...typography.body,
    color: colors.text.primary,
  },
  sheetRowMeta: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  sheetBadge: {
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 4,
    backgroundColor: colors.bg.surface,
  },
  sheetBadgeActive: {
    backgroundColor: colors.action.primary,
    borderColor: colors.action.primary,
  },
  sheetBadgeText: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  sheetBadgeTextActive: {
    color: colors.bg.primary,
  },
  sheetNotice: {
    ...typography.body,
    color: colors.text.secondary,
  },
  sheetActions: {
    gap: tokens.spacing.sm,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: colors.state.negative,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.lg,
    backgroundColor: colors.bg.surface,
    gap: tokens.spacing.sm,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.state.negative,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
  },
});
