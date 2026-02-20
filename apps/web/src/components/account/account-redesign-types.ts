import type { Period } from "@poleursus/shared";

export type AccountRedesignPeriod = Period;

export type ContributionMemberBalance = {
  userId: string;
  name: string;
  initials: string;
  color: string;
  totalPaid: number;
  totalResponsible: number;
  net: number;
};

export type ContributionDebt = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
};

export type ContributionCategoryShare = {
  userId: string;
  name: string;
  amount: number;
  percentage: number;
};

export type ContributionCategorySummary = {
  id: string;
  name: string;
  iconId?: string | null;
  totalAmount: number;
  transactionCount: number;
  shares: ContributionCategoryShare[];
};

export type AccountContributor = {
  userId: string;
  name: string;
  shortName: string;
  initials: string;
  color: string;
};

export type AccountRedesignData = {
  account: {
    id: string;
    name: string;
    icon: string;
    type: string;
    currency: string;
    balance: number;
  };
  flow: {
    totalIncome: number;
    totalExpense: number;
    incomeDelta: number | null;
    expenseDelta: number | null;
    byUser: {
      income: { userId: string; amount: number }[];
      expense: { userId: string; amount: number }[];
    };
  };
  categories: {
    id: string;
    name: string;
    iconId?: string | null;
    colorKey: string;
    amount: number;
    transactionCount: number;
    type: "income" | "expense";
  }[];
  recentTransactions: {
    id: string;
    description: string;
    categoryName: string;
    categoryIconId?: string | null;
    amount: number;
    date: string;
  }[];
  monthlyHistory: {
    label: string;
    income: number;
    expense: number;
    isCurrent: boolean;
    incomeByUser: { userId: string; amount: number }[];
    expenseByUser: { userId: string; amount: number }[];
  }[];
  contributors: AccountContributor[];
  contributionBalance: {
    members: ContributionMemberBalance[];
    debts: ContributionDebt[];
    expenseCategories: ContributionCategorySummary[];
    incomeCategories: ContributionCategorySummary[];
  } | null;
};
