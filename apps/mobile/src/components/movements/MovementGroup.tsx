import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { formatMinorToMoney } from "@poleursus/shared";
import { movementsDesignTokens, type Movement, type UserProfile } from "../../types/movements";
import { MovementRow } from "./MovementRow";
import { DateSeparator } from "./DateSeparator";

type MovementGroupProps = {
  label: string;
  variant: "pending" | "done";
  movements: Movement[];
  totalAmount: bigint;
  dotColor: string;
  currencyCode: string;
  currencySymbol: string;
  profilesById: Record<string, UserProfile>;
  onPressMovement?: (id: string) => void;
  locale?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

const colors = movementsDesignTokens.colors;

const formatDateLabel = (value: string, locale?: string) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(locale ?? "es", {
    day: "numeric",
    month: "long",
  });
};

export function MovementGroup({
  label,
  variant,
  movements,
  totalAmount,
  dotColor,
  currencyCode,
  currencySymbol,
  profilesById,
  onPressMovement,
  locale,
  isCollapsed = false,
  onToggleCollapse,
}: MovementGroupProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Movement[]>();
    movements.forEach((movement) => {
      const list = map.get(movement.date) ?? [];
      list.push(movement);
      map.set(movement.date, list);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [movements]);

  const formattedTotal = (() => {
    const absoluteValue = totalAmount < 0n ? -totalAmount : totalAmount;
    const formatted = formatMinorToMoney(absoluteValue, currencyCode);
    const sign = totalAmount < 0n ? "-" : "";
    return `${sign}${currencySymbol}${formatted}`;
  })();
  const formattedTotalLabel = `(${formattedTotal})`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.headerLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.headerCount}>— {movements.length} movimientos</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerAmount}>{formattedTotalLabel}</Text>
          {onToggleCollapse && (
            <Pressable onPress={onToggleCollapse} hitSlop={8}>
              <Text style={styles.collapseText}>
                {isCollapsed ? "Mostrar" : "Ocultar"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      {!isCollapsed &&
        grouped.map(([date, items]) => (
          <View key={date}>
            <DateSeparator label={formatDateLabel(date, locale)} />
            {items.map((movement) => (
              <MovementRow
                key={movement.id}
                movement={movement}
                profile={profilesById[movement.userId]}
                currencyCode={currencyCode}
                currencySymbol={currencySymbol}
                variant={variant === "pending" ? "pending" : "default"}
                onPress={onPressMovement}
              />
            ))}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  headerLabel: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textPrimary,
    fontFamily: "DMSans-Bold",
  },
  headerCount: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textSecondary,
    fontFamily: "DMSans",
  },
  headerAmount: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textPrimary,
    fontFamily: "DMSans-SemiBold",
  },
  headerRight: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  collapseText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textSecondary,
    fontFamily: "DMSans-Medium",
  },
});
