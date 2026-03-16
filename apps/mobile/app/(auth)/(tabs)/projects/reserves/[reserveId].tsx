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
  computeSavingsMonthView,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getMonthRangeFromKey,
  getReserveContainerBalanceMinor,
  getReserveContainerStats,
  getReserveTransferDirection,
  themeTokens,
  toMonthKey,
  withAlpha,
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

type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: string | number | null;
  amount_base_minor: string | number | null;
  date: string;
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
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<TransactionRow[]>([]);
  const fillProgress = useRef(new Animated.Value(0)).current;
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const previousMonthKey = useMemo(() => {
    const date = new Date(`${currentMonthKey}-01T00:00:00`);
    date.setMonth(date.getMonth() - 1);
    return toMonthKey(date);
  }, [currentMonthKey]);

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId || !reserveId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentMonthRange = getMonthRangeFromKey(currentMonthKey);
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
        transactionsResult,
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
        supabase
          .from("transactions")
          .select("id, type, amount_minor, amount_base_minor, date")
          .eq("account_id", selectedAccountId)
          .gte("date", currentMonthRange.start)
          .lte("date", currentMonthRange.end)
          .order("date", { ascending: true }),
      ]);

      if (reserveResult.error || !reserveResult.data) {
        throw reserveResult.error ?? new Error("reserve-not-found");
      }
      if (projectsResult.error) throw projectsResult.error;
      if (monthClosesResult.error) throw monthClosesResult.error;
      if (monthCloseAllocationsResult.error) throw monthCloseAllocationsResult.error;
      if (reserveTransfersResult.error) throw reserveTransfersResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setReserveContainer(reserveResult.data as ReserveContainer);
      setProjects((projectsResult.data ?? []) as Project[]);
      setMonthCloses((monthClosesResult.data ?? []) as MonthClose[]);
      setMonthCloseAllocations((monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]);
      setReserveTransfers((reserveTransfersResult.data ?? []) as ReserveTransfer[]);
      setCurrentMonthTransactions((transactionsResult.data ?? []) as TransactionRow[]);
      setMessage(null);
    } catch (loadError) {
      console.error("[ReserveDetail][mobile] load error", loadError);
      setError(locale === "en" ? "Couldn't load reserve." : "No se pudo cargar la reserva.");
    } finally {
      setLoading(false);
    }
  }, [currentMonthKey, locale, reserveId, selectedAccountId, user]);

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

  const currentMonthSavingsMinor = useMemo(
    () =>
      computeSavingsMonthView({
        period: currentMonthKey,
        transactions: currentMonthTransactions,
      }).generatedSavedMinor,
    [currentMonthKey, currentMonthTransactions]
  );

  const savingsHistory = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat(localeCode === "en" ? "en-US" : "es-ES", {
      month: "short",
    });
    const byPeriod = new Map<string, bigint>();

    monthCloses.forEach((monthClose) => {
      byPeriod.set(String(monthClose.period).slice(0, 7), toMinor(monthClose.actual_saved_base_minor));
    });
    byPeriod.set(currentMonthKey, currentMonthSavingsMinor);

    const values = Array.from(byPeriod.values());
    const averageMinor =
      values.length > 0
        ? values.reduce((total, amountMinor) => total + amountMinor, 0n) / BigInt(values.length)
        : 0n;
    const maxMinor = values.reduce(
      (current, amountMinor) => (amountMinor > current ? amountMinor : current),
      0n
    );

    const bars = Array.from({ length: 4 }, (_, index) => {
      const date = new Date(`${currentMonthKey}-01T00:00:00`);
      date.setMonth(date.getMonth() + index - 3);
      const period = toMonthKey(date);
      return {
        period,
        amountMinor: byPeriod.get(period) ?? 0n,
        label: monthFormatter.format(date).replace(".", "").slice(0, 3),
        isCurrent: period === currentMonthKey,
      };
    });

    return {
      currentMinor: currentMonthSavingsMinor,
      previousMinor: byPeriod.get(previousMonthKey) ?? 0n,
      averageMinor,
      maxMinor,
      bars,
    };
  }, [currentMonthKey, currentMonthSavingsMinor, localeCode, monthCloses, previousMonthKey]);

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
  const historyAccent = primaryActionColor;
  const historyDanger = userTokens.dangerText;
  const historyCardBorder = withAlpha(historyAccent, resolvedMode === "dark" ? 0.34 : 0.2);
  const historyCardBackground = withAlpha(
    userTokens.surfaceAlt,
    resolvedMode === "dark" ? 0.92 : 0.76
  );
  const historyCardShadow = withAlpha(historyAccent, resolvedMode === "dark" ? 0.24 : 0.14);
  const historyChipBackground = withAlpha(userTokens.surface, resolvedMode === "dark" ? 0.82 : 0.88);
  const historyTileBackground = withAlpha(userTokens.surface, resolvedMode === "dark" ? 0.68 : 0.82);
  const historyTileBorder = withAlpha(userTokens.border, resolvedMode === "dark" ? 0.92 : 0.82);
  const historyChartBackground = withAlpha(userTokens.surface, resolvedMode === "dark" ? 0.56 : 0.7);
  const historyBaseline = withAlpha(userTokens.border, resolvedMode === "dark" ? 0.94 : 0.88);

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
                  style={[styles.heroAmount, { color: "#FFFFFF" }]}
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

          <View
            style={[
              styles.savingsHistoryCard,
              {
                borderColor: historyCardBorder,
                backgroundColor: historyCardBackground,
                shadowColor: historyCardShadow,
              },
            ]}
          >
            <View style={styles.savingsHistoryHeader}>
              <View style={styles.savingsHistoryHeaderCopy}>
                <Text style={[styles.savingsHistoryEyebrow, { color: historyAccent }]}>
                  {locale === "en" ? "Savings history" : "Historial de ahorro"}
                </Text>
                <Text style={[styles.savingsHistoryTitle, { color: userTokens.textPrimary }]}>
                  {locale === "en" ? "Last 4 months" : "Últimos 4 meses"}
                </Text>
              </View>
              <View
                style={[
                  styles.savingsHistoryChip,
                  {
                    backgroundColor: historyChipBackground,
                    borderColor: historyTileBorder,
                  },
                ]}
              >
                <Text style={[styles.savingsHistoryChipText, { color: userTokens.textSecondary }]}>
                  {locale === "en" ? "Monthly savings" : "Ahorro mensual"}
                </Text>
              </View>
            </View>

            <View style={styles.savingsHistoryStatsGrid}>
              {[
                {
                  label: locale === "en" ? "Current" : "Actual",
                  value: savingsHistory.currentMinor,
                },
                {
                  label: locale === "en" ? "Previous" : "Anterior",
                  value: savingsHistory.previousMinor,
                },
                {
                  label: locale === "en" ? "Average" : "Media",
                  value: savingsHistory.averageMinor,
                },
                {
                  label: locale === "en" ? "Peak" : "Máximo",
                  value: savingsHistory.maxMinor,
                },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={[
                    styles.savingsHistoryStatCard,
                    {
                      backgroundColor: historyTileBackground,
                      borderColor: historyTileBorder,
                    },
                  ]}
                >
                  <Text style={[styles.savingsHistoryStatLabel, { color: userTokens.textSecondary }]}>
                    {stat.label}
                  </Text>
                  <Text style={[styles.savingsHistoryStatValue, { color: userTokens.textPrimary }]}>
                    {formatMoneyWithSymbol(stat.value, baseCurrency, currencySymbol)}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.savingsHistoryChart,
                {
                  backgroundColor: historyChartBackground,
                  borderColor: historyTileBorder,
                },
              ]}
            >
              <View style={[styles.savingsHistoryBaseline, { backgroundColor: historyBaseline }]} />
              <View style={styles.savingsHistoryBarsRow}>
                {savingsHistory.bars.map((bar) => {
                  const height =
                    savingsHistory.maxMinor > 0n && bar.amountMinor > 0n
                      ? Math.max(16, (Number(bar.amountMinor) / Number(savingsHistory.maxMinor)) * 108)
                      : 16;
                  const barColor =
                    bar.amountMinor < 0n
                      ? historyDanger
                      : bar.isCurrent
                        ? historyAccent
                        : withAlpha(historyAccent, resolvedMode === "dark" ? 0.52 : 0.38);

                  return (
                    <View key={bar.period} style={styles.savingsHistoryBarItem}>
                      <View style={styles.savingsHistoryBubbleSlot}>
                        {bar.isCurrent ? (
                          <View
                            style={[
                              styles.savingsHistoryBubble,
                              {
                                backgroundColor: withAlpha(
                                  userTokens.surface,
                                  resolvedMode === "dark" ? 0.88 : 0.92
                                ),
                                borderColor: historyTileBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.savingsHistoryBubbleText,
                                { color: userTokens.textSecondary },
                              ]}
                            >
                              {formatMoneyWithSymbol(bar.amountMinor, baseCurrency, currencySymbol)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.savingsHistoryBarTrack}>
                        <View
                          style={[
                            styles.savingsHistoryBar,
                            {
                              height,
                              backgroundColor: barColor,
                              shadowColor: withAlpha(
                                bar.isCurrent ? historyAccent : userTokens.textPrimary,
                                resolvedMode === "dark" ? 0.26 : 0.16
                              ),
                              opacity: bar.amountMinor === 0n ? 0.55 : 1,
                            },
                          ]}
                        />
                        {bar.isCurrent ? (
                          <View
                            style={[
                              styles.savingsHistoryBarMarker,
                              {
                                backgroundColor: historyAccent,
                                borderWidth: 0,
                              },
                            ]}
                          />
                        ) : null}
                      </View>
                      <Text style={[styles.savingsHistoryBarLabel, { color: userTokens.textSecondary }]}>
                        {bar.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
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
  savingsHistoryCard: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 28,
    padding: 16,
    shadowColor: "#5B8DFF",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  savingsHistoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  savingsHistoryHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  savingsHistoryEyebrow: {
    fontSize: 11,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#5B8DFF",
  },
  savingsHistoryTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: "DMSans-Bold",
  },
  savingsHistoryChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
  },
  savingsHistoryChipText: {
    fontSize: 11,
    fontFamily: "DMSans-Medium",
    color: "#475569",
  },
  savingsHistoryStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  savingsHistoryStatCard: {
    width: "48.5%",
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
  },
  savingsHistoryStatLabel: {
    fontSize: 10,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748B",
  },
  savingsHistoryStatValue: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "DMSans-Bold",
    color: "#0F172A",
  },
  savingsHistoryChart: {
    marginTop: 16,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    position: "relative",
  },
  savingsHistoryBaseline: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 30,
    height: 1,
    backgroundColor: "#D7E3FF",
  },
  savingsHistoryBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 170,
  },
  savingsHistoryBarItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  savingsHistoryBubbleSlot: {
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  savingsHistoryBubble: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.96)",
  },
  savingsHistoryBubbleText: {
    fontSize: 10,
    fontFamily: "DMSans-Medium",
    color: "#475569",
  },
  savingsHistoryBarTrack: {
    width: "100%",
    maxWidth: 30,
    height: 116,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  savingsHistoryBar: {
    width: "100%",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: "hidden",
    shadowColor: "#5B8DFF",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  savingsHistoryBarMarker: {
    position: "absolute",
    bottom: -5,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#5B8DFF",
  },
  savingsHistoryBarLabel: {
    marginTop: 10,
    fontSize: 10,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748B",
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
