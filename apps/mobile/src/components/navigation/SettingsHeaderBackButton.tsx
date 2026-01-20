import { HeaderBackButton, type HeaderBackButtonProps } from "@react-navigation/elements";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";

export function SettingsHeaderBackButton(props: HeaderBackButtonProps) {
  const navigation = useNavigation();
  const router = useRouter();

  const handlePress = () => {
    router.back();
    // Small delay to let the back navigation complete before opening drawer
    setTimeout(() => {
      navigation.dispatch(DrawerActions.openDrawer());
    }, 50);
  };

  return <HeaderBackButton {...props} onPress={handlePress} />;
}
