import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  HelpCircle,
  PlusCircle,
  RefreshCw,
  Repeat,
} from "lucide-react-native";
import {
  themeTokens,
  type AddActionIconName,
  type AddActionMeta,
} from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

const iconMap: Record<AddActionIconName, typeof HelpCircle> = {
  PlusCircle,
  Repeat,
  RefreshCw,
};

type AddMenuItemProps = {
  meta: AddActionMeta;
  onPress: () => void;
  disabled?: boolean;
};

const resolveIcon = (meta: AddActionMeta) =>
  iconMap[meta.icon] ??
  (meta.iconFallback ? iconMap[meta.iconFallback] : undefined) ??
  HelpCircle;

export function AddMenuItem({
  meta,
  onPress,
  disabled = false,
}: AddMenuItemProps) {
  const Icon = resolveIcon(meta);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        disabled && styles.cardDisabled,
      ]}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.badge, pressed && styles.badgePressed]}>
            <Icon
              color={pressed ? colors.text.primary : colors.text.muted}
              size={20}
              strokeWidth={2}
            />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title}>{meta.title}</Text>
            <Text style={styles.description}>{meta.description}</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.surface,
  },
  cardPressed: {
    opacity: 0.96,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.secondary,
  },
  badgePressed: {
    backgroundColor: colors.action.secondary,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  description: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.regular,
    color: colors.text.muted,
  },
});
