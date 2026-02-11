require("dotenv").config();

module.exports = {
  expo: {
    name: "Finnon",
    slug: "finnon-mobile",
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
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.poleursus.finnonapp",
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
    },
  },
};
