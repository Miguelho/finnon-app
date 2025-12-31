export const themeTokens = {
  light: {
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    radii: {
      sm: 6,
      md: 10,
      lg: 16,
      pill: 999,
    },
    typography: {
      size: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 22,
        display: 28,
      },
      weight: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
    },
    colors: {
      bg: {
        primary: "#FFFFFF",
        secondary: "#F7F8FA",
        surface: "#FFFFFF",
      },
      text: {
        primary: "#1C1E21",
        secondary: "#5F6368",
        muted: "#9AA0A6",
      },
      action: {
        primary: "#5B8DFF",
        secondary: "#E8EEFF",
        disabled: "#C7D2FE",
      },
      state: {
        positive: "#2E7D65",
        negative: "#B23B3B",
        neutral: "#DADCE0",
      },
      shadow: {
        soft: "#0000001A",
      },
    },
  },
  dark: {
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    radii: {
      sm: 6,
      md: 10,
      lg: 16,
      pill: 999,
    },
    typography: {
      size: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 22,
        display: 28,
      },
      weight: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
    },
    colors: {
      bg: {
        primary: "#0E0F12",
        secondary: "#15171C",
        surface: "#1C1F26",
      },
      text: {
        primary: "#F1F3F4",
        secondary: "#B0B3B8",
        muted: "#7A7D81",
      },
      action: {
        primary: "#FFFFFF",
        secondary: "#2A2D34",
        disabled: "#3A3D44",
      },
      state: {
        positive: "#4CAF91",
        negative: "#E57373",
        neutral: "#2A2D34",
      },
      shadow: {
        soft: "#00000033",
      },
    },
  },
} as const;

export type ThemeTokens = typeof themeTokens.light;
