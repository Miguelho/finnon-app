import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import { useIsFocused } from "@react-navigation/native";
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
  isExpired,
  type AccountSummaryData,
  type AccountParticipantVM,
  type AccountCategoryVM,
  type UserRole,
  type CategoryIconKey,
} from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

type AccountListItem = {
  id: string;
  name: string;
  base_currency: string;
};

type AnchorFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function AccountTabScreen() {
  const router = useRouter();
  const { user, selectedAccountId, setSelectedAccountId, isInitialized } = useAuth();
  const { dictionary, locale } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [summaryData, setSummaryData] = useState<AccountSummaryData | null>(null);
  const [userRole, setUserRole] = useState<UserRole>("viewer");
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState<AnchorFrame | null>(null);
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(false);
  const [isMembersPanelOpen, setIsMembersPanelOpen] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);

  const infoButtonRef = useRef<View>(null);

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

  const participants = useMemo(
    () => viewModel?.participants ?? [],
    [viewModel?.participants]
  );
  const activeMember = useMemo(
    () => participants.find((participant) => participant.userId === activeMemberId) ?? null,
    [participants, activeMemberId]
  );

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

    if (isInitialized && selectedAccountId && isFocused) {
      init();
    }

    return () => {
      cancelled = true;
    };
  }, [isInitialized, selectedAccountId, isFocused, loadData]);

  useEffect(() => {
    let cancelled = false;

    async function loadInviteCount() {
      if (!user?.email || !isFocused) return;

      const { data, error } = await supabase
        .from("invites")
        .select("id, expires_at, status, invited_email, invitee_email")
        .or(`invited_email.eq.${user.email},invitee_email.eq.${user.email}`)
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
  }, [isFocused, user?.email]);

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
  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);
  const accountIdShort = summaryData?.account?.id.slice(0, 6) ?? "-";

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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: tokens.spacing.lg + insets.top, paddingBottom: 100 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
        <AccountHero
          accountName={viewModel.account.name}
          participants={participants}
          currentUserId={user?.id ?? ""}
          youLabel={viewModel.copy.youLabel}
          emptyLabel={viewModel.copy.participantsEmpty}
          maxVisible={5}
          infoButtonRef={infoButtonRef}
          onOpenInfo={() => {
            if (isInfoOpen) {
              setIsInfoOpen(false);
              return;
            }
            infoButtonRef.current?.measureInWindow((x, y, width, height) => {
              setInfoAnchor({ x, y, width, height });
              setIsInfoOpen(true);
            });
          }}
          onOpenMember={(memberId) => {
            setActiveMemberId(memberId);
            setIsMembersPanelOpen(false);
            setIsMemberPanelOpen(true);
          }}
          onOpenAllMembers={() => setIsMembersPanelOpen(true)}
          infoLabel={t(dictionary, "account.infoButtonLabel")}
        />

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
        inviteCount={inviteCount}
        onOpenInvites={() => {
          setIsSwitcherOpen(false);
          router.push("/(auth)/invitations");
        }}
        copy={{
          title: viewModel.copy.switchAccount,
          activeBadge: t(dictionary, "dashboard.accountsActiveBadge"),
          createCta: viewModel.copy.createAccount,
          closeLabel: t(dictionary, "common.close"),
          invitesLabel: t(dictionary, "invitations.title"),
          invitesDescription: t(dictionary, "invitations.subtitle"),
        }}
      />

      <AccountInfoPopover
        open={isInfoOpen}
        anchor={infoAnchor}
        onClose={() => setIsInfoOpen(false)}
        roleLabel={roleLabel}
        baseCurrency={viewModel.account.baseCurrency}
        baseCurrencyLabel={viewModel.copy.baseCurrencySubtitle}
        accountIdShort={accountIdShort}
        idLabel={t(dictionary, "account.idLabel")}
        roleTitle={t(dictionary, "account.yourRoleLabel")}
      />

      <MemberDetailSheet
        visible={isMemberPanelOpen}
        member={activeMember}
        youLabel={viewModel.copy.youLabel}
        currentUserId={user?.id ?? ""}
        roleTitle={t(dictionary, "account.roleLabel")}
        onClose={() => setIsMemberPanelOpen(false)}
        closeLabel={t(dictionary, "common.close")}
      />

      <MembersListSheet
        visible={isMembersPanelOpen}
        title={viewModel.copy.participantsLabel}
        participants={participants}
        youLabel={viewModel.copy.youLabel}
        currentUserId={user?.id ?? ""}
        onClose={() => setIsMembersPanelOpen(false)}
        onSelectMember={(memberId) => {
          setActiveMemberId(memberId);
          setIsMembersPanelOpen(false);
          setIsMemberPanelOpen(true);
        }}
        closeLabel={t(dictionary, "common.close")}
      />
      </View>
    </>
  );
}

// === Sub-components ===

function AccountHero({
  accountName,
  participants,
  currentUserId,
  youLabel,
  emptyLabel,
  maxVisible,
  infoButtonRef,
  onOpenInfo,
  onOpenMember,
  onOpenAllMembers,
  infoLabel,
}: {
  accountName: string;
  participants: AccountParticipantVM[];
  currentUserId: string;
  youLabel: string;
  emptyLabel: string;
  maxVisible: number;
  infoButtonRef: RefObject<View>;
  onOpenInfo: () => void;
  onOpenMember: (memberId: string) => void;
  onOpenAllMembers: () => void;
  infoLabel: string;
}) {
  return (
    <View style={styles.accountHero}>
      <View style={styles.accountHeroTitleRow}>
        <Text style={styles.accountName} numberOfLines={1}>
          {accountName}
        </Text>
        <View ref={infoButtonRef} collapsable={false}>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={onOpenInfo}
            accessibilityRole="button"
            accessibilityLabel={infoLabel}
          >
            <Text style={styles.infoButtonText}>i</Text>
          </TouchableOpacity>
        </View>
      </View>
      <MemberAvatarsRow
        participants={participants}
        currentUserId={currentUserId}
        youLabel={youLabel}
        emptyLabel={emptyLabel}
        maxVisible={maxVisible}
        onOpenMember={onOpenMember}
        onOpenAllMembers={onOpenAllMembers}
      />
    </View>
  );
}

function MemberAvatarsRow({
  participants,
  currentUserId,
  youLabel,
  emptyLabel,
  maxVisible,
  onOpenMember,
  onOpenAllMembers,
}: {
  participants: AccountParticipantVM[];
  currentUserId: string;
  youLabel: string;
  emptyLabel: string;
  maxVisible: number;
  onOpenMember: (memberId: string) => void;
  onOpenAllMembers: () => void;
}) {
  const { visibleMembers, overflowCount } = useMemo(() => {
    if (participants.length <= maxVisible) {
      return { visibleMembers: participants, overflowCount: 0 };
    }
    const visibleCount = Math.max(maxVisible - 1, 0);
    return {
      visibleMembers: participants.slice(0, visibleCount),
      overflowCount: participants.length - visibleCount,
    };
  }, [participants, maxVisible]);

  if (participants.length === 0) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.avatarRow}>
      {visibleMembers.map((participant) => {
        const isCurrentUser = participant.userId === currentUserId;
        const displayName = resolveParticipantName(participant, isCurrentUser, youLabel);
        return (
          <Pressable
            key={participant.userId}
            style={styles.avatarButton}
            onPress={() => onOpenMember(participant.userId)}
            accessibilityRole="button"
            accessibilityLabel={displayName}
          >
            <UserAvatar
              email={participant.email}
              userId={participant.userId}
              avatarPath={participant.avatarPath}
              fallbackText={participant.avatarFallbackText}
              fallbackBgToken={participant.avatarFallbackBgToken as any}
              size={32}
            />
          </Pressable>
        );
      })}
      {overflowCount > 0 && (
        <Pressable
          style={[styles.avatarButton, styles.avatarOverflow]}
          onPress={onOpenAllMembers}
          accessibilityRole="button"
          accessibilityLabel={`+${overflowCount}`}
        >
          <Text style={styles.avatarOverflowText}>+{overflowCount}</Text>
        </Pressable>
      )}
    </View>
  );
}

function ParticipantRow({
  participant,
  isCurrentUser,
  youLabel,
  onPress,
}: {
  participant: AccountParticipantVM;
  isCurrentUser: boolean;
  youLabel: string;
  onPress?: () => void;
}) {
  const displayName = resolveParticipantName(participant, isCurrentUser, youLabel);

  return (
    <TouchableOpacity
      style={styles.participantRow}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={displayName}
      disabled={!onPress}
    >
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
    </TouchableOpacity>
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
          iconKey={(category.iconId ?? "Tag") as CategoryIconKey}
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

function AccountInfoPopover({
  open,
  anchor,
  onClose,
  roleLabel,
  baseCurrency,
  baseCurrencyLabel,
  accountIdShort,
  idLabel,
  roleTitle,
}: {
  open: boolean;
  anchor: AnchorFrame | null;
  onClose: () => void;
  roleLabel: string;
  baseCurrency: string;
  baseCurrencyLabel: string;
  accountIdShort: string;
  idLabel: string;
  roleTitle: string;
}) {
  if (!open || !anchor) return null;

  const windowWidth = Dimensions.get("window").width;
  const popoverWidth = 240;
  const idealLeft = anchor.x + anchor.width - popoverWidth;
  const leftOffset = Math.min(
    Math.max(tokens.spacing.lg, idealLeft),
    windowWidth - popoverWidth - tokens.spacing.lg
  );
  const topOffset = anchor.y + anchor.height + tokens.spacing.xs;

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.infoOverlay} onPress={onClose}>
        <Pressable
          style={[styles.infoPopover, { top: topOffset, left: leftOffset }]}
          onPress={() => {}}
        >
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{roleTitle}</Text>
            <Text style={styles.infoValue}>{roleLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{baseCurrencyLabel}</Text>
            <Text style={styles.infoValue}>{baseCurrency}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{idLabel}</Text>
            <Text style={[styles.infoValue, styles.infoValueMono]}>
              {accountIdShort}
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MemberDetailSheet({
  visible,
  member,
  youLabel,
  currentUserId,
  roleTitle,
  closeLabel,
  onClose,
}: {
  visible: boolean;
  member: AccountParticipantVM | null;
  youLabel: string;
  currentUserId: string;
  roleTitle: string;
  closeLabel: string;
  onClose: () => void;
}) {
  if (!member) return null;

  const isCurrentUser = member.userId === currentUserId;
  const displayName = resolveParticipantName(member, isCurrentUser, youLabel);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={styles.memberSheetContainer}>
          <View style={styles.sheetHandle} />
          <View style={styles.memberSheetHeader}>
            <View style={styles.memberHeaderText}>
              <Text style={styles.sheetTitle}>{displayName}</Text>
              {member.email ? (
                <Text style={styles.memberEmail}>{member.email}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              style={styles.sheetCloseButton}
            >
              <Text style={styles.sheetCloseText}>x</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.memberSheetContent}>
            <View style={styles.memberHero}>
              <UserAvatar
                email={member.email}
                userId={member.userId}
                avatarPath={member.avatarPath}
                fallbackText={member.avatarFallbackText}
                fallbackBgToken={member.avatarFallbackBgToken as any}
                size={64}
              />
              <View style={styles.memberHeroText}>
                <Text style={styles.memberName}>{displayName}</Text>
                {member.email ? (
                  <Text style={styles.memberEmail}>{member.email}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.memberDetailRow}>
              <Text style={styles.infoLabel}>{roleTitle}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{member.role}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MembersListSheet({
  visible,
  title,
  participants,
  youLabel,
  currentUserId,
  onClose,
  onSelectMember,
  closeLabel,
}: {
  visible: boolean;
  title: string;
  participants: AccountParticipantVM[];
  youLabel: string;
  currentUserId: string;
  onClose: () => void;
  onSelectMember: (memberId: string) => void;
  closeLabel: string;
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
        <View style={styles.memberSheetContainer}>
          <View style={styles.sheetHandle} />
          <View style={styles.memberSheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              style={styles.sheetCloseButton}
            >
              <Text style={styles.sheetCloseText}>x</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.memberSheetContent}>
            <View style={styles.participantList}>
              {participants.map((participant) => (
                <ParticipantRow
                  key={participant.userId}
                  participant={participant}
                  isCurrentUser={participant.userId === currentUserId}
                  youLabel={youLabel}
                  onPress={() => onSelectMember(participant.userId)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AccountSwitcherSheet({
  visible,
  accounts,
  activeAccountId,
  onClose,
  onSelect,
  inviteCount,
  onOpenInvites,
  copy,
}: {
  visible: boolean;
  accounts: AccountListItem[];
  activeAccountId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  inviteCount: number;
  onOpenInvites: () => void;
  copy: {
    title: string;
    activeBadge: string;
    createCta: string;
    closeLabel: string;
    invitesLabel: string;
    invitesDescription: string;
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
            <TouchableOpacity
              style={styles.inviteRow}
              onPress={onOpenInvites}
            >
              <View style={styles.inviteRowInfo}>
                <Text style={styles.inviteRowTitle}>{copy.invitesLabel}</Text>
                <Text style={styles.inviteRowDescription}>
                  {copy.invitesDescription}
                </Text>
              </View>
              <View style={styles.inviteBadge}>
                <Text style={styles.inviteBadgeText}>{inviteCount}</Text>
              </View>
            </TouchableOpacity>
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

function resolveParticipantName(
  participant: AccountParticipantVM,
  isCurrentUser: boolean,
  youLabel: string
) {
  if (isCurrentUser) return youLabel;
  return (
    participant.displayName ||
    participant.email ||
    `User ${participant.userId.slice(0, 6)}`
  );
}

// === Styles ===

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
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
  accountHero: {
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  accountHeroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.sm,
  },
  accountName: {
    ...typography.display,
    color: colors.text.primary,
    textAlign: "center",
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.surface,
  },
  infoButtonText: {
    ...typography.meta,
    color: colors.text.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.xs,
  },
  avatarButton: {
    padding: tokens.spacing.xs,
    borderRadius: 999,
  },
  avatarOverflow: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverflowText: {
    ...typography.meta,
    color: colors.text.primary,
    fontWeight: tokens.typography.weight.semibold,
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
  infoOverlay: {
    flex: 1,
  },
  infoPopover: {
    position: "absolute",
    width: 240,
    backgroundColor: colors.bg.surface,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  infoLabel: {
    ...typography.meta,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  infoValueMono: {
    fontFamily: "monospace",
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
  memberSheetContainer: {
    maxHeight: "70%",
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    paddingBottom: tokens.spacing.lg,
  },
  memberSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  memberHeaderText: {
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  sheetCloseButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  sheetCloseText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  memberSheetContent: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  memberHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  memberHeroText: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  memberName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  memberEmail: {
    ...typography.body,
    color: colors.text.secondary,
  },
  memberDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
  },
  inviteRowInfo: {
    flex: 1,
  },
  inviteRowTitle: {
    ...typography.body,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  inviteRowDescription: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  inviteBadge: {
    backgroundColor: colors.action.primary,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
  },
  inviteBadgeText: {
    ...typography.meta,
    color: colors.bg.primary,
    fontWeight: tokens.typography.weight.semibold,
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
