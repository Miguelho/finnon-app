import type { PropsWithChildren } from "react";
import { StyleSheet, type StyleProp, type ViewStyle, View } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

const tokens = themeTokens.light;

type SummaryCardShellProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function SummaryCardShell({ children, style }: SummaryCardShellProps) {
  const { tokens: userTokens } = useUserTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: userTokens.surface, borderColor: userTokens.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
  },
});
