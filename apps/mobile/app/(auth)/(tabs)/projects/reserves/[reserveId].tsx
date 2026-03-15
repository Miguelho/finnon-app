import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import {
  CURRENCIES,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getReserveContainerBalanceMinor,
  getReserveContainerStats,
  getReserveTransferDirection,
  themeTokens,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type Project,
  type ReserveContainer,
  type ReserveTransfer,
  type UserRole,
} from "@poleursus/shared";
import { useAuth } from "../../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../../src/lib/i18n";
import { supabase } from "../../../../../src/lib/supabase";
import { Card } from "../../../../../src/components/Card";

const tokens = themeTokens.light;
const AnimatedSvgRect = Animated.createAnimatedComponent(Rect);
const HUCHA_ACCENT = "#4ECDC4";
const HERO_SIZE = 160;
const HERO_CX = HERO_SIZE / 2;
const HERO_CY = HERO_SIZE / 2;
const HERO_RADIUS = HERO_SIZE * 0.41;
const HERO_TRACK_WIDTH = HERO_SIZE * 0.068;

type AccountRow = {
  id: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole; user_id: string }>;
};

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.round(value));
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const getHistoryRowRadius = (index: number, total: number) => {
  if (total <= 1) {
    return {
      borderRadius: tokens.radii.lg,
    };
  }

  if (index === 0) {
    return {
      borderTopLeftRadius: tokens.radii.lg,
      borderTopRightRadius: tokens.radii.lg,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
    };
  }

  if (index === total - 1) {
    return {
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      borderBottomLeftRadius: tokens.radii.lg,
      borderBottomRightRadius: tokens.radii.lg,
    };
  }

  return {
    borderRadius: 10,
  };
};

export default function ReserveDetailScreen() {
  const { reserveId } = useLocalSearchParams<{ reserveId: string }>();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor, resolvedMode } = useUserTheme();
  const insets = useSafeAreaInsets();
  const localeCode: "es" | "en" = locale === "en" ? "en" : "es";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [reserveContainer, setReserveContainer] = useState<ReserveContainer | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [monthCloses, setMonthCloses] = useState<MonthClose[]>([]);
  const [monthCloseAllocations, setMonthCloseAllocations] = useState<MonthCloseAllocation[]>([]);
  const [reserveTransfers, setReserveTransfers] = useState<ReserveTransfer[]>([]);
  const fillProgress = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId || !reserveId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accountResult = await supabase
        .from("accounts")
        .select("id, base_currency, account_members!inner(role, user_id)")
        .eq("id", selectedAccountId)
        .eq("account_members.user_id", user.id)
        .maybeSingle();

      if (accountResult.error || !accountResult.data) {
        throw accountResult.error ?? new Error("account-not-found");
      }

      const account = accountResult.data as AccountRow;
      const accountCurrency = account.base_currency;
      const symbol =
        CURRENCIES.find((item) => item.code === accountCurrency)?.symbol ??
        accountCurrency;

      const [
        reserveResult,
        projectsResult,
        monthClosesResult,
        monthCloseAllocationsResult,
        reserveTransfersResult,
      ] = await Promise.all([
        supabase
          .from("reserve_containers")
          .select("*")
          .eq("account_id", selectedAccountId)
          .eq("id", reserveId)
          .maybeSingle(),
        supabase
          .from("projects")
          .select("*")
          .eq("account_id", selectedAccountId)
          .not("target_amount_base_minor", "is", null)
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("month_closes")
          .select("*")
          .eq("account_id", selectedAccountId)
          .order("period", { ascending: false }),
        supabase
          .from("month_close_allocations")
          .select("*")
          .eq("account_id", selectedAccountId),
        supabase
          .from("reserve_transfers")
          .select("*")
          .eq("account_id", selectedAccountId)
          .order("created_at", { ascending: false }),
      ]);

      if (reserveResult.error || !reserveResult.data) {
        throw reserveResult.error ?? new Error("reserve-not-found");
      }
      if (projectsResult.error) throw projectsResult.error;
      if (monthClosesResult.error) throw monthClosesResult.error;
      if (monthCloseAllocationsResult.error) throw monthCloseAllocationsResult.error;
      if (reserveTransfersResult.error) throw reserveTransfersResult.error;

      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setReserveContainer(reserveResult.data as ReserveContainer);
      setProjects((projectsResult.data ?? []) as Project[]);
      setMonthCloses((monthClosesResult.data ?? []) as MonthClose[]);
      setMonthCloseAllocations((monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]);
      setReserveTransfers((reserveTransfersResult.data ?? []) as ReserveTransfer[]);
      setMessage(null);
    } catch (loadError) {
      console.error("[ReserveDetail][mobile] load error", loadError);
      setError(locale === "en" ? "Couldn't load reserve." : "No se pudo cargar la reserva.");
    } finally {
      setLoading(false);
    }
  }, [locale, reserveId, selectedAccountId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const monthClosesById = useMemo(
    () => new Map(monthCloses.map((monthClose) => [monthClose.id, monthClose])),
    [monthCloses]
  );

  const reserveBalanceMinor = useMemo(
    () =>
      getReserveContainerBalanceMinor({
        reserveContainerId: reserveContainer?.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
      }),
    [monthCloseAllocations, reserveContainer?.id, reserveTransfers]
  );

  const reserveStats = useMemo(
    () =>
      getReserveContainerStats({
        reserveContainerId: reserveContainer?.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
        monthClosesById,
        currentPeriod: toMonthKey(new Date()),
      }),
    [monthCloseAllocations, monthClosesById, reserveContainer?.id, reserveTransfers]
  );

  const activityRows = useMemo(() => {
    if (!reserveContainer) return [];

    const projectById = new Map(projects.map((project) => [project.id, project]));

    const incoming = monthCloseAllocations
      .filter((allocation) => allocation.reserve_container_id === reserveContainer.id)
      .map((allocation) => {
        const monthClose = monthClosesById.get(allocation.month_close_id);
        const period =
          monthClose && typeof monthClose.period === "string"
            ? String(monthClose.period).slice(0, 7)
            : null;
        return {
          id: `allocation:${allocation.id}`,
          label:
            localeCode === "en"
              ? `Month close ${period ? formatMonthLabel(period, localeCode) : ""}`.trim()
              : `Cierre ${period ? formatMonthLabel(period, localeCode) : ""}`.trim(),
          secondary:
            locale === "en" ? "Incoming from month close" : "Entrada desde cierre mensual",
          amountMinor: toMinor(allocation.amount_base_minor),
          createdAt: monthClose?.closed_at ?? allocation.created_at ?? null,
        };
      });

    const transferRows = reserveTransfers
      .filter((transfer) => transfer.source_reserve_container_id === reserveContainer.id)
      .map((transfer) => {
        const project = projectById.get(transfer.destination_project_id);
        const direction = getReserveTransferDirection(transfer);
        return {
          id: `transfer:${transfer.id}`,
          label: project
            ? `${project.emoji || "🎯"} ${project.name}`
            : locale === "en"
              ? direction === "project_to_reserve"
                ? "Project return"
                : "Project transfer"
              : direction === "project_to_reserve"
                ? "Devolucion desde proyecto"
                : "Transferencia a proyecto",
          secondary:
            locale === "en"
              ? direction === "project_to_reserve"
                ? "Incoming return from project"
                : "Outgoing transfer to project"
              : direction === "project_to_reserve"
                ? "Entrada devuelta desde proyecto"
                : "Salida hacia proyecto",
          amountMinor:
            direction === "project_to_reserve"
              ? toMinor(transfer.amount_base_minor)
              : -toMinor(transfer.amount_base_minor),
          createdAt: transfer.created_at ?? null,
        };
      });

    return [...incoming, ...transferRows].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [locale, localeCode, monthCloseAllocations, monthClosesById, projects, reserveContainer, reserveTransfers]);

  const levelTarget = useMemo(() => {
    const maxReference = reserveStats.bestMonth?.amountMinor ?? reserveBalanceMinor;
    if (maxReference <= 0n) return 0.5;
    return Math.min(0.92, Number(reserveBalanceMinor) / Number(maxReference));
  }, [reserveBalanceMinor, reserveStats.bestMonth?.amountMinor]);

  useEffect(() => {
    const animation = Animated.timing(fillProgress, {
      toValue: levelTarget,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [fillProgress, levelTarget]);

  const clipPathId = useMemo(
    () => `reserve-fill-clip-${String(reserveId ?? "default")}`,
    [reserveId]
  );
  const gradientId = useMemo(
    () => `reserve-fill-gradient-${String(reserveId ?? "default")}`,
    [reserveId]
  );
  const fillY = fillProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [HERO_CY + HERO_RADIUS, HERO_CY - HERO_RADIUS],
  });
  const fillHeight = fillProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, HERO_RADIUS * 2 + 2],
  });
  const bestMonthLabel = reserveStats.bestMonth
    ? formatMonthLabel(reserveStats.bestMonth.period, localeCode)
    : null;
  const trackColor =
    resolvedMode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "home.savings.hucha") }} />
        <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
          <ActivityIndicator size="large" color={primaryActionColor} />
        </View>
      </>
    );
  }

  if (!reserveContainer) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "home.savings.hucha") }} />
        <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
          <View style={styles.container}>
            <Card>
              <Text style={[styles.errorText, { color: userTokens.textPrimary }]}>
                {locale === "en" ? "Reserve not found." : "Reserva no encontrada."}
              </Text>
            </Card>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t(dictionary, "home.savings.hucha") }} />
      <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
        <ScrollView
          scrollEnabled={!isSubmitting}
          contentContainerStyle={[
            styles.container,
            { paddingBottom: tokens.spacing.xxl + insets.bottom + 64 },
          ]}
        >
          {error ? (
            <Text style={[styles.feedbackText, styles.inlineError]}>{error}</Text>
          ) : null}
          {message ? <Text style={[styles.feedbackText, styles.successText]}>{message}</Text> : null}

          <View style={styles.hero}>
            <View style={styles.heroCircle}>
              <Svg width={HERO_SIZE} height={HERO_SIZE} style={StyleSheet.absoluteFillObject}>
                <Defs>
                  <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#4ECDC4CC" />
                    <Stop offset="1" stopColor="#26A69AEE" />
                  </LinearGradient>
                  <ClipPath id={clipPathId}>
                    <Circle cx={HERO_CX} cy={HERO_CY} r={HERO_RADIUS - 1} />
                  </ClipPath>
                </Defs>

                <Circle
                  cx={HERO_CX}
                  cy={HERO_CY}
                  r={HERO_RADIUS}
                  stroke={trackColor}
                  strokeWidth={HERO_TRACK_WIDTH}
                  fill="none"
                />
                <AnimatedSvgRect
                  x={HERO_CX - HERO_RADIUS}
                  y={fillY}
                  width={HERO_RADIUS * 2 + 2}
                  height={fillHeight}
                  fill={`url(#${gradientId})`}
                  clipPath={`url(#${clipPathId})`}
                />
                <Circle
                  cx={HERO_CX}
                  cy={HERO_CY}
                  r={HERO_RADIUS}
                  stroke="rgba(78,205,196,0.35)"
                  strokeWidth={1.8}
                  fill="none"
                />
              </Svg>

              <View style={styles.heroCircleContent} pointerEvents="none">
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.heroAmount, { color: HUCHA_ACCENT }]}
                >
                  {formatMoneyWithSymbol(reserveBalanceMinor, baseCurrency, currencySymbol)}
                </Text>
              </View>
            </View>

            <Text style={[styles.heroLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "projects.hucha.accumulated")}
            </Text>
            <Text style={[styles.heroTitle, { color: userTokens.textPrimary }]}>
              {t(dictionary, "home.savings.hucha")}
            </Text>
            <Text style={[styles.heroSubtitle, { color: userTokens.textSecondary }]}>
              {t(dictionary, "projects.hucha.subtitle")}
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <View
              style={[
                styles.summaryCell,
                {
                  backgroundColor: userTokens.surface,
                  borderColor: userTokens.border,
                },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.hucha.thisMonth")}
              </Text>
              <Text style={[styles.summaryValue, { color: HUCHA_ACCENT }]}>
                {formatMoneyWithSymbol(
                  reserveStats.currentMonthContributionMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </Text>
            </View>

            <View
              style={[
                styles.summaryCell,
                {
                  backgroundColor: userTokens.surface,
                  borderColor: userTokens.border,
                },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.hucha.monthlyAverage")}
              </Text>
              <Text style={[styles.summaryValue, { color: HUCHA_ACCENT }]}>
                {formatMoneyWithSymbol(reserveStats.averageMinor, baseCurrency, currencySymbol)}
              </Text>
            </View>

            <View
              style={[
                styles.summaryCell,
                {
                  backgroundColor: userTokens.surface,
                  borderColor: userTokens.border,
                },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.hucha.bestMonth")}
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: reserveStats.bestMonth ? HUCHA_ACCENT : userTokens.textPrimary },
                ]}
              >
                {reserveStats.bestMonth
                  ? formatMoneyWithSymbol(
                      reserveStats.bestMonth.amountMinor,
                      baseCurrency,
                      currencySymbol
                    )
                  : "—"}
              </Text>
              {bestMonthLabel ? (
                <Text style={[styles.summarySubLabel, { color: userTokens.textSecondary }]}>
                  {bestMonthLabel}
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.summaryCell,
                {
                  backgroundColor: userTokens.surface,
                  borderColor: userTokens.border,
                },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.hucha.monthsWithContribution")}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {reserveStats.monthsWithContribution}
              </Text>
            </View>
          </View>

          <View style={styles.historySection}>
            <Text style={[styles.historySectionTitle, { color: userTokens.textSecondary }]}>
              {locale === "en" ? "Contribution history" : "Historial de aportes"}
            </Text>

            {activityRows.length === 0 ? (
              <Text style={[styles.emptyHistoryText, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.hucha.emptyHistory")}
              </Text>
            ) : (
              <View style={styles.historyList}>
                {activityRows.map((row, index) => (
                  <View
                    key={row.id}
                    style={[
                      styles.historyRow,
                      getHistoryRowRadius(index, activityRows.length),
                      { backgroundColor: userTokens.surface },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.historyTitle, { color: userTokens.textSecondary }]}
                    >
                      {row.label}
                    </Text>
                    <Text
                      style={[
                        styles.historyAmount,
                        { color: row.amountMinor >= 0n ? HUCHA_ACCENT : userTokens.textPrimary },
                      ]}
                    >
                      {row.amountMinor >= 0n ? "+" : "-"}
                      {formatMoneyWithSymbol(
                        row.amountMinor >= 0n ? row.amountMinor : -row.amountMinor,
                        baseCurrency,
                        currencySymbol
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  feedbackText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  hero: {
    alignItems: "center",
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  heroCircle: {
    position: "relative",
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCircleContent: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  heroAmount: {
    width: 120,
    textAlign: "center",
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "DMSans-Bold",
  },
  heroLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontFamily: "DMSans-Medium",
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  heroTitle: {
    fontSize: tokens.typography.size.xl,
    fontFamily: "DMSans-Bold",
  },
  heroSubtitle: {
    maxWidth: 260,
    textAlign: "center",
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  summaryCell: {
    width: "48.5%",
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
  },
  summaryLabel: {
    marginBottom: 4,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
  },
  summaryValue: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  summarySubLabel: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  historySection: {
    gap: tokens.spacing.sm,
  },
  historySectionTitle: {
    fontSize: 10,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  emptyHistoryText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Regular",
  },
  historyList: {
    gap: 2,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 14,
  },
  historyTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "DMSans-Regular",
  },
  historyAmount: {
    marginLeft: tokens.spacing.sm,
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Bold",
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  inlineError: {
    color: "#DC2626",
  },
  successText: {
    color: HUCHA_ACCENT,
  },
});
