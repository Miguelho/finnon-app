import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/tokens';
import { AccountHeader } from '../../components/account/AccountHeader';
import { BalanceHero } from '../../components/account/BalanceHero';
import { PeriodSelector } from '../../components/account/PeriodSelector';
import { FlowCards } from '../../components/account/FlowCards';
import { MonthlyChart } from '../../components/account/MonthlyChart';
import { CategoryList } from '../../components/account/CategoryList';
import { RecentTransactions } from '../../components/account/RecentTransactions';
import type {
  Period,
  AccountScreenData,
  CategorySummary,
} from '../../types/account';

// ─── Datos de ejemplo (reemplazar por tu fuente de datos real) ───
const MOCK_DATA: AccountScreenData = {
  account: {
    id: 'casa-1',
    name: 'Casa',
    icon: '🏠',
    type: 'Cuenta personal',
    currency: 'EUR',
    balance: 14334.48,
  },
  flow: {
    totalIncome: 19443.49,
    totalExpense: 5109.01,
    incomeDelta: 2.3,
    expenseDelta: -8.1,
  },
  categories: [
    {
      id: 'casa',
      name: 'Casa',
      icon: '🏠',
      colorKey: 'casa',
      amount: 4651.54,
      transactionCount: 12,
      type: 'expense',
    },
    {
      id: 'familia',
      name: 'Familia',
      icon: '👨‍👩‍👧',
      colorKey: 'familia',
      amount: 340.45,
      transactionCount: 4,
      type: 'expense',
    },
    {
      id: 'ocio',
      name: 'Ocio',
      icon: '🎮',
      colorKey: 'ocio',
      amount: 82.87,
      transactionCount: 3,
      type: 'expense',
    },
    {
      id: 'restaurantes',
      name: 'Restaurantes',
      icon: '🍽️',
      colorKey: 'restaurantes',
      amount: 34.15,
      transactionCount: 2,
      type: 'expense',
    },
    {
      id: 'interests',
      name: 'Intereses',
      icon: '💰',
      colorKey: 'interests',
      amount: 81.47,
      transactionCount: 1,
      type: 'expense',
    },
    {
      id: 'lottery',
      name: 'Lotería',
      icon: '🎰',
      colorKey: 'lottery',
      amount: 5.0,
      transactionCount: 1,
      type: 'expense',
    },
  ],
  recentTransactions: [
    {
      id: 'tx-1',
      description: 'Alquiler enero',
      categoryName: 'Casa',
      categoryIcon: '🏠',
      amount: -850.0,
      date: '2026-02-01',
    },
    {
      id: 'tx-2',
      description: 'Nómina enero',
      categoryName: 'Paycheck',
      categoryIcon: '💼',
      amount: 2450.0,
      date: '2026-01-31',
    },
    {
      id: 'tx-3',
      description: 'La Barraca',
      categoryName: 'Restaurantes',
      categoryIcon: '🍽️',
      amount: -22.5,
      date: '2026-01-28',
    },
    {
      id: 'tx-4',
      description: 'Iberdrola',
      categoryName: 'Casa',
      categoryIcon: '⚡',
      amount: -67.3,
      date: '2026-01-25',
    },
  ],
  monthlyHistory: [
    { label: 'Sep', income: 4500, expense: 3200, isCurrent: false },
    { label: 'Oct', income: 5000, expense: 2800, isCurrent: false },
    { label: 'Nov', income: 4800, expense: 3500, isCurrent: false },
    { label: 'Dic', income: 5200, expense: 3000, isCurrent: false },
    { label: 'Ene', income: 5500, expense: 2500, isCurrent: true },
  ],
};

export default function AccountScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('month');

  // En producción esto vendría de un hook (useAccountData, useSWR, react-query, etc.)
  const data = MOCK_DATA;

  const handleCategoryPress = useCallback(
    (category: CategorySummary) => {
      // Navegar al drill-down de la categoría
      // Ajusta la ruta según tu estructura de Expo Router
      router.push({
        pathname: '/account/category/[id]',
        params: { id: category.id },
      });
    },
    [router]
  );

  const handleViewAllCategories = useCallback(() => {
    router.push('/account/categories');
  }, [router]);

  const handleViewAllTransactions = useCallback(() => {
    router.push('/account/transactions');
  }, [router]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AccountHeader
        account={data.account}
        onSettingsPress={() => router.push('/account/settings')}
      />

      <BalanceHero balance={data.account.balance} currency="€" />

      <PeriodSelector selected={period} onSelect={setPeriod} />

      <FlowCards flow={data.flow} />

      <MonthlyChart data={data.monthlyHistory} />

      <CategoryList
        categories={data.categories}
        limit={4}
        onCategoryPress={handleCategoryPress}
        onViewAllPress={handleViewAllCategories}
      />

      <RecentTransactions
        transactions={data.recentTransactions}
        limit={4}
        onViewAllPress={handleViewAllTransactions}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 100, // espacio para bottom tab bar
  },
});
