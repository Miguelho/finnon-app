import { Tabs } from "expo-router";
import { useCopy, t } from "../../../src/lib/i18n";
import { TabBarWithAdd } from "../../../src/components/navigation/TabBarWithAdd";

const tabItems = [
  { key: "home", labelKey: "navigation.home" },
  { key: "transactions", labelKey: "transactions.pageTitle" },
  { key: "projects", labelKey: "navigation.projects" },
  { key: "goal", labelKey: "goal.pageTitle" },
  { key: "account", labelKey: "navigation.account" },
] as const;

export default function TabsLayout() {
  const { dictionary } = useCopy();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBar: (props) => <TabBarWithAdd {...props} />,
      }}
      tabBar={(props) => <TabBarWithAdd {...props} />}
    >
      {tabItems.map((item) => (
        <Tabs.Screen
          key={item.key}
          name={item.key}
          options={{
            title: t(dictionary, item.labelKey),
            tabBarLabel: t(dictionary, item.labelKey),
            tabBarAccessibilityLabel: t(dictionary, item.labelKey),
          }}
        />
      ))}
    </Tabs>
  );
}
