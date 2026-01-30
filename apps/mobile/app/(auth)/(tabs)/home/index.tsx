import { useEffect, useMemo, useRef, useState } from "react";
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
  Dimensions,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { Button } from "../../../../src/components/Button";
import { AddActionSheet } from "../../../../src/components/AddActionSheet";
import { AddTransactionModal } from "../../../../src/components/add-transaction";
import { CashFlowArrows } from "../../../../src/components/home/CashFlowArrows";
import { WeekStrip } from "../../../../src/components/home/WeekStrip";
import { MonthViewModal } from "../../../../src/components/home/MonthViewModal";
import { DayDetailPanel } from "../../../../src/components/home/DayDetailPanel";
import { CategoryIcon } from "../../../../src/components/CategoryIcon";
import {
  buildHomeViewModel,
  CURRENCIES,
  createTypographyStyles,
  formatMoneyWithSymbol,
  getExpandedMonthRange,
  getWeekInfo,
  getSummaryForDay,
  markObligationPaid,
  themeTokens,
  withAlpha,
  isFutureDay,
  isExpired,
  type AddActionKey,
  type UserRole,
  type Obligation,
  type CategoryIconKey,
} from "@poleursus/shared";
import { useCopy, t } from "../../../../src/lib/i18n";

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

type SummaryValueWithPendingChipProps = {
  value: string;
  pendingMinor: bigint;
  pendingText: string;
  triggerLabel: string;
  valueStyle?: StyleProp<TextStyle>;
  pendingToneColor?: string;
  align?: "apart" | "compact";
};

function SummaryValueWithPendingChip({
  value,
  pendingMinor,
  pendingText,
  triggerLabel,
  valueStyle,
  pendingToneColor,
  align = "apart",
}: SummaryValueWithPendingChipProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<View>(null);
  const hasPending = pendingMinor > 0n;

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (!triggerRef.current) {
      setOpen(true);
      return;
    }
    triggerRef.current.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const windowWidth = Dimensions.get("window").width;
  const chipWidth = Math.min(240, windowWidth - tokens.spacing.lg * 2);
  const leftOffset = anchor
    ? Math.min(
        Math.max(tokens.spacing.lg, anchor.x + anchor.width - chipWidth),
        windowWidth - chipWidth - tokens.spacing.lg
      )
    : tokens.spacing.lg;
  const topOffset = anchor
    ? anchor.y + anchor.height + tokens.spacing.xs
    : tokens.spacing.lg;

  const pendingTextColor = pendingToneColor
    ? withAlpha(pendingToneColor, 0.65)
    : colors.text.secondary;

  return (
    <View
      style={[
        styles.summaryValueRow,
        align === "compact" && styles.summaryValueRowCompact,
      ]}
    >
      <Text style={[styles.summaryValue, valueStyle]}>{value}</Text>
      {hasPending ? (
        <>
          <Pressable
            ref={triggerRef}
            onPress={handleToggle}
            accessibilityRole="button"
            accessibilityLabel={triggerLabel}
            accessibilityState={{ expanded: open }}
            style={styles.pendingTriggerButton}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={16}
              color={colors.text.muted}
            />
          </Pressable>
          <Modal
            transparent
            visible={open}
            animationType="fade"
            onRequestClose={() => setOpen(false)}
          >
            <Pressable style={styles.pendingOverlay} onPress={() => setOpen(false)}>
              <Pressable
                style={[
                  styles.pendingChip,
                  { top: topOffset, left: leftOffset, width: chipWidth },
                ]}
                onPress={() => {}}
              >
                <Text style={[styles.pendingChipText, { color: pendingTextColor }]}>
                  {pendingText}
                </Text>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, session, selectedAccountId, setSelectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const isFocused = useIsFocused();

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
  const [updatingObligationId, setUpdatingObligationId] = useState<string | null>(
    null
  );
  const [inviteCount, setInviteCount] = useState(0);
  const [nextDays, setNextDays] = useState<number>(CASHFLOW_DAYS_OPTIONS[0]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false);
  const [isDayPanelOpen, setIsDayPanelOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [weekReference, setWeekReference] = useState<Date>(new Date());
  const [transactionDefaultDate, setTransactionDefaultDate] = useState<
    string | null
  >(null);

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
      if (!session || !user || !isFocused) {
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
  }, [session?.user?.id, user?.id, isFocused]);

  useEffect(() => {
    let cancelled = false;

    async function loadInviteCount() {
      if (!user || !isFocused) return;

      const normalizedEmail = user.email?.trim().toLowerCase();
      const filters = [];

      if (normalizedEmail) {
        filters.push(
          `invited_email.ilike.${normalizedEmail}`,
          `invitee_email.ilike.${normalizedEmail}`
        );
      }

      if (user.id) {
        filters.push(`invitee_user_id.eq.${user.id}`);
      }

      if (filters.length === 0) {
        if (!cancelled) setInviteCount(0);
        return;
      }

      const { data, error } = await supabase
        .from("invites")
        .select("id, expires_at, status, invited_email, invitee_email, invitee_user_id")
        .or(filters.join(","))
        .eq("status", "pending");

      if (error) {
        if (!cancelled) setInviteCount(0);
        return;
      }

      const count = (data ?? []).filter((invite) => !isExpired(invite.expires_at))
        .length;
      if (!cancelled) setInviteCount(count);
    }

    void loadInviteCount();

    return () => {
      cancelled = true;
    };
  }, [isFocused, user?.email, user?.id]);

  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0]?.id ?? null);
    }
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  useEffect(() => {
    if (loadingAccounts || loadingTransactions) return;
    if (accounts && accounts.length === 0) {
      router.replace("/(auth)/select-account");
    }
  }, [accounts, loadingAccounts, loadingTransactions, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      if (!mainAccount || !isFocused) return;

      setLoadingTransactions(true);
      setError(null);

      // Use expanded range to include adjacent month days for calendar grid continuity
      const expandedRange = getExpandedMonthRange(viewMonth);
      const startDate = expandedRange.start.toISOString().slice(0, 10);
      const endDate = expandedRange.end.toISOString().slice(0, 10);
      const today = new Date();
      const maxUpcomingDays = Math.max(...CASHFLOW_DAYS_OPTIONS);
      const upcomingEnd = new Date(today);
      upcomingEnd.setDate(upcomingEnd.getDate() + maxUpcomingDays);
      const obligationsEnd =
        upcomingEnd > expandedRange.end ? upcomingEnd : expandedRange.end;
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
  }, [mainAccount?.id, isFocused, viewMonth]);

  const calendarTransactions = useMemo(() => {
    const map = new Map<string, Transaction>();
    [...monthlyTransactions, ...upcomingTransactions].forEach((item) => {
      map.set(item.id, item);
    });
    return Array.from(map.values());
  }, [monthlyTransactions, upcomingTransactions]);

  const daySummary = useMemo(() => {
    if (!selectedDay || !mainAccount) return null;
    return getSummaryForDay(
      selectedDay,
      obligations,
      calendarTransactions,
      mainAccount.base_currency,
      t(dictionary, "home.recentFallbackTitle")
    );
  }, [
    selectedDay,
    obligations,
    calendarTransactions,
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
  const calendarEventRange = getExpandedMonthRange(viewMonth);
  const viewModel = buildHomeViewModel({
    account: mainAccount,
    role: activeRole,
    dictionary,
    obligations,
    monthlyTransactions,
    upcomingTransactions,
    recentTransactions,
    month: viewMonth,
    nextDays,
    recentLimit: 6,
    upcomingEventsLimit: 3,
    locale,
    now: today,
    calendarEventRange,
    weekReference,
    weekTransactions: calendarTransactions,
    weekObligations: obligations,
  });
  const weekInfo = getWeekInfo(weekReference, locale);
  const weekLabel = `${weekInfo.weekNumber} · ${weekInfo.monthLabel}`;
  const cashflowNetMinor =
    viewModel.cashflow.incomeMinor - viewModel.cashflow.expenseMinor;
  const formatSignedBalance = (amountMinor: bigint) => {
    const absoluteMinor = amountMinor < 0n ? -amountMinor : amountMinor;
    const sign = amountMinor < 0n ? "-" : "";
    return `${sign}${formatMoneyWithSymbol(
      absoluteMinor,
      mainAccount.base_currency,
      currencySymbol
    )}`;
  };
  const balancePendingText = t(dictionary, "home.pendingChipLabel", {
    amount: formatSignedBalance(-viewModel.monthOverview.expensePendingMinor),
  });
  const monthNetMinor = viewModel.monthOverview.balanceEomMinor;
  const monthNetFormatted = formatSignedBalance(monthNetMinor);
  const pendingTotalMinor =
    viewModel.monthOverview.incomePendingMinor +
    viewModel.monthOverview.expensePendingMinor;
  const pendingTotalText = t(dictionary, "home.includesPending", {
    amount: formatMoneyWithSymbol(
      pendingTotalMinor,
      mainAccount.base_currency,
      currencySymbol
    ),
  });

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

  const shiftWeek = (delta: number) => {
    setWeekReference((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
    setSelectedDay(null);
    setIsDayPanelOpen(false);
  };

  const handleAddAction = (key: AddActionKey) => {
    switch (key) {
      case "movement":
        setTransactionDefaultDate(null);
        setIsTransactionModalOpen(true);
        return;
      case "recurring":
        router.push(
          "/(auth)/(tabs)/transactions/create?type=expense&kind=recurring"
        );
        return;
    }
  };

  const handleTransactionSuccess = () => {
    // Reload transactions after successful creation
    setIsTransactionModalOpen(false);
    setTransactionDefaultDate(null);
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {viewModel.permissions.isGuestReadOnly && (
          <View style={styles.readOnlyBadgeRow}>
            <View style={styles.readOnlyBadge}>
              <Text style={styles.readOnlyBadgeText}>
                {viewModel.copy.guestBadge}
              </Text>
            </View>
          </View>
        )}
        {inviteCount > 0 && (
          <TouchableOpacity
            style={styles.inviteCard}
            onPress={() => router.push("/(auth)/invitations")}
          >
            <Text style={styles.inviteTitle}>
              {t(dictionary, "invitations.pendingBadge")}
            </Text>
            <Text style={styles.inviteSubtitle}>
              {t(dictionary, "invitations.viewCta")} ({inviteCount})
            </Text>
          </TouchableOpacity>
        )}
        {/* Hero */}
        <View style={styles.heroCard}>
          {/* 1. Resumen del mes */}
          <View style={[styles.heroSection, styles.heroSectionFirst]}>
            <Text style={styles.sectionTitle}>
              {viewModel.copy.monthSummaryTitle}
            </Text>
            <View style={styles.monthNetRow}>
              <Text style={styles.monthNetValue}>{monthNetFormatted}</Text>
              {pendingTotalMinor > 0n && (
                <View style={styles.pendingChipInline}>
                  <Text style={styles.pendingChipInlineText}>{pendingTotalText}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 3. Income - Expenses */}
          <View style={styles.heroSection}>
            <View style={styles.monthBreakdown}>
              <View style={styles.monthBreakdownCard}>
                <Text style={styles.summaryCardTitle}>
                  {viewModel.copy.incomeLabel}
                </Text>
                <SummaryValueWithPendingChip
                  value={formatMoneyWithSymbol(
                    viewModel.monthOverview.incomeRealMinor,
                    mainAccount.base_currency,
                    currencySymbol
                  )}
                  pendingMinor={viewModel.monthOverview.incomePendingMinor}
                  pendingText={t(dictionary, "home.pendingChipLabel", {
                    amount: formatMoneyWithSymbol(
                      viewModel.monthOverview.incomePendingMinor,
                      mainAccount.base_currency,
                      currencySymbol
                    ),
                  })}
                  triggerLabel={t(dictionary, "home.pendingTriggerLabel")}
                  valueStyle={styles.amountPositive}
                  pendingToneColor={colors.state.positive}
                />
              </View>

              <View style={styles.monthBreakdownCard}>
                <Text style={styles.summaryCardTitle}>
                  {viewModel.copy.expenseLabel}
                </Text>
                <SummaryValueWithPendingChip
                  value={formatMoneyWithSymbol(
                    viewModel.monthOverview.expenseRealMinor,
                    mainAccount.base_currency,
                    currencySymbol
                  )}
                  pendingMinor={viewModel.monthOverview.expensePendingMinor}
                  pendingText={t(dictionary, "home.pendingChipLabel", {
                    amount: formatMoneyWithSymbol(
                      viewModel.monthOverview.expensePendingMinor,
                      mainAccount.base_currency,
                      currencySymbol
                    ),
                  })}
                  triggerLabel={t(dictionary, "home.pendingTriggerLabel")}
                  valueStyle={styles.amountNegative}
                  pendingToneColor={colors.state.negative}
                />
              </View>
            </View>

            {!viewModel.monthOverview.hasActivity && (
              <View style={styles.heroActivityEmpty}>
                <Text style={styles.heroEmptyText}>
                  {viewModel.emptyStates.activity.title}
                </Text>
                <TouchableOpacity
                  style={styles.heroEmptyCta}
                  onPress={() => setIsTransactionModalOpen(true)}
                >
                  <Text style={styles.heroEmptyCtaText}>
                    {viewModel.emptyStates.activity.cta}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 4. Balance */}
          <View style={styles.heroSection}>
            <Text style={styles.sectionTitle}>{viewModel.copy.balanceLabel}</Text>
            <View style={styles.balanceCard}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>
                  {viewModel.copy.balanceTodayLabel}
                </Text>
                <SummaryValueWithPendingChip
                  value={formatSignedBalance(viewModel.monthOverview.balanceTodayMinor)}
                  pendingMinor={viewModel.monthOverview.expensePendingMinor}
                  pendingText={balancePendingText}
                  triggerLabel={t(dictionary, "home.pendingTriggerLabel")}
                  valueStyle={styles.balanceValue}
                  pendingToneColor={colors.state.negative}
                  align="compact"
                />
              </View>
            </View>
          </View>

          {/* 4. Próximos X días (Cashflow) */}
          <View style={styles.heroSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{viewModel.copy.upcomingTitle}</Text>
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
              <>
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
                <View style={styles.upcomingEventsList}>
                  {viewModel.cashflow.items.slice(0, 10).map((item) => {
                    const dayLabel = item.date.toLocaleDateString(locale, {
                      weekday: "short",
                    });
                    return (
                      <View key={item.id} style={styles.upcomingEventRow}>
                        <Text style={styles.upcomingEventLabel}>
                          {dayLabel}: {item.title}
                        </Text>
                        <Text
                          style={[
                            styles.upcomingEventAmount,
                            item.type === "income"
                              ? styles.amountPositive
                              : styles.amountNegative,
                          ]}
                        >
                          {item.type === "expense" ? "-" : "+"}
                          {formatMoneyWithSymbol(
                            item.amountMinor,
                            mainAccount.base_currency,
                            currencySymbol
                          )}
                        </Text>
                      </View>
                    );
                  })}
                  {viewModel.cashflow.items.length > 10 && (
                    <Text style={styles.upcomingMoreText}>
                      {t(dictionary, "home.upcomingMoreMessage")}
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>

          {/* 5. Semana */}
          <View style={styles.heroSection}>
            <WeekStrip
              days={viewModel.weekStrip.days}
              locale={locale}
              selectedDate={selectedDay}
              onSelectDate={handleSelectDay}
              onViewMonth={() => setIsMonthViewOpen(true)}
              onPrevWeek={() => shiftWeek(-7)}
              onNextWeek={() => shiftWeek(7)}
              weekTitle={viewModel.copy.weekTitle}
              weekLabel={weekLabel}
              viewMonthCta={viewModel.copy.viewMonthCta}
              dotsLegend={viewModel.copy.dotsLegend}
            />
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
                const isPending = isFutureDay(item.date);
                const baseColor =
                  item.type === "income" ? colors.state.positive : colors.state.negative;
                const amountColor = isPending ? withAlpha(baseColor, 0.55) : baseColor;
                return (
                  <View key={item.id} style={styles.listRow}>
                    <View style={styles.listRowInfo}>
                      <View style={styles.listRowTitleRow}>
                        <View
                          style={[
                            styles.listRowIconContainer,
                            isPending && styles.pendingOpacity,
                          ]}
                        >
                          <CategoryIcon
                            iconKey={item.iconId as CategoryIconKey}
                            size={16}
                            tone={item.type === "income" ? "positive" : "negative"}
                          />
                        </View>
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
                        item.type === "income" ? styles.amountPositive : styles.amountNegative,
                        { color: amountColor },
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
        onAddForDay={(date) => {
          setIsDayPanelOpen(false);
          setTransactionDefaultDate(date.toISOString().slice(0, 10));
          setIsTransactionModalOpen(true);
        }}
        onViewMonth={() => {
          setIsDayPanelOpen(false);
          setIsMonthViewOpen(true);
        }}
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
          addForDayCta: viewModel.copy.addForDayCta,
          viewMonthCta: viewModel.copy.viewMonthCta,
        }}
      />

      {/* Add Action */}
      <AddActionSheet
        sheetTitle={t(dictionary, "mobile.home.addTitle")}
        fabLabel={viewModel.copy.addCta}
        onAction={handleAddAction}
        disabled={!viewModel.permissions.canEdit}
        notice={
          viewModel.permissions.isGuestReadOnly ? (
            <Text style={styles.sheetNotice}>{viewModel.copy.guestBlurb}</Text>
          ) : undefined
        }
      />

      {/* Transaction Modal */}
      {mainAccount && (
        <AddTransactionModal
          visible={isTransactionModalOpen}
          accountId={mainAccount.id}
          currency={mainAccount.base_currency}
          defaultDate={transactionDefaultDate ?? undefined}
          onClose={() => {
            setIsTransactionModalOpen(false);
            setTransactionDefaultDate(null);
          }}
          onSuccess={handleTransactionSuccess}
        />
      )}

      {/* Month View Modal */}
      {mainAccount && (
        <MonthViewModal
          visible={isMonthViewOpen}
          onClose={() => setIsMonthViewOpen(false)}
          accountId={mainAccount.id}
          locale={locale}
          baseCurrency={mainAccount.base_currency}
          fallbackTitle={t(dictionary, "home.recentFallbackTitle")}
          obligations={obligations}
          transactions={monthlyTransactions}
          initialMonth={selectedDay ?? weekReference ?? new Date()}
          onSelectDate={(date) => {
            handleSelectDay(date);
            // Modal stays open so user can browse days without reopening
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    paddingTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: 120,
    gap: tokens.spacing.lg,
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
  heroCard: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    backgroundColor: colors.bg.surface,
  },
  inviteCard: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
    backgroundColor: colors.bg.surface,
  },
  inviteTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.xs,
  },
  inviteSubtitle: {
    ...typography.meta,
    color: colors.text.secondary,
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
  monthNetRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  monthNetValue: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight as "700",
    color: colors.text.primary,
  },
  pendingChipInline: {
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.bg.secondary,
  },
  pendingChipInlineText: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  balanceCard: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.md,
    backgroundColor: colors.bg.secondary,
    gap: tokens.spacing.sm,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  balanceLabel: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  balanceValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  monthBreakdown: {
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  monthBreakdownCard: {
    flex: 1,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.md,
    backgroundColor: colors.bg.secondary,
    gap: tokens.spacing.sm,
  },
  summaryCardTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  summaryValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  summaryValueRowCompact: {
    justifyContent: "flex-end",
  },
  summaryValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  pendingTriggerButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  pendingOverlay: {
    flex: 1,
  },
  pendingChip: {
    position: "absolute",
    backgroundColor: colors.bg.surface,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
  },
  pendingChipText: {
    ...typography.meta,
    color: colors.text.secondary,
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
  listRowIconContainer: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingOpacity: {
    opacity: 0.6,
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
  upcomingEventsList: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  upcomingEventRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  upcomingEventLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  upcomingEventAmount: {
    ...typography.caption,
    fontWeight: "500",
  },
  upcomingMoreText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  amountPositive: {
    color: colors.state.positive,
  },
  amountNegative: {
    color: colors.state.negative,
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
