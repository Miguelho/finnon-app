import { Stack } from "expo-router";
import { useCopy, t } from "../../src/lib/i18n";

export default function AuthLayout() {
  const { dictionary } = useCopy();

  return (
    <Stack>
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="select-account"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="account/[id]"
        options={{
          headerShown: true,
          title: t(dictionary, "account.labelAccount"),
        }}
      />
      <Stack.Screen
        name="settings/index"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.title"),
        }}
      />
      <Stack.Screen
        name="settings/user-details"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.userDetails.title"),
        }}
      />
      <Stack.Screen
        name="settings/invitations"
        options={{
          headerShown: true,
          title: t(dictionary, "invites.title"),
        }}
      />
      <Stack.Screen
        name="settings/language"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.language.title"),
        }}
      />
    </Stack>
  );
}
