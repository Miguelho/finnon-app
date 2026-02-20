import { View, StyleSheet } from 'react-native';
import { AccountHeader } from '../../components/account/AccountHeader';
import { BalanceHero } from '../../components/account/BalanceHero';
import { ContributionPeriodBanner } from '../../components/account/ContributionPeriodBanner';
import { PeriodSelector } from '../../components/account/PeriodSelector';
import { FlowCards } from '../../components/account/FlowCards';
import { MonthlyChart } from '../../components/account/MonthlyChart';
import { ContributionBalanceSection } from '../../components/account/ContributionBalanceSection';
import type {
  Period,
  AccountScreenData,
} from '../../types/account';

interface AccountScreenProps {
  data: AccountScreenData;
  period: Period;
  onPeriodChange: (period: Period) => void;
  currencySymbol?: string;
  currencyDecimals?: number;
  onSettingsPress?: () => void;
  onSearchPress?: () => void;
  onContributionCategoryPress?: (categoryId: string, type: "income" | "expense") => void;
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
  onContributionCategoryPress,
  onIncomePress,
  onExpensePress,
}: AccountScreenProps) {
  return (
    <View style={styles.container}>
      <AccountHeader
        account={data.account}
        contributors={data.contributors}
        onSettingsPress={onSettingsPress}
        onSearchPress={onSearchPress}
      />

      <BalanceHero
        balance={data.account.balance}
        currency={currencySymbol}
        decimals={currencyDecimals}
      />

      <ContributionPeriodBanner
        contributors={data.contributors}
        contributionBalance={data.contributionBalance}
        period={period}
        currency={currencySymbol}
        decimals={currencyDecimals}
      />

      <PeriodSelector selected={period} onSelect={onPeriodChange} />

      <FlowCards
        flow={data.flow}
        contributors={data.contributors}
        currency={currencySymbol}
        decimals={currencyDecimals}
        onIncomePress={onIncomePress}
        onExpensePress={onExpensePress}
      />

      <MonthlyChart
        data={data.monthlyHistory}
        period={period}
        contributors={data.contributors}
      />

      <ContributionBalanceSection
        data={data.contributionBalance}
        contributors={data.contributors}
        currencySymbol={currencySymbol}
        currencyDecimals={currencyDecimals}
        onCategoryPress={onContributionCategoryPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
