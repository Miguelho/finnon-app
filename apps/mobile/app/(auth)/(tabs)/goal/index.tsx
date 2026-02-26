import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { supabase } from "../../../../src/lib/supabase";
import { getSessionAccessToken } from "../../../../src/lib/auth";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useNetworkNotice } from "../../../../src/contexts/NetworkNoticeContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { Button } from "../../../../src/components/Button";
import { Card } from "../../../../src/components/Card";
import { Input } from "../../../../src/components/Input";
// InsightsCarousel removed - insights section no longer used
import { GoalSimulator } from "../../../../src/components/goal/GoalSimulator";
import { GoalGamificationSection } from "../../../../src/components/goal/GoalGamification";
import { GoalHistoryHero } from "../../../../src/components/goal/GoalHistoryHero";
import {
  computeGoalProgress,
  computeGoalSummaryView,
  computeGoalSummaryViewV2,
  computeHeroDisplay,
  extractCandidatesFromSections,
  getDayFromDate,
  createTypographyStyles,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getGoalTotalsFromTransactions,
  getMonthlyGoal,
  parseMoneyToMinor,
  parseSavingsCandidates,
  themeTokens,
  toMonthKey,
  type FinancialGoal,
  type GoalTransaction,
  type HeroDisplayData,
  type SavingsCandidateTx,
  type SavingsSummary,
  type UserRole,
  upsertMonthlyGoal,
  CURRENCIES,
  getMonthRangeFromKey,
  getCurrentMonth,
  getPreviousMonth,
  getNextMonth,
  isCurrentMonth,
  parseGoalHistoryResponse,
  parseGoalGamificationResponse,
  computeGoalHistoryView,
  computeCurrentMonthComparison,
  shouldShowGamification,
  type GoalHistoryEntry,
  type GoalGamification as GoalGamificationData,
  type GoalHistoryView,
} from "@poleursus/shared";
import { useCopy, t } from "../../../../src/lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

const formatAbs = (value: bigint) => (value < 0n ? -value : value);

const getStatusColor = (status: "positive" | "negative" | "neutral") => {
  if (status === "positive") return colors.state.positive;
  if (status === "negative") return colors.state.negative;
  return colors.state.neutral;
};

const formatSignedMoney = (
  value: bigint,
  currency: string,
  currencySymbol: string
) => {
  const formatted = formatMoneyWithSymbol(
    formatAbs(value),
    currency,
    currencySymbol
  );
  return value < 0n ? `-${formatted}` : formatted;
};

const formatSignedMoneyWithPlus = (
  value: bigint,
  currency: string,
  currencySymbol: string
) => {
  const formatted = formatMoneyWithSymbol(
    formatAbs(value),
    currency,
    currencySymbol
  );
  if (value === 0n) return formatted;
  return value < 0n ? `-${formatted}` : `+${formatted}`;
};

type AccountInfo = {
  id: string;
  base_currency: string;
  account_members?: { role: UserRole; user_id: string }[];
};

function GoalSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { tokens: userTokens } = useUserTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: userTokens.surface,
              borderTopColor: userTokens.border,
              borderTopWidth: 1,
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: userTokens.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: userTokens.textPrimary }]}>
              {title}
            </Text>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

type RateTooltipProps = {
  label: string;
  body: string;
};

function RateTooltip({ label, body }: RateTooltipProps) {
  const { tokens: userTokens } = useUserTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<View>(null);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (!triggerRef.current) {
      setOpen(true);
      return;
    }
    triggerRef.current.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const windowWidth = Dimensions.get("window").width;
  const tooltipWidth = Math.min(260, windowWidth - tokens.spacing.lg * 2);
  const leftOffset = anchor
    ? Math.min(
        Math.max(tokens.spacing.lg, anchor.x + anchor.width - tooltipWidth),
        windowWidth - tooltipWidth - tokens.spacing.lg
      )
    : tokens.spacing.lg;
  const topOffset = anchor
    ? anchor.y + anchor.height + tokens.spacing.xs
    : tokens.spacing.lg;

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={styles.rateTooltipTrigger}
        hitSlop={8}
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={16}
          color={userTokens.textSecondary}
        />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.rateTooltipOverlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.rateTooltipPopover,
              {
                backgroundColor: userTokens.surface,
                borderColor: userTokens.border,
              },
              { top: topOffset, left: leftOffset, width: tooltipWidth },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.rateTooltipText, { color: userTokens.textSecondary }]}>
              {body}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

type HeroTooltipProps = {
  label: string;
  lines: string[];
  conclusion: string;
};

function HeroTooltip({ label, lines, conclusion }: HeroTooltipProps) {
  const { tokens: userTokens } = useUserTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<View>(null);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (!triggerRef.current) {
      setOpen(true);
      return;
    }
    triggerRef.current.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const windowWidth = Dimensions.get("window").width;
  const tooltipWidth = Math.min(280, windowWidth - tokens.spacing.lg * 2);
  const leftOffset = anchor
    ? Math.min(
        Math.max(tokens.spacing.lg, anchor.x + anchor.width - tooltipWidth),
        windowWidth - tooltipWidth - tokens.spacing.lg
      )
    : tokens.spacing.lg;
  const topOffset = anchor
    ? anchor.y + anchor.height + tokens.spacing.xs
    : tokens.spacing.lg;

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={styles.heroTooltipTrigger}
        hitSlop={8}
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={16}
          color={userTokens.textSecondary}
        />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.rateTooltipOverlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.heroTooltipPopover,
              {
                backgroundColor: userTokens.surface,
                borderColor: userTokens.border,
              },
              { top: topOffset, left: leftOffset, width: tooltipWidth },
            ]}
            onPress={() => {}}
          >
            <View style={styles.heroTooltipLines}>
              {lines.map((line, index) => (
                <Text
                  key={`${line}-${index}`}
                  style={[styles.heroTooltipText, { color: userTokens.textSecondary }]}
                >
                  {line}
                </Text>
              ))}
            </View>
            <Text
              style={[
                styles.heroTooltipConclusion,
                { color: userTokens.textPrimary, borderTopColor: userTokens.border },
              ]}
            >
              {conclusion}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default function GoalScreen() {
  const { user, selectedAccountId } = useAuth();
  const { tokens: userThemeTokens, primaryActionColor } = useUserTheme();
  const { dictionary, locale } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const router = useRouter();

  const [goal, setGoal] = useState<FinancialGoal | null>(null);
  const [transactions, setTransactions] = useState<GoalTransaction[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [userRole, setUserRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [goalSummary, setGoalSummary] = useState<SavingsSummary | null>(null);
  const [savingsCandidates, setSavingsCandidates] = useState<SavingsCandidateTx[]>([]);

  // Month navigation and history
  const monthKey = useMemo(() => toMonthKey(new Date()), []);
  const [selectedMonth, setSelectedMonth] = useState(monthKey);
  const [goalHistory, setGoalHistory] = useState<GoalHistoryEntry[]>([]);
  const [gamification, setGamification] = useState<GoalGamificationData | null>(null);
  const monthLabel = useMemo(() => formatMonthLabel(monthKey, locale), [monthKey, locale]);
  const canEdit = userRole !== "viewer";
  const hasInitialLoadRef = useRef(false);

  const fetchGoalSummary = useCallback(async () => {
    if (!selectedAccountId) return;
    try {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        throw new Error(t(dictionary, "errors.authRequired"));
      }
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
      const params = new URLSearchParams({
        accountId: selectedAccountId,
        month: monthKey,
        origin: "goal",
      });
      const response = await fetch(
        `${apiUrl}/api/goal/savings-candidates?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorKey =
          typeof errorBody?.errorKey === "string"
            ? errorBody.errorKey
            : "errors.internalServer";
        throw new Error(t(dictionary, errorKey as any));
      }
      const payload = await response.json();
      const parsed = parseSavingsCandidates(payload);
      setGoalSummary(parsed.summary);
      // Extract candidates for simulator
      const candidates = extractCandidatesFromSections(parsed.sections);
      setSavingsCandidates(candidates);
    } catch (err) {
      console.error("[GoalScreen] Summary error:", err);
    }
  }, [dictionary, monthKey, selectedAccountId]);

  const fetchGoalHistory = useCallback(async () => {
    if (!selectedAccountId) return;
    try {
      const { data, error } = await supabase.rpc('get_goal_history', {
        p_account_id: selectedAccountId,
        p_limit: 12,
      });

      if (error) throw error;
      if (data) {
        const parsed = parseGoalHistoryResponse(data);
        setGoalHistory(parsed);
      }
    } catch (err) {
      console.error('[GoalScreen] History fetch error:', err);
    }
  }, [selectedAccountId]);

  const fetchGamification = useCallback(async () => {
    if (!selectedAccountId) return;
    try {
      const { data, error } = await supabase.rpc('get_goal_gamification', {
        p_account_id: selectedAccountId,
      });

      if (error) throw error;
      if (data && data.length > 0) {
        const parsed = parseGoalGamificationResponse(data[0]);
        setGamification(parsed);
      }
    } catch (err) {
      console.error('[GoalScreen] Gamification fetch error:', err);
    }
  }, [selectedAccountId]);

  const currencySymbol = useMemo(() => {
    return CURRENCIES.find((currency) => currency.code === baseCurrency)?.symbol ?? baseCurrency;
  }, [baseCurrency]);

  const totals = useMemo(() => getGoalTotalsFromTransactions(transactions), [transactions]);
  const progress = useMemo(() => {
    if (goalSummary) {
      const summaryTotals = {
        incomeTotalMinor: goalSummary.incomeMinor,
        expenseTotalMinor: goalSummary.expenseMinor,
      };
      const summaryNow = goalSummary.today
        ? new Date(`${goalSummary.today}T00:00:00`)
        : undefined;
      return computeGoalProgress({ goal, totals: summaryTotals, now: summaryNow });
    }
    return computeGoalProgress({ goal, totals });
  }, [goal, goalSummary, totals]);
  const summaryView = useMemo(
    () => computeGoalSummaryView(goalSummary),
    [goalSummary]
  );

  // V2: Métricas con fecha estimada de cumplimiento
  const summaryViewV2 = useMemo(
    () => computeGoalSummaryViewV2(goalSummary),
    [goalSummary]
  );

  // V3: Simplified hero display
  const heroDisplay = useMemo(
    () => computeHeroDisplay(goalSummary),
    [goalSummary]
  );
  const displayProgress = useMemo(() => {
    // V2: Usar métricas que incluyen pendientes cuando estén disponibles
    if (summaryViewV2) {
      return {
        targetMinor: summaryViewV2.targetMinor,
        savedMinor: summaryViewV2.savedTotalMinor, // Real + pendientes
        remainingMinor: summaryViewV2.remainingMinor,
        ratePerDayMinor: summaryView?.requiredDailyFromTodayMinor ?? 0n,
        progressRatio: summaryViewV2.progressRatio,
        status: summaryViewV2.status,
      };
    }
    if (summaryView) {
      return {
        targetMinor: summaryView.targetMinor,
        savedMinor: summaryView.savedMinor,
        remainingMinor: summaryView.remainingMinor,
        ratePerDayMinor: summaryView.requiredDailyFromTodayMinor,
        progressRatio: summaryView.progressRatio,
        status: summaryView.status,
      };
    }
    if (progress) {
      return {
        targetMinor: progress.targetMinor,
        savedMinor: progress.savedMinor,
        remainingMinor: progress.remainingMinor,
        ratePerDayMinor: progress.ratePerDayMinor,
        progressRatio: progress.progressRatio,
        status: progress.status,
      };
    }
    return null;
  }, [progress, summaryView, summaryViewV2]);
  const simulatorCopy = useMemo(
    () => ({
      title: t(dictionary, "goal.simulator.title"),
      subtitle: {
        retrasado: t(dictionary, "goal.simulator.subtitle.retrasado"),
        enRiesgo: t(dictionary, "goal.simulator.subtitle.enRiesgo"),
        adelantado: t(dictionary, "goal.simulator.subtitle.adelantado"),
      },
      linkText: t(dictionary, "goal.simulator.linkText"),
      impact: {
        empty: t(dictionary, "goal.simulator.impact.empty"),
        emptyDetail: t(dictionary, "goal.simulator.impact.emptyDetail"),
        daysEarlier: (days: number) =>
          t(dictionary, "goal.simulator.impact.daysEarlier", { days }),
        reachGoal: t(dictionary, "goal.simulator.impact.reachGoal"),
        remaining: (amount: string) =>
          t(dictionary, "goal.simulator.impact.remaining", { amount }),
        savings: (amount: string) =>
          t(dictionary, "goal.simulator.impact.savings", { amount }),
      },
      itemImpact: (days: number) =>
        t(dictionary, "goal.simulator.itemImpact", { days }),
      noItems: t(dictionary, "goal.simulator.noItems"),
    }),
    [dictionary]
  );

  // History and gamification computed values
  const isViewingCurrentMonth = useMemo(
    () => isCurrentMonth(selectedMonth),
    [selectedMonth]
  );

  const minMonth = useMemo(() => {
    if (goalHistory.length === 0) return undefined;
    return goalHistory[goalHistory.length - 1]?.month;
  }, [goalHistory]);

  const canGoBack = goal ? !minMonth || selectedMonth > minMonth : false;
  const canGoForward = goal ? !isCurrentMonth(selectedMonth) : false;

  const handlePreviousMonth = () => {
    if (canGoBack) {
      setSelectedMonth(getPreviousMonth(selectedMonth));
    }
  };

  const handleNextMonth = () => {
    if (canGoForward) {
      setSelectedMonth(getNextMonth(selectedMonth));
    }
  };

  const currentHistoryView = useMemo(() => {
    if (isViewingCurrentMonth || !gamification) return null;
    const entry = goalHistory.find((h) => h.month === selectedMonth);
    if (!entry) return null;
    return computeGoalHistoryView(entry, gamification);
  }, [selectedMonth, goalHistory, gamification, isViewingCurrentMonth]);

  const currentComparison = useMemo(() => {
    if (!isViewingCurrentMonth || !gamification || !summaryViewV2) return null;
    const estimatedDayPart = summaryViewV2.estimatedCompletionDate?.split("-")[2];
    const estimatedDay = estimatedDayPart ? parseInt(estimatedDayPart, 10) : null;
    return computeCurrentMonthComparison(
      goalSummary?.savedRealMinor ?? 0n,
      estimatedDay,
      gamification
    );
  }, [isViewingCurrentMonth, gamification, summaryViewV2, goalSummary]);

  const gamificationCopy = useMemo(() => ({
    gamificationTitle: t(dictionary, 'goal.history.gamificationTitle'),
    streakLabel: t(dictionary, 'goal.history.streakLabel'),
    streak: (months: number) => t(dictionary, 'goal.history.streak', { months }),
    historyLabel: t(dictionary, 'goal.history.historyLabel'),
    history: (completed: number, total: number) =>
      t(dictionary, 'goal.history.historyFormat', { completed, total }),
    comparisonTitle: t(dictionary, 'goal.history.comparisonTitle'),
    comparisonSaved: t(dictionary, 'goal.history.comparisonSaved'),
    comparisonVelocity: t(dictionary, 'goal.history.comparisonVelocity'),
    savedPositive: (amount: string) =>
      t(dictionary, 'goal.history.savedPositive', { amount }),
    savedNegative: (amount: string) =>
      t(dictionary, 'goal.history.savedNegative', { amount }),
    velocityPositive: (days: number) => t(dictionary, 'goal.history.velocityPositive', { days }),
    velocityNegative: (days: number) => t(dictionary, 'goal.history.velocityNegative', { days }),
  }), [dictionary]);

  const historyHeroCopy = useMemo(() => ({
    completedLabel: t(dictionary, 'goal.history.completedLabel'),
    failedLabel: t(dictionary, 'goal.history.failedLabel'),
    completedOnDay: t(dictionary, 'goal.history.completedOnDay', { day: 0 }),
    completedOnDayDelta: t(dictionary, 'goal.history.completedOnDayDelta', { day: 0, delta: 0 }),
    completedOnDayDeltaLate: t(dictionary, 'goal.history.completedOnDayDeltaLate', { day: 0, delta: 0 }),
    missedBy: t(dictionary, 'goal.history.missedBy', { amount: '' }),
    finalAmount: t(dictionary, 'goal.history.finalAmount'),
    targetWas: t(dictionary, 'goal.history.targetWas', { amount: '' }),
    exceededBy: t(dictionary, 'goal.history.exceededBy', { amount: '' }),
  }), [dictionary]);

  const formattedTarget = displayProgress
    ? formatMoneyWithSymbol(displayProgress.targetMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedSaved = displayProgress
    ? formatSignedMoney(displayProgress.savedMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const progressColor = getStatusColor(displayProgress?.status ?? "neutral");
  const progressWidth = displayProgress ? `${Math.round(displayProgress.progressRatio * 100)}%` : "0%";
  const hasTransactions = transactions.length > 0;
  const simulatorCategoriesById = useMemo(() => {
    return transactions.reduce<Record<string, { name: string; icon_id: string | null }>>(
      (acc, tx) => {
        const categoryId = tx.category?.id;
        if (!categoryId || acc[categoryId]) return acc;
        acc[categoryId] = {
          name: tx.category?.name ?? t(dictionary, "transactions.uncategorized"),
          icon_id: tx.category?.icon_id ?? null,
        };
        return acc;
      },
      {}
    );
  }, [dictionary, transactions]);

  const simulatorMonthStatus = useMemo<
    "adelantado" | "en_riesgo" | "retrasado" | null
  >(() => {
    if (summaryViewV2?.monthStatus) return summaryViewV2.monthStatus;
    if (!displayProgress) return null;
    switch (displayProgress.status) {
      case "positive":
        return "adelantado";
      case "negative":
        return "retrasado";
      case "neutral":
      default:
        return "en_riesgo";
    }
  }, [displayProgress, summaryViewV2?.monthStatus]);

  const goalAmountStatus = useMemo(() => {
    if (heroDisplay && goalSummary) {
      const savedReal = heroDisplay.savedRealMinor;
      const savedTotal = goalSummary.savedTotalMinor ?? savedReal;
      const target = heroDisplay.targetMinor;
      if (savedReal >= target) return "positive";
      if (savedTotal >= target) return "warning";
      return "negative";
    }
    if (displayProgress?.status === "positive") return "positive";
    if (displayProgress?.status === "negative") return "negative";
    return "warning";
  }, [displayProgress?.status, goalSummary, heroDisplay]);

  const monthNavigator = goal ? (
    <View style={styles.monthNavRow}>
      <TouchableOpacity
        onPress={handlePreviousMonth}
        disabled={!canGoBack}
        accessibilityLabel="Previous month"
        style={[
          styles.monthNavButton,
          {
            backgroundColor: userThemeTokens.surface,
            borderColor: userThemeTokens.border,
          },
          !canGoBack && styles.monthNavButtonDisabled,
        ]}
      >
        <ChevronLeft
          size={18}
          color={canGoBack ? userThemeTokens.textPrimary : userThemeTokens.textSecondary}
        />
      </TouchableOpacity>
      <Text
        style={[
          styles.subtitle,
          styles.monthNavLabel,
          { color: userThemeTokens.textSecondary },
        ]}
      >
        {isViewingCurrentMonth
          ? monthLabel
          : formatMonthLabel(selectedMonth, locale)}
      </Text>
      <TouchableOpacity
        onPress={handleNextMonth}
        disabled={!canGoForward}
        accessibilityLabel="Next month"
        style={[
          styles.monthNavButton,
          {
            backgroundColor: userThemeTokens.surface,
            borderColor: userThemeTokens.border,
          },
          !canGoForward && styles.monthNavButtonDisabled,
        ]}
      >
        <ChevronRight
          size={18}
          color={canGoForward ? userThemeTokens.textPrimary : userThemeTokens.textSecondary}
        />
      </TouchableOpacity>
    </View>
  ) : null;

  const heroTooltipData = useMemo(() => {
    if (!summaryViewV2 || !goalSummary) return null;

    const currentSavingMinor = goalSummary.savedRealMinor ?? goalSummary.savedMinor;
    const pendingNetMinor =
      (goalSummary.incomePendingMinor ?? 0n) -
      (goalSummary.expensePendingMinor ?? 0n);

    const lines = [
      t(dictionary, "goal.heroTooltip.currentSaving", {
        amount: formatMoneyWithSymbol(
          currentSavingMinor,
          baseCurrency,
          currencySymbol
        ),
      }),
      t(dictionary, "goal.heroTooltip.target", {
        amount: formatMoneyWithSymbol(
          summaryViewV2.targetMinor,
          baseCurrency,
          currencySymbol
        ),
      }),
    ];

    if (summaryViewV2.completionStatus !== "completed_today") {
      lines.push(
        t(dictionary, "goal.heroTooltip.pendingNet", {
          amount: formatSignedMoneyWithPlus(
            pendingNetMinor,
            baseCurrency,
            currencySymbol
          ),
        })
      );
    }

    if (summaryViewV2.completionStatus === "completed_today") {
      return {
        lines,
        conclusion: t(dictionary, "goal.heroTooltip.conclusionCompleted"),
      };
    }

    if (summaryViewV2.completionStatus === "completion_date") {
      const day = getDayFromDate(summaryViewV2.estimatedCompletionDate);
      return {
        lines,
        conclusion:
          day !== null
            ? t(dictionary, "goal.heroTooltip.conclusionWillComplete", { day })
            : t(dictionary, "goal.heroTooltip.conclusionNotAchievable"),
      };
    }

    return {
      lines,
      conclusion: t(dictionary, "goal.heroTooltip.conclusionNotAchievable"),
    };
  }, [baseCurrency, currencySymbol, dictionary, goalSummary, summaryViewV2]);

  const loadData = useCallback(async (options?: { blocking?: boolean }) => {
    if (!selectedAccountId || !user) return;
    const blocking = options?.blocking ?? !hasInitialLoadRef.current;

    if (blocking) {
      setLoading(true);
    }
    setError(null);

    try {
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("id, base_currency, account_members!inner(role, user_id)")
        .eq("id", selectedAccountId)
        .eq("account_members.user_id", user.id)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!accountData) {
        setError(t(dictionary, "errors.accountNotFound"));
        return;
      }

      const account = accountData as AccountInfo;
      setBaseCurrency(account.base_currency);
      setUserRole(account.account_members?.[0]?.role ?? "viewer");

      const { start } = getMonthRangeFromKey(monthKey);
      const todayKey = new Date().toISOString().slice(0, 10);
      const [goalData, transactionsResult] = await Promise.all([
        getMonthlyGoal(supabase, selectedAccountId, monthKey),
        supabase
          .from("transactions")
          .select("type, amount_minor, amount_base_minor, category:categories(id, name, icon_id)")
          .eq("account_id", selectedAccountId)
          .gte("date", start)
          .lte("date", todayKey),
      ]);
      const { data: transactionsData, error: transactionsError } = transactionsResult;
      if (transactionsError) throw transactionsError;

      setGoal(goalData);
      setTransactions((transactionsData as GoalTransaction[]) ?? []);
      hasInitialLoadRef.current = true;

      // Non-critical data is fetched in background to reduce TTI.
      void fetchGoalSummary();
      if (goalData) {
        void fetchGoalHistory();
        void fetchGamification();
      } else {
        setGoalHistory([]);
        setGamification(null);
      }

      setError(null);
    } catch (err: any) {
      console.error("[GoalScreen] Error:", err);
      if (blocking) {
        setError(err?.message ?? t(dictionary, "errors.internalServer"));
      }
      reportNetworkIssue({ onRetry: () => void loadData({ blocking: true }) });
    } finally {
      if (blocking) {
        setLoading(false);
      }
    }
  }, [dictionary, fetchGoalSummary, fetchGoalHistory, fetchGamification, monthKey, reportNetworkIssue, selectedAccountId, user]);

  useEffect(() => {
    if (!isFocused) return;
    void loadData({ blocking: !hasInitialLoadRef.current });
  }, [isFocused, loadData]);

  const handleOpenEditor = () => {
    setFormError(null);
    if (goal) {
      const value = formatMinorToMoney(displayProgress?.targetMinor ?? 0n, baseCurrency);
      setAmountInput(value);
    } else {
      setAmountInput("");
    }
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!canEdit || !user || !selectedAccountId) return;

    const cleaned = amountInput.trim();
    const parsed = parseMoneyToMinor(cleaned, baseCurrency);
    if (typeof parsed === "object" && "error" in parsed) {
      setFormError(t(dictionary, parsed.error.key, parsed.error.params));
      return;
    }

    if (parsed <= 0n) {
      setFormError(t(dictionary, "money.invalidAmount"));
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const nextGoal = await upsertMonthlyGoal({
        client: supabase,
        accountId: selectedAccountId,
        month: monthKey,
        targetAmountBaseMinor: parsed,
        createdBy: user.id,
      });
      setGoal(nextGoal);
      fetchGoalSummary();
      setIsSheetOpen(false);
    } catch (err: any) {
      console.error("[GoalScreen] Save error:", err);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        err?.message ?? t(dictionary, "errors.internalServer")
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  if (loading) {
    return (
      <View
        style={[
          styles.loading,
          { paddingTop: tokens.spacing.lg, backgroundColor: userThemeTokens.background },
        ]}
      >
        <ActivityIndicator size="large" color={primaryActionColor} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.errorContainer,
          { paddingTop: tokens.spacing.lg, backgroundColor: userThemeTokens.background },
        ]}
      >
        <Text style={[styles.errorTitle, { color: userThemeTokens.textPrimary }]}>
          {t(dictionary, "common.errorTitle")}
        </Text>
        <Text style={[styles.errorText, { color: userThemeTokens.textSecondary }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[
            styles.retryButton,
            {
              borderColor: userThemeTokens.border,
              backgroundColor: userThemeTokens.surface,
            },
          ]}
          onPress={() => void loadData({ blocking: true })}
        >
          <Text style={[styles.retryButtonText, { color: userThemeTokens.textPrimary }]}>
            {t(dictionary, "common.retry")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.root, { backgroundColor: userThemeTokens.background }]}>
        <ScrollView
          style={[styles.scrollView, { backgroundColor: userThemeTokens.background }]}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: tokens.spacing.lg, paddingBottom: 120 + insets.bottom },
          ]}
        >
          {/* CURRENT MONTH VIEW */}
          {goal && isViewingCurrentMonth ? (
            <>
            <Card>
            {/* V3: Simplified hero */}
            <View style={styles.heroEditRow}>
              {monthNavigator}
              <Button
                title={t(dictionary, "goal.heroEditShort")}
                onPress={handleOpenEditor}
                disabled={!canEdit}
                variant="secondary"
                size="small"
              />
            </View>

            {/* Main savings amount - big and centered */}
            <View style={styles.heroMainSection}>
              <Text
                style={[
                  styles.heroMainAmount,
                  goalAmountStatus === "positive"
                    ? { color: colors.state.positive }
                    : goalAmountStatus === "warning"
                      ? { color: colors.state.warning }
                      : { color: colors.state.negative },
                ]}
              >
                {heroDisplay
                  ? formatSignedMoney(
                      heroDisplay.savedRealMinor,
                      baseCurrency,
                      currencySymbol
                    )
                  : formattedSaved}
              </Text>
              <Text
                style={[
                  styles.heroTargetContext,
                  { color: userThemeTokens.textSecondary },
                ]}
              >
                {t(dictionary, "goal.heroTargetContext", { amount: formattedTarget })}
              </Text>
              <View style={styles.heroLegendRow}>
                <View style={styles.heroLegendItem}>
                  <View
                    style={[
                      styles.heroLegendDot,
                      { backgroundColor: colors.state.positive },
                    ]}
                  />
                  <Text
                    style={[
                      styles.heroLegendText,
                      { color: userThemeTokens.textSecondary },
                    ]}
                  >
                    {t(dictionary, "goal.amountLegend.onTarget")}
                  </Text>
                </View>
                <View style={styles.heroLegendItem}>
                  <View
                    style={[
                      styles.heroLegendDot,
                      { backgroundColor: colors.state.warning },
                    ]}
                  />
                  <Text
                    style={[
                      styles.heroLegendText,
                      { color: userThemeTokens.textSecondary },
                    ]}
                  >
                    {t(dictionary, "goal.amountLegend.pendingTarget")}
                  </Text>
                </View>
                <View style={styles.heroLegendItem}>
                  <View
                    style={[
                      styles.heroLegendDot,
                      { backgroundColor: colors.state.negative },
                    ]}
                  />
                  <Text
                    style={[
                      styles.heroLegendText,
                      { color: userThemeTokens.textSecondary },
                    ]}
                  >
                    {t(dictionary, "goal.amountLegend.offTarget")}
                  </Text>
                </View>
              </View>
            </View>

            {/* Progress bar based on real savings */}
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: userThemeTokens.border },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: heroDisplay
                      ? `${Math.round(heroDisplay.realProgressRatio * 100)}%`
                      : progressWidth,
                    backgroundColor: heroDisplay
                      ? heroDisplay.barStatus === "positive"
                        ? colors.state.positive
                        : heroDisplay.barStatus === "negative"
                        ? colors.state.negative
                        : colors.state.neutral
                      : progressColor,
                  },
                ]}
              />
            </View>

            {/* Projection chip - only show when applicable */}
            {heroDisplay?.projection && (
              <View style={styles.projectionChip}>
                <Text style={styles.projectionArrow}>↑</Text>
                <Text style={styles.projectionText}>
                  {t(dictionary, "goal.heroProjection", {
                    day: heroDisplay.projection.day,
                    amount: formatMoneyWithSymbol(
                      heroDisplay.projection.amountMinor,
                      baseCurrency,
                      currencySymbol
                    ),
                  })}
                </Text>
              </View>
            )}

            {!hasTransactions && (
              <Text
                style={[
                  styles.helperTextCentered,
                  { color: userThemeTokens.textSecondary },
                ]}
              >
                {t(dictionary, "goal.noTransactions")}
              </Text>
            )}
          </Card>

          {/* Gamification Section - Only if there's history */}
          {gamification && shouldShowGamification(gamification) && (
            <GoalGamificationSection
              gamification={gamification}
              comparison={currentComparison}
              baseCurrency={baseCurrency}
              currencySymbol={currencySymbol}
              copy={gamificationCopy}
            />
          )}

          {/* Simulator - Only for current month */}
          {simulatorMonthStatus && (
            <GoalSimulator
              monthStatus={simulatorMonthStatus}
              candidates={savingsCandidates}
              baseCurrency={baseCurrency}
              currencySymbol={currencySymbol}
              gapToGoalMinor={
                summaryViewV2?.remainingMinor ??
                displayProgress?.remainingMinor ??
                goalSummary?.gapToGoalMinor ??
                null
              }
              categoriesById={simulatorCategoriesById}
              copy={simulatorCopy}
            />
          )}
        </>
        ) : goal && currentHistoryView ? (
          /* PAST MONTH VIEW */
          <>
            <GoalHistoryHero
              view={currentHistoryView}
              baseCurrency={baseCurrency}
              currencySymbol={currencySymbol}
              copy={historyHeroCopy}
              monthNavigator={monthNavigator}
            />
          </>
        ) : goal && !isViewingCurrentMonth ? (
          /* PAST MONTH - NO DATA */
          <>
            <Card style={styles.emptyCard}>
              <View style={styles.monthNavContainer}>{monthNavigator}</View>
              <Text style={[styles.emptyText, { color: userThemeTokens.textSecondary }]}>
                {t(dictionary, 'goal.history.noHistory')}
              </Text>
            </Card>
          </>
          ) : (
            /* NO GOAL - EMPTY STATE */
            <Card>
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { color: userThemeTokens.textPrimary }]}>
                  {t(dictionary, "goal.emptyTitle")}
                </Text>
                <Text
                  style={[
                    styles.emptyDescription,
                    { color: userThemeTokens.textSecondary },
                  ]}
                >
                  {t(dictionary, "goal.emptyDescription")}
                </Text>
                <Button
                  title={t(dictionary, "goal.createCta")}
                  onPress={handleOpenEditor}
                  disabled={!canEdit}
                  variant="secondary"
                />
              </View>
            </Card>
          )}
        </ScrollView>
      </View>

      <GoalSheet
        visible={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={t(dictionary, "goal.editorTitle")}
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetDescription, { color: userThemeTokens.textSecondary }]}>
            {t(dictionary, "goal.editorDescription")}
          </Text>
          <Input
            label={t(dictionary, "goal.amountLabel")}
            value={amountInput}
            onChangeText={(value) => setAmountInput(sanitizeNumericInput(value))}
            placeholder={t(dictionary, "goal.amountPlaceholder")}
            keyboardType="numeric"
            error={formError ?? undefined}
          />
          <View style={styles.sheetActions}>
            <Button
              title={t(dictionary, "common.cancel")}
              onPress={() => setIsSheetOpen(false)}
              variant="secondary"
              disabled={isSaving}
            />
            <Button
              title={isSaving ? t(dictionary, "goal.savingCta") : t(dictionary, "goal.saveCta")}
              onPress={handleSave}
              loading={isSaving}
              disabled={isSaving || !canEdit}
            />
          </View>
        </View>
      </GoalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    color: colors.text.secondary,
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.xs,
  },
  monthNavLabel: {
    textTransform: "capitalize",
  },
  monthNavContainer: {
    alignItems: "flex-start",
    marginBottom: tokens.spacing.sm,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
  },
  monthNavButtonDisabled: {
    opacity: 0.5,
  },
  cardSection: {
    gap: tokens.spacing.sm,
  },
  // V3: Simplified hero styles
  heroEditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroMainSection: {
    alignItems: "center",
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  heroMainAmount: {
    fontSize: 36,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
    lineHeight: 40,
  },
  heroTargetContext: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
  },
  heroLegendRow: {
    marginTop: tokens.spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    rowGap: tokens.spacing.xs,
    columnGap: tokens.spacing.md,
  },
  heroLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  heroLegendText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
  },
  projectionChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.xs,
    backgroundColor: `${colors.state.positive}15`,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  projectionArrow: {
    fontSize: tokens.typography.size.sm,
    color: colors.state.positive,
  },
  projectionText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.state.positive,
  },
  helperTextCentered: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
  // Legacy hero styles (kept for reference)
  heroLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
  },
  heroValue: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.xs,
  },
  monthStatusText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    marginTop: tokens.spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: tokens.radii.pill,
    backgroundColor: colors.state.neutral,
    overflow: "hidden",
    marginTop: tokens.spacing.md,
  },
  progressFill: {
    height: "100%",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.lg,
    marginTop: tokens.spacing.lg,
  },
  metricItem: {
    minWidth: 120,
    gap: tokens.spacing.xs,
  },
  metricLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  metricLabel: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
  },
  metricValue: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  rateHelperText: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  rateTooltipTrigger: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  rateTooltipOverlay: {
    flex: 1,
  },
  rateTooltipPopover: {
    position: "absolute",
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  rateTooltipText: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  heroTooltipTrigger: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  heroTooltipPopover: {
    position: "absolute",
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    gap: tokens.spacing.xs,
  },
  heroTooltipLines: {
    gap: tokens.spacing.xs,
  },
  heroTooltipText: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  heroTooltipConclusion: {
    paddingTop: tokens.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  helperText: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  cardActions: {
    marginTop: tokens.spacing.lg,
  },
  emptyState: {
    gap: tokens.spacing.sm,
  },
  emptyTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  emptyDescription: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheetContainer: {
    backgroundColor: colors.bg.surface,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    gap: tokens.spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 4,
    borderRadius: tokens.radii.pill,
    backgroundColor: colors.state.neutral,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  sheetContent: {
    gap: tokens.spacing.lg,
  },
  sheetDescription: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  sheetActions: {
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  errorTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  retryButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  emptyCard: {
    padding: tokens.spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
