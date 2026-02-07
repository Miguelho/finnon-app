import { View, Text, StyleSheet } from "react-native";
import { formatMinorToMoney } from "@poleursus/shared";
import { movementsDesignTokens, type MovementsSummary } from "../../types/movements";

type SummaryCardsProps = {
  summary: MovementsSummary;
  currencyCode: string;
  currencySymbol: string;
};

type SummaryCardProps = {
  label: string;
  totalValue: bigint;
  confirmedValue: bigint;
  confirmedLabel: string;
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
  const accentColor =
    variant === "income"
      ? colors.incomeGreen
      : variant === "expense"
      ? colors.expenseRed
      : colors.textPrimary;
  const amountColor = accentColor;
  const confirmedText = confirmedLabel === "actual" ? "actual" : "confirmados";

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
  return (
    <View style={styles.row}>
      <SummaryCard
        label="Ingresos"
        totalValue={summary.totalIncome}
        confirmedValue={summary.confirmedIncome}
        confirmedLabel="confirmados"
        variant="income"
        currencyCode={currencyCode}
        currencySymbol={currencySymbol}
      />
      <SummaryCard
        label="Gastos"
        totalValue={summary.totalExpense}
        confirmedValue={summary.confirmedExpense}
        confirmedLabel="confirmados"
        variant="expense"
        currencyCode={currencyCode}
        currencySymbol={currencySymbol}
      />
      <SummaryCard
        label="Balance"
        totalValue={summary.totalBalance}
        confirmedValue={summary.confirmedBalance}
        confirmedLabel="actual"
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
