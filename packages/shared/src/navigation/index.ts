import type { CopyKey } from "../copy";

export type NavigationKey = "home" | "account" | "settings";

export type NavigationItem = {
  key: NavigationKey;
  labelKey: CopyKey;
};

export const navigationItems: NavigationItem[] = [
  { key: "home", labelKey: "navigation.home" },
  { key: "account", labelKey: "navigation.account" },
  { key: "settings", labelKey: "navigation.settings" },
];
