import type { Period } from "@poleursus/shared";

export type AccountRedesignPeriod = Period;

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
  }[];
};
