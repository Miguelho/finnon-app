import { Stack } from "expo-router";
import { useCopy, t } from "../../../../src/lib/i18n";
import { useStackScreenOptions } from "../../../../src/lib/navigation-presets";

export default function TransactionsStackLayout() {
  const { dictionary } = useCopy();
  const stackScreenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={stackScreenOptions} initialRouteName="index">
      <Stack.Screen
        name="index"
        options={{ title: t(dictionary, "transactions.pageTitle") }}
      />
      <Stack.Screen
        name="create"
        options={{ title: t(dictionary, "transactions.newTransaction") }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: t(dictionary, "transactions.edit.title") }}
      />
    </Stack>
  );
}
