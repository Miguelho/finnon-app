import { Stack } from "expo-router";
import { useCopy, t } from "../../src/lib/i18n";
import { useStackScreenOptions } from "../../src/lib/navigation-presets";
import { SettingsHeaderBackButton } from "../../src/components/navigation/SettingsHeaderBackButton";

export default function AuthLayout() {
  const { dictionary } = useCopy();
  const stackScreenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={stackScreenOptions}>
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
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="transactions"
        options={{
          headerShown: false,
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
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/account/index"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.menu.sections.account.items.general.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/account/general"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.menu.sections.account.items.general.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/account/members"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.menu.sections.account.items.members.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/account/categories"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.menu.sections.account.items.categories.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/user-details"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.userProfile.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/invitations"
        options={{
          headerShown: true,
          title: t(dictionary, "invites.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="invitations"
        options={{
          headerShown: true,
          title: t(dictionary, "invitations.title"),
        }}
      />
      <Stack.Screen
        name="settings/language"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.language.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="transaction/recurrent/index"
        options={{
          headerShown: true,
          title: t(dictionary, "recurrentes.title"),
        }}
      />
      <Stack.Screen
        name="transaction/recurrent/[id]"
        options={{
          headerShown: true,
          title: t(dictionary, "recurrentes.edit"),
        }}
      />
    </Stack>
  );
}
