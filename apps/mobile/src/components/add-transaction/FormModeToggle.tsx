import { TouchableOpacity, StyleSheet } from "react-native";
import { SquaresFour, List } from "phosphor-react-native";
import { themeTokens, type FormMode } from "@poleursus/shared";
import { useCopy, t } from "../../lib/i18n";
import { useUserTheme } from "../../contexts/UserThemeContext";

const tokens = themeTokens.light;

interface FormModeToggleProps {
  mode: FormMode;
  onChange: (mode: FormMode) => void;
}

export function FormModeToggle({ mode, onChange }: FormModeToggleProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();

  const toggleMode = () => {
    onChange(mode === "panels" ? "list" : "panels");
  };

  const Icon = mode === "panels" ? SquaresFour : List;
  const label = mode === "panels"
    ? (t(dictionary, "addTransaction.modePanels" as any) as string)
    : (t(dictionary, "addTransaction.modeList" as any) as string);

  return (
    <TouchableOpacity
      onPress={toggleMode}
      style={styles.button}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Icon size={20} color={userTokens.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
});
