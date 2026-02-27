import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { formatMoneyWithSymbol, themeTokens } from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

const tokens = themeTokens.light;

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

type SavingsMonthCardProps = {
  title: string;
  monthLabel: string;
  message: string;
  baseCurrency: string;
  currencySymbol: string;
  objectiveMinor: bigint | number | string;
  savingsMinor: bigint | number | string;
  projectsMinor: bigint | number | string;
  huchaMinor: bigint | number | string;
  onPress: () => void;
  projectsLabel: string;
  huchaLabel: string;
  totalLabel: string;
};

export function SavingsMonthCard({
  title,
  monthLabel,
  message,
  baseCurrency,
  currencySymbol,
  objectiveMinor,
  savingsMinor,
  projectsMinor,
  huchaMinor,
  onPress,
  projectsLabel,
  huchaLabel,
  totalLabel,
}: SavingsMonthCardProps) {
  const { tokens: userTokens } = useUserTheme();
  const objective = toMinor(objectiveMinor);
  const savings = toMinor(savingsMinor);
  const projects = toMinor(projectsMinor);
  const hucha = toMinor(huchaMinor);
  const positiveSavings = savings > 0n ? savings : 0n;
  const scale = Number(
    positiveSavings > objective ? positiveSavings : objective > 0n ? objective : 1n
  );
  const projectsPercent =
    scale > 0 ? Math.max(0, Math.min(100, (Number(projects) / scale) * 100)) : 0;
  const huchaPercent =
    scale > 0 ? Math.max(0, Math.min(100, (Number(hucha) / scale) * 100)) : 0;
  const markerPercent =
    scale > 0 ? Math.max(0, Math.min(100, (Number(objective) / scale) * 100)) : 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[
        styles.card,
        {
          backgroundColor: userTokens.surface,
          borderColor: userTokens.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: userTokens.textPrimary }]}>{title}</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.month, { color: userTokens.textSecondary }]}>{monthLabel}</Text>
          <ChevronRight size={16} color={userTokens.textSecondary} />
        </View>
      </View>

      <View style={[styles.barTrack, { backgroundColor: userTokens.surfaceAlt }]}>
        {positiveSavings > 0n ? (
          <>
            <View style={[styles.projectsFill, { width: `${projectsPercent}%` }]} />
            <View
              style={[
                styles.huchaFill,
                { width: `${huchaPercent}%`, left: `${projectsPercent}%` },
              ]}
            />
            <View
              style={[
                styles.marker,
                { left: `${markerPercent}%`, backgroundColor: userTokens.textPrimary },
              ]}
            />
          </>
        ) : null}
      </View>

      <View style={styles.legendRow}>
        <Text style={[styles.legendText, { color: userTokens.textSecondary }]}>
          {projectsLabel}{" "}
          {formatMoneyWithSymbol(projects, baseCurrency, currencySymbol)}
        </Text>
        <Text style={[styles.legendText, { color: userTokens.textSecondary }]}>
          {huchaLabel} {formatMoneyWithSymbol(hucha, baseCurrency, currencySymbol)}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.message, { color: userTokens.textSecondary }]}>{message}</Text>
        <Text style={[styles.total, { color: "#4ade80" }]}>
          {totalLabel} {formatMoneyWithSymbol(savings, baseCurrency, currencySymbol)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-SemiBold",
  },
  month: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
  },
  projectsFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#4ade80",
  },
  huchaFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "#fb923c",
  },
  marker: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 14,
    borderRadius: 1,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  legendText: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.md,
  },
  message: {
    flex: 1,
    fontSize: tokens.typography.size.xs,
    lineHeight: 16,
    fontFamily: "DMSans-Regular",
  },
  total: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-SemiBold",
  },
});

