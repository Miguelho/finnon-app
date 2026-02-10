import { Redirect } from "expo-router";

export default function AccountSettingsIndexScreen() {
  return <Redirect href="/(auth)/settings/account/general" />;
}
