import { useLocalSearchParams } from "expo-router";
import { AccountDetails } from "../../../src/components/AccountDetails";

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = typeof id === "string" ? id : "";

  return <AccountDetails accountId={accountId} />;
}
