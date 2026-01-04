import { Stack } from "expo-router";
import { useCopy, t } from "../../../../src/lib/i18n";
import { useStackScreenOptions } from "../../../../src/lib/navigation-presets";

export default function SettingsLayout() {
  const { dictionary } = useCopy();
  const stackScreenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: t(dictionary, "settings.title"),
        }}
      />
      <Stack.Screen
        name="user-details"
        options={{
          title: t(dictionary, "settings.userDetails.title"),
        }}
      />
      <Stack.Screen
        name="invitations"
        options={{
          title: t(dictionary, "invites.title"),
        }}
      />
      <Stack.Screen
        name="language"
        options={{
          title: t(dictionary, "settings.language.title"),
        }}
      />
    </Stack>
  );
}
