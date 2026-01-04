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
import { CategoryIcon } from "../../src/components/CategoryIcon";
import {
  buildHomeViewModel,
  CURRENCIES,
  formatMoneyWithSymbol,
  getIconById,
  getMonthRange,
  themeTokens,
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
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [updatingObligationId, setUpdatingObligationId] = useState<string | null>(
    null
  );

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
      const upcomingEnd = new Date();
      upcomingEnd.setDate(upcomingEnd.getDate() + 7);
      const obligationsEnd =
        upcomingEnd > monthRange.end ? upcomingEnd : monthRange.end;
      const obligationsEndDate = obligationsEnd.toISOString().slice(0, 10);

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
    router.replace("/(auth)/onboarding");
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

  const viewModel = buildHomeViewModel({
    account: mainAccount,
    role: activeRole,
    dictionary,
    obligations,
    monthlyTransactions,
    recentTransactions,
    month: new Date(),
    nextDays: 7,
    recentLimit: 6,
  });

  const upcomingItems = viewModel.upcoming.items.slice(0, 5);

  const handleToggleObligationStatus = async (item: {
    id: string;
    status?: "pending" | "paid";
  }) => {
    if (!viewModel.permissions.canEdit) return;
    const nextStatus = item.status === "paid" ? "pending" : "paid";
    const paidAt =
      nextStatus === "paid" ? new Date().toISOString().slice(0, 10) : null;

    setUpdatingObligationId(item.id);
    try {
      const { error: updateError } = await supabase
        .from("obligations")
        .update({ status: nextStatus, paid_at: paidAt })
        .eq("id", item.id);

      if (updateError) throw updateError;

      setObligations((prev) =>
        prev.map((obligation) =>
          obligation.id === item.id
            ? {
                ...obligation,
                status: nextStatus,
                paid_at: paidAt,
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

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: tokens.spacing.lg + insets.top },
        ]}
      >
        {/* Header */}
        <View style={styles.headerBlock}>
          <View style={styles.header}>
            {/* Izquierda: Logo + Finnon */}
            <View style={styles.headerLeft}>
              <View style={styles.brandMark} />
              <Text style={styles.brandText}>{t(dictionary, "common.appName")}</Text>
            </View>

            {/* Centro: Cuenta (clickeable) */}
            <TouchableOpacity
              style={styles.accountChip}
              onPress={() => router.push("/(auth)/select-account")}
              accessibilityRole="button"
              accessibilityLabel={`${mainAccount.name} · ${mainAccount.base_currency}`}
            >
              <Text style={styles.accountChipText} numberOfLines={1}>
                {mainAccount.name} · {mainAccount.base_currency}
              </Text>
            </TouchableOpacity>

            {/* Derecha: Settings */}
            <TouchableOpacity
              style={styles.headerRight}
              onPress={() => router.push("/(auth)/(tabs)/settings")}
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
        
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>{t(dictionary, "mobile.home.monthTitle")}</Text>
        </View>
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>
                {viewModel.copy.committedLabel}
              </Text>
              <Text style={styles.heroMetricValue}>
                {formatMoneyWithSymbol(
                  viewModel.monthlyHero.committedMinor,
                  mainAccount.base_currency,
                  currencySymbol
                )}
              </Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>
                {viewModel.copy.pendingLabel}
              </Text>
              <Text style={styles.heroMetricValue}>
                {formatMoneyWithSymbol(
                  viewModel.monthlyHero.pendingMinor,
                  mainAccount.base_currency,
                  currencySymbol
                )}
              </Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>
                {viewModel.monthlyHero.paidLabel}
              </Text>
              <Text style={styles.heroMetricValue}>
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

        {/* Upcoming */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t(dictionary, "mobile.home.upcomingObligationsTitle")}
            </Text>
            {upcomingItems.length > 0 && (
              <TouchableOpacity onPress={() => router.push("/(auth)/transactions")}>
                <Text style={styles.sectionCta} numberOfLines={1}>
                  {viewModel.copy.upcomingCta}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {upcomingItems.length === 0 ? (
            <Text style={styles.emptyText}>{viewModel.emptyStates.upcoming}</Text>
          ) : (
            <View style={styles.list}>
              {upcomingItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.listRow,
                    !viewModel.permissions.canEdit && styles.listRowDisabled,
                  ]}
                  onPress={() => router.push(`/(auth)/obligations/${item.id}`)}
                  disabled={!viewModel.permissions.canEdit}
                >
                  <View style={styles.listRowInfo}>
                    <Text style={styles.listRowTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.listRowMetaRow}>
                      <Text style={styles.listRowMeta}>
                        {formatDateShort(item.dueDate, locale)}
                      </Text>
                      <View
                        style={[
                          styles.statusChip,
                          item.status === "paid"
                            ? styles.statusChipPaid
                            : styles.statusChipPending,
                        ]}
                      >
                        <Text style={styles.statusChipText}>
                          {item.status === "paid"
                            ? t(dictionary, "obligations.create.statusPaid")
                            : t(dictionary, "obligations.create.statusPending")}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.listRowActions}>
                    <Text style={styles.listRowAmount}>
                      {formatMoneyWithSymbol(
                        item.amountMinor,
                        mainAccount.base_currency,
                        currencySymbol
                      )}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.obligationAction,
                        item.status === "paid"
                          ? styles.obligationActionSecondary
                          : styles.obligationActionPrimary,
                        (updatingObligationId === item.id ||
                          !viewModel.permissions.canEdit) &&
                          styles.obligationActionDisabled,
                      ]}
                      onPress={() => handleToggleObligationStatus(item)}
                      disabled={
                        updatingObligationId === item.id ||
                        !viewModel.permissions.canEdit
                      }
                    >
                      <Text
                        style={[
                          styles.obligationActionText,
                          item.status === "paid" &&
                            styles.obligationActionTextSecondary,
                        ]}
                      >
                        {item.status === "paid"
                          ? t(dictionary, "mobile.home.markPending")
                          : t(dictionary, "mobile.home.markPaid")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Actividad reciente</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/transactions")}>
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
          <TouchableOpacity
            style={[
              styles.sheetAction,
              !viewModel.permissions.canEdit && styles.sheetActionDisabled,
            ]}
            disabled={!viewModel.permissions.canEdit}
            onPress={() => {
              setIsAddSheetOpen(false);
              router.push("/(auth)/transactions/create?type=expense");
            }}
          >
            <View style={styles.sheetActionRow}>
              <View style={styles.sheetActionIcon} />
              <View style={styles.sheetActionContent}>
                <Text style={styles.sheetActionTitle}>
                  {t(dictionary, "mobile.home.addExpenseTitle")}
                </Text>
                <Text style={styles.sheetActionMeta}>
                  {t(dictionary, "mobile.home.addExpenseDescription")}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sheetAction,
              !viewModel.permissions.canEdit && styles.sheetActionDisabled,
            ]}
            disabled={!viewModel.permissions.canEdit}
            onPress={() => {
              setIsAddSheetOpen(false);
              router.push("/(auth)/transactions/create?type=income");
            }}
          >
            <View style={styles.sheetActionRow}>
              <View style={styles.sheetActionIcon} />
              <View style={styles.sheetActionContent}>
                <Text style={styles.sheetActionTitle}>
                  {t(dictionary, "mobile.home.addIncomeTitle")}
                </Text>
                <Text style={styles.sheetActionMeta}>
                  {t(dictionary, "mobile.home.addIncomeDescription")}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sheetAction,
              !viewModel.permissions.canEdit && styles.sheetActionDisabled,
            ]}
            disabled={!viewModel.permissions.canEdit}
            onPress={() => {
              setIsAddSheetOpen(false);
              router.push("/(auth)/categories");
            }}
          >
            <View style={styles.sheetActionRow}>
              <View style={styles.sheetActionIcon}>
                <CategoryIcon
                  iconId="default"
                  size={20}
                  tone="muted"
                  accessibilityLabel={t(dictionary, "categories.title")}
                />
              </View>
              <View style={styles.sheetActionContent}>
                <Text style={styles.sheetActionTitle}>
                  {t(dictionary, "mobile.home.addCategoryTitle")}
                </Text>
                <Text style={styles.sheetActionMeta}>
                  {t(dictionary, "mobile.home.addCategoryDescription")}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sheetAction,
              !viewModel.permissions.canEdit && styles.sheetActionDisabled,
            ]}
            disabled={!viewModel.permissions.canEdit}
            onPress={() => {
              setIsAddSheetOpen(false);
              router.push("/(auth)/obligations/create");
            }}
          >
            <View style={styles.sheetActionRow}>
              <View style={styles.sheetActionIcon} />
              <View style={styles.sheetActionContent}>
                <Text style={styles.sheetActionTitle}>
                  {t(dictionary, "mobile.home.addObligationTitle")}
                </Text>
                <Text style={styles.sheetActionMeta}>
                  {t(dictionary, "mobile.home.addObligationDescription")}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sheetAction,
              !viewModel.permissions.canEdit && styles.sheetActionDisabled,
            ]}
            disabled={!viewModel.permissions.canEdit}
            onPress={() => {
              setIsAddSheetOpen(false);
              router.push("/(auth)/transactions/create?type=expense&kind=recurring");
            }}
          >
            <View style={styles.sheetActionRow}>
              <View style={styles.sheetActionIcon} />
              <View style={styles.sheetActionContent}>
                <Text style={styles.sheetActionTitle}>
                  {t(dictionary, "mobile.home.addRecurringTitle")}
                </Text>
                <Text style={styles.sheetActionMeta}>
                  {t(dictionary, "mobile.home.addRecurringDescription")}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
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
  scroll: {
    padding: tokens.spacing.lg,
    paddingBottom: 120,
    gap: tokens.spacing.lg,
  },
  headerBlock: {
    gap: tokens.spacing.sm,
  },
  brandMark: {
    width: tokens.spacing.lg,
    height: tokens.spacing.lg,
    borderRadius: tokens.radii.sm,
    backgroundColor: colors.text.primary,
  },
  brandText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    textTransform: "capitalize",
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
    flex: 1,
    alignItems: "flex-end",
  },
  accountChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
    maxWidth: "50%",
  },
  accountChipText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: "600",
    color: colors.text.primary,
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
    fontSize: tokens.typography.size.xs,
    fontWeight: "600",
    color: colors.text.primary,
  },
  profileButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: "600",
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
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTitle: {
    fontSize: tokens.typography.size.xl,
    fontWeight: "700",
    color: colors.text.primary,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
  },
  heroMetric: {
    flex: 1,
    gap: 4,
  },
  heroMetricLabel: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  heroMetricValue: {
    fontSize: tokens.typography.size.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  nextObligationRow: {
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    paddingTop: tokens.spacing.md,
    gap: 4,
  },
  nextObligationLabel: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  nextObligationValue: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.primary,
    fontWeight: "600",
  },
  heroEmptyRow: {
    gap: 6,
  },
  heroActivityEmpty: {
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    paddingTop: tokens.spacing.md,
    gap: 6,
  },
  heroEmptyText: {
    fontSize: tokens.typography.size.sm,
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
    fontSize: tokens.typography.size.sm,
    fontWeight: "600",
    color: colors.action.primary,
  },
  readOnlyRow: {
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    paddingTop: tokens.spacing.md,
    gap: 6,
  },
  readOnlyText: {
    fontSize: tokens.typography.size.sm,
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
    fontSize: tokens.typography.size.sm,
    fontWeight: "600",
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
    fontSize: tokens.typography.size.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  sectionCta: {
    fontSize: tokens.typography.size.sm,
    color: colors.action.primary,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: tokens.typography.size.sm,
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
  listRowDisabled: {
    opacity: 0.6,
  },
  listRowInfo: {
    flex: 1,
    gap: 4,
  },
  listRowMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
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
    fontSize: tokens.typography.size.sm,
    fontWeight: "600",
    color: colors.text.primary,
    flexShrink: 1,
  },
  listRowMeta: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  statusChip: {
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: tokens.radii.pill,
  },
  statusChipPending: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  statusChipPaid: {
    backgroundColor: colors.action.secondary,
  },
  statusChipText: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.primary,
    fontWeight: "600",
  },
  listRowActions: {
    alignItems: "flex-end",
    gap: tokens.spacing.xs,
  },
  listRowAmount: {
    fontSize: tokens.typography.size.sm,
    fontWeight: "700",
    color: colors.text.primary,
  },
  obligationAction: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    borderRadius: tokens.radii.pill,
  },
  obligationActionPrimary: {
    backgroundColor: colors.action.primary,
  },
  obligationActionSecondary: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  obligationActionDisabled: {
    opacity: 0.6,
  },
  obligationActionText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: "600",
    color: colors.bg.primary,
  },
  obligationActionTextSecondary: {
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
    fontSize: tokens.typography.size.sm,
    fontWeight: "700",
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
    fontSize: tokens.typography.size.lg,
    fontWeight: "700",
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
    fontSize: tokens.typography.size.sm,
    fontWeight: "700",
    color: colors.text.primary,
  },
  sheetRowMeta: {
    fontSize: tokens.typography.size.xs,
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
    fontSize: tokens.typography.size.xs,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  sheetBadgeTextActive: {
    color: colors.bg.primary,
  },
  sheetNotice: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  sheetActions: {
    gap: tokens.spacing.sm,
  },
  sheetAction: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    backgroundColor: colors.bg.secondary,
  },
  sheetActionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.md,
  },
  sheetActionIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  sheetActionContent: {
    flex: 1,
    gap: 4,
  },
  sheetActionDisabled: {
    opacity: 0.6,
  },
  sheetActionTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: "700",
    color: colors.text.primary,
  },
  sheetActionMeta: {
    fontSize: tokens.typography.size.xs,
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
    fontSize: tokens.typography.size.lg,
    fontWeight: "700",
    color: colors.state.negative,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
});
