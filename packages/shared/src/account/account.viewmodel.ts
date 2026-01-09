import type { CopyDictionary } from "../copy";
import { t } from "../copy";
import type { UserRole } from "../domain/types";

// Types matching the RPC response
export type AccountSummaryParticipant = {
  user_id: string;
  role: UserRole;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: string | null;
};

export type AccountSummaryCategoryBreakdown = {
  category_id: string;
  name: string;
  icon_id: string | null;
  type: "income" | "expense";
  total: number; // From DB as number, converted to bigint in viewmodel
};

export type AccountSummaryData = {
  account: {
    id: string;
    name: string;
    base_currency: string;
  };
  participants: AccountSummaryParticipant[];
  totals: {
    income_total: number;
    expense_total: number;
    balance_total: number;
  };
  category_breakdown: AccountSummaryCategoryBreakdown[];
  categories_count: number;
};

// ViewModel types
export type AccountCategoryVM = {
  id: string;
  name: string;
  iconId: string | null;
  type: "income" | "expense";
  totalMinor: bigint;
};

export type AccountParticipantVM = {
  userId: string;
  role: UserRole;
  email: string | null;
  displayName: string | null;
  avatarPath: string | null;
  avatarFallbackText: string | null;
  avatarFallbackBgToken: string | null;
};

export type AccountViewModel = {
  account: {
    id: string;
    name: string;
    baseCurrency: string;
  };
  participants: AccountParticipantVM[];
  totals: {
    balanceMinor: bigint;
    incomeMinor: bigint;
    expenseMinor: bigint;
  };
  categories: {
    count: number;
    breakdown: AccountCategoryVM[];
  };
  permissions: {
    isGuestReadOnly: boolean;
    canEdit: boolean;
  };
  copy: {
    title: string;
    balanceLabel: string;
    incomeLabel: string;
    expenseLabel: string;
    categoriesTitle: string;
    categoriesViewAll: string;
    categoriesCount: string;
    categoryBreakdownTitle: string;
    emptyCategories: string;
    switchAccount: string;
    createAccount: string;
    baseCurrencySubtitle: string;
    participantsLabel: string;
    participantsEmpty: string;
    youLabel: string;
  };
};

export type BuildAccountViewModelInput = {
  data: AccountSummaryData;
  dictionary: CopyDictionary;
  currentUserId: string;
  role: UserRole;
};

export function buildAccountViewModel({
  data,
  dictionary,
  currentUserId,
  role,
}: BuildAccountViewModelInput): AccountViewModel {
  const isGuestReadOnly = role === "viewer";

  const participants: AccountParticipantVM[] = data.participants.map((p) => ({
    userId: p.user_id,
    role: p.role,
    email: p.email,
    displayName: p.display_name,
    avatarPath: p.avatar_path,
    avatarFallbackText: p.avatar_fallback_text,
    avatarFallbackBgToken: p.avatar_fallback_bg_token,
  }));

  // Sort participants: current user first, then by role (admin > contributor > viewer)
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    const roleOrder = { admin: 0, contributor: 1, viewer: 2 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  const categoryBreakdown: AccountCategoryVM[] = data.category_breakdown.map((c) => ({
    id: c.category_id,
    name: c.name,
    iconId: c.icon_id,
    type: c.type,
    totalMinor: BigInt(c.total),
  }));

  return {
    account: {
      id: data.account.id,
      name: data.account.name,
      baseCurrency: data.account.base_currency,
    },
    participants: sortedParticipants,
    totals: {
      balanceMinor: BigInt(data.totals.balance_total),
      incomeMinor: BigInt(data.totals.income_total),
      expenseMinor: BigInt(data.totals.expense_total),
    },
    categories: {
      count: data.categories_count,
      breakdown: categoryBreakdown,
    },
    permissions: {
      isGuestReadOnly,
      canEdit: !isGuestReadOnly,
    },
    copy: {
      title: t(dictionary, "account.title"),
      balanceLabel: t(dictionary, "account.summary.balanceLabel"),
      incomeLabel: t(dictionary, "account.summary.incomeLabel"),
      expenseLabel: t(dictionary, "account.summary.expenseLabel"),
      categoriesTitle: t(dictionary, "account.summary.categoriesTitle"),
      categoriesViewAll: t(dictionary, "account.summary.categoriesViewAll"),
      categoriesCount: t(dictionary, "account.summary.categoriesCount", {
        count: data.categories_count,
      }),
      categoryBreakdownTitle: t(dictionary, "account.summary.categoryBreakdownTitle"),
      emptyCategories: t(dictionary, "account.summary.emptyCategories"),
      switchAccount: t(dictionary, "account.summary.switchAccount"),
      createAccount: t(dictionary, "account.summary.createAccount"),
      baseCurrencySubtitle: t(dictionary, "account.summary.baseCurrencySubtitle"),
      participantsLabel: t(dictionary, "account.participantsLabel", {
        count: data.participants.length,
      }),
      participantsEmpty: t(dictionary, "account.participantsEmpty"),
      youLabel: t(dictionary, "account.youLabel"),
    },
  };
}
