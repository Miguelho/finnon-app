import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { formatCurrencyParts } from "./utils";
import { useCopy, t } from "../../lib/i18n";
import { useUserTheme } from "../../contexts/UserThemeContext";

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
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  if (!items || items.length === 0) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: userTokens.surface, borderColor: userTokens.border },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: userTokens.textPrimary }]}>
          {t(dictionary, "mobile.home.programmedTitle")}
        </Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={[styles.link, { color: primaryActionColor }]}>
            {t(dictionary, "mobile.home.programmedViewAll")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {items.map((item, index) => {
          const isIncome = item.type === "income";
          const { integer, decimals } = formatCurrencyParts(item.amountMinor, currencySymbol);
          return (
            <View
              key={item.id}
              style={[
                styles.row,
                index > 0 && styles.rowBorder,
                index > 0 && { borderTopColor: userTokens.border },
              ]}
            >
              <View style={styles.rowInfo}>
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: userTokens.surfaceAlt },
                  ]}
                >
                  <Text
                    style={[
                      styles.rowIconText,
                      {
                        color: isIncome
                          ? colors.state.positive
                          : colors.state.negative,
                      },
                    ]}
                  >
                    {isIncome ? "↑" : "↓"}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: userTokens.textPrimary }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.rowDate, { color: userTokens.textSecondary }]}>
                    {item.dateLabel}
                  </Text>
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
    borderRadius: tokens.radii.lg,
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
    fontFamily: "DMSans-SemiBold",
  },
  link: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
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
  rowIconText: {
    fontSize: 16,
  },
  rowTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    fontFamily: "DMSans-Medium",
  },
  rowDate: {
    fontSize: tokens.typography.size.xs,
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
