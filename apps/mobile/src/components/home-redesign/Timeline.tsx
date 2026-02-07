import { View, Text, StyleSheet } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { formatCurrencyParts, formatShortDate } from "./utils";

const tokens = themeTokens.light;
const colors = tokens.colors;

type TimelineMovement = {
  name: string;
  amountMinor: bigint;
  date: string | Date;
  type: "income" | "expense";
};

type TimelineProps = {
  last?: TimelineMovement | null;
  next?: TimelineMovement | null;
  currencySymbol: string;
  locale?: string;
};

export function Timeline({ last, next, currencySymbol, locale = "es" }: TimelineProps) {
  return (
    <View style={styles.card}>
      <TimelineItem
        label="Último"
        movement={last}
        align="left"
        currencySymbol={currencySymbol}
        locale={locale}
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <View style={[styles.dividerDot, styles.dividerDotActive]} />
        <Text style={styles.dividerLabel}>Hoy</Text>
        <View style={styles.dividerDot} />
        <View style={styles.dividerLine} />
      </View>

      <TimelineItem
        label="Próximo"
        movement={next}
        align="right"
        currencySymbol={currencySymbol}
        locale={locale}
      />
    </View>
  );
}

type TimelineItemProps = {
  label: string;
  movement?: TimelineMovement | null;
  align: "left" | "right";
  currencySymbol: string;
  locale: string;
};

function TimelineItem({
  label,
  movement,
  align,
  currencySymbol,
  locale,
}: TimelineItemProps) {
  const alignStyle = align === "right" ? styles.alignRight : styles.alignLeft;

  if (!movement) {
    return (
      <View style={[styles.item, alignStyle]}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={styles.itemPlaceholder}>—</Text>
      </View>
    );
  }

  const { integer, decimals } = formatCurrencyParts(movement.amountMinor, currencySymbol);
  const isIncome = movement.type === "income";

  return (
    <View style={[styles.item, alignStyle]}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemName} numberOfLines={1}>
        {movement.name}
      </Text>
      <Text style={[styles.itemAmount, isIncome ? styles.amountPositive : styles.amountNegative]}>
        {isIncome ? "+" : "-"}
        {integer},{decimals}
      </Text>
      <Text style={styles.itemDate}>{formatShortDate(movement.date, locale)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    backgroundColor: colors.bg.surface,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  item: {
    flex: 1,
    gap: 2,
  },
  alignLeft: {
    alignItems: "flex-start",
  },
  alignRight: {
    alignItems: "flex-end",
  },
  itemLabel: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.text.muted,
    fontFamily: "DMSans-Medium",
  },
  itemPlaceholder: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.muted,
    fontFamily: "DMSans",
  },
  itemName: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
    fontFamily: "DMSans-Medium",
  },
  itemAmount: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    fontFamily: "JetBrainsMono-Medium",
  },
  itemDate: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.muted,
    fontFamily: "DMSans",
  },
  amountPositive: {
    color: colors.state.positive,
  },
  amountNegative: {
    color: colors.state.negative,
  },
  divider: {
    alignItems: "center",
    paddingHorizontal: tokens.spacing.md,
  },
  dividerLine: {
    width: 1,
    height: 18,
    backgroundColor: colors.state.neutral,
  },
  dividerDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.state.neutral,
    marginVertical: 2,
  },
  dividerDotActive: {
    backgroundColor: colors.text.primary,
  },
  dividerLabel: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.text.muted,
    fontFamily: "DMSans-SemiBold",
    marginVertical: 2,
  },
});
