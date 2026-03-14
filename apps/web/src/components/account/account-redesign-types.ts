import type { Period } from "@poleursus/shared";

export type AccountRedesignPeriod = Period;

export type MemberBalanceMember = {
  userId: string;
  name: string;
  initials: string;
  color: string;
  totalPaid: number;
  totalResponsible: number;
  net: number;
};

export type MemberBalanceDebt = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
};

export type MemberBalanceCategoryShare = {
  userId: string;
  name: string;
  amount: number;
  percentage: number;
};

export type MemberBalanceCategorySummary = {
  id: string;
  name: string;
  iconId?: string | null;
  totalAmount: number;
  transactionCount: number;
  shares: MemberBalanceCategoryShare[];
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
  memberBalance: {
    members: MemberBalanceMember[];
    debts: MemberBalanceDebt[];
    expenseCategories: MemberBalanceCategorySummary[];
    incomeCategories: MemberBalanceCategorySummary[];
  } | null;
};
