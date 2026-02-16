import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { type HeaderBackButtonProps } from "@react-navigation/elements";
import { themeTokens } from "@poleursus/shared";
import { useAuth } from "../contexts/AuthContext";
import { useUserTheme } from "../contexts/UserThemeContext";
import { AppHeaderAvatar } from "../components/navigation/AppHeaderAvatar";
import { AppHeaderBackButton } from "../components/navigation/AppHeaderBackButton";
import { AppHeaderActivityButton } from "../components/navigation/AppHeaderActivityButton";

const tokens = themeTokens.light;
const colors = tokens.colors;

type HeaderTitleProps = {
  children?: string;
  maxWidth: number;
  textColor: string;
};

function HeaderTitle({ children, maxWidth, textColor }: HeaderTitleProps) {
  const title = typeof children === "string" ? children : "";

  return (
    <View style={[styles.headerTitleContainer, { maxWidth }]}>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.headerTitleText, { color: textColor }]}
      >
        {title}
      </Text>
    </View>
  );
}

export function useStackScreenOptions() {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { tokens: userTokens } = useUserTheme();
  const titleMaxWidth = Math.max(0, width - tokens.spacing.xxxl * 2);
  const shellBackground = session ? userTokens.background : colors.bg.primary;
  const shellTextPrimary = session ? userTokens.textPrimary : colors.text.primary;

  return {
    headerTitle: ({ children }: { children?: string }) => (
      <HeaderTitle maxWidth={titleMaxWidth} textColor={shellTextPrimary}>
        {children}
      </HeaderTitle>
    ),
    headerTitleContainerStyle: {
      maxWidth: titleMaxWidth,
      marginHorizontal: tokens.spacing.lg,
    },
    headerTitleAlign: "left" as const,
    headerTitleStyle: {
      fontSize: tokens.typography.size.lg,
      fontWeight: tokens.typography.weight.bold,
      color: shellTextPrimary,
    },
    headerLeft: (props: HeaderBackButtonProps) => <AppHeaderBackButton {...props} />,
    headerRight: () => (
      <View style={styles.headerRight}>
        <AppHeaderActivityButton />
        <AppHeaderAvatar />
      </View>
    ),
    headerTintColor: shellTextPrimary,
    headerStyle: {
      backgroundColor: shellBackground,
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitleContainer: {
    flexShrink: 1,
    alignItems: "flex-start",
  },
  headerTitleText: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
  },
});
