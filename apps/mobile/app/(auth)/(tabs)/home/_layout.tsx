import { Stack } from "expo-router";
import { useCopy, t } from "../../../../src/lib/i18n";
import { useStackScreenOptions } from "../../../../src/lib/navigation-presets";

export default function HomeStackLayout() {
  const { dictionary } = useCopy();
  const stackScreenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{ title: t(dictionary, "navigation.home") }}
      />
      <Stack.Screen
        name="savings"
        options={{ title: t(dictionary, "home.savings.title") }}
      />
    </Stack>
  );
}
