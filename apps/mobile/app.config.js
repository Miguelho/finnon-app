require("dotenv").config();

module.exports = {
  expo: {
    name: "Finnon",
    owner: "poleursus",
    slug: "finnon-app",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      dark: {
        image: "./assets/splash-dark.png",
        resizeMode: "contain",
        backgroundColor: "#0E0F12",
      },
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.poleursus.finnonapp",
      associatedDomains: ["applinks:finnon.app"],
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.poleursus.finnonapp",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "finnon.app",
              pathPrefix: "/auth/confirm",
            },
            {
              scheme: "https",
              host: "finnon.app",
              pathPrefix: "/auth/callback",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    scheme: "finnon",
    plugins: [
      "expo-router",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow Finnon to access your photos to set your avatar.",
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      eas: {
        projectId: "e89e0bcd-c347-47df-87ce-1f6ea0d5a8f0",
      },
    },
  },
};
