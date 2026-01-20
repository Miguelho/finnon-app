import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { HeaderBackButton, type HeaderBackButtonProps } from "@react-navigation/elements";
import { themeTokens } from "@poleursus/shared";
import { AppHeaderAvatar } from "../components/navigation/AppHeaderAvatar";

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
      fontWeight: tokens.typography.weight.bold,
      color: colors.text.primary,
    },
    headerLeft: (props: HeaderBackButtonProps) =>
      props.canGoBack ? <HeaderBackButton {...props} /> : <AppHeaderAvatar />,
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
  tabBarActiveBackgroundColor: "transparent",
  tabBarActiveTintColor: colors.action.primary,
  tabBarInactiveTintColor: colors.text.secondary,
  tabBarLabelStyle: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
  },
  tabBarItemStyle: {
    flex: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBarStyle: {
    backgroundColor: colors.bg.primary,
    borderTopColor: colors.state.neutral,
    borderTopWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
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
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
  },
});
