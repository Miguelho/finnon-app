import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PanResponder,
} from "react-native";
import {
  createTypographyStyles,
  formatMoneyWithSymbol,
  themeTokens,
  type DaySummary,
} from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

type DayDetailPanelProps = {
  visible: boolean;
  summary: DaySummary | null;
  locale: string;
  currency: string;
  currencySymbol: string;
  canEdit: boolean;
  onClose: () => void;
  onToggleObligation: (item: { id: string; status: "pending" | "paid" }) => void;
  onAddForDay?: (date: Date) => void;
  onViewMonth?: () => void;
  copy: {
    balanceLabel: string;
    incomeLabel: string;
    expenseLabel: string;
    markPaid: string;
    markPending: string;
    daySummaryTitle: string;
    dayObligationsTitle: string;
    dayRecurringTitle: string;
    dayTransactionsTitle: string;
    dayEmpty: string;
    closeLabel: string;
    statusPaidLabel: string;
    statusPendingLabel: string;
    addForDayCta?: string;
    viewMonthCta?: string;
  };
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

export function DayDetailPanel({
  visible,
  summary,
  locale,
  currency,
  currencySymbol,
  canEdit,
  onClose,
  onToggleObligation,
  onAddForDay,
  onViewMonth,
  copy,
}: DayDetailPanelProps) {
  const { primaryActionColor, primaryActionTextColor } = useUserTheme();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!visible) {
      setExpanded(false);
    }
  }, [visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80) {
            onClose();
          } else if (gesture.dy < -40) {
            setExpanded(true);
          } else if (gesture.dy > 20) {
            setExpanded(false);
          }
        },
      }),
    [onClose]
  );

  if (!summary) return null;

  const netColor =
    summary.netMinor < 0n ? colors.state.negative : colors.text.primary;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.panel,
            { height: expanded ? "80%" : "40%" },
          ]}
        >
          <View style={styles.handleRow} {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>{copy.closeLabel}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {summary.date.toLocaleDateString(locale, {
                weekday: "short",
                day: "2-digit",
                month: "short",
              })}
            </Text>
            <Text style={styles.headerSubtitle}>{copy.daySummaryTitle}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.meta}>{copy.balanceLabel}</Text>
                <Text style={[styles.summaryValue, { color: netColor }]}>
                  {summary.netMinor < 0n ? "-" : "+"}
                  {formatMoneyWithSymbol(
                    summary.netMinor < 0n ? -summary.netMinor : summary.netMinor,
                    currency,
                    currencySymbol
                  )}
                </Text>
              </View>
              <View>
                <Text style={styles.meta}>{copy.incomeLabel}</Text>
                <Text style={styles.summaryValue}>
                  +{formatMoneyWithSymbol(
                    summary.incomeMinor,
                    currency,
                    currencySymbol
                  )}
                </Text>
              </View>
              <View>
                <Text style={styles.meta}>{copy.expenseLabel}</Text>
                <Text style={styles.summaryValue}>
                  -{formatMoneyWithSymbol(
                    summary.expenseMinor,
                    currency,
                    currencySymbol
                  )}
                </Text>
              </View>
            </View>

            {!summary.hasActivity && (
              <Text style={styles.emptyText}>{copy.dayEmpty}</Text>
            )}

            {summary.obligations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{copy.dayObligationsTitle}</Text>
                {summary.obligations.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowMeta}>
                        {item.status === "paid" ? "●" : "○"}{" "}
                        {item.status === "paid"
                          ? copy.statusPaidLabel
                          : copy.statusPendingLabel}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      <Text style={styles.rowAmount}>
                        {formatMoneyWithSymbol(
                          item.amountMinor,
                          currency,
                          currencySymbol
                        )}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.obligationButton,
                          item.status === "paid"
                            ? styles.obligationButtonSecondary
                            : { backgroundColor: primaryActionColor },
                          !canEdit && styles.disabled,
                        ]}
                        disabled={!canEdit}
                        onPress={() =>
                          onToggleObligation({
                            id: item.id,
                            status: item.status,
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.obligationButtonText,
                            item.status !== "paid" && {
                              color: primaryActionTextColor,
                            },
                            item.status === "paid" &&
                              styles.obligationButtonTextSecondary,
                          ]}
                        >
                          {item.status === "paid"
                            ? copy.markPending
                            : copy.markPaid}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {summary.recurring.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{copy.dayRecurringTitle}</Text>
                {summary.recurring.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      {item.notes ? (
                        <Text style={styles.rowMeta}>{item.notes}</Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.rowAmount,
                        item.type === "income"
                          ? styles.amountPositive
                          : styles.amountNegative,
                      ]}
                    >
                      {item.type === "income" ? "+" : "-"}
                      {formatMoneyWithSymbol(
                        item.amountMinor,
                        currency,
                        currencySymbol
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {summary.transactions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{copy.dayTransactionsTitle}</Text>
                {summary.transactions.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      {item.notes ? (
                        <Text style={styles.rowMeta}>{item.notes}</Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.rowAmount,
                        item.type === "income"
                          ? styles.amountPositive
                          : styles.amountNegative,
                      ]}
                    >
                      {item.type === "income" ? "+" : "-"}
                      {formatMoneyWithSymbol(
                        item.amountMinor,
                        currency,
                        currencySymbol
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionsSection}>
              {canEdit && onAddForDay && copy.addForDayCta && (
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: primaryActionColor }]}
                  onPress={() => onAddForDay(summary.date)}
                >
                  <Text
                    style={[styles.addButtonText, { color: primaryActionTextColor }]}
                  >
                    {copy.addForDayCta}
                  </Text>
                </TouchableOpacity>
              )}
              {onViewMonth && copy.viewMonthCta && (
                <TouchableOpacity
                  style={styles.viewMonthLink}
                  onPress={onViewMonth}
                >
                  <Text
                    style={[styles.viewMonthText, { color: primaryActionColor }]}
                  >
                    {copy.viewMonthCta}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.surface,
  },
  handleRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: tokens.spacing.sm,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.state.neutral,
  },
  closeButton: {
    position: "absolute",
    right: tokens.spacing.lg,
    top: tokens.spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  closeText: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  content: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  meta: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  section: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
    gap: tokens.spacing.md,
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    ...typography.body,
    color: colors.text.primary,
  },
  rowMeta: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  rowActions: {
    alignItems: "flex-end",
    gap: tokens.spacing.xs,
  },
  rowAmount: {
    ...typography.body,
    color: colors.text.primary,
  },
  obligationButton: {
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
  obligationButtonSecondary: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  obligationButtonText: {
    ...typography.meta,
    color: colors.bg.primary,
  },
  obligationButtonTextSecondary: {
    color: colors.text.primary,
  },
  amountPositive: {
    color: colors.state.positive,
  },
  amountNegative: {
    color: colors.state.negative,
  },
  disabled: {
    opacity: 0.6,
  },
  actionsSection: {
    gap: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
  },
  addButton: {
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    alignItems: "center",
  },
  addButtonText: {
    ...typography.body,
    fontWeight: "600",
  },
  viewMonthLink: {
    alignItems: "center",
    paddingVertical: tokens.spacing.xs,
  },
  viewMonthText: {
    ...typography.meta,
  },
});
