import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { themeTokens } from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

type HeaderTitleProps = {
  children?: string;
  maxWidth: number;
};

function HeaderTitle({ children, maxWidth }: HeaderTitleProps) {
  const title = typeof children === "string" ? children : "";

  return (
    <View style={[styles.headerTitleContainer, { maxWidth }]}>
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.headerTitleText}>
        {title}
      </Text>
    </View>
  );
}

export function useStackScreenOptions() {
  const { width } = useWindowDimensions();
  const titleMaxWidth = Math.max(0, width - tokens.spacing.xxxl * 2);

  return {
    headerTitle: ({ children }: { children?: string }) => (
      <HeaderTitle maxWidth={titleMaxWidth}>{children}</HeaderTitle>
    ),
    headerTitleContainerStyle: {
      maxWidth: titleMaxWidth,
      marginHorizontal: tokens.spacing.lg,
    },
    headerTitleAlign: "center" as const,
    headerTitleStyle: {
      fontSize: tokens.typography.size.md,
      fontWeight: tokens.typography.weight.semibold,
      color: colors.text.primary,
    },
    headerTintColor: colors.text.primary,
    headerStyle: {
      backgroundColor: colors.bg.primary,
    },
    headerShadowVisible: false,
    headerBackTitleVisible: false,
  };
}

export const tabBarBaseOptions = {
  headerShown: false,
  tabBarShowIcon: true,
  tabBarActiveBackgroundColor: colors.bg.secondary,
  tabBarActiveTintColor: colors.text.primary,
  tabBarInactiveTintColor: colors.text.secondary,
  tabBarLabelStyle: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
  },
  tabBarItemStyle: {
    flex: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBarStyle: {
    backgroundColor: colors.bg.primary,
    borderTopColor: colors.state.neutral,
    borderTopWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.md,
    shadowColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
};

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexShrink: 1,
    alignItems: "center",
  },
  headerTitleText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
});
