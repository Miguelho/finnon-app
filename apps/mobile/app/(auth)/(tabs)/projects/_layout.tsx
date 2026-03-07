import { Stack } from "expo-router";
import { useCopy, t } from "../../../../src/lib/i18n";
import { useStackScreenOptions } from "../../../../src/lib/navigation-presets";

export default function ProjectsStackLayout() {
  const { dictionary } = useCopy();
  const stackScreenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{ title: t(dictionary, "navigation.projects") }}
      />
      <Stack.Screen
        name="month-close"
        options={{ title: t(dictionary, "projects.monthClose.title") }}
      />
      <Stack.Screen
        name="savings"
        options={{ title: t(dictionary, "home.savings.title") }}
      />
      <Stack.Screen
        name="[projectId]"
        options={{ title: t(dictionary, "navigation.projects") }}
      />
      <Stack.Screen
        name="reserves/[reserveId]"
        options={{ title: t(dictionary, "home.savings.hucha") }}
      />
    </Stack>
  );
}
