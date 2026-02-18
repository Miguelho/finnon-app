import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";
import { ChevronDown, Search, Check } from "lucide-react-native";
import { movementsDesignTokens } from "../../types/movements";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { useCopy, t } from "../../lib/i18n";

type Option = { id: string; name: string };

type DropdownFilterProps = {
  label: string;
  options: Option[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onDeselect: (id: string) => void;
};

const colors = movementsDesignTokens.colors;

export function DropdownFilter({
  label,
  options,
  selectedIds,
  onSelect,
  onDeselect,
}: DropdownFilterProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter((option) =>
      option.name.toLowerCase().includes(trimmed)
    );
  }, [options, query]);

  const selectedCount = selectedIds.length;

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: userTokens.surface,
            borderColor: userTokens.border,
          },
          pressed && styles.triggerPressed,
        ]}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.triggerText, { color: userTokens.textSecondary }]}>
          {label}
          {selectedCount > 0 ? ` (${selectedCount})` : ""}
        </Text>
        <ChevronDown size={18} color={userTokens.textSecondary} />
      </Pressable>

      <Modal
        transparent
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: userTokens.surface, borderColor: userTokens.border },
            ]}
            onPress={() => {}}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: userTokens.textPrimary }]}>
                {label}
              </Text>
              <Pressable onPress={() => setVisible(false)}>
                <Text style={[styles.sheetDone, { color: primaryActionColor }]}>
                  {t(dictionary, "common.close")}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.searchRow, { backgroundColor: userTokens.surfaceAlt }]}>
              <Search size={18} color={userTokens.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: userTokens.textPrimary }]}
                placeholder={t(dictionary, "transactions.ui.filterSearchPlaceholder", {
                  label: label.toLowerCase(),
                })}
                placeholderTextColor={userTokens.textSecondary}
                value={query}
                onChangeText={setQuery}
              />
            </View>
            <ScrollView style={styles.optionsList}>
              {filteredOptions.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                  <Pressable
                    key={option.id}
                    style={({ pressed }) => [
                      styles.optionRow,
                      { borderBottomColor: userTokens.border },
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() =>
                      isSelected ? onDeselect(option.id) : onSelect(option.id)
                    }
                  >
                    <Text style={[styles.optionText, { color: userTokens.textPrimary }]}>
                      {option.name}
                    </Text>
                    {isSelected && (
                      <Check size={18} color={primaryActionColor} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: movementsDesignTokens.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  triggerPressed: {
    opacity: 0.85,
  },
  triggerText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans-Medium",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: movementsDesignTokens.radius.lg,
    borderTopRightRadius: movementsDesignTokens.radius.lg,
    minHeight: 320,
    maxHeight: "80%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: movementsDesignTokens.typography.sizes.lg,
    fontFamily: "DMSans-SemiBold",
  },
  sheetDone: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans-Medium",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: movementsDesignTokens.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans",
  },
  optionsList: {
    marginTop: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionText: {
    fontSize: movementsDesignTokens.typography.sizes.md,
    color: colors.textSecondary,
    fontFamily: "DMSans",
  },
});
