import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  MoreHorizontal,
} from "lucide-react-native";
import { useActionSheet } from "@expo/react-native-action-sheet";
import {
  CURRENCIES,
  formatMinorToMoney,
  themeTokens,
  type RecurringItem,
  type CategoryIconKey,
} from "@poleursus/shared";
import { useCopy, t } from "../lib/i18n";
import { CategoryIcon } from "./CategoryIcon";
import { useUserTheme } from "../contexts/UserThemeContext";

type Category = {
  id?: string | null;
  name?: string | null;
  icon_id?: string | null;
  type?: "income" | "expense";
};

type StatusBadge = {
  label: string;
  tone: "positive" | "neutral" | "muted";
};

type TrendBadge = {
  label: string;
  tone: "positive" | "negative" | "neutral";
};

type RecurringTileProps = {
  recurringItem: RecurringItem & {
    category?: Category | null;
  };
  density?: "comfortable" | "compact";
  detailLabel?: string | null;
  statusBadge?: StatusBadge | null;
  trend?: TrendBadge | null;
  categoryColor?: string | null;
  showLeadingAccent?: boolean;
  onPress?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPause?: (id: string, isPaused: boolean) => void;
  onEnd?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const tokens = themeTokens.light;
const spacing = tokens.spacing;
const radii = tokens.radii;
const typography = tokens.typography;

const densityStyles = {
  comfortable: {
    container: { paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
    badgeSize: 40,
    badgeRadius: 14,
    iconSize: 18,
  },
  compact: {
    container: { paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
    badgeSize: 36,
    badgeRadius: 12,
    iconSize: 16,
  },
};

export function RecurringTile({
  recurringItem,
  density = "comfortable",
  detailLabel,
  statusBadge,
  trend,
  categoryColor,
  showLeadingAccent = false,
  onPress,
  onEdit,
  onPause,
  onEnd,
  onDelete,
}: RecurringTileProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, resolvedMode } = useUserTheme();
  const modeColors = themeTokens[resolvedMode].colors;
  const { showActionSheetWithOptions } = useActionSheet();
  const styles = densityStyles[density];
  const hasActions = Boolean(onEdit || onPause || onEnd || onDelete);

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
  const categoryName = recurringItem.category?.name || undefined;

  const displayName =
    recurringItem.merchant || t(dictionary, "recurrentes.namePlaceholder");

  const frequencyLabel =
    recurringItem.frequency === "weekly"
      ? t(dictionary, "recurrentes.frequencyWeekly")
      : recurringItem.frequency === "monthly"
        ? t(dictionary, "recurrentes.frequencyMonthly")
        : t(dictionary, "recurrentes.frequencyYearly");

  const metaParts = [frequencyLabel];
  if (detailLabel) metaParts.push(detailLabel);

  const handleOpenActions = () => {
    if (!hasActions) return;

    const editLabel = t(dictionary, "common.edit");
    const pauseLabel = recurringItem.is_paused
      ? t(dictionary, "recurrentes.resume")
      : t(dictionary, "recurrentes.pause");
    const endLabel = t(dictionary, "recurrentes.end");
    const deleteLabel = t(dictionary, "recurrentes.delete");
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
    if (onDelete) {
      actionMap[options.length] = () => onDelete(recurringItem.id);
      options.push(deleteLabel);
    }
    options.push(cancelLabel);

    const cancelButtonIndex = options.length - 1;
    const destructiveIndices: number[] = [];
    if (onEnd) destructiveIndices.push(options.indexOf(endLabel));
    if (onDelete) destructiveIndices.push(options.indexOf(deleteLabel));
    const destructiveButtonIndex = destructiveIndices.length > 0 ? destructiveIndices : undefined;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
      },
      (buttonIndex) => {
        if (buttonIndex === undefined || buttonIndex === cancelButtonIndex) return;
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
          borderLeftWidth: showLeadingAccent ? 3 : 0,
          borderLeftColor: modeColors.state.positive,
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
              borderWidth: 1,
              borderColor: userTokens.border,
            },
          ]}
        >
          <CategoryIcon
            iconKey={recurringItem.category?.icon_id as CategoryIconKey}
            size={styles.iconSize}
            tone="muted"
            accessibilityLabel={categoryName}
          />
        </View>

        <View style={stylesText.content}>
          <View style={stylesText.titleRow}>
            <Text
              style={[stylesText.merchant, { color: userTokens.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayName}
            </Text>
            {statusBadge ? (
              <View
                style={[
                  stylesText.statusBadge,
                  statusBadge.tone === "positive"
                    ? { backgroundColor: `${modeColors.state.positive}1F` }
                    : statusBadge.tone === "neutral"
                      ? { backgroundColor: userTokens.surfaceAlt }
                      : { backgroundColor: `${userTokens.textSecondary}1A` },
                ]}
              >
                <Text
                  style={[
                    stylesText.statusBadgeText,
                    {
                      color:
                        statusBadge.tone === "positive"
                          ? modeColors.state.positive
                          : statusBadge.tone === "neutral"
                            ? userTokens.textPrimary
                            : userTokens.textSecondary,
                    },
                  ]}
                >
                  {statusBadge.label}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={stylesText.metaRow}>
            <Text
              style={[stylesText.meta, { color: userTokens.textSecondary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {metaParts.join(" · ")}
            </Text>
            {recurringItem.category?.name ? (
              <View style={stylesText.categoryRow}>
                <View
                  style={[
                    stylesText.categoryDot,
                    { backgroundColor: categoryColor ?? userTokens.textSecondary },
                  ]}
                />
                <Text style={[stylesText.meta, { color: userTokens.textSecondary }]}>
                  {recurringItem.category.name}
                </Text>
              </View>
            ) : null}
          </View>
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

        {trend ? (
          <View style={stylesText.trendRow}>
            {trend.tone === "positive" ? (
              <ArrowDownRight
                size={14}
                color={modeColors.state.positive}
                strokeWidth={2}
              />
            ) : trend.tone === "negative" ? (
              <ArrowUpRight
                size={14}
                color={modeColors.state.negative}
                strokeWidth={2}
              />
            ) : (
              <Minus size={14} color={userTokens.textSecondary} strokeWidth={2} />
            )}
            <Text
              style={[
                stylesText.trendText,
                {
                  color:
                    trend.tone === "positive"
                      ? modeColors.state.positive
                      : trend.tone === "negative"
                        ? modeColors.state.negative
                        : userTokens.textSecondary,
                },
              ]}
            >
              {trend.label}
            </Text>
          </View>
        ) : null}
      </View>

      {hasActions ? (
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
      ) : null}
    </Pressable>
  );
}

const stylesText = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  merchant: {
    flexShrink: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metaRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  meta: {
    fontSize: typography.size.sm,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  trailing: {
    alignItems: "flex-end",
    marginLeft: spacing.sm,
    gap: 4,
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
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  trendText: {
    fontSize: 11,
    fontWeight: typography.weight.medium,
  },
  actionsButton: {
    width: 28,
    height: 28,
    marginLeft: spacing.sm,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
