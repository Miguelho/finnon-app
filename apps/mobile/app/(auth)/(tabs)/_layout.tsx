import { Tabs, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { themeTokens } from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";
import { tabBarBaseOptions } from "../../../src/lib/navigation-presets";

const tokens = themeTokens.light;

const tabIconMap = {
  home: { active: "home", inactive: "home-outline" },
  transactions: { active: "clipboard-list", inactive: "clipboard-list-outline" },
  account: { active: "account-circle", inactive: "account-circle-outline" },
} as const;

const tabItems = [
  { key: "home", labelKey: "navigation.home" },
  { key: "transactions", labelKey: "transactions.pageTitle" },
  { key: "account", labelKey: "navigation.account" },
] as const;

export default function TabsLayout() {
  const { dictionary } = useCopy();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={tabBarBaseOptions}
    >
      {tabItems.map((item) => (
        <Tabs.Screen
          key={item.key}
          name={item.key}
          options={{
            title: t(dictionary, item.labelKey),
            tabBarLabel: t(dictionary, item.labelKey),
            tabBarAccessibilityLabel: t(dictionary, item.labelKey),
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
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
