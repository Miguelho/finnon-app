import { Stack } from "expo-router";
import { useCopy, t } from "../../../../src/lib/i18n";
import { useStackScreenOptions } from "../../../../src/lib/navigation-presets";

export default function AccountStackLayout() {
  const { dictionary } = useCopy();
  const stackScreenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{ title: t(dictionary, "navigation.account") }}
      />
      <Stack.Screen
        name="categories/index"
        options={{ title: t(dictionary, "categories.title") }}
      />
      <Stack.Screen
        name="categories/create"
        options={{ title: t(dictionary, "categories.create.title") }}
      />
      <Stack.Screen
        name="categories/[id]/edit"
        options={{ title: t(dictionary, "categories.edit.title") }}
      />
    </Stack>
  );
}
