import type { Period as SharedPeriod } from "@poleursus/shared";

/**
 * Tipos de datos para la pantalla de cuenta.
 *
 * Están separados del UI para que el día que conectes con un backend real
 * solo tengas que mapear la respuesta a estos tipos.
 */

export interface Account {
  id: string;
  name: string;
  icon: string; // emoji o nombre de icono
  type: string; // "Cuenta personal", "Cuenta compartida", etc.
  currency: string;
  balance: number;
}

export interface FlowSummary {
  totalIncome: number;
  totalExpense: number;
  // Porcentaje de cambio respecto al período anterior (null si no hay datos)
  incomeDelta: number | null;
  expenseDelta: number | null;
  byUser: {
    income: Array<{ userId: string; amount: number }>;
    expense: Array<{ userId: string; amount: number }>;
  };
}

export interface CategorySummary {
  id: string;
  name: string;
  iconId?: string | null;
  colorKey: string; // clave para colors.category[colorKey]
  amount: number;
  transactionCount: number;
  type: 'income' | 'expense';
}

export interface Transaction {
  id: string;
  description: string;
  categoryName: string;
  categoryIconId?: string | null;
  amount: number; // positivo = ingreso, negativo = gasto
  date: string; // ISO date string
}

export interface MonthlyDataPoint {
  label: string; // "Ene", "Feb", etc.
  income: number;
  expense: number;
  isCurrent: boolean;
  incomeByUser: Array<{ userId: string; amount: number }>;
  expenseByUser: Array<{ userId: string; amount: number }>;
}

export interface ContributionMemberBalance {
  userId: string;
  name: string;
  initials: string;
  color: string;
  totalPaid: number;
  totalResponsible: number;
  net: number;
}

export interface ContributionDebt {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
}

export interface ContributionCategoryShare {
  userId: string;
  name: string;
  amount: number;
  percentage: number;
}

export interface ContributionCategorySummary {
  id: string;
  name: string;
  iconId?: string | null;
  totalAmount: number;
  transactionCount: number;
  shares: ContributionCategoryShare[];
}

export interface ContributionBalanceData {
  members: ContributionMemberBalance[];
  debts: ContributionDebt[];
  expenseCategories: ContributionCategorySummary[];
  incomeCategories: ContributionCategorySummary[];
}

export interface AccountContributor {
  userId: string;
  name: string;
  shortName: string;
  initials: string;
  color: string;
}

export type Period = SharedPeriod;

export interface AccountScreenData {
  account: Account;
  flow: FlowSummary;
  categories: CategorySummary[];
  recentTransactions: Transaction[];
  monthlyHistory: MonthlyDataPoint[];
  contributors: AccountContributor[];
  contributionBalance: ContributionBalanceData | null;
}
