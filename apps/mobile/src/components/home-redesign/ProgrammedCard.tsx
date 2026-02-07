import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { formatCurrencyParts } from "./utils";

const tokens = themeTokens.light;
const colors = tokens.colors;

type ProgrammedItem = {
  id: string;
  name: string;
  amountMinor: bigint;
  dateLabel: string;
  type: "income" | "expense";
};

type ProgrammedCardProps = {
  items: ProgrammedItem[];
  onViewAll: () => void;
  currencySymbol: string;
};

export function ProgrammedCard({ items, onViewAll, currencySymbol }: ProgrammedCardProps) {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Programados</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.link}>Ver todos →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {items.map((item, index) => {
          const isIncome = item.type === "income";
          const { integer, decimals } = formatCurrencyParts(item.amountMinor, currencySymbol);
          return (
            <View
              key={item.id}
              style={[styles.row, index > 0 && styles.rowBorder]}
            >
              <View style={styles.rowInfo}>
                <View
                  style={[
                    styles.rowIcon,
                    isIncome ? styles.rowIconIncome : styles.rowIconExpense,
                  ]}
                >
                  <Text style={styles.rowIconText}>{isIncome ? "↑" : "↓"}</Text>
                </View>
                <View>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowDate}>{item.dateLabel}</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.rowAmount,
                  isIncome ? styles.amountPositive : styles.amountNegative,
                ]}
              >
                {isIncome ? "+" : "-"}
                {integer},{decimals}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    backgroundColor: colors.bg.surface,
    padding: tokens.spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    fontFamily: "DMSans-SemiBold",
  },
  link: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
    color: colors.action.primary,
    fontFamily: "DMSans-Medium",
  },
  list: {},
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: tokens.spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
  },
  rowInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.sm,
  },
  rowIconIncome: {
    backgroundColor: "#F0FDF4",
  },
  rowIconExpense: {
    backgroundColor: "#FEF2F2",
  },
  rowIconText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  rowTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
    fontFamily: "DMSans-Medium",
  },
  rowDate: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.muted,
    fontFamily: "DMSans",
  },
  rowAmount: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    fontFamily: "JetBrainsMono-Medium",
  },
  amountPositive: {
    color: colors.state.positive,
  },
  amountNegative: {
    color: colors.state.negative,
  },
});
