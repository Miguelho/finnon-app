import { Stack } from "expo-router";
import { AuthProvider } from "../src/contexts/AuthContext";
import { LocaleProvider, useCopy, t } from "../src/lib/i18n";

function RootLayoutNav() {
  const { dictionary } = useCopy();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: true, title: t(dictionary, "common.appName") }}
      />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </LocaleProvider>
  );
}
