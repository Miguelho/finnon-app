import { View, Text, StyleSheet } from "react-native";
import { formatMinorToMoney } from "@poleursus/shared";
import { movementsDesignTokens, type MovementsSummary } from "../../types/movements";
import { useCopy, t } from "../../lib/i18n";

type SummaryCardsProps = {
  summary: MovementsSummary;
  currencyCode: string;
  currencySymbol: string;
};

type SummaryCardProps = {
  label: string;
  totalValue: bigint;
  confirmedValue: bigint;
  confirmedLabel: "single" | "plural";
  variant: "income" | "expense" | "balance";
  currencyCode: string;
  currencySymbol: string;
};

const colors = movementsDesignTokens.colors;

const formatAmount = (
  value: bigint,
  currencyCode: string,
  currencySymbol: string,
  forceNegative?: boolean
) => {
  const absoluteValue = value < 0n ? -value : value;
  const formatted = formatMinorToMoney(absoluteValue, currencyCode);
  if (forceNegative || value < 0n) {
    return `-${currencySymbol}${formatted}`;
  }
  return `${currencySymbol}${formatted}`;
};

function SummaryCard({
  label,
  totalValue,
  confirmedValue,
  confirmedLabel,
  variant,
  currencyCode,
  currencySymbol,
}: SummaryCardProps) {
  const { dictionary } = useCopy();
  const accentColor =
    variant === "income"
      ? colors.incomeGreen
      : variant === "expense"
      ? colors.expenseRed
      : colors.textPrimary;
  const amountColor = accentColor;
  const confirmedText =
    confirmedLabel === "single"
      ? t(dictionary, "transactions.ui.summaryConfirmedOne")
      : t(dictionary, "transactions.ui.summaryConfirmedOther");

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.amount, { color: amountColor }]}>
        {formatAmount(
          totalValue,
          currencyCode,
          currencySymbol,
          variant === "expense"
        )}
      </Text>
      <Text style={styles.confirmed}>
        <Text style={styles.confirmedValue}>
          {formatAmount(
            confirmedValue,
            currencyCode,
            currencySymbol,
            variant === "expense"
          )}
        </Text>{" "}
        {confirmedText}
      </Text>
    </View>
  );
}

export function SummaryCards({
  summary,
  currencyCode,
  currencySymbol,
}: SummaryCardsProps) {
  const { dictionary } = useCopy();
  return (
    <View style={styles.row}>
      <SummaryCard
        label={t(dictionary, "common.incomeLabel")}
        totalValue={summary.totalIncome}
        confirmedValue={summary.confirmedIncome}
        confirmedLabel="plural"
        variant="income"
        currencyCode={currencyCode}
        currencySymbol={currencySymbol}
      />
      <SummaryCard
        label={t(dictionary, "common.expenseLabel")}
        totalValue={summary.totalExpense}
        confirmedValue={summary.confirmedExpense}
        confirmedLabel="plural"
        variant="expense"
        currencyCode={currencyCode}
        currencySymbol={currencySymbol}
      />
      <SummaryCard
        label={t(dictionary, "common.balanceLabel")}
        totalValue={summary.totalBalance}
        confirmedValue={summary.confirmedBalance}
        confirmedLabel="single"
        variant="balance"
        currencyCode={currencyCode}
        currencySymbol={currencySymbol}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "column",
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: movementsDesignTokens.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: 12,
  },
  label: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textSecondary,
    fontFamily: "DMSans-Medium",
  },
  amount: {
    marginTop: 6,
    fontSize: movementsDesignTokens.typography.sizes.xl,
    fontFamily: "DMSans-Bold",
  },
  confirmed: {
    marginTop: 4,
    fontSize: movementsDesignTokens.typography.sizes.xs,
    color: colors.textTertiary,
    fontFamily: "DMSans",
  },
  confirmedValue: {
    color: colors.textSecondary,
    fontFamily: "DMSans-SemiBold",
  },
});
