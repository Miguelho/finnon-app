import { Tabs, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { themeTokens } from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";
import { tabBarBaseOptions, useStackScreenOptions } from "../../../src/lib/navigation-presets";

const tokens = themeTokens.light;

const tabIconMap = {
  home: { active: "home", inactive: "home-outline" },
  transactions: { active: "clipboard-list", inactive: "clipboard-list-outline" },
  goal: { active: "flag", inactive: "flag-outline" },
} as const;

const tabItems = [
  { key: "home", labelKey: "navigation.home" },
  { key: "transactions", labelKey: "transactions.pageTitle" },
  { key: "goal", labelKey: "goal.pageTitle" },
] as const;

export default function TabsLayout() {
  const { dictionary } = useCopy();
  const router = useRouter();
  const stackScreenOptions = useStackScreenOptions();

  return (
    <Tabs
      screenOptions={{
        ...tabBarBaseOptions,
        ...stackScreenOptions,
        headerShown: true,
      }}
    >
      {tabItems.map((item) => (
        <Tabs.Screen
          key={item.key}
          name={item.key}
          options={{
            title: t(dictionary, item.labelKey),
            tabBarLabel: t(dictionary, item.labelKey),
            tabBarAccessibilityLabel: t(dictionary, item.labelKey),
            headerShown: item.key !== "transactions",
            tabBarIcon: ({ focused, color }) => (
              <MaterialCommunityIcons
                name={focused ? tabIconMap[item.key].active : tabIconMap[item.key].inactive}
                size={tokens.typography.size.lg}
                color={color}
              />
            ),
          }}
          listeners={
            item.key === "transactions"
              ? {
                  tabPress: (event) => {
                    event.preventDefault();
                    router.replace("/(auth)/(tabs)/transactions");
                  },
                }
              : undefined
          }
        />
      ))}
    </Tabs>
  );
}
