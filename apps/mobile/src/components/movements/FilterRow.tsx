import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { movementsDesignTokens } from "../../types/movements";
import { DropdownFilter } from "./DropdownFilter";

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

const colors = movementsDesignTokens.colors;

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
      <View style={styles.separator} />
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        isActive && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
        {label}
      </Text>
      <Text style={[styles.chipCount, isActive && styles.chipTextActive]}>
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
    backgroundColor: colors.surface,
    borderRadius: movementsDesignTokens.radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textSecondary,
    fontFamily: "DMSans-Medium",
  },
  chipTextActive: {
    color: colors.surface,
  },
  chipCount: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    color: colors.textTertiary,
    fontFamily: "DMSans",
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderStrong,
    marginHorizontal: 4,
  },
});
