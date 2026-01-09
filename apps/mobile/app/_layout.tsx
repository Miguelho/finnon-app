import { Stack } from "expo-router";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { AuthProvider } from "../src/contexts/AuthContext";
import { NetworkNoticeProvider } from "../src/contexts/NetworkNoticeContext";
import { LocaleProvider, useCopy, t } from "../src/lib/i18n";
import { useStackScreenOptions } from "../src/lib/navigation-presets";

function RootLayoutNav() {
  const { dictionary } = useCopy();
  const stackScreenOptions = useStackScreenOptions();

  return (
    <Stack
      screenOptions={{
        ...stackScreenOptions,
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
        <ActionSheetProvider>
          <NetworkNoticeProvider>
            <RootLayoutNav />
          </NetworkNoticeProvider>
        </ActionSheetProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
