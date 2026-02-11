import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { useLocale, t } from "../../../src/lib/i18n";

const tokens = themeTokens.light;

type LocaleOption = {
  code: string;
  label: string;
};

export default function LanguageScreen() {
  const { locale, dictionary, setLocale } = useLocale();

  const options: LocaleOption[] = [
    { code: "en", label: t(dictionary, "settings.language.options.en") },
    { code: "es", label: t(dictionary, "settings.language.options.es") },
  ];

  const handleSelect = async (code: string) => {
    if (code !== locale) {
      await setLocale(code);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {t(dictionary, "settings.language.subtitle")}
        </Text>
      </View>

      <View style={styles.optionsCard}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={option.code}
            style={[
              styles.option,
              index !== options.length - 1 && styles.optionBorder,
            ]}
            onPress={() => handleSelect(option.code)}
            activeOpacity={0.7}
          >
            <Text style={styles.optionLabel}>{option.label}</Text>
            {locale === option.code && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg.primary,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
  },
  optionsCard: {
    backgroundColor: tokens.colors.bg.surface,
    marginTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tokens.colors.state.neutral,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
  },
  optionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.state.neutral,
  },
  optionLabel: {
    fontSize: tokens.typography.size.md,
    color: tokens.colors.text.primary,
  },
  checkmark: {
    fontSize: tokens.typography.size.lg,
    color: tokens.colors.action.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
});
