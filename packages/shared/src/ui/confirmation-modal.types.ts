export type ConfirmationModalTone = "default" | "destructive";

export type ConfirmationModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  confirmLoading?: boolean;
  tone?: ConfirmationModalTone;
  dismissOnBackdrop?: boolean;
};
