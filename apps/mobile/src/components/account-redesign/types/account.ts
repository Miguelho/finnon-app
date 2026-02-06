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
}

export type Period = 'week' | 'month' | 'quarter' | 'year';

export interface AccountScreenData {
  account: Account;
  flow: FlowSummary;
  categories: CategorySummary[];
  recentTransactions: Transaction[];
  monthlyHistory: MonthlyDataPoint[];
}
