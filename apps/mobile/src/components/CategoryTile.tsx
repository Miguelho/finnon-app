import { Pressable, StyleSheet, Text, View } from "react-native";
import { MoreHorizontal } from "lucide-react-native";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { themeTokens, type CategoryIconKey } from "@poleursus/shared";
import { useCopy, t } from "../lib/i18n";
import { CategoryIcon } from "./CategoryIcon";

type CategoryTileProps = {
  category: {
    id: string;
    name: string;
    icon_id: string;
    type: "income" | "expense";
  };
  density?: "comfortable" | "compact";
  onPress?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
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

export function CategoryTile({
  category,
  density = "comfortable",
  onPress,
  onEdit,
  onDelete,
}: CategoryTileProps) {
  const { dictionary } = useCopy();
  const { showActionSheetWithOptions } = useActionSheet();
  const styles = densityStyles[density];
  const hasActions = Boolean(onEdit || onDelete);

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
          onEdit(category.id);
          return;
        }
        if (onDelete) {
          onDelete(category.id);
        }
      }
    );
  };

  return (
    <Pressable
      onPress={onPress ? () => onPress(category.id) : undefined}
      style={({ pressed }) => [
        stylesText.container,
        styles.container,
        pressed && onPress ? stylesText.pressed : null,
      ]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={category.name}
    >
      <View style={[stylesText.leading, { gap: styles.container.gap }]}>
        <View
          style={[
            stylesText.badge,
            {
              width: styles.badgeSize,
              height: styles.badgeSize,
              borderRadius: styles.badgeRadius,
            },
          ]}
        >
          <CategoryIcon
            iconKey={category.icon_id as CategoryIconKey}
            size={styles.iconSize}
            tone="muted"
            accessibilityLabel={category.name}
          />
        </View>

        <View style={stylesText.content}>
          <Text
            style={stylesText.categoryName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {category.name}
          </Text>
        </View>
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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MoreHorizontal size={18} color={colors.text.muted} />
        </Pressable>
      )}
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
    alignItems: "center",
    minWidth: 0,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.secondary,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  categoryName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  actionsButton: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
