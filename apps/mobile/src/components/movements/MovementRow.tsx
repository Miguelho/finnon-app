import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Trash2 } from "lucide-react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
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
  onDelete?: (id: string) => void;
  deleteLabel?: string;
};

const movementColors = movementsDesignTokens.colors;

export function MovementRow({
  movement,
  profile,
  currencyCode,
  currencySymbol,
  variant = "default",
  onPress,
  onDelete,
  deleteLabel = "Eliminar",
}: MovementRowProps) {
  const { tokens: userTokens } = useUserTheme();
  const swipeableRef = useRef<Swipeable | null>(null);
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

  const rowContent = (
    <Pressable
      onPress={onPress ? () => onPress(movement.id) : undefined}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: userTokens.surface,
          borderColor: userTokens.border,
        },
        variant === "pending" && {
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
          displayName={profile?.display_name ?? null}
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

  if (!onDelete) {
    return <View style={styles.rowWrapper}>{rowContent}</View>;
  }

  return (
    <View style={styles.rowWrapper}>
      <Swipeable
        ref={swipeableRef}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable
            onPress={() => {
              swipeableRef.current?.close();
              onDelete(movement.id);
            }}
            style={styles.deleteAction}
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
          >
            <Trash2 size={16} color="#fff" />
            <Text style={styles.deleteText}>{deleteLabel}</Text>
          </Pressable>
        )}
      >
        {rowContent}
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrapper: {
    marginBottom: 8,
    borderRadius: movementsDesignTokens.radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: movementsDesignTokens.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  deleteAction: {
    width: 96,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: movementColors.expenseRed,
    borderRadius: movementsDesignTokens.radius.md,
  },
  deleteText: {
    color: "#fff",
    fontSize: movementsDesignTokens.typography.sizes.xs,
    fontFamily: "DMSans-SemiBold",
  },
});
