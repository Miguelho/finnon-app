import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useActionSheet } from "@expo/react-native-action-sheet";
import {
  CURRENCIES,
  formatMinorToMoney,
  themeTokens,
  withAlpha,
  isFutureDay,
  type AvatarColorToken,
  type CategoryIconKey,
} from "@poleursus/shared";
import { useCopy, t } from "../lib/i18n";
import { CategoryIcon } from "./CategoryIcon";
import { UserAvatar } from "./UserAvatar";

type TransactionTileProps = {
  transaction: {
    id: string;
    merchant: string;
    category?: { id: string; name: string; icon: string };
    notes?: string | null;
    date: string | Date;
    amount: bigint;
    currency: string;
    createdBy?: {
      initial: string;
      userId?: string | null;
      email?: string | null;
      avatarPath?: string | null;
      fallbackText?: string | null;
      fallbackBgToken?: AvatarColorToken | null;
      label?: string;
    };
    accountName?: string;
    type?: "income" | "expense";
  };
  density?: "comfortable" | "compact";
  onPress?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showAccountName?: boolean;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const spacing = tokens.spacing;
const radii = tokens.radii;
const typography = tokens.typography;

const densityStyles = {
  comfortable: {
    container: { paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
    badgeSize: 36,
    badgeRadius: 12,
    iconSize: 18,
  },
  compact: {
    container: { paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
    badgeSize: 32,
    badgeRadius: 10,
    iconSize: 16,
  },
};

const formatDateLabel = (value: string | Date, locale: string) =>
  new Date(value).toLocaleDateString(locale);
export function TransactionTile({
  transaction,
  density = "comfortable",
  onPress,
  onEdit,
  onDelete,
  showAccountName = false,
}: TransactionTileProps) {
  const { dictionary, locale } = useCopy();
  const { showActionSheetWithOptions } = useActionSheet();
  const styles = densityStyles[density];
  const hasActions = Boolean(onEdit || onDelete);
  const transactionType =
    transaction.type ??
    (transaction.amount >= 0n ? ("income" as const) : ("expense" as const));
  const absoluteAmount =
    transaction.amount < 0n ? -transaction.amount : transaction.amount;
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === transaction.currency)
      ?.symbol ?? transaction.currency;
  const amountValue = formatMinorToMoney(absoluteAmount, transaction.currency);
  const isPending = isFutureDay(transaction.date);
  const baseAmountColor =
    transactionType === "income"
      ? colors.state.positive
      : colors.state.negative;
  const amountColor = isPending
    ? withAlpha(baseAmountColor, 0.55)
    : baseAmountColor;
  const displayMerchant = transaction.merchant;
  const categoryName = transaction.category?.name;
  const metaParts = [formatDateLabel(transaction.date, locale)];

  if (categoryName && categoryName !== displayMerchant) {
    metaParts.push(categoryName);
  }

  if (showAccountName && transaction.accountName) {
    metaParts.push(transaction.accountName);
  }

  if (transaction.notes?.trim()) {
    metaParts.push(transaction.notes.trim());
  }

  const handleOpenActions = () => {
    if (!hasActions) return;
    const editLabel = t(dictionary, "common.edit");
    const deleteLabel = t(dictionary, "common.delete");
    const cancelLabel = t(dictionary, "common.cancel");
    const options = [];
    if (onEdit) options.push(editLabel);
    if (onDelete) options.push(deleteLabel);
    options.push(cancelLabel);
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = onDelete
      ? options.indexOf(deleteLabel)
      : undefined;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
      },
      (buttonIndex) => {
        if (buttonIndex === undefined || buttonIndex === cancelButtonIndex) return;
        if (onEdit && buttonIndex === 0) {
          onEdit(transaction.id);
          return;
        }
        if (onDelete) {
          onDelete(transaction.id);
        }
      }
    );
  };

  return (
    <Pressable
      onPress={onPress ? () => onPress(transaction.id) : undefined}
      style={({ pressed }) => [
        stylesText.container,
        styles.container,
        pressed && onPress ? stylesText.pressed : null,
      ]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={displayMerchant}
    >
      <View style={[stylesText.leading, { gap: styles.container.gap }]}>
        <View
          style={[
            stylesText.badge,
            isPending && stylesText.pendingOpacity,
            {
              width: styles.badgeSize,
              height: styles.badgeSize,
              borderRadius: styles.badgeRadius,
            },
          ]}
        >
          <CategoryIcon
            iconKey={transaction.category?.icon as CategoryIconKey}
            size={styles.iconSize}
            tone="muted"
            accessibilityLabel={transaction.category?.name}
          />
        </View>

        <View style={stylesText.content}>
          <Text
            style={stylesText.merchant}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayMerchant}
          </Text>
          <View style={stylesText.metaRow}>
            <Text
              style={stylesText.meta}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {metaParts.join(" • ")}
            </Text>
            {isPending && (
              <View style={stylesText.pendingChip}>
                <Text style={stylesText.pendingChipText}>
                  {t(dictionary, "common.pendingLabel")}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={stylesText.trailing}>
        <View style={stylesText.amountRow}>
          <Text style={stylesText.amountMuted}>
            {transactionType === "expense" ? "-" : ""}
            {currencySymbol}
          </Text>
          <Text style={[stylesText.amountValue, { color: amountColor }]}>
            {amountValue}
          </Text>
        </View>

        <View style={stylesText.trailingBottom}>
          {transaction.createdBy && (
            <UserAvatar
              email={transaction.createdBy.email ?? null}
              userId={transaction.createdBy.userId ?? null}
              avatarPath={transaction.createdBy.avatarPath ?? null}
              fallbackText={
                transaction.createdBy.fallbackText ??
                transaction.createdBy.initial ??
                null
              }
              fallbackBgToken={transaction.createdBy.fallbackBgToken ?? null}
              size={24}
              label={transaction.createdBy.label}
            />
          )}
          {hasActions && (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                handleOpenActions();
              }}
              accessibilityRole="button"
              accessibilityLabel={t(dictionary, "common.moreActions")}
              style={stylesText.actionsButton}
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={18}
                color={colors.text.muted}
              />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const stylesText = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg.primary,
  },
  pressed: {
    backgroundColor: colors.action.secondary,
  },
  leading: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    minWidth: 0,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.secondary,
  },
  pendingOpacity: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  merchant: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  meta: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  pendingChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.state.neutral,
  },
  pendingChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
  },
  trailing: {
    alignItems: "flex-end",
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  amountMuted: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.muted,
  },
  amountValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  trailingBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionsButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
