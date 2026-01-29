import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { themeTokens } from "../theme/tokens";
import type { ConfirmationModalProps } from "./confirmation-modal.types";

const tokens = themeTokens.light;
const colors = tokens.colors;

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  cancelDisabled = false,
  confirmLoading = false,
  tone = "default",
  dismissOnBackdrop = true,
}: ConfirmationModalProps) {
  const confirmColor =
    tone === "destructive" ? colors.state.negative : colors.action.primary;
  const isConfirmDisabled = confirmDisabled || confirmLoading;
  const isCancelDisabled = cancelDisabled || confirmLoading;
  const hasCancel = Boolean(cancelLabel && onCancel);
  const allowDismiss = Boolean(onCancel) && dismissOnBackdrop && !isCancelDisabled;

  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={() => {
        if (allowDismiss) onCancel?.();
      }}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (allowDismiss) onCancel?.();
          }}
        />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          <View style={styles.actions}>
            {hasCancel ? (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                disabled={isCancelDisabled}
              >
                <Text style={[styles.cancelText, isCancelDisabled && styles.disabledText]}>
                  {cancelLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { borderColor: confirmColor },
                isConfirmDisabled && styles.disabledButton,
              ]}
              onPress={onConfirm}
              disabled={isConfirmDisabled}
            >
              {confirmLoading ? (
                <ActivityIndicator color={confirmColor} />
              ) : (
                <Text style={[styles.confirmText, { color: confirmColor }]}>
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export type { ConfirmationModalProps, ConfirmationModalTone } from "./confirmation-modal.types";

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.32)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  title: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.sm,
  },
  description: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    marginBottom: tokens.spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: tokens.spacing.sm,
  },
  cancelButton: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  cancelText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    fontWeight: tokens.typography.weight.medium,
  },
  confirmButton: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
  },
  confirmText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.6,
  },
});
