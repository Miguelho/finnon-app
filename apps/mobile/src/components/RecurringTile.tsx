import { Pressable, StyleSheet, Text, View } from "react-native";
import { MoreHorizontal } from "lucide-react-native";
import { useActionSheet } from "@expo/react-native-action-sheet";
import {
  CURRENCIES,
  formatMinorToMoney,
  themeTokens,
  type RecurringItem,
  type CategoryIconKey,
  getNextOccurrence,
} from "@poleursus/shared";
import { useCopy, t } from "../lib/i18n";
import { CategoryIcon } from "./CategoryIcon";
import { useUserTheme } from "../contexts/UserThemeContext";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type RecurringTileProps = {
  recurringItem: RecurringItem & {
    category?: Category | null;
  };
  density?: "comfortable" | "compact";
  onPress?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPause?: (id: string, isPaused: boolean) => void;
  onEnd?: (id: string) => void;
};

const tokens = themeTokens.light;
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

const formatNextDate = (dateISO: string, locale: string) => {
  const date = new Date(dateISO);
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

export function RecurringTile({
  recurringItem,
  density = "comfortable",
  onPress,
  onEdit,
  onPause,
  onEnd,
}: RecurringTileProps) {
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, resolvedMode } = useUserTheme();
  const modeColors = themeTokens[resolvedMode].colors;
  const { showActionSheetWithOptions } = useActionSheet();
  const styles = densityStyles[density];
  const hasActions = Boolean(onEdit || onPause || onEnd);

  const amountMinor =
    typeof recurringItem.amount_minor === "bigint"
      ? recurringItem.amount_minor
      : BigInt(recurringItem.amount_minor);

  const currencySymbol =
    CURRENCIES.find((c) => c.code === recurringItem.currency)?.symbol ??
    recurringItem.currency;

  const amountValue = formatMinorToMoney(amountMinor, recurringItem.currency);
  const amountColor =
    recurringItem.type === "income"
      ? modeColors.state.positive
      : modeColors.state.negative;

  const displayName =
    recurringItem.merchant || t(dictionary, "recurrentes.namePlaceholder");

  // Build frequency label
  const frequencyLabel =
    recurringItem.frequency === "weekly"
      ? t(dictionary, "recurrentes.frequencyWeekly")
      : recurringItem.frequency === "monthly"
        ? t(dictionary, "recurrentes.frequencyMonthly")
        : t(dictionary, "recurrentes.frequencyYearly");

  // Get next occurrence
  const today = new Date().toISOString().slice(0, 10);
  const nextOccurrence = getNextOccurrence(recurringItem, today);
  const nextOccurrenceLabel = nextOccurrence
    ? t(dictionary, "recurrentes.nextOccurrence", {
        date: formatNextDate(nextOccurrence, locale),
      })
    : null;

  // Build meta line
  const metaParts: string[] = [frequencyLabel];
  if (nextOccurrenceLabel && !recurringItem.is_paused) {
    metaParts.push(nextOccurrenceLabel);
  }
  if (recurringItem.is_paused) {
    metaParts.push(t(dictionary, "recurrentes.paused"));
  }
  if (recurringItem.category?.name) {
    metaParts.push(recurringItem.category.name);
  }

  const handleOpenActions = () => {
    if (!hasActions) return;

    const editLabel = t(dictionary, "common.edit");
    const pauseLabel = recurringItem.is_paused
      ? t(dictionary, "recurrentes.resume")
      : t(dictionary, "recurrentes.pause");
    const endLabel = t(dictionary, "recurrentes.end");
    const cancelLabel = t(dictionary, "common.cancel");

    const options: string[] = [];
    const actionMap: { [key: number]: () => void } = {};

    if (onEdit) {
      actionMap[options.length] = () => onEdit(recurringItem.id);
      options.push(editLabel);
    }
    if (onPause) {
      actionMap[options.length] = () =>
        onPause(recurringItem.id, !recurringItem.is_paused);
      options.push(pauseLabel);
    }
    if (onEnd) {
      actionMap[options.length] = () => onEnd(recurringItem.id);
      options.push(endLabel);
    }
    options.push(cancelLabel);

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = onEnd ? options.indexOf(endLabel) : undefined;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
      },
      (buttonIndex) => {
        if (buttonIndex === undefined || buttonIndex === cancelButtonIndex)
          return;
        const action = actionMap[buttonIndex];
        if (action) action();
      }
    );
  };

  return (
    <Pressable
      onPress={onPress ? () => onPress(recurringItem.id) : undefined}
      style={({ pressed }) => [
        stylesText.container,
        styles.container,
        {
          backgroundColor: userTokens.surface,
        },
        pressed && onPress ? { backgroundColor: userTokens.surfaceAlt } : null,
        recurringItem.is_paused && stylesText.paused,
      ]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={displayName}
    >
      <View style={[stylesText.leading, { gap: styles.container.gap }]}>
        <View
          style={[
            stylesText.badge,
            {
              width: styles.badgeSize,
              height: styles.badgeSize,
              borderRadius: styles.badgeRadius,
              backgroundColor: userTokens.surfaceAlt,
            },
          ]}
        >
          <CategoryIcon
            iconKey={recurringItem.category?.icon_id as CategoryIconKey}
            size={styles.iconSize}
            tone="muted"
            accessibilityLabel={recurringItem.category?.name}
          />
        </View>

        <View style={stylesText.content}>
          <Text
            style={[stylesText.merchant, { color: userTokens.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayName}
          </Text>
          <Text
            style={[stylesText.meta, { color: userTokens.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {metaParts.join(" · ")}
          </Text>
        </View>
      </View>

      <View style={stylesText.trailing}>
        <View style={stylesText.amountRow}>
          <Text style={[stylesText.amountMuted, { color: userTokens.textTertiary }]}>
            {recurringItem.type === "expense" ? "-" : ""}
            {currencySymbol}
          </Text>
          <Text style={[stylesText.amountValue, { color: amountColor }]}>
            {amountValue}
          </Text>
        </View>

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
            <MoreHorizontal size={18} color={userTokens.textSecondary} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const stylesText = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paused: {
    opacity: 0.6,
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
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  merchant: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: typography.size.sm,
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
  },
  amountValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  actionsButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
