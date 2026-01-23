import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { CaretDown, Check } from "phosphor-react-native";
import { themeTokens, CURRENCIES } from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = tokens.typography;
const radii = tokens.radii;

export interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  disabled?: boolean;
}

export function CurrencySelector({
  value,
  onChange,
  disabled = false,
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Currency: ${value}`}
        style={({ pressed }) => [
          styles.trigger,
          pressed && !disabled && styles.triggerPressed,
          disabled && styles.triggerDisabled,
        ]}
      >
        <Text style={[styles.triggerText, disabled && styles.triggerTextDisabled]}>
          {value}
        </Text>
        <CaretDown
          size={14}
          weight="bold"
          color={disabled ? colors.text.muted : colors.text.primary}
        />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Currency</Text>
              </View>
              <ScrollView
                style={styles.listContainer}
                keyboardShouldPersistTaps="handled"
              >
                {CURRENCIES.map((curr) => {
                  const isSelected = value === curr.code;
                  return (
                    <Pressable
                      key={curr.code}
                      style={({ pressed }) => [
                        styles.item,
                        isSelected && styles.itemSelected,
                        pressed && styles.itemPressed,
                      ]}
                      onPress={() => handleSelect(curr.code)}
                    >
                      <View style={styles.itemContent}>
                        <Text
                          style={[
                            styles.itemCode,
                            isSelected && styles.itemCodeSelected,
                          ]}
                        >
                          {curr.code}
                        </Text>
                        <Text
                          style={[
                            styles.itemName,
                            isSelected && styles.itemNameSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {curr.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <Check size={18} weight="bold" color={colors.action.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.bg.secondary,
    borderTopRightRadius: radii.md,
    borderBottomRightRadius: radii.md,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: colors.state.neutral,
  },
  triggerPressed: {
    backgroundColor: colors.action.secondary,
  },
  triggerDisabled: {
    opacity: 0.6,
  },
  triggerText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  triggerTextDisabled: {
    color: colors.text.muted,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  modalContent: {
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.state.neutral,
  },
  modalTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    textAlign: "center",
  },
  listContainer: {
    maxHeight: 400,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.state.neutral,
  },
  itemSelected: {
    backgroundColor: colors.action.secondary,
  },
  itemPressed: {
    backgroundColor: colors.bg.secondary,
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  itemCode: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    width: 44,
  },
  itemCodeSelected: {
    color: colors.action.primary,
  },
  itemName: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  itemNameSelected: {
    color: colors.action.primary,
  },
});
