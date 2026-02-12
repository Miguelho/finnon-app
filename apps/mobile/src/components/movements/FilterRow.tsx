import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { movementsDesignTokens } from "../../types/movements";
import { DropdownFilter } from "./DropdownFilter";
import { useUserTheme } from "../../contexts/UserThemeContext";

type FilterCounts = {
  income: number;
  expense: number;
};

type Option = { id: string; name: string };

type FilterRowProps = {
  counts: FilterCounts;
  activeTypes: Array<"income" | "expense">;
  onToggleType: (type: "income" | "expense") => void;
  categories: Option[];
  selectedCategoryIds: string[];
  onCategorySelect: (id: string) => void;
  onCategoryDeselect: (id: string) => void;
  merchants: Option[];
  selectedMerchants: string[];
  onMerchantSelect: (id: string) => void;
  onMerchantDeselect: (id: string) => void;
};

export function FilterRow({
  counts,
  activeTypes,
  onToggleType,
  categories,
  selectedCategoryIds,
  onCategorySelect,
  onCategoryDeselect,
  merchants,
  selectedMerchants,
  onMerchantSelect,
  onMerchantDeselect,
}: FilterRowProps) {
  const { tokens: userTokens } = useUserTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <FilterChip
        label="Ingresos"
        count={counts.income}
        isActive={activeTypes.includes("income")}
        onPress={() => onToggleType("income")}
      />
      <FilterChip
        label="Gastos"
        count={counts.expense}
        isActive={activeTypes.includes("expense")}
        onPress={() => onToggleType("expense")}
      />
      <View style={[styles.separator, { backgroundColor: userTokens.border }]} />
      <DropdownFilter
        label="Categoría"
        options={categories}
        selectedIds={selectedCategoryIds}
        onSelect={onCategorySelect}
        onDeselect={onCategoryDeselect}
      />
      <DropdownFilter
        label="Comercio"
        options={merchants}
        selectedIds={selectedMerchants}
        onSelect={onMerchantSelect}
        onDeselect={onMerchantDeselect}
      />
    </ScrollView>
  );
}

type FilterChipProps = {
  label: string;
  count: number;
  isActive: boolean;
  onPress: () => void;
};

function FilterChip({ label, count, isActive, onPress }: FilterChipProps) {
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: userTokens.surface,
          borderColor: userTokens.border,
        },
        isActive && styles.chipActive,
        isActive && {
          backgroundColor: primaryActionColor,
          borderColor: primaryActionColor,
        },
        pressed && styles.chipPressed,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: userTokens.textSecondary },
          isActive && styles.chipTextActive,
          isActive && { color: primaryActionTextColor },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.chipCount,
          { color: userTokens.textSecondary },
          isActive && styles.chipTextActive,
          isActive && { color: primaryActionTextColor },
        ]}
      >
        {count}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: movementsDesignTokens.radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans-Medium",
  },
  chipTextActive: {
  },
  chipCount: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    fontFamily: "DMSans",
  },
  separator: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
});
