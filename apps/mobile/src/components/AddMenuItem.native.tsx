import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  HelpCircle,
  PlusCircle,
  RefreshCw,
  Repeat,
  Tag,
} from "lucide-react-native";
import {
  themeTokens,
  type AddActionIconName,
  type AddActionMeta,
} from "@poleursus/shared";
import { useUserTheme } from "../contexts/UserThemeContext";

const tokens = themeTokens.light;

const iconMap: Record<AddActionIconName, typeof HelpCircle> = {
  PlusCircle,
  Repeat,
  RefreshCw,
  Tag,
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
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const Icon = resolveIcon(meta);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: userTokens.border,
          backgroundColor: userTokens.surface,
        },
        pressed && styles.cardPressed,
        disabled && styles.cardDisabled,
      ]}
    >
      {({ pressed }) => (
        <>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: pressed
                  ? userTokens.surface
                  : userTokens.surfaceAlt,
                borderColor: primaryActionColor,
              },
              pressed && styles.badgePressed,
            ]}
          >
            <Icon
              color={pressed ? userTokens.textPrimary : userTokens.textTertiary}
              size={20}
              strokeWidth={2}
            />
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {meta.title}
            </Text>
            <Text style={[styles.description, { color: userTokens.textSecondary }]}>
              {meta.description}
            </Text>
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
  },
  cardPressed: {
    opacity: 0.95,
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
  },
  badgePressed: {
    borderWidth: 1,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: tokens.typography.weight.semibold,
  },
  description: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.regular,
  },
});
