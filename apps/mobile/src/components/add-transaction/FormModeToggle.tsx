import { TouchableOpacity, StyleSheet } from "react-native";
import { SquaresFour, List } from "phosphor-react-native";
import { themeTokens, type FormMode } from "@poleursus/shared";
import { useCopy, t } from "../../lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface FormModeToggleProps {
  mode: FormMode;
  onChange: (mode: FormMode) => void;
}

export function FormModeToggle({ mode, onChange }: FormModeToggleProps) {
  const { dictionary } = useCopy();

  const toggleMode = () => {
    onChange(mode === "panels" ? "list" : "panels");
  };

  const Icon = mode === "panels" ? SquaresFour : List;
  const label = mode === "panels"
    ? t(dictionary, "addTransaction.modePanels")
    : t(dictionary, "addTransaction.modeList");

  return (
    <TouchableOpacity
      onPress={toggleMode}
      style={styles.button}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Icon size={20} color={colors.text.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
});
