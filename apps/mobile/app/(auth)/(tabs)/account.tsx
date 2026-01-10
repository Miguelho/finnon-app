import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useNetworkNotice } from "../../../src/contexts/NetworkNoticeContext";
import { supabase } from "../../../src/lib/supabase";
import { useCopy, t } from "../../../src/lib/i18n";
import { UserAvatar } from "../../../src/components/UserAvatar";
import { CategoryIcon } from "../../../src/components/CategoryIcon";
import {
  buildAccountViewModel,
  CURRENCIES,
  formatMoneyWithSymbol,
  themeTokens,
  createTypographyStyles,
  type AccountSummaryData,
  type AccountParticipantVM,
  type AccountCategoryVM,
  type UserRole,
} from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

type AccountListItem = {
  id: string;
  name: string;
  base_currency: string;
};

export default function AccountTabScreen() {
  const router = useRouter();
  const { user, selectedAccountId, setSelectedAccountId, isInitialized } = useAuth();
  const { dictionary, locale } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();
  const insets = useSafeAreaInsets();

  const [summaryData, setSummaryData] = useState<AccountSummaryData | null>(null);
  const [userRole, setUserRole] = useState<UserRole>("viewer");
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const currencySymbol = useMemo(() => {
    const currency = summaryData?.account?.base_currency;
    return CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency ?? "";
  }, [summaryData?.account?.base_currency]);

  const viewModel = useMemo(() => {
    if (!summaryData || !user) return null;
    return buildAccountViewModel({
      data: summaryData,
      dictionary,
      currentUserId: user.id,
      role: userRole,
    });
  }, [summaryData, dictionary, user, userRole]);

  const loadData = useCallback(async () => {
    if (!selectedAccountId || !user) return;

    try {
      // Fetch account summary via RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_account_summary",
        { p_account_id: selectedAccountId }
      );

      if (rpcError) throw rpcError;
      if (!rpcData) throw new Error(t(dictionary, "account.loadError"));

      setSummaryData(rpcData as AccountSummaryData);

      // Get user's role in this account
      const participant = (rpcData as AccountSummaryData).participants.find(
        (p) => p.user_id === user.id
      );
      setUserRole((participant?.role as UserRole) ?? "viewer");

      // Fetch all accounts for switcher
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("id, name, base_currency, account_members!inner(user_id)")
        .eq("account_members.user_id", user.id);

      if (accountsError) throw accountsError;
      setAccounts(
        (accountsData ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          base_currency: a.base_currency,
        }))
      );

      setError(null);
    } catch (err: any) {
      console.error("[AccountScreen] Error:", err);
      setError(err?.message ?? t(dictionary, "account.loadError"));
      reportNetworkIssue({ onRetry: loadData });
    }
  }, [selectedAccountId, user, dictionary, reportNetworkIssue]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      await loadData();
      if (!cancelled) setLoading(false);
    }

    if (isInitialized && selectedAccountId) {
      init();
    }

    return () => {
      cancelled = true;
    };
  }, [isInitialized, selectedAccountId, loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSelectAccount = useCallback(
    async (accountId: string) => {
      setIsSwitcherOpen(false);
      if (accountId !== selectedAccountId) {
        setSelectedAccountId(accountId);
      }
    },
    [selectedAccountId, setSelectedAccountId]
  );

  const screenTitle = viewModel?.account.name ?? t(dictionary, "navigation.account");

  if (!isInitialized) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "navigation.account") }} />
        <View style={[styles.loading, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={colors.text.muted} />
        </View>
      </>
    );
  }

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "navigation.account") }} />
        <View style={[styles.loading, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={colors.text.muted} />
        </View>
      </>
    );
  }

  if (error || !viewModel) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "navigation.account") }} />
        <View style={[styles.errorContainer, { paddingTop: insets.top + tokens.spacing.lg }]}>
          <Text style={styles.errorTitle}>{t(dictionary, "account.errorTitle")}</Text>
          <Text style={styles.errorText}>{error ?? t(dictionary, "account.loadError")}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>{t(dictionary, "common.retry")}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: screenTitle }} />
      <View style={styles.root}>
        <View style={[styles.topNav, { paddingTop: insets.top + tokens.spacing.sm }]}>
          <Text style={styles.topNavTitle} numberOfLines={1}>
            {viewModel.account.name}
          </Text>
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: tokens.spacing.lg, paddingBottom: 100 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
        {/* Account Header */}
        <View style={styles.accountHeader}>
          <Text style={styles.accountName}>{viewModel.account.name}</Text>
          <Text style={styles.accountCurrency}>
            {viewModel.account.baseCurrency} · {viewModel.copy.baseCurrencySubtitle}
          </Text>
        </View>

        {/* Financial Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{viewModel.copy.balanceLabel}</Text>
            <Text style={styles.summaryValueNeutral}>
              {formatMoneyWithSymbol(
                viewModel.totals.balanceMinor,
                viewModel.account.baseCurrency,
                currencySymbol
              )}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.summaryCardHalf]}>
              <Text style={styles.summaryLabel}>{viewModel.copy.incomeLabel}</Text>
              <Text style={styles.summaryValuePositive}>
                {formatMoneyWithSymbol(
                  viewModel.totals.incomeMinor,
                  viewModel.account.baseCurrency,
                  currencySymbol
                )}
              </Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardHalf]}>
              <Text style={styles.summaryLabel}>{viewModel.copy.expenseLabel}</Text>
              <Text style={styles.summaryValueNegative}>
                {formatMoneyWithSymbol(
                  viewModel.totals.expenseMinor,
                  viewModel.account.baseCurrency,
                  currencySymbol
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* Participants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{viewModel.copy.participantsLabel}</Text>
          {viewModel.participants.length === 0 ? (
            <Text style={styles.emptyText}>{viewModel.copy.participantsEmpty}</Text>
          ) : (
            <View style={styles.participantList}>
              {viewModel.participants.map((participant) => (
                <ParticipantRow
                  key={participant.userId}
                  participant={participant}
                  isCurrentUser={participant.userId === user?.id}
                  youLabel={viewModel.copy.youLabel}
                />
              ))}
            </View>
          )}
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{viewModel.copy.categoriesTitle}</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/categories")}>
              <Text style={styles.sectionCta}>{viewModel.copy.categoriesViewAll}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionMeta}>{viewModel.copy.categoriesCount}</Text>
          {viewModel.categories.breakdown.length === 0 ? (
            <Text style={styles.emptyText}>{viewModel.copy.emptyCategories}</Text>
          ) : (
            <View style={styles.categoryList}>
              {viewModel.categories.breakdown.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  currency={viewModel.account.baseCurrency}
                  currencySymbol={currencySymbol}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Account Switcher FAB */}
      <TouchableOpacity
        style={[styles.switcherFab, { bottom: tokens.spacing.xxl + insets.bottom }]}
        onPress={() => setIsSwitcherOpen(true)}
        accessibilityLabel={viewModel.copy.switchAccount}
      >
        <Text style={styles.switcherFabText}>{viewModel.copy.switchAccount}</Text>
      </TouchableOpacity>

      {/* Account Switcher Sheet */}
      <AccountSwitcherSheet
        visible={isSwitcherOpen}
        accounts={accounts}
        activeAccountId={selectedAccountId}
        onClose={() => setIsSwitcherOpen(false)}
        onSelect={handleSelectAccount}
        copy={{
          title: viewModel.copy.switchAccount,
          activeBadge: t(dictionary, "dashboard.accountsActiveBadge"),
          createCta: viewModel.copy.createAccount,
          closeLabel: t(dictionary, "common.close"),
        }}
      />
      </View>
    </>
  );
}

// === Sub-components ===

function ParticipantRow({
  participant,
  isCurrentUser,
  youLabel,
}: {
  participant: AccountParticipantVM;
  isCurrentUser: boolean;
  youLabel: string;
}) {
  const displayName = isCurrentUser
    ? youLabel
    : participant.displayName || participant.email || `User ${participant.userId.slice(0, 6)}`;

  return (
    <View style={styles.participantRow}>
      <UserAvatar
        email={participant.email}
        userId={participant.userId}
        avatarPath={participant.avatarPath}
        fallbackText={participant.avatarFallbackText}
        fallbackBgToken={participant.avatarFallbackBgToken as any}
        size={36}
      />
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{displayName}</Text>
        {!isCurrentUser && participant.email && (
          <Text style={styles.participantMeta}>{participant.email}</Text>
        )}
      </View>
      <View style={styles.roleBadge}>
        <Text style={styles.roleBadgeText}>{participant.role}</Text>
      </View>
    </View>
  );
}

function CategoryRow({
  category,
  currency,
  currencySymbol,
}: {
  category: AccountCategoryVM;
  currency: string;
  currencySymbol: string;
}) {
  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryIcon}>
        <CategoryIcon
          iconId={category.iconId ?? "default"}
          size={20}
          tone={category.type === "income" ? "positive" : "negative"}
        />
      </View>
      <Text style={styles.categoryName} numberOfLines={1}>
        {category.name}
      </Text>
      <Text
        style={[
          styles.categoryAmount,
          category.type === "income" ? styles.amountPositive : styles.amountNegative,
        ]}
      >
        {formatMoneyWithSymbol(category.totalMinor, currency, currencySymbol)}
      </Text>
    </View>
  );
}

function AccountSwitcherSheet({
  visible,
  accounts,
  activeAccountId,
  onClose,
  onSelect,
  copy,
}: {
  visible: boolean;
  accounts: AccountListItem[];
  activeAccountId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  copy: {
    title: string;
    activeBadge: string;
    createCta: string;
    closeLabel: string;
  };
}) {
  const router = useRouter();

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
            <Text style={styles.sheetTitle}>{copy.title}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            {accounts.map((account) => {
              const isActive = account.id === activeAccountId;
              return (
                <TouchableOpacity
                  key={account.id}
                  style={[styles.accountItem, isActive && styles.accountItemActive]}
                  onPress={() => onSelect(account.id)}
                >
                  <View style={styles.accountItemInfo}>
                    <Text style={styles.accountItemName}>{account.name}</Text>
                    <Text style={styles.accountItemCurrency}>{account.base_currency}</Text>
                  </View>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>{copy.activeBadge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.createAccountButton}
              onPress={() => {
                onClose();
                router.push("/(auth)/onboarding");
              }}
            >
              <Text style={styles.createAccountButtonText}>+ {copy.createCta}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// === Styles ===

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  topNav: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
  },
  topNavTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: "center",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
    padding: tokens.spacing.lg,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: tokens.spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: tokens.spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.action.primary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.pill,
  },
  retryButtonText: {
    ...typography.body,
    color: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.xl,
  },
  accountHeader: {
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  accountName: {
    ...typography.display,
    color: colors.text.primary,
    textAlign: "center",
  },
  accountCurrency: {
    ...typography.body,
    color: colors.text.secondary,
  },
  summarySection: {
    gap: tokens.spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  summaryCardHalf: {
    flex: 1,
  },
  summaryLabel: {
    ...typography.meta,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValueNeutral: {
    ...typography.h2,
    color: colors.text.primary,
  },
  summaryValuePositive: {
    ...typography.h3,
    color: colors.state.positive,
  },
  summaryValueNegative: {
    ...typography.h3,
    color: colors.state.negative,
  },
  section: {
    gap: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  sectionCta: {
    ...typography.body,
    color: colors.action.primary,
  },
  sectionMeta: {
    ...typography.meta,
    color: colors.text.secondary,
    marginTop: -tokens.spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  participantList: {
    gap: tokens.spacing.sm,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    backgroundColor: colors.bg.surface,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    ...typography.body,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  participantMeta: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  roleBadge: {
    backgroundColor: colors.action.secondary,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
  },
  roleBadgeText: {
    ...typography.meta,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    textTransform: "capitalize",
  },
  categoryList: {
    gap: tokens.spacing.sm,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    backgroundColor: colors.bg.surface,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.sm,
    backgroundColor: colors.bg.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  categoryAmount: {
    ...typography.body,
    fontWeight: tokens.typography.weight.medium,
  },
  amountPositive: {
    color: colors.state.positive,
  },
  amountNegative: {
    color: colors.state.negative,
  },
  switcherFab: {
    position: "absolute",
    right: tokens.spacing.lg,
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
  switcherFabText: {
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
    maxHeight: "60%",
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
    gap: tokens.spacing.sm,
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
  },
  accountItemActive: {
    borderColor: colors.action.primary,
    backgroundColor: colors.action.secondary,
  },
  accountItemInfo: {
    flex: 1,
  },
  accountItemName: {
    ...typography.body,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  accountItemCurrency: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  activeBadge: {
    backgroundColor: colors.action.primary,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
  },
  activeBadgeText: {
    ...typography.meta,
    color: colors.bg.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  createAccountButton: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.state.neutral,
    alignItems: "center",
  },
  createAccountButtonText: {
    ...typography.body,
    color: colors.action.primary,
  },
});
