import { Stack } from "expo-router";
import { useStackScreenOptions } from "../../../src/lib/navigation-presets";

export default function TransactionsStackLayout() {
  const stackScreenOptions = useStackScreenOptions();

  return <Stack screenOptions={stackScreenOptions} />;
}
