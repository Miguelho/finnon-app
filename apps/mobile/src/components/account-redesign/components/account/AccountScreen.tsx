import { View, StyleSheet } from 'react-native';
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

interface AccountScreenProps {
  data: AccountScreenData;
  period: Period;
  onPeriodChange: (period: Period) => void;
  currencySymbol?: string;
  currencyDecimals?: number;
  onSettingsPress?: () => void;
  onSearchPress?: () => void;
  onCategoryPress?: (category: CategorySummary) => void;
  onViewAllCategoriesPress?: () => void;
  onViewAllTransactionsPress?: () => void;
  onIncomePress?: () => void;
  onExpensePress?: () => void;
}

export function AccountScreen({
  data,
  period,
  onPeriodChange,
  currencySymbol = '€',
  currencyDecimals = 2,
  onSettingsPress,
  onSearchPress,
  onCategoryPress,
  onViewAllCategoriesPress,
  onViewAllTransactionsPress,
  onIncomePress,
  onExpensePress,
}: AccountScreenProps) {
  return (
    <View style={styles.container}>
      <AccountHeader
        account={data.account}
        onSettingsPress={onSettingsPress}
        onSearchPress={onSearchPress}
      />

      <BalanceHero
        balance={data.account.balance}
        currency={currencySymbol}
        decimals={currencyDecimals}
      />

      <PeriodSelector selected={period} onSelect={onPeriodChange} />

      <FlowCards
        flow={data.flow}
        currency={currencySymbol}
        decimals={currencyDecimals}
        onIncomePress={onIncomePress}
        onExpensePress={onExpensePress}
      />

      <MonthlyChart data={data.monthlyHistory} />

      <CategoryList
        categories={data.categories}
        currencySymbol={currencySymbol}
        currencyDecimals={currencyDecimals}
        limit={4}
        onCategoryPress={onCategoryPress}
        onViewAllPress={onViewAllCategoriesPress}
      />

      <RecentTransactions
        transactions={data.recentTransactions}
        currencySymbol={currencySymbol}
        currencyDecimals={currencyDecimals}
        limit={4}
        onViewAllPress={onViewAllTransactionsPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
