import { useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ADD_ACTIONS,
  themeTokens,
  type AddActionKey,
} from "@poleursus/shared";
import { AddMenuItem } from "./AddMenuItem";

const tokens = themeTokens.light;
const colors = tokens.colors;
const spacing = tokens.spacing;
const radii = tokens.radii;
const typography = tokens.typography;

type AddActionSheetProps = {
  /** Bottom offset for the FAB (usually safe area insets) */
  bottomOffset?: number;
  /** Title shown in the sheet header */
  sheetTitle: string;
  /** Text shown on the FAB button */
  fabLabel: string;
  /** Called when an action is selected */
  onAction: (key: AddActionKey) => void;
  /** Optional notice shown at the top of the sheet (e.g., for read-only guests) */
  notice?: ReactNode;
  /** Whether the actions are disabled */
  disabled?: boolean;
  /** Custom trigger renderer (replaces FAB if provided) */
  renderTrigger?: (open: () => void) => ReactNode;
};

export function AddActionSheet({
  bottomOffset = 0,
  sheetTitle,
  fabLabel,
  onAction,
  notice,
  disabled = false,
  renderTrigger,
}: AddActionSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleAction = (key: AddActionKey) => {
    setIsOpen(false);
    onAction(key);
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(handleOpen)
      ) : (
        <TouchableOpacity
          onPress={handleOpen}
          style={[
            styles.fab,
            { bottom: spacing.lg + bottomOffset },
            disabled && styles.fabDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={fabLabel}
          disabled={disabled}
        >
          <Text style={styles.fabText}>+ {fabLabel}</Text>
        </TouchableOpacity>
      )}

      <Modal
        transparent
        visible={isOpen}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={handleClose} />
          <View style={styles.container}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{sheetTitle}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
              {notice}
              <View style={styles.actions}>
                {ADD_ACTIONS.map((action) => (
                  <AddMenuItem
                    key={action.key}
                    meta={action}
                    onPress={() => handleAction(action.key)}
                    disabled={disabled}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.action.primary,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabDisabled: {
    backgroundColor: colors.action.disabled,
  },
  fabText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.bg.primary,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  backdrop: {
    flex: 1,
  },
  container: {
    maxHeight: "80%",
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    paddingBottom: spacing.lg,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.state.neutral,
    marginTop: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
});
