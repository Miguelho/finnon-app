import "react-native-gesture-handler";
import { useWindowDimensions } from "react-native";
import { Drawer } from "expo-router/drawer";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { useFonts } from "expo-font";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { themeTokens } from "@poleursus/shared";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { NetworkNoticeProvider } from "../src/contexts/NetworkNoticeContext";
import { SettingsDrawerContent } from "../src/components/settings/SettingsDrawerContent";
import { LocaleProvider } from "../src/lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;

function RootLayoutNav() {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const drawerWidth = Math.round(width * 0.82);

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        overlayColor: "rgba(0,0,0,0.3)",
        drawerStyle: { width: drawerWidth, backgroundColor: colors.bg.surface },
        sceneContainerStyle: { backgroundColor: colors.bg.primary },
      }}
      drawerContent={(props) => <SettingsDrawerContent {...props} />}
    >
      <Drawer.Screen name="index" options={{ swipeEnabled: false }} />
      <Drawer.Screen name="join" options={{ swipeEnabled: false }} />
      <Drawer.Screen name="(auth)" options={{ swipeEnabled: Boolean(session) }} />
    </Drawer>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-SemiBold": DMSans_600SemiBold,
    "DMSans-Bold": DMSans_700Bold,
    JetBrainsMono: JetBrainsMono_400Regular,
    "JetBrainsMono-Medium": JetBrainsMono_500Medium,
  });

  if (!fontsLoaded) return null;

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
