import type { CopyKey } from "../copy";

export type NavigationKey = "home" | "account" | "settings" | "goal";

export type NavigationItem = {
  key: NavigationKey;
  labelKey: CopyKey;
};

export const navigationItems: NavigationItem[] = [
  { key: "home", labelKey: "navigation.home" },
  { key: "goal", labelKey: "navigation.goal" },
  { key: "account", labelKey: "navigation.account" },
  { key: "settings", labelKey: "navigation.settings" },
];
