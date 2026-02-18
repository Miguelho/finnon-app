import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ChevronDown } from "lucide-react-native";
import {
  createTypographyStyles,
  formatMoneyWithSymbol,
  themeTokens,
  type CashflowItem,
  type HomeViewModel,
  type Obligation,
} from "@poleursus/shared";

type BalanceHeroAccordionProps = {
  balanceTodayMinor: bigint;
  real: HomeViewModel["balanceHero"]["real"];
  scheduledRange: HomeViewModel["balanceHero"]["scheduledRange"];
  scheduledItems: CashflowItem[];
  noDate: HomeViewModel["balanceHero"]["noDate"];
  balanceEndOfMonthEstimatedMinor: bigint;
  exposureTotalMinor: bigint;
  currency: string;
  currencySymbol: string;
  locale: string;
  monthLabel?: string;
  balanceColumnWidth?: number;
  alignRightGutter?: number;
  copy: HomeViewModel["copy"];
  canEdit: boolean;
  onViewAllScheduled?: () => void;
  onAssignNoDate?: (item: Obligation) => void;
  onMarkNoDateSettled?: (item: Obligation) => void;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const formatSignedBalance = (
  amountMinor: bigint,
  currency: string,
  currencySymbol: string
) => {
  const absoluteMinor = amountMinor < 0n ? -amountMinor : amountMinor;
  const sign = amountMinor < 0n ? "-" : "";
  return `${sign}${formatMoneyWithSymbol(absoluteMinor, currency, currencySymbol)}`;
};

const getNetColor = (amountMinor: bigint) => {
  if (amountMinor > 0n) return colors.state.positive;
  if (amountMinor < 0n) return colors.state.negative;
  return colors.text.secondary;
};

export function BalanceHeroAccordion({
  balanceTodayMinor,
  real,
  scheduledRange,
  scheduledItems,
  noDate,
  balanceEndOfMonthEstimatedMinor,
  exposureTotalMinor,
  currency,
  currencySymbol,
  locale,
  monthLabel,
  balanceColumnWidth,
  alignRightGutter = 0,
  copy,
  canEdit,
  onViewAllScheduled,
  onAssignNoDate,
  onMarkNoDateSettled,
}: BalanceHeroAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const contentHeight = useRef(new Animated.Value(0)).current;
  const measuredHeight = useRef(0);

  const scheduledTopItems = useMemo(
    () => scheduledItems.slice(0, 3),
    [scheduledItems]
  );
  const noDateTopItems = useMemo(() => noDate.items.slice(0, 3), [noDate.items]);

  const toggleAccordion = () => {
    const nextOpen = !isOpen;
    if (nextOpen) {
      setIsRendered(true);
      setIsOpen(true);
      rotation.setValue(1);
      if (measuredHeight.current > 0) {
        contentHeight.setValue(measuredHeight.current);
      }
      return;
    }

    setIsOpen(false);
    Animated.parallel([
      Animated.timing(rotation, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(contentHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsRendered(false);
    });
  };

  const rotateStyle = {
    transform: [
      {
        rotate: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "180deg"],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggleAccordion}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{copy.balanceTodayLabel}</Text>
              {monthLabel ? <Text style={styles.monthLabel}>{monthLabel}</Text> : null}
            </View>
            <View
              style={[
                styles.headerRightColumn,
                balanceColumnWidth ? { width: balanceColumnWidth } : null,
                alignRightGutter ? { marginRight: -alignRightGutter } : null,
              ]}
            >
              <View style={styles.headerRightTop}>
                <Text style={styles.headerHint}>
                  {isOpen ? copy.balanceBreakdownCloseCta : copy.balanceBreakdownCta}
                </Text>
                <Animated.View style={[styles.chevron, rotateStyle]}>
                  <ChevronDown size={18} color={colors.text.secondary} />
                </Animated.View>
              </View>
              <Text style={styles.balanceValue}>
                {formatSignedBalance(balanceTodayMinor, currency, currencySymbol)}
              </Text>
            </View>
          </View>
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{copy.balanceHeroRealChip}</Text>
              <Text
                style={[styles.chipValue, { color: getNetColor(real.netMinor) }]}
              >
                {formatSignedBalance(real.netMinor, currency, currencySymbol)}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{copy.balanceHeroScheduledChip}</Text>
              <Text
                style={[
                  styles.chipValue,
                  { color: getNetColor(scheduledRange.netMinor) },
                ]}
              >
                {formatSignedBalance(
                  scheduledRange.netMinor,
                  currency,
                  currencySymbol
                )}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{copy.balanceHeroNoDateChip}</Text>
              <Text
                style={[
                  styles.chipValue,
                  { color: getNetColor(noDate.netMinor) },
                ]}
              >
                {formatSignedBalance(noDate.netMinor, currency, currencySymbol)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {isRendered && (
        <Animated.View style={[styles.content, { height: contentHeight }]}>
          <View
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              if (nextHeight <= 0) return;
              measuredHeight.current = nextHeight;
              if (isOpen) {
                contentHeight.setValue(nextHeight);
              }
            }}
            style={styles.contentInner}
            pointerEvents={isOpen ? "auto" : "none"}
          >
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{copy.realLabel}</Text>
              <View style={styles.sectionGrid}>
                <View style={styles.sectionColumn}>
                  <Text style={styles.sectionLabel}>{copy.realReceivedLabel}</Text>
                  <Text style={[styles.amountPositive]}>
                    {formatMoneyWithSymbol(real.receivableMinor, currency, currencySymbol)}
                  </Text>
                </View>
                <View style={styles.sectionColumn}>
                  <Text style={styles.sectionLabel}>{copy.realPaidLabel}</Text>
                  <Text style={[styles.amountNegative]}>
                    {formatMoneyWithSymbol(real.payableMinor, currency, currencySymbol)}
                  </Text>
                </View>
              </View>
              <View style={styles.sectionNetRow}>
                <Text style={styles.sectionLabel}>{copy.netLabel}</Text>
                <Text style={{ color: getNetColor(real.netMinor) }}>
                  {formatSignedBalance(real.netMinor, currency, currencySymbol)}
                </Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{copy.scheduledLabel}</Text>
              <View style={styles.sectionGrid}>
                <View style={styles.sectionColumn}>
                  <Text style={styles.sectionLabel}>{copy.receivableLabel}</Text>
                  <Text style={[styles.amountPositive]}>
                    {formatMoneyWithSymbol(
                      scheduledRange.receivableMinor,
                      currency,
                      currencySymbol
                    )}
                  </Text>
                </View>
                <View style={styles.sectionColumn}>
                  <Text style={styles.sectionLabel}>{copy.payableLabel}</Text>
                  <Text style={[styles.amountNegative]}>
                    {formatMoneyWithSymbol(
                      scheduledRange.payableMinor,
                      currency,
                      currencySymbol
                    )}
                  </Text>
                </View>
              </View>
              <View style={styles.sectionNetRow}>
                <Text style={styles.sectionLabel}>{copy.netLabel}</Text>
                <Text style={{ color: getNetColor(scheduledRange.netMinor) }}>
                  {formatSignedBalance(scheduledRange.netMinor, currency, currencySymbol)}
                </Text>
              </View>
              {scheduledTopItems.length > 0 && (
                <View style={styles.list}>
                  {scheduledTopItems.map((item) => {
                    const dayLabel = item.date.toLocaleDateString(locale, {
                      day: "2-digit",
                      month: "short",
                    });
                    return (
                      <View key={item.id} style={styles.listRow}>
                        <Text style={styles.listLabel}>
                          {dayLabel}: {item.title}
                        </Text>
                        <Text
                          style={
                            item.type === "income"
                              ? styles.amountPositive
                              : styles.amountNegative
                          }
                        >
                          {item.type === "expense" ? "-" : "+"}
                          {formatMoneyWithSymbol(item.amountMinor, currency, currencySymbol)}
                        </Text>
                      </View>
                    );
                  })}
                  {onViewAllScheduled && (
                    <TouchableOpacity onPress={onViewAllScheduled}>
                      <Text style={styles.linkText}>{copy.viewAllCta}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{copy.noDateLabel}</Text>
              <View style={styles.sectionGrid}>
                <View style={styles.sectionColumn}>
                  <Text style={styles.sectionLabel}>{copy.receivableLabel}</Text>
                  <Text style={[styles.amountPositive]}>
                    {formatMoneyWithSymbol(noDate.receivableMinor, currency, currencySymbol)}
                  </Text>
                </View>
                <View style={styles.sectionColumn}>
                  <Text style={styles.sectionLabel}>{copy.payableLabel}</Text>
                  <Text style={[styles.amountNegative]}>
                    {formatMoneyWithSymbol(noDate.payableMinor, currency, currencySymbol)}
                  </Text>
                </View>
              </View>
              <View style={styles.sectionNetRow}>
                <Text style={styles.sectionLabel}>{copy.netLabel}</Text>
                <Text style={{ color: getNetColor(noDate.netMinor) }}>
                  {formatSignedBalance(noDate.netMinor, currency, currencySymbol)}
                </Text>
              </View>
              {noDateTopItems.length > 0 && (
                <View style={styles.list}>
                  {noDateTopItems.map((item) => (
                    <View key={item.id} style={styles.listRow}>
                      <Text style={styles.listLabel}>{item.name}</Text>
                      <Text style={styles.amountNegative}>
                        -{formatMoneyWithSymbol(
                          item.amount_base_minor ?? item.amount_minor,
                          currency,
                          currencySymbol
                        )}
                      </Text>
                      <View style={styles.listActions}>
                        {onAssignNoDate && (
                          <TouchableOpacity
                            onPress={() => onAssignNoDate(item)}
                            disabled={!canEdit}
                          >
                            <Text style={styles.linkText}>{copy.setDateCta}</Text>
                          </TouchableOpacity>
                        )}
                        {onMarkNoDateSettled && (
                          <TouchableOpacity
                            onPress={() => onMarkNoDateSettled(item)}
                            disabled={!canEdit}
                          >
                            <Text style={styles.secondaryText}>{copy.markSettledCta}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.footer}>
              <View style={styles.footerRow}>
                <Text style={styles.sectionLabel}>{copy.endOfMonthEstimateLabel}</Text>
                <Text style={{ color: getNetColor(balanceEndOfMonthEstimatedMinor) }}>
                  {formatSignedBalance(
                    balanceEndOfMonthEstimatedMinor,
                    currency,
                    currencySymbol
                  )}
                </Text>
              </View>
              <View style={styles.footerRow}>
                <Text style={styles.sectionLabel}>{copy.exposureTotalLabel}</Text>
                <Text style={{ color: getNetColor(exposureTotalMinor) }}>
                  {formatSignedBalance(exposureTotalMinor, currency, currencySymbol)}
                </Text>
              </View>
              <Text style={styles.footerNote}>{copy.includesNoDate}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.surface,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  headerContent: {
    flex: 1,
    gap: tokens.spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  headerLeft: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  headerRightColumn: {
    alignItems: "flex-end",
    gap: tokens.spacing.xs,
  },
  headerRightTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  headerTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text.primary,
  },
  headerHint: {
    fontSize: typography.meta.fontSize,
    color: colors.text.secondary,
  },
  monthLabel: {
    fontSize: typography.meta.fontSize,
    color: colors.text.secondary,
  },
  balanceValue: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight,
    color: colors.text.primary,
    textAlign: "right",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
  },
  chipLabel: {
    fontSize: typography.meta.fontSize,
    color: colors.text.secondary,
  },
  chipValue: {
    fontSize: typography.meta.fontSize,
    fontWeight: typography.meta.fontWeight,
  },
  chevron: {
    alignSelf: "flex-start",
    marginTop: tokens.spacing.xs,
  },
  content: {
    overflow: "hidden",
  },
  contentInner: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text.primary,
  },
  sectionGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  sectionColumn: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.meta.fontSize,
    color: colors.text.secondary,
  },
  sectionNetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    paddingTop: tokens.spacing.sm,
  },
  list: {
    gap: tokens.spacing.xs,
  },
  listRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  listLabel: {
    flex: 1,
    fontSize: typography.meta.fontSize,
    color: colors.text.secondary,
  },
  listActions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  linkText: {
    fontSize: typography.meta.fontSize,
    fontWeight: typography.meta.fontWeight,
    color: colors.action.primary,
  },
  secondaryText: {
    fontSize: typography.meta.fontSize,
    color: colors.text.secondary,
  },
  footer: {
    gap: tokens.spacing.xs,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerNote: {
    fontSize: typography.meta.fontSize,
    color: colors.text.muted,
  },
  amountPositive: {
    fontSize: typography.body.fontSize,
    color: colors.state.positive,
  },
  amountNegative: {
    fontSize: typography.body.fontSize,
    color: colors.state.negative,
  },
});
