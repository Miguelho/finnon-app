import { Redirect, useLocalSearchParams } from "expo-router";

type CreateParams = {
  type?: string | string[];
  date?: string | string[];
  kind?: string | string[];
};

export default function LegacyTabsCreateTransactionRoute() {
  const params = useLocalSearchParams<CreateParams>();
  return <Redirect href={{ pathname: "/(auth)/transactions/create", params }} />;
}
