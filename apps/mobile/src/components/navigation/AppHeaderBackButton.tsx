import { HeaderBackButton, type HeaderBackButtonProps } from "@react-navigation/elements";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { type GestureResponderEvent } from "react-native";

export function AppHeaderBackButton(props: HeaderBackButtonProps) {
  const navigation = useNavigation();

  // Get the current route index in the navigation stack
  const routeIndex = useNavigationState((state) => state.index);

  // Only show the back button if there are previous screens in the stack (index > 0)
  const canGoBack = routeIndex > 0;

  const handlePress = (event: GestureResponderEvent) => {
    if (canGoBack) {
      navigation.goBack();
    }
  };

  if (!canGoBack) {
    return null;
  }

  return <HeaderBackButton {...props} onPress={handlePress} />;
}
