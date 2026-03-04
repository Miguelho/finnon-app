import { Redirect, useLocalSearchParams } from "expo-router";

type EditParams = {
  id?: string | string[];
};

export default function LegacyTabsEditTransactionRoute() {
  const params = useLocalSearchParams<EditParams>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!id) {
    return <Redirect href="/(auth)/(tabs)/transactions" />;
  }

  return <Redirect href={`/(auth)/transactions/${id}`} />;
}
