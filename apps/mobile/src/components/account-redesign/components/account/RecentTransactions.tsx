import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CategoryIcon } from '../../../CategoryIcon';
import { colors, typography, spacing, radii } from '../../theme/tokens';
import { themeTokens } from '@poleursus/shared';
import { formatCurrency } from '../../utils/currency';
import type { Transaction } from '../../types/account';
import { useUserTheme } from '../../../../contexts/UserThemeContext';
import { useCopy, t } from '../../../../lib/i18n';

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((chunk) => chunk + chunk)
          .join("")
      : normalized;
  if (expanded.length !== 6) return hexColor;
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);
  if ([red, green, blue].some((value) => Number.isNaN(value))) return hexColor;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
  currencySymbol?: string;
  currencyDecimals?: number;
  limit?: number;
  onViewAllPress?: () => void;
}

export function RecentTransactions({
  transactions,
  currencySymbol = '€',
  currencyDecimals = 2,
  limit = 4,
  onViewAllPress,
}: RecentTransactionsProps) {
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor, resolvedMode } = useUserTheme();
  const modeColors = themeTokens[resolvedMode].colors;
  const visible = transactions.slice(0, limit);

  // Formatear fecha relativa sencilla
  const formatDate = (isoDate: string) => {
    const [yearPart, monthPart, dayPart] = isoDate.split("-");
    const rawYear = Number(yearPart);
    const rawMonth = Number(monthPart);
    const rawDay = Number(dayPart);
    const safeYear = Number.isFinite(rawYear) ? rawYear : 1970;
    const safeMonth = Number.isFinite(rawMonth) ? rawMonth : 1;
    const safeDay = Number.isFinite(rawDay) ? rawDay : 1;
    const date = new Date(safeYear, safeMonth - 1, safeDay);
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    })
      .format(date)
      .replace(",", "")
      .replace(/\.$/, "");
  };

  return (
    <View>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
          {t(dictionary, "account.redesign.latestMovementsTitle")}
        </Text>
        <Pressable onPress={onViewAllPress} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: primaryActionColor }]}>
            {t(dictionary, "account.redesign.viewAllMovements")}
          </Text>
        </Pressable>
      </View>

      {/* List */}
      <View style={styles.list}>
        {visible.map((tx, i) => {
          const formatted = formatCurrency(Math.abs(tx.amount), {
            currency: currencySymbol,
            decimals: currencyDecimals,
          });
          const isIncome = tx.amount > 0;
          const toneColor = isIncome
            ? modeColors.state.positive
            : modeColors.state.negative;
          const iconBg = withAlpha(toneColor, resolvedMode === "dark" ? 0.28 : 0.18);
          const iconBorder = withAlpha(toneColor, resolvedMode === "dark" ? 0.55 : 0.34);

          return (
            <View
              key={tx.id}
              style={[
                styles.item,
                i < visible.length - 1 && styles.itemBorder,
                i < visible.length - 1 && { borderBottomColor: userTokens.border },
              ]}
            >
              {/* Icon */}
              <View
                style={[
                  styles.icon,
                  { backgroundColor: iconBg, borderColor: iconBorder },
                ]}
              >
                <CategoryIcon
                  iconKey={(tx.categoryIconId ?? 'Tag') as any}
                  size={15}
                  tone={isIncome ? 'positive' : 'negative'}
                />
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={[styles.name, { color: userTokens.textPrimary }]} numberOfLines={1}>
                  {tx.description}
                </Text>
                <Text style={[styles.meta, { color: userTokens.textSecondary }]}>
                  {tx.categoryName} · {formatDate(tx.date)}
                </Text>
              </View>

              {/* Amount */}
              <Text
                style={[
                  styles.amount,
                  isIncome ? styles.amountPositive : styles.amountNegative,
                ]}
              >
                {isIncome ? '+' : '-'}
                {currencySymbol}
                {formatted.whole}
                {formatted.cents}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size.lg,
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.base,
  },
  list: {
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing['6xl'],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.lg + 1,
  },
  itemBorder: {
    borderBottomWidth: 1,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.md,
  },
  meta: {
    fontFamily: typography.family.sans,
    fontSize: typography.size.sm,
    marginTop: 1,
  },
  amount: {
    fontFamily: typography.family.monoMedium,
    fontSize: typography.size.md,
  },
  amountPositive: {
    color: colors.income,
  },
  amountNegative: {
    color: colors.expense,
  },
});
