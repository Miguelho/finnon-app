import {
  DEFAULT_USER_THEME,
  DEFAULT_USER_THEME_MODE,
  USER_THEME_DEFINITIONS,
} from "@poleursus/shared";
import {
  USER_THEME_PREFERENCES_STORAGE_KEY,
  USER_THEME_PREHYDRATE_STYLE_ID,
} from "./user-theme-storage";

const PREHYDRATION_THEME_DEFINITIONS = Object.fromEntries(
  Object.entries(USER_THEME_DEFINITIONS).map(([themeId, definition]) => [
    themeId,
    {
      light: definition.light,
      dark: definition.dark,
    },
  ])
);

export function getThemePrehydrateScript(): string {
  return `
(() => {
  try {
    const STORAGE_KEY = ${JSON.stringify(USER_THEME_PREFERENCES_STORAGE_KEY)};
    const STYLE_ID = ${JSON.stringify(USER_THEME_PREHYDRATE_STYLE_ID)};
    const DEFAULT_THEME = ${JSON.stringify(DEFAULT_USER_THEME)};
    const DEFAULT_MODE = ${JSON.stringify(DEFAULT_USER_THEME_MODE)};
    const THEME_DEFINITIONS = ${JSON.stringify(PREHYDRATION_THEME_DEFINITIONS)};

    let styleElement = document.getElementById(STYLE_ID);
    if (!(styleElement instanceof HTMLStyleElement)) {
      styleElement = document.createElement("style");
      styleElement.id = STYLE_ID;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = "";

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    const theme =
      typeof parsed.theme === "string" ? parsed.theme : DEFAULT_THEME;
    const colorMode =
      typeof parsed.colorMode === "string" ? parsed.colorMode : DEFAULT_MODE;

    const definition = THEME_DEFINITIONS[theme] ?? THEME_DEFINITIONS[DEFAULT_THEME];
    if (!definition) return;

    const systemMode =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    const resolvedMode =
      colorMode === "system"
        ? systemMode
        : colorMode === "dark"
          ? "dark"
          : "light";

    const tokens = definition[resolvedMode];
    if (!tokens) return;

    const hexToHslToken = (hexColor) => {
      const normalized = String(hexColor || "").replace("#", "");
      const expanded =
        normalized.length === 3
          ? normalized
              .split("")
              .map((chunk) => chunk + chunk)
              .join("")
          : normalized;

      if (expanded.length !== 6) return "0 0% 100%";

      const red = parseInt(expanded.slice(0, 2), 16) / 255;
      const green = parseInt(expanded.slice(2, 4), 16) / 255;
      const blue = parseInt(expanded.slice(4, 6), 16) / 255;

      if ([red, green, blue].some((value) => Number.isNaN(value))) {
        return "0 0% 100%";
      }

      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const delta = max - min;

      let hue = 0;
      if (delta !== 0) {
        if (max === red) hue = ((green - blue) / delta) % 6;
        else if (max === green) hue = (blue - red) / delta + 2;
        else hue = (red - green) / delta + 4;
      }

      hue = Math.round((hue * 60 + 360) % 360);
      const lightness = (max + min) / 2;
      const saturation =
        delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

      const satPct = Math.round(saturation * 1000) / 10;
      const lightPct = Math.round(lightness * 1000) / 10;
      return hue + " " + satPct + "% " + lightPct + "%";
    };

    const getReadableTextColor = (hexColor) => {
      const normalized = String(hexColor || "").replace("#", "");
      const expanded =
        normalized.length === 3
          ? normalized
              .split("")
              .map((chunk) => chunk + chunk)
              .join("")
          : normalized;

      if (expanded.length !== 6) return "#FFFFFF";

      const red = parseInt(expanded.slice(0, 2), 16);
      const green = parseInt(expanded.slice(2, 4), 16);
      const blue = parseInt(expanded.slice(4, 6), 16);

      if ([red, green, blue].some((value) => Number.isNaN(value))) {
        return "#FFFFFF";
      }

      const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
      return luminance > 160 ? "#111111" : "#FFFFFF";
    };

    const primaryTextHex = getReadableTextColor(tokens.primary);
    const accountColors =
      resolvedMode === "dark"
        ? {
            income: "#22A06B",
            incomeBg: "#183026",
            incomeLight: "#24513F",
            expense: "#DE350B",
            expenseBg: "#382022",
            expenseLight: "#5A2E32",
            categoryCasa: "#3A3420",
            categoryFamilia: "#392633",
            categoryOcio: "#233148",
            categoryRestaurantes: "#3A2C1F",
            categoryInterests: "#1E3932",
            categoryLottery: "#2D2943",
            categoryDefault: "#2A2D34",
            categoryIcon: "#FFFFFF",
          }
        : {
            income: "#22A06B",
            incomeBg: "#E6F9F0",
            incomeLight: "#C8E6CD",
            expense: "#DE350B",
            expenseBg: "#FFF0E6",
            expenseLight: "#F8D7CF",
            categoryCasa: "#FEF3C7",
            categoryFamilia: "#FCE7F3",
            categoryOcio: "#E0E7FF",
            categoryRestaurantes: "#FFEDD5",
            categoryInterests: "#D1FAE5",
            categoryLottery: "#EDE9FE",
            categoryDefault: "#F3F4F6",
            categoryIcon: "#1A1A18",
          };

    styleElement.textContent = [
      ":root {",
      "--background: " + hexToHslToken(tokens.background) + ";",
      "--foreground: " + hexToHslToken(tokens.textPrimary) + ";",
      "--card: " + hexToHslToken(tokens.surface) + ";",
      "--card-foreground: " + hexToHslToken(tokens.textPrimary) + ";",
      "--popover: " + hexToHslToken(tokens.surface) + ";",
      "--popover-foreground: " + hexToHslToken(tokens.textPrimary) + ";",
      "--secondary: " + hexToHslToken(tokens.surfaceAlt) + ";",
      "--secondary-foreground: " + hexToHslToken(tokens.textPrimary) + ";",
      "--muted: " + hexToHslToken(tokens.surfaceAlt) + ";",
      "--muted-foreground: " + hexToHslToken(tokens.textSecondary) + ";",
      "--accent: " + hexToHslToken(tokens.surfaceAlt) + ";",
      "--accent-foreground: " + hexToHslToken(tokens.textPrimary) + ";",
      "--border: " + hexToHslToken(tokens.border) + ";",
      "--input: " + hexToHslToken(tokens.border) + ";",
      "--primary: " + hexToHslToken(tokens.primary) + ";",
      "--primary-foreground: " + hexToHslToken(primaryTextHex) + ";",
      "--ring: " + hexToHslToken(tokens.primary) + ";",
      "--account-bg: " + tokens.background + ";",
      "--account-surface: " + tokens.surface + ";",
      "--account-surface-alt: " + tokens.surfaceAlt + ";",
      "--account-border: " + tokens.border + ";",
      "--account-border-light: " + tokens.border + ";",
      "--account-text-primary: " + tokens.textPrimary + ";",
      "--account-text-secondary: " + tokens.textSecondary + ";",
      "--account-text-tertiary: " + tokens.textSecondary + ";",
      "--account-income: " + accountColors.income + ";",
      "--account-income-bg: " + accountColors.incomeBg + ";",
      "--account-income-light: " + accountColors.incomeLight + ";",
      "--account-expense: " + accountColors.expense + ";",
      "--account-expense-bg: " + accountColors.expenseBg + ";",
      "--account-expense-light: " + accountColors.expenseLight + ";",
      "--account-accent: " + tokens.primary + ";",
      "--account-accent-bg: " + tokens.surfaceAlt + ";",
      "--account-category-casa: " + accountColors.categoryCasa + ";",
      "--account-category-familia: " + accountColors.categoryFamilia + ";",
      "--account-category-ocio: " + accountColors.categoryOcio + ";",
      "--account-category-restaurantes: " + accountColors.categoryRestaurantes + ";",
      "--account-category-interests: " + accountColors.categoryInterests + ";",
      "--account-category-lottery: " + accountColors.categoryLottery + ";",
      "--account-category-default: " + accountColors.categoryDefault + ";",
      "--account-category-icon: " + accountColors.categoryIcon + ";",
      "--period-text-tertiary: " + tokens.textSecondary + ";",
      "color-scheme: " + resolvedMode + ";",
      "}",
    ].join("");
  } catch (_) {
    // no-op
  }
})();
`.trim();
}
