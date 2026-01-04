import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { themeTokens, navigationItems } from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";
import { tabBarBaseOptions } from "../../../src/lib/navigation-presets";

const tokens = themeTokens.light;

const tabIconMap = {
  home: { active: "home", inactive: "home-outline" },
  account: { active: "account-group", inactive: "account-group-outline" },
  settings: { active: "cog", inactive: "cog-outline" },
} as const;

export default function TabsLayout() {
  const { dictionary } = useCopy();

  return (
    <Tabs
      screenOptions={tabBarBaseOptions}
    >
      {navigationItems.map((item) => (
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
        />
      ))}
    </Tabs>
  );
}
