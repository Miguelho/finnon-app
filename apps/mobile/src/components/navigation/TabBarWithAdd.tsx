import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { themeTokens, type AddActionKey } from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { AddActionSheet } from "../AddActionSheet";
import { useCopy, t } from "../../lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;

const tabLabelKeys = {
  home: "navigation.home",
  transactions: "transactions.pageTitle",
  goal: "goal.pageTitle",
  account: "navigation.account",
} as const;

const tabIconMap = {
  home: { active: "home", inactive: "home-outline" },
  transactions: { active: "clipboard-list", inactive: "clipboard-list-outline" },
  goal: { active: "flag", inactive: "flag-outline" },
  account: { active: "bookmark", inactive: "bookmark-outline" },
} as const;

export function TabBarWithAdd({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { dictionary } = useCopy();
  const {
    tokens: userTokens,
    primaryActionColor,
    primaryActionTextColor,
  } = useUserTheme();

  const handleAddAction = (key: AddActionKey) => {
    switch (key) {
      case "movement":
        router.push("/(auth)/(tabs)/transactions/create");
        return;
      case "category":
        router.push("/(auth)/(tabs)/account/categories/create");
        return;
      case "recurring":
        router.push("/(auth)/(tabs)/transactions/create?type=expense&kind=recurring");
        return;
    }
  };

  const routes = state.routes as Array<{ key: string; name: keyof typeof tabLabelKeys }>;
  const leftRoutes = routes.slice(0, 2);
  const rightRoutes = routes.slice(2);

  const renderTab = (route: { key: string; name: keyof typeof tabLabelKeys }, index: number) => {
    const isFocused = state.index === index;
    const label = t(dictionary, tabLabelKeys[route.name]);
    const iconName = isFocused
      ? tabIconMap[route.name].active
      : tabIconMap[route.name].inactive;
    const shouldResetToRoot = route.name === "transactions" || route.name === "account";

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (event.defaultPrevented) return;

      if (!isFocused || shouldResetToRoot) {
        if (shouldResetToRoot) {
          navigation.navigate(route.name, { screen: "index" });
          return;
        }
        navigation.navigate(route.name);
      }
    };

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        style={styles.tabButton}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <MaterialCommunityIcons
          name={iconName}
          size={tokens.typography.size.lg}
          color={isFocused ? primaryActionColor : userTokens.textSecondary}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? primaryActionColor : userTokens.textSecondary },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: userTokens.background,
          borderTopColor: userTokens.border,
        },
        { paddingBottom: Math.max(insets.bottom, tokens.spacing.md) },
      ]}
    >
      {leftRoutes.map((route, index) => renderTab(route, index))}
      <AddActionSheet
        sheetTitle={t(dictionary, "mobile.home.addTitle")}
        fabLabel={t(dictionary, "home.addCta")}
        onAction={handleAddAction}
        renderTrigger={(open) => (
          <TouchableOpacity
            onPress={open}
            style={[styles.addButton, { backgroundColor: primaryActionColor }]}
            accessibilityRole="button"
            accessibilityLabel={t(dictionary, "home.addCta")}
          >
            <MaterialCommunityIcons name="plus" size={22} color={primaryActionTextColor} />
          </TouchableOpacity>
        )}
      />
      {rightRoutes.map((route, index) => renderTab(route, index + leftRoutes.length))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderTopWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.spacing.xs,
  },
  tabLabel: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
    marginTop: 2,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
