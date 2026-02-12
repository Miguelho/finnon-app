import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  isCategoryIconKey,
  formatMinorToMoney,
  withAlpha,
} from "@poleursus/shared";
import { CategoryIcon } from "../CategoryIcon";
import { UserAvatar } from "../UserAvatar";
import { movementsDesignTokens, type Movement, type UserProfile } from "../../types/movements";
import { useUserTheme } from "../../contexts/UserThemeContext";

type MovementRowProps = {
  movement: Movement;
  profile?: UserProfile;
  currencyCode: string;
  currencySymbol: string;
  variant?: "default" | "pending";
  onPress?: (id: string) => void;
};

const movementColors = movementsDesignTokens.colors;

export function MovementRow({
  movement,
  profile,
  currencyCode,
  currencySymbol,
  variant = "default",
  onPress,
}: MovementRowProps) {
  const { tokens: userTokens } = useUserTheme();
  const amountColor =
    movement.type === "income"
      ? movementColors.incomeGreen
      : movementColors.expenseRed;
  const amountOpacity = variant === "pending" ? 0.7 : 1;
  const formatted = formatMinorToMoney(
    movement.amountMinor < 0n ? -movement.amountMinor : movement.amountMinor,
    currencyCode
  );
  const amountLabel =
    movement.type === "expense"
      ? `-${currencySymbol}${formatted}`
      : `${currencySymbol}${formatted}`;

  const iconKey = isCategoryIconKey(movement.categoryIconId)
    ? movement.categoryIconId
    : "Receipt";

  return (
    <Pressable
      onPress={onPress ? () => onPress(movement.id) : undefined}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: userTokens.surface,
          borderColor: userTokens.border,
        },
        variant === "pending" && {
          backgroundColor: withAlpha(movementColors.pendingAmber, 0.14),
          borderColor: withAlpha(movementColors.pendingAmber, 0.34),
        },
        pressed && onPress ? styles.rowPressed : null,
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: userTokens.surfaceAlt }]}>
        <CategoryIcon
          iconKey={iconKey}
          size={18}
          tone="muted"
          accessibilityLabel={movement.categoryName}
        />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: userTokens.textPrimary }]} numberOfLines={1}>
          {movement.title}
        </Text>
        <Text style={[styles.meta, { color: userTokens.textSecondary }]} numberOfLines={1}>
          {movement.categoryName}
          {movement.subcategory ? ` · ${movement.subcategory}` : ""}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Text style={[styles.amount, { color: amountColor, opacity: amountOpacity }]}>
          {amountLabel}
        </Text>
        <UserAvatar
          email={profile?.email ?? null}
          userId={movement.userId}
          avatarPath={profile?.avatar_path ?? null}
          fallbackText={profile?.avatar_fallback_text ?? null}
          fallbackBgToken={profile?.avatar_fallback_bg_token ?? null}
          avatarColor={profile?.avatar_color ?? null}
          size={20}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: movementsDesignTokens.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowPressed: {
    opacity: 0.85,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: movementsDesignTokens.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: movementsDesignTokens.typography.sizes.md,
    fontFamily: "DMSans-Medium",
  },
  meta: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans",
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6,
  },
  amount: {
    fontSize: movementsDesignTokens.typography.sizes.md,
    fontFamily: "DMSans-SemiBold",
  },
});
