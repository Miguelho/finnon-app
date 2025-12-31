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
    </Stack>
  );
}
