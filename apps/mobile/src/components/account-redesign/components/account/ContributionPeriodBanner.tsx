import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  PanResponder,
} from "react-native";
import { typography, spacing, radii } from "../../theme/tokens";
import { formatCurrency } from "../../utils/currency";
import { useUserTheme } from "../../../../contexts/UserThemeContext";
import { useCopy, t } from "../../../../lib/i18n";
import { X } from "lucide-react-native";
import type {
  AccountContributor,
  ContributionBalanceData,
  ContributionMemberBalance,
  Period,
} from "../../types/account";

interface ContributionPeriodBannerProps {
  contributors: AccountContributor[];
  contributionBalance: ContributionBalanceData | null;
  period: Period;
  currency?: string;
  decimals?: number;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((chunk) => chunk + chunk)
          .join("")
      : normalized;
  if (expanded.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);
  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return `rgba(37, 99, 235, ${alpha})`;
  }
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function ContributionPeriodBanner({
  contributors,
  contributionBalance,
  period,
  currency = "€",
  decimals = 2,
}: ContributionPeriodBannerProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const [detailOpen, setDetailOpen] = useState(false);
  const detailScrollOffsetY = useRef(0);
  const translate = t as any;

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 8,
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dy > 72 && detailScrollOffsetY.current <= 0) {
            setDetailOpen(false);
          }
        },
      }),
    []
  );

  const contributionBanner = useMemo(() => {
    if (!contributionBalance || contributionBalance.members.length < 2) return null;

    const periodKeyByValue: Record<Period, string> = {
      week: "account.redesign.periodWeek",
      month: "account.redesign.periodMonth",
      quarter: "account.redesign.periodQuarter",
      year: "account.redesign.periodYear",
    };

    const sorted = [...contributionBalance.members].sort((a, b) => b.totalPaid - a.totalPaid);
    const leader = sorted[0];
    const trailing = sorted[sorted.length - 1];
    if (!leader || !trailing) return null;

    const periodLabel = translate(dictionary, periodKeyByValue[period] as any);
    const diff = leader.totalPaid - trailing.totalPaid;
    const threshold = 100 / Math.pow(10, decimals);

    const contributor = contributors.find((item) => item.userId === leader.userId);

    if (diff < threshold) {
      return {
        message: translate(dictionary, "account.redesign.contributionBannerEqual", {
          period: periodLabel,
        }),
        initials: contributor?.initials ?? leader.initials,
        color: contributor?.color ?? leader.color,
      };
    }

    return {
      message: translate(dictionary, "account.redesign.contributionBanner", {
        name: leader.name,
        amount: formatCurrency(diff, { currency, decimals }).full,
        otherName: trailing.name,
        period: periodLabel,
      }),
      initials: contributor?.initials ?? leader.initials,
      color: contributor?.color ?? leader.color,
    };
  }, [contributionBalance, contributors, currency, decimals, dictionary, period]);

  if (!contributionBanner) return null;

  const members = contributionBalance?.members ?? [];
  const globalMax = members.reduce(
    (max, member) => Math.max(max, member.totalPaid, member.totalResponsible),
    0
  );

  const renderMemberRow = (member: ContributionMemberBalance) => {
    const net = formatCurrency(member.net, { currency, decimals, showSign: true }).full;
    const paid = formatCurrency(member.totalPaid, { currency, decimals }).full;
    const responsibility = formatCurrency(member.totalResponsible, { currency, decimals }).full;
    const paidWidth: `${number}%` = globalMax > 0 ? `${(member.totalPaid / globalMax) * 100}%` : "0%";
    const responsibilityWidth: `${number}%` =
      globalMax > 0 ? `${(member.totalResponsible / globalMax) * 100}%` : "0%";

    return (
      <View key={member.userId} style={[styles.memberBlock, { borderBottomColor: userTokens.border }]}>
        <View style={styles.memberHeader}>
          <View style={styles.memberIdentity}>
            <View style={[styles.memberAvatar, { backgroundColor: member.color }]}>
              <Text style={styles.memberAvatarText}>{member.initials}</Text>
            </View>
            <Text style={[styles.memberName, { color: userTokens.textPrimary }]} numberOfLines={1}>
              {member.name}
            </Text>
          </View>

          <View
            style={[
              styles.balanceBadge,
              member.net > 0
                ? styles.balanceBadgePositive
                : member.net < 0
                  ? styles.balanceBadgeNegative
                  : { backgroundColor: userTokens.surfaceAlt },
            ]}
          >
            <Text
              style={[
                styles.balanceBadgeText,
                {
                  color:
                    member.net > 0
                      ? "#1B7A4A"
                      : member.net < 0
                        ? "#C4441A"
                        : userTokens.textSecondary,
                },
              ]}
            >
              {net}
            </Text>
          </View>
        </View>

        <View style={styles.bars}>
          <View style={styles.barRow}>
            <Text style={[styles.barLabel, { color: userTokens.textSecondary }]} numberOfLines={1}>
              {translate(dictionary, "account.redesign.balanceDetailPaid")}
            </Text>
            <View style={[styles.barTrack, { backgroundColor: userTokens.border }]}>
              <View style={[styles.barFill, { width: paidWidth, backgroundColor: member.color }]} />
            </View>
            <Text style={[styles.barAmount, { color: userTokens.textPrimary }]}>{paid}</Text>
          </View>

          <View style={styles.barRow}>
            <Text style={[styles.barLabel, { color: userTokens.textSecondary }]} numberOfLines={1}>
              {translate(dictionary, "account.redesign.balanceDetailResponsibility")}
            </Text>
            <View style={[styles.barTrack, { backgroundColor: userTokens.border }]}>
              <View
                style={[
                  styles.barFill,
                  styles.barFillResponsibility,
                  { width: responsibilityWidth, backgroundColor: member.color },
                ]}
              />
            </View>
            <Text style={[styles.barAmount, { color: userTokens.textPrimary }]}>{responsibility}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={styles.container}>
        <Pressable
          onPress={() => setDetailOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={translate(dictionary, "account.redesign.balanceDetailOpenAriaLabel")}
          style={({ pressed }) => [
            styles.bannerPressable,
            pressed ? styles.bannerPressed : null,
          ]}
        >
          <View
            style={[
              styles.banner,
              {
                backgroundColor: hexToRgba(contributionBanner.color, 0.14),
                borderColor: hexToRgba(contributionBanner.color, 0.25),
              },
            ]}
          >
            <View
              style={[
                styles.bannerAvatar,
                { backgroundColor: contributionBanner.color },
              ]}
            >
              <Text style={styles.bannerAvatarText}>{contributionBanner.initials}</Text>
            </View>
            <Text style={[styles.bannerText, { color: userTokens.textPrimary }]}>
              {contributionBanner.message}
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={detailOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDetailOpen(false)}
          accessibilityLabel={translate(dictionary, "account.redesign.balanceDetailCloseAriaLabel")}
        />
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: userTokens.surface,
              borderColor: userTokens.border,
            },
          ]}
        >
          <View style={styles.modalHandleTouchArea} {...handlePanResponder.panHandlers}>
            <View style={[styles.modalHandle, { backgroundColor: userTokens.border }]} />
          </View>

          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: userTokens.textPrimary }]}>
                {translate(dictionary, "account.redesign.balanceDetailTitle")}
              </Text>
              <Text style={[styles.modalPeriod, { color: userTokens.textSecondary }]}>
                {translate(dictionary, "account.redesign.balanceDetailPeriodContext", {
                  period: translate(
                    dictionary,
                    {
                      week: "account.redesign.periodWeek",
                      month: "account.redesign.periodMonth",
                      quarter: "account.redesign.periodQuarter",
                      year: "account.redesign.periodYear",
                    }[period] as any
                  ),
                })}
              </Text>
            </View>

            <Pressable
              onPress={() => setDetailOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={translate(dictionary, "account.redesign.balanceDetailCloseAriaLabel")}
              style={[
                styles.closeButton,
                { borderColor: userTokens.border, backgroundColor: userTokens.surfaceAlt },
              ]}
            >
              <X size={16} color={userTokens.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              detailScrollOffsetY.current = event.nativeEvent.contentOffset.y;
            }}
          >
            {members.map(renderMemberRow)}

            <View style={styles.modalSummary}>
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: hexToRgba(contributionBanner.color, 0.14),
                    borderColor: hexToRgba(contributionBanner.color, 0.25),
                  },
                ]}
              >
                <View
                  style={[
                    styles.bannerAvatar,
                    { backgroundColor: contributionBanner.color },
                  ]}
                >
                  <Text style={styles.bannerAvatarText}>{contributionBanner.initials}</Text>
                </View>
                <Text style={[styles.bannerText, { color: userTokens.textPrimary }]}>
                  {contributionBanner.message}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing["4xl"],
    marginBottom: spacing["4xl"],
    alignItems: "center",
  },
  bannerPressable: {
    maxWidth: "95%",
  },
  bannerPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    maxWidth: "95%",
    gap: spacing.sm,
  },
  bannerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bannerAvatarText: {
    fontFamily: typography.family.sansBold,
    fontSize: 7,
    color: "#FFFFFF",
  },
  bannerText: {
    fontFamily: typography.family.sansMedium,
    fontSize: 11,
    lineHeight: 15,
    flexShrink: 1,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "transparent",
  },
  modalSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  modalHandleTouchArea: {
    alignSelf: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  modalTitle: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size.lg,
  },
  modalPeriod: {
    marginTop: 2,
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.xs,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    marginTop: spacing.md,
  },
  modalBodyContent: {
    paddingBottom: spacing["4xl"],
  },
  memberBlock: {
    borderBottomWidth: 1,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  memberIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  memberAvatarText: {
    fontFamily: typography.family.sansBold,
    fontSize: 8,
    color: "#FFFFFF",
  },
  memberName: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.sm,
    flexShrink: 1,
  },
  balanceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  balanceBadgePositive: {
    backgroundColor: "rgba(27,122,74,0.08)",
  },
  balanceBadgeNegative: {
    backgroundColor: "rgba(196,68,26,0.08)",
  },
  balanceBadgeText: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size.xs,
  },
  bars: {
    marginTop: spacing.sm,
    gap: 5,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  barLabel: {
    width: 84,
    textAlign: "right",
    fontFamily: typography.family.sansMedium,
    fontSize: 10,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  barFillResponsibility: {
    opacity: 0.3,
  },
  barAmount: {
    minWidth: 56,
    fontFamily: typography.family.monoMedium,
    fontSize: 10,
  },
  modalSummary: {
    alignItems: "center",
    paddingBottom: spacing.sm,
  },
});
