import { Stack } from "expo-router";
import { useCopy, t } from "../../../../src/lib/i18n";
import { useStackScreenOptions } from "../../../../src/lib/navigation-presets";

export default function GoalStackLayout() {
  const { dictionary } = useCopy();
  const stackScreenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{ title: t(dictionary, "goal.pageTitle") }}
      />
    </Stack>
  );
}
