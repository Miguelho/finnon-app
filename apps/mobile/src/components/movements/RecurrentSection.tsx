import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { isCategoryIconKey, formatMinorToMoney } from "@poleursus/shared";
import { CategoryIcon } from "../CategoryIcon";
import { movementsDesignTokens, type RecurringTemplate } from "../../types/movements";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { useCopy, t } from "../../lib/i18n";

type RecurrentSectionProps = {
  recurrents: RecurringTemplate[];
  totalAmount: bigint;
  currencyCode: string;
  currencySymbol: string;
  onRegister: (id: string) => void;
  onRegisterAll: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  locale?: string;
};

export function RecurrentSection({
  recurrents,
  totalAmount,
  currencyCode,
  currencySymbol,
  onRegister,
  onRegisterAll,
  isCollapsed,
  onToggleCollapse,
  locale,
}: RecurrentSectionProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();
  const count = recurrents.length;
  const formattedTotal = useMemo(() => {
    const absoluteValue = totalAmount < 0n ? -totalAmount : totalAmount;
    const formatted = formatMinorToMoney(absoluteValue, currencyCode);
    const sign = totalAmount < 0n ? "-" : "";
    return `${sign}${currencySymbol}${formatted}`;
  }, [currencyCode, currencySymbol, totalAmount]);

  if (count === 0) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: userTokens.surface,
          borderColor: userTokens.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="repeat"
            size={18}
            color={primaryActionColor}
          />
          <Text style={[styles.headerTitle, { color: userTokens.textPrimary }]}>
            {t(dictionary, "transactions.ui.toRegisterSection")}
          </Text>
          <Text style={[styles.headerCount, { color: primaryActionColor }]}>
            {count}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.headerAmount, { color: userTokens.textSecondary }]}>
            ({formattedTotal})
          </Text>
          <Pressable onPress={onToggleCollapse} hitSlop={8}>
            <Text style={[styles.headerToggle, { color: userTokens.textSecondary }]}>
              {isCollapsed
                ? t(dictionary, "transactions.ui.show")
                : t(dictionary, "transactions.ui.hide")}
            </Text>
          </Pressable>
        </View>
      </View>

      {!isCollapsed && (
        <>
          <View style={styles.cards}>
            {recurrents.map((item) => (
              <RecurrentCard
                key={item.id}
                item={item}
                currencyCode={currencyCode}
                currencySymbol={currencySymbol}
                locale={locale}
                onRegister={onRegister}
              />
            ))}
          </View>
          <Pressable
            style={[styles.registerAll, { backgroundColor: primaryActionColor }]}
            onPress={onRegisterAll}
          >
            <Text style={[styles.registerAllText, { color: primaryActionTextColor }]}>
              {t(dictionary, "transactions.ui.registerAll", { count })}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

type RecurrentCardProps = {
  item: RecurringTemplate;
  currencyCode: string;
  currencySymbol: string;
  onRegister: (id: string) => void;
  locale?: string;
};

function RecurrentCard({
  item,
  currencyCode,
  currencySymbol,
  onRegister,
  locale,
}: RecurrentCardProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();
  const [isRemoving, setIsRemoving] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const formattedDate = useMemo(() => {
    const date = new Date(`${item.expectedDate}T00:00:00`);
    return date.toLocaleDateString(locale ?? "es", {
      day: "numeric",
      month: "short",
    });
  }, [item.expectedDate, locale]);

  const amount = formatMinorToMoney(item.amountMinor, currencyCode);
  const amountLabel =
    item.type === "expense"
      ? `-${currencySymbol}${amount}`
      : `${currencySymbol}${amount}`;

  const metaParts = [item.categoryName];
  if (item.subcategory) metaParts.push(item.subcategory);
  metaParts.push(formattedDate);

  const iconKey = isCategoryIconKey(item.categoryIconId)
    ? item.categoryIconId
    : "Receipt";

  const handleRegister = () => {
    if (isRemoving) return;
    setIsRemoving(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 40,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => onRegister(item.id));
  };

  return (
    <Animated.View style={{ transform: [{ translateX }], opacity }}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: userTokens.surfaceAlt,
            borderColor: userTokens.border,
          },
        ]}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: userTokens.surface }]}>
            <CategoryIcon
              iconKey={iconKey}
              size={16}
              tone="muted"
              accessibilityLabel={item.categoryName}
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: userTokens.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.cardMeta, { color: userTokens.textSecondary }]} numberOfLines={1}>
              {metaParts.join(" · ")}
            </Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.cardAmount, { color: userTokens.textPrimary }]}>
            {amountLabel}
          </Text>
          <Pressable
            style={[styles.registerButton, { backgroundColor: primaryActionColor }]}
            onPress={handleRegister}
          >
            <Text style={[styles.registerButtonText, { color: primaryActionTextColor }]}>
              {t(dictionary, "transactions.ui.register")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: movementsDesignTokens.radius.md,
    borderWidth: 1,
    padding: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: movementsDesignTokens.typography.sizes.md,
    fontFamily: "DMSans-SemiBold",
  },
  headerCount: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans",
  },
  headerAmount: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans-SemiBold",
  },
  headerToggle: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans-Medium",
  },
  cards: {
    marginTop: 12,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: movementsDesignTokens.radius.md,
    borderWidth: 1,
    padding: 10,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: movementsDesignTokens.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: movementsDesignTokens.typography.sizes.md,
    fontFamily: "DMSans-Medium",
  },
  cardMeta: {
    marginTop: 2,
    fontSize: movementsDesignTokens.typography.sizes.xs,
    fontFamily: "DMSans",
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  cardAmount: {
    fontSize: movementsDesignTokens.typography.sizes.md,
    fontFamily: "DMSans-SemiBold",
  },
  registerButton: {
    borderRadius: movementsDesignTokens.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  registerButtonText: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    fontFamily: "DMSans-SemiBold",
  },
  registerAll: {
    marginTop: 12,
    borderRadius: movementsDesignTokens.radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  registerAllText: {
    fontFamily: "DMSans-SemiBold",
  },
});
