import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  assignProjectColor,
  buildProjectColorMap,
  computePendingMonthCloseKeysFromMonthCloses,
  computeProjectProgress,
  CURRENCIES,
  DEFAULT_PROJECT_EMOJI,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getMonthlyProjectCommitmentTotal,
  getProjectColor,
  getProjectReserveTransferTotalsMap,
  getReserveContainerStats,
  parseMoneyToMinor,
  PROJECT_EMOJI_SUGGESTIONS,
  semanticColorTokens,
  themeTokens,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Project,
  type ReserveContainer,
  type ReserveTransfer,
  type UserRole,
} from "@poleursus/shared";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useDataCache } from "../../../../src/cache/DataCacheProvider";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";
import { Button } from "../../../../src/components/Button";
import { Card } from "../../../../src/components/Card";
import { HuchaLiquidCanvas } from "../../../../src/components/HuchaLiquidCanvas";
import { Input } from "../../../../src/components/Input";
import { ProjectProgressRing } from "../../../../src/components/projects/ProjectProgressRing";

const tokens = themeTokens.light;
const SAVINGS_VALUE_COLOR = semanticColorTokens.savings.primary;

const HUCHA_ACCENT = "#4ECDC4";
const RETURN_ACCENT = "#74C69D";
const FLOW_HEIGHT = 28;
const PROJECT_CARD_WIDTH = 198;
const PROJECT_CARD_MIN_HEIGHT = 286;

type TransferMode = "add" | "ret";

type AccountRow = {
  id: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole; user_id: string }>;
};

type ProjectViewModel = {
  project: Project;
  projectColor: string;
  progress: ReturnType<typeof computeProjectProgress>;
  progressPercent: number;
  durationLabel: string | null;
  dateLabel: string | null;
  returnableMinor: bigint;
};

type ProjectCarouselItem =
  | { kind: "project"; id: string; projectId: string }
  | { kind: "add"; id: "add" };

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

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

const maxBigInt = (...values: bigint[]) =>
  values.reduce((current, value) => (value > current ? value : current), 0n);

const moveProjectToFront = (projects: Project[], projectId: string) => {
  const nextProjects = [...projects];
  const index = nextProjects.findIndex((project) => project.id === projectId);
  if (index <= 0) return nextProjects;
  const [project] = nextProjects.splice(index, 1);
  if (!project) return nextProjects;
  nextProjects.unshift(project);
  return nextProjects;
};

const formatDurationLabel = (months: number, locale: "es" | "en") => {
  if (months <= 0) return locale === "en" ? "Reached" : "Alcanzado";
  if (months < 12) {
    if (locale === "en") {
      return `In ${months} month${months === 1 ? "" : "s"}`;
    }
    return `En ${months} mes${months === 1 ? "" : "es"}`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (locale === "en") {
    if (remainingMonths === 0) {
      return `In ${years} year${years === 1 ? "" : "s"}`;
    }
    return `In ${years}y ${remainingMonths}m`;
  }

  if (remainingMonths === 0) {
    return `En ${years} ano${years === 1 ? "" : "s"}`;
  }
  return `En ${years}a ${remainingMonths}m`;
};

const formatEstimatedDate = (date: Date, locale: "es" | "en") =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "short",
    year: "numeric",
  }).format(date);

const computeCumulativePeakMinor = (series: Array<{ amountMinor: bigint }>) => {
  let runningTotal = 0n;
  let peak = 0n;

  series.forEach((row) => {
    runningTotal += row.amountMinor;
    if (runningTotal > peak) peak = runningTotal;
  });

  return peak;
};

function FlowTransferIndicator({
  visible,
  direction,
  left,
}: {
  visible: boolean;
  direction: TransferMode | null;
  left: number;
}) {
  const lineProgress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const dotProgress = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const dotLoopsRef = useRef<Array<Animated.CompositeAnimation | null>>([null, null, null]);

  useEffect(() => {
    Animated.timing(lineProgress, {
      toValue: visible ? 1 : 0,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [lineProgress, visible]);

  useEffect(() => {
    dotLoopsRef.current.forEach((loop, index) => {
      loop?.stop();
      dotProgress[index]?.setValue(0);
    });

    if (!visible || !direction) return;

    dotProgress.forEach((value, index) => {
      value.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 500),
          Animated.timing(value, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      dotLoopsRef.current[index] = loop;
      loop.start();
    });

    return () => {
      dotLoopsRef.current.forEach((loop, index) => {
        loop?.stop();
        dotProgress[index]?.setValue(0);
      });
    };
  }, [direction, dotProgress, visible]);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flowLine,
          {
            left,
            height: lineProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, FLOW_HEIGHT],
            }),
            opacity: lineProgress,
          },
        ]}
      />
      {direction ? (
        <View pointerEvents="none" style={[styles.flowDots, { left }]}>
          {dotProgress.map((value, index) => {
            const translateY = value.interpolate({
              inputRange: [0, 1],
              outputRange: direction === "ret" ? [24, 0] : [0, 24],
            });
            const opacity = value.interpolate({
              inputRange: [0, 0.15, 0.85, 1],
              outputRange: [0, 1, 1, 0],
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.flowDot,
                  {
                    transform: [{ translateY }],
                    opacity,
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}
    </>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const { emitMutation } = useDataCache();
  const insets = useSafeAreaInsets();
  const localeCode: "es" | "en" = locale === "en" ? "en" : "es";

  const flatListRef = useRef<FlatList<ProjectCarouselItem> | null>(null);
  const cardOpacityMapRef = useRef<Map<string, Animated.Value>>(new Map());
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [orderedProjects, setOrderedProjects] = useState<Project[]>([]);
  const [reserveContainers, setReserveContainers] = useState<ReserveContainer[]>([]);
  const [fundingPlans, setFundingPlans] = useState<MonthlyProjectFundingPlan[]>([]);
  const [monthCloses, setMonthCloses] = useState<MonthClose[]>([]);
  const [monthCloseAllocations, setMonthCloseAllocations] = useState<MonthCloseAllocation[]>([]);
  const [reserveTransfers, setReserveTransfers] = useState<ReserveTransfer[]>([]);
  const [extraContributions, setExtraContributions] = useState<
    Array<{ project_id: string | null; amount_base_minor: bigint | number | string | null }>
  >([]);
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [hasPendingMonthlyClose, setHasPendingMonthlyClose] = useState(false);
  const [pendingMonthKey, setPendingMonthKey] = useState(addMonths(toMonthKey(new Date()), -1));

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<TransferMode | null>(null);
  const [transferInput, setTransferInput] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [emojiInput, setEmojiInput] = useState(DEFAULT_PROJECT_EMOJI);
  const [targetInput, setTargetInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("");

  const getCardOpacity = useCallback((projectId: string) => {
    const existing = cardOpacityMapRef.current.get(projectId);
    if (existing) return existing;
    const next = new Animated.Value(1);
    cardOpacityMapRef.current.set(projectId, next);
    return next;
  }, []);

  const clearSelectionTimer = useCallback(() => {
    if (!selectionTimeoutRef.current) return;
    clearTimeout(selectionTimeoutRef.current);
    selectionTimeoutRef.current = null;
  }, []);

  useEffect(() => clearSelectionTimer, [clearSelectionTimer]);

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId) {
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
        CURRENCIES.find((item) => item.code === accountCurrency)?.symbol ?? accountCurrency;

      const currentMonthKey = toMonthKey(new Date());

      const [
        projectsResult,
        reserveContainersResult,
        fundingPlansResult,
        monthClosesResult,
        monthCloseAllocationsResult,
        reserveTransfersResult,
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("account_id", selectedAccountId)
          .not("target_amount_base_minor", "is", null)
          .eq("status", "active")
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("reserve_containers")
          .select("*")
          .eq("account_id", selectedAccountId)
          .eq("status", "active"),
        supabase
          .from("monthly_project_funding_plans")
          .select("*")
          .eq("account_id", selectedAccountId)
          .eq("period", `${currentMonthKey}-01`),
        supabase.from("month_closes").select("*").eq("account_id", selectedAccountId),
        supabase
          .from("month_close_allocations")
          .select("*")
          .eq("account_id", selectedAccountId),
        supabase.from("reserve_transfers").select("*").eq("account_id", selectedAccountId),
      ]);

      if (projectsResult.error) throw projectsResult.error;
      if (reserveContainersResult.error) throw reserveContainersResult.error;
      if (fundingPlansResult.error) throw fundingPlansResult.error;
      if (monthClosesResult.error) throw monthClosesResult.error;
      if (monthCloseAllocationsResult.error) throw monthCloseAllocationsResult.error;
      if (reserveTransfersResult.error) throw reserveTransfersResult.error;

      const nextProjects = (projectsResult.data ?? []) as Project[];
      const projectIds = nextProjects.map((project) => project.id);

      const { data: extraContributionRows, error: extraContributionsError } =
        projectIds.length > 0
          ? await supabase
              .from("transactions")
              .select("project_id, amount_base_minor")
              .eq("account_id", selectedAccountId)
              .eq("type", "expense")
              .in("project_id", projectIds)
          : {
              data: [] as Array<{
                project_id: string | null;
                amount_base_minor: bigint | number | string | null;
              }>,
              error: null,
            };

      if (extraContributionsError) throw extraContributionsError;

      const pendingMonthKeys = computePendingMonthCloseKeysFromMonthCloses({
        commitmentProjects: nextProjects.map((project) => ({
          projectId: project.id,
          createdAt: project.created_at ?? null,
        })),
        closedMonths: ((monthClosesResult.data ?? []) as MonthClose[]).map((entry) => ({
          period: entry.period,
        })),
        currentMonthKey,
      });

      setRole(account.account_members?.[0]?.role ?? "viewer");
      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setProjects(nextProjects);
      setReserveContainers((reserveContainersResult.data ?? []) as ReserveContainer[]);
      setFundingPlans((fundingPlansResult.data ?? []) as MonthlyProjectFundingPlan[]);
      setMonthCloses((monthClosesResult.data ?? []) as MonthClose[]);
      setMonthCloseAllocations((monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]);
      setReserveTransfers((reserveTransfersResult.data ?? []) as ReserveTransfer[]);
      setExtraContributions(
        (extraContributionRows ?? []) as Array<{
          project_id: string | null;
          amount_base_minor: bigint | number | string | null;
        }>
      );
      setHasPendingMonthlyClose(pendingMonthKeys.length > 0);
      setPendingMonthKey(pendingMonthKeys[0] ?? addMonths(currentMonthKey, -1));
    } catch (loadError) {
      console.error("[Projects][mobile] load error", loadError);
      setError(t(dictionary, "errors.internalServer"));
    } finally {
      setLoading(false);
    }
  }, [dictionary, selectedAccountId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setOrderedProjects([...projects].sort((a, b) => a.priority - b.priority));
    setSelectedProjectId((current) =>
      current && projects.some((project) => project.id === current) ? current : null
    );
    setSelectedMode(null);
    setTransferInput("");
    setTransferError(null);
  }, [projects]);

  const canEdit = role !== "viewer";

  const reserveTransferTotalsByProject = useMemo(
    () => getProjectReserveTransferTotalsMap(reserveTransfers),
    [reserveTransfers]
  );

  const fundedByProject = useMemo(() => {
    const byProject = new Map<string, bigint>();

    monthCloseAllocations.forEach((allocation) => {
      if (!allocation.project_id) return;
      byProject.set(
        allocation.project_id,
        (byProject.get(allocation.project_id) ?? 0n) + toMinor(allocation.amount_base_minor)
      );
    });

    reserveTransferTotalsByProject.forEach((amountMinor, projectId) => {
      byProject.set(projectId, (byProject.get(projectId) ?? 0n) + amountMinor);
    });

    return byProject;
  }, [monthCloseAllocations, reserveTransferTotalsByProject]);

  const plannedByProject = useMemo(() => {
    const byProject = new Map<string, bigint>();
    fundingPlans.forEach((plan) => {
      byProject.set(
        plan.project_id,
        (byProject.get(plan.project_id) ?? 0n) + toMinor(plan.planned_amount_base_minor)
      );
    });
    return byProject;
  }, [fundingPlans]);

  const extraContributionsByProject = useMemo(() => {
    const byProject = new Map<string, bigint>();
    extraContributions.forEach((entry) => {
      if (!entry.project_id) return;
      byProject.set(
        entry.project_id,
        (byProject.get(entry.project_id) ?? 0n) + toMinor(entry.amount_base_minor)
      );
    });
    return byProject;
  }, [extraContributions]);

  const totalCommitmentMinor = useMemo(
    () => getMonthlyProjectCommitmentTotal(projects, { activeOnly: true }),
    [projects]
  );

  const huchaReserve = useMemo(
    () => reserveContainers.find((reserveContainer) => reserveContainer.kind === "hucha") ?? null,
    [reserveContainers]
  );

  const projectColorMap = useMemo(() => buildProjectColorMap(projects), [projects]);
  const monthClosesById = useMemo(
    () => new Map(monthCloses.map((monthClose) => [monthClose.id, monthClose])),
    [monthCloses]
  );

  const huchaStats = useMemo(
    () =>
      getReserveContainerStats({
        reserveContainerId: huchaReserve?.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
        monthClosesById,
        currentPeriod: toMonthKey(new Date()),
      }),
    [huchaReserve?.id, monthCloseAllocations, monthClosesById, reserveTransfers]
  );

  const huchaReferenceMinor = useMemo(() => {
    const cumulativePeakMinor = computeCumulativePeakMinor(huchaStats.series);
    return maxBigInt(
      cumulativePeakMinor,
      huchaStats.accumulatedMinor,
      huchaStats.averageMinor * 4n,
      100000n
    );
  }, [huchaStats.accumulatedMinor, huchaStats.averageMinor, huchaStats.series]);

  const projectViewModels = useMemo<ProjectViewModel[]>(
    () =>
      orderedProjects.map((project) => {
        const projectColor = getProjectColor(project, projectColorMap);
        const progress = computeProjectProgress({
          project,
          fundedMinor: fundedByProject.get(project.id) ?? 0n,
          plannedThisMonthMinor: plannedByProject.get(project.id) ?? 0n,
          spentMinor: extraContributionsByProject.get(project.id) ?? 0n,
        });

        return {
          project,
          projectColor,
          progress,
          progressPercent: Math.round(progress.progressRatio * 100),
          durationLabel:
            progress.monthsLeft !== null
              ? formatDurationLabel(progress.monthsLeft, localeCode)
              : null,
          dateLabel: progress.estimatedCompletionDate
            ? formatEstimatedDate(progress.estimatedCompletionDate, localeCode)
            : null,
          returnableMinor: maxBigInt(reserveTransferTotalsByProject.get(project.id) ?? 0n, 0n),
        };
      }),
    [
      extraContributionsByProject,
      fundedByProject,
      localeCode,
      orderedProjects,
      plannedByProject,
      projectColorMap,
      reserveTransferTotalsByProject,
    ]
  );

  const selectedProjectModel = useMemo(
    () => projectViewModels.find((entry) => entry.project.id === selectedProjectId) ?? null,
    [projectViewModels, selectedProjectId]
  );

  // TODO: i18n for redesigned transfer-card copy.
  const transferCopy = useMemo(
    () => ({
      addHint: localeCode === "en" ? "Available in Hucha" : "Disponible en hucha",
      retHint:
        localeCode === "en"
          ? "Available to return"
          : "Disponible para devolver a hucha",
      selectDirection:
        localeCode === "en"
          ? "Choose a direction to move money."
          : "Elige una direccion para mover dinero.",
      addError:
        localeCode === "en"
          ? "Couldn't move money from Hucha."
          : "No se pudo mover dinero desde la hucha.",
      retError:
        localeCode === "en"
          ? "Couldn't return money to Hucha."
          : "No se pudo devolver dinero a la hucha.",
    }),
    [localeCode]
  );

  const parsedTransferAmount = useMemo(() => {
    const trimmed = transferInput.trim();
    if (!trimmed) {
      return { amountMinor: 0n, error: null as string | null };
    }

    const parsed = parseMoneyToMinor(trimmed, baseCurrency);
    if (typeof parsed === "object" && "error" in parsed) {
      const errorKey = parsed.error.key as never;
      const errorParams = parsed.error.params as never;
      return {
        amountMinor: 0n,
        error: t(dictionary, errorKey, errorParams),
      };
    }

    if (parsed <= 0n) {
      return { amountMinor: 0n, error: t(dictionary, "money.invalidAmount") };
    }

    return { amountMinor: parsed, error: null as string | null };
  }, [baseCurrency, dictionary, transferInput]);

  const transferMaxMinor = useMemo(() => {
    if (!selectedMode || !selectedProjectModel) return 0n;
    if (selectedMode === "add") return maxBigInt(huchaStats.accumulatedMinor, 0n);
    return maxBigInt(selectedProjectModel.returnableMinor, 0n);
  }, [huchaStats.accumulatedMinor, selectedMode, selectedProjectModel]);

  const transferValidationError = useMemo(() => {
    if (!selectedMode || !transferInput.trim()) return null;
    if (parsedTransferAmount.error) return parsedTransferAmount.error;
    if (parsedTransferAmount.amountMinor > transferMaxMinor) {
      return localeCode === "en"
        ? "Amount exceeds what is available."
        : "El importe supera lo disponible.";
    }
    return null;
  }, [localeCode, parsedTransferAmount, selectedMode, transferInput, transferMaxMinor]);

  const isTransferValid =
    Boolean(selectedMode) &&
    Boolean(selectedProjectModel) &&
    parsedTransferAmount.error === null &&
    parsedTransferAmount.amountMinor > 0n &&
    parsedTransferAmount.amountMinor <= transferMaxMinor;

  const previewHuchaMinor = useMemo(() => {
    if (!selectedMode || parsedTransferAmount.error || parsedTransferAmount.amountMinor <= 0n) {
      return maxBigInt(huchaStats.accumulatedMinor, 0n);
    }

    if (selectedMode === "add") {
      const nextAmount = huchaStats.accumulatedMinor - parsedTransferAmount.amountMinor;
      return nextAmount > 0n ? nextAmount : 0n;
    }

    return huchaStats.accumulatedMinor + parsedTransferAmount.amountMinor;
  }, [huchaStats.accumulatedMinor, parsedTransferAmount, selectedMode]);

  const nextPriority = useMemo(() => {
    const highest = projects.reduce(
      (currentHighest, project) => Math.max(currentHighest, project.priority),
      0
    );
    return highest + 1;
  }, [projects]);

  const openCreate = () => {
    setCreateError(null);
    setNameInput("");
    setEmojiInput(DEFAULT_PROJECT_EMOJI);
    setTargetInput("");
    setPriorityInput(String(nextPriority));
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!canEdit || !user || !selectedAccountId || isCreating) return;

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setCreateError(t(dictionary, "projects.validation.nameRequired"));
      return;
    }

    const parsedTarget = parseMoneyToMinor(targetInput.trim(), baseCurrency);
    if (typeof parsedTarget === "object" && "error" in parsedTarget) {
      setCreateError(t(dictionary, parsedTarget.error.key, parsedTarget.error.params));
      return;
    }

    if (parsedTarget <= 0n) {
      setCreateError(t(dictionary, "money.invalidAmount"));
      return;
    }

    const parsedPriority = Number.parseInt(priorityInput.trim(), 10);
    const safePriority = Number.isFinite(parsedPriority)
      ? Math.max(parsedPriority, 1)
      : nextPriority;

    setIsCreating(true);
    setCreateError(null);
    const nextColor = assignProjectColor(projects);

    try {
      const { error: insertError } = await supabase.from("projects").insert({
        account_id: selectedAccountId,
        name: trimmedName,
        emoji: emojiInput.trim() || DEFAULT_PROJECT_EMOJI,
        color: nextColor,
        target_amount_base_minor: String(parsedTarget),
        priority: safePriority,
        status: "active",
        created_by: user.id,
      });

      if (insertError) throw insertError;

      setIsCreateOpen(false);
      await emitMutation("projects", "insert");
      await loadData();
    } catch (createError) {
      console.error("[Projects][mobile] create error", createError);
      setCreateError(t(dictionary, "errors.internalServer"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectProject = useCallback(
    (projectId: string) => {
      if (isReordering || selectedProjectId === projectId) return;

      clearSelectionTimer();
      setIsReordering(true);
      setSelectedProjectId(null);
      setSelectedMode(null);
      setTransferInput("");
      setTransferError(null);

      const opacity = getCardOpacity(projectId);
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          setIsReordering(false);
          opacity.setValue(1);
          return;
        }

        setOrderedProjects((current) => moveProjectToFront(current, projectId));

        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start(() => {
            selectionTimeoutRef.current = setTimeout(() => {
              setSelectedProjectId(projectId);
              setIsReordering(false);
            }, 180);
          });
        });
      });
    },
    [clearSelectionTimer, getCardOpacity, isReordering, selectedProjectId]
  );

  const handleToggleMode = useCallback(
    (mode: TransferMode) => {
      if (!canEdit || !selectedProjectModel) return;
      setTransferError(null);
      setTransferInput("");
      setSelectedMode((current) => (current === mode ? null : mode));
    },
    [canEdit, selectedProjectModel]
  );

  const handleCancelTransfer = useCallback(() => {
    setSelectedProjectId(null);
    setSelectedMode(null);
    setTransferInput("");
    setTransferError(null);
  }, []);

  const handleConfirmTransfer = useCallback(async () => {
    if (
      !selectedAccountId ||
      !huchaReserve ||
      !selectedProjectModel ||
      !selectedMode ||
      !isTransferValid ||
      isSubmittingTransfer
    ) {
      return;
    }

    setIsSubmittingTransfer(true);
    setTransferError(null);

    try {
      if (selectedMode === "add") {
        const { error: rpcError } = await supabase.rpc("transfer_reserve_to_project", {
          p_account_id: selectedAccountId,
          p_source_reserve_container_id: huchaReserve.id,
          p_destination_project_id: selectedProjectModel.project.id,
          p_amount_base_minor: parsedTransferAmount.amountMinor.toString(),
        });

        if (rpcError) throw rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc("transfer_project_to_hucha", {
          p_account_id: selectedAccountId,
          p_project_id: selectedProjectModel.project.id,
          p_amount_base_minor: parsedTransferAmount.amountMinor.toString(),
        });

        if (rpcError) throw rpcError;
      }

      setSelectedMode(null);
      setSelectedProjectId(null);
      setTransferInput("");
      await emitMutation("reserve_transfers", "insert");
      await emitMutation("projects", "update");
      await loadData();
    } catch (transferActionError) {
      console.error("[Projects][mobile] transfer error", transferActionError);
      setTransferError(selectedMode === "add" ? transferCopy.addError : transferCopy.retError);
    } finally {
      setIsSubmittingTransfer(false);
    }
  }, [
    emitMutation,
    huchaReserve,
    isSubmittingTransfer,
    isTransferValid,
    loadData,
    parsedTransferAmount.amountMinor,
    selectedAccountId,
    selectedMode,
    selectedProjectModel,
    transferCopy.addError,
    transferCopy.retError,
  ]);

  const carouselItems = useMemo<ProjectCarouselItem[]>(
    () => [
      ...projectViewModels.map((entry) => ({
        kind: "project" as const,
        id: entry.project.id,
        projectId: entry.project.id,
      })),
      { kind: "add" as const, id: "add" },
    ],
    [projectViewModels]
  );

  const renderCarouselItem = useCallback(
    ({ item }: { item: ProjectCarouselItem }) => {
      if (item.kind === "add") {
        return (
          <TouchableOpacity
            style={[
              styles.addProjectCard,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surface,
                opacity: canEdit ? 1 : 0.45,
              },
            ]}
            activeOpacity={0.82}
            disabled={!canEdit}
            onPress={openCreate}
          >
            <Text style={[styles.addProjectPlus, { color: userTokens.textSecondary }]}>+</Text>
            <Text style={[styles.addProjectLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "projects.newProject")}
            </Text>
          </TouchableOpacity>
        );
      }

      const entry = projectViewModels.find((projectEntry) => projectEntry.project.id === item.projectId);
      if (!entry) return null;

      const isSelected = selectedProjectId === entry.project.id;
      const isAddMode = selectedMode === "add" && isSelected;
      const isReturnMode = selectedMode === "ret" && isSelected;
      const panelHint = selectedMode
        ? `${selectedMode === "add" ? transferCopy.addHint : transferCopy.retHint}: ${formatMoneyWithSymbol(
            selectedMode === "add"
              ? huchaStats.accumulatedMinor
              : entry.returnableMinor,
            baseCurrency,
            currencySymbol
          )}`
        : transferCopy.selectDirection;

      return (
        <Animated.View
          style={[
            styles.projectCardShell,
            {
              opacity: getCardOpacity(entry.project.id),
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            style={[
              styles.projectCard,
              {
                backgroundColor: userTokens.surface,
                borderColor: isSelected ? "rgba(78,205,196,0.22)" : userTokens.border,
                transform: [{ translateY: isSelected ? -3 : 0 }],
              },
            ]}
            onPress={() => handleSelectProject(entry.project.id)}
          >
            <View style={styles.projectRingSection}>
              <View style={styles.projectRingRow}>
                {isSelected ? (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={!canEdit}
                    onPress={() => handleToggleMode("ret")}
                    style={[
                      styles.arrowButton,
                      { borderColor: userTokens.border },
                      isReturnMode && styles.arrowButtonActiveReturn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.arrowButtonText,
                        { color: isReturnMode ? RETURN_ACCENT : userTokens.textSecondary },
                      ]}
                    >
                      ↑
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <ProjectProgressRing
                  progress={entry.progress.progressRatio}
                  size={80}
                  strokeWidth={6}
                  trackColor={userTokens.surfaceAlt}
                  progressColor={entry.projectColor}
                  center={
                    <Text style={styles.projectEmoji}>
                      {entry.project.emoji || DEFAULT_PROJECT_EMOJI}
                    </Text>
                  }
                />

                {isSelected ? (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={!canEdit}
                    onPress={() => handleToggleMode("add")}
                    style={[
                      styles.arrowButton,
                      { borderColor: userTokens.border },
                      isAddMode && styles.arrowButtonActiveAdd,
                    ]}
                  >
                    <Text
                      style={[
                        styles.arrowButtonText,
                        { color: isAddMode ? HUCHA_ACCENT : userTokens.textSecondary },
                      ]}
                    >
                      ↓
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <Text numberOfLines={1} style={[styles.projectName, { color: userTokens.textPrimary }]}>
              {entry.project.name}
            </Text>
            <Text style={[styles.projectAmounts, { color: userTokens.textSecondary }]}>
              {formatMoneyWithSymbol(entry.progress.fundedReservedMinor, baseCurrency, currencySymbol)}{" "}
              {t(dictionary, "projects.of")}{" "}
              {formatMoneyWithSymbol(entry.progress.targetMinor, baseCurrency, currencySymbol)}
            </Text>
            <Text style={[styles.projectPercent, { color: entry.projectColor }]}>
              {entry.progressPercent}%
            </Text>
            {entry.durationLabel && entry.dateLabel ? (
              <View style={styles.projectEtaBlock}>
                <Text style={[styles.projectEta, { color: userTokens.textSecondary }]}>
                  {entry.durationLabel}
                </Text>
                <Text style={[styles.projectEtaSub, { color: userTokens.textSecondary }]}>
                  {entry.dateLabel}
                </Text>
              </View>
            ) : (
              <Text style={styles.projectNoPlan}>{t(dictionary, "projects.noPlan")}</Text>
            )}

            {isSelected ? (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() =>
                  router.push(`/(auth)/(tabs)/projects/${entry.project.id}`)
                }
                style={[
                  styles.detailButton,
                  {
                    borderColor: userTokens.border,
                    backgroundColor: userTokens.surface,
                  },
                ]}
              >
                <Text style={[styles.detailButtonText, { color: userTokens.textPrimary }]}>
                  {localeCode === "en" ? "View detail" : "Ver detalle"}
                </Text>
              </TouchableOpacity>
            ) : null}

            {isSelected ? (
              <View
                style={[
                  styles.transferPanel,
                  {
                    backgroundColor: userTokens.surfaceAlt,
                    borderTopColor: userTokens.border,
                  },
                ]}
              >
                <Text style={[styles.transferHint, { color: userTokens.textSecondary }]}>
                  {panelHint}
                </Text>

                {selectedMode ? (
                  <View style={styles.transferRow}>
                    <View style={[styles.transferInputWrap, { borderBottomColor: userTokens.border }]}>
                      <Text style={[styles.transferPrefix, { color: userTokens.textSecondary }]}>
                        €
                      </Text>
                      <TextInput
                        value={transferInput}
                        onChangeText={(value) => setTransferInput(sanitizeNumericInput(value))}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={userTokens.textTertiary}
                        style={[styles.transferInput, { color: userTokens.textPrimary }]}
                      />
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.82}
                      disabled={!isTransferValid || isSubmittingTransfer}
                      onPress={() => void handleConfirmTransfer()}
                      style={[
                        styles.confirmButton,
                        {
                          backgroundColor: HUCHA_ACCENT,
                          opacity: isTransferValid ? 1 : 0.35,
                        },
                      ]}
                    >
                      <Text style={styles.confirmButtonText}>✓</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {transferValidationError || transferError ? (
                  <Text style={styles.transferErrorText}>
                    {transferValidationError ?? transferError}
                  </Text>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={handleCancelTransfer}
                  style={styles.transferCancelButton}
                >
                  <Text style={[styles.transferCancelText, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "common.cancel")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [
      baseCurrency,
      canEdit,
      currencySymbol,
      dictionary,
      getCardOpacity,
      handleCancelTransfer,
      handleConfirmTransfer,
      handleSelectProject,
      handleToggleMode,
      huchaStats.accumulatedMinor,
      isSubmittingTransfer,
      isTransferValid,
      projectViewModels,
      selectedMode,
      selectedProjectId,
      t,
      transferCopy.addHint,
      transferCopy.retHint,
      transferCopy.selectDirection,
      transferError,
      transferInput,
      transferValidationError,
      userTokens.border,
      userTokens.surface,
      userTokens.surfaceAlt,
      userTokens.textPrimary,
      userTokens.textSecondary,
      userTokens.textTertiary,
    ]
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "navigation.projects") }} />
        <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
          <ActivityIndicator size="large" color={primaryActionColor} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t(dictionary, "navigation.projects") }} />
      <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
        {error ? (
          <View style={styles.outerContainer}>
            <Card>
              <Text style={[styles.errorText, { color: userTokens.textPrimary }]}>{error}</Text>
              <View style={styles.retryWrap}>
                <Button onPress={() => void loadData()} title={t(dictionary, "common.retry")} />
              </View>
            </Card>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.outerContainer,
              { paddingBottom: tokens.spacing.xxl + insets.bottom + 72 },
            ]}
          >
            <View style={styles.pageHeader}>
              <View style={styles.pageHeaderCopy}>
                <Text style={[styles.pageTitle, { color: userTokens.textPrimary }]}>
                  {t(dictionary, "projects.pageTitle")}
                </Text>
                <Text style={[styles.pageDescription, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "projects.pageDescription")}
                </Text>
                {hasPendingMonthlyClose ? (
                  <Text style={[styles.pendingInline, { color: userTokens.textSecondary }]}>
                    {localeCode === "en"
                      ? `Pending close: ${formatMonthLabel(pendingMonthKey, localeCode)}`
                      : `Cierre pendiente: ${formatMonthLabel(pendingMonthKey, localeCode)}`}
                  </Text>
                ) : null}
              </View>

              <View style={styles.monthCloseButtonWrap}>
                <Button
                  variant="secondary"
                  title={
                    hasPendingMonthlyClose
                      ? localeCode === "en"
                        ? "Review close"
                        : "Revisar cierre"
                      : localeCode === "en"
                        ? "Month close"
                        : "Cierre mensual"
                  }
                  onPress={() =>
                    router.push(
                      hasPendingMonthlyClose
                        ? `/(auth)/(tabs)/projects/month-close?month=${pendingMonthKey}`
                        : "/(auth)/(tabs)/projects/month-close"
                    )
                  }
                />
              </View>
            </View>

            {huchaReserve ? (
              <TouchableOpacity
                activeOpacity={0.84}
                onPress={() => router.push(`/(auth)/(tabs)/projects/reserves/${huchaReserve.id}`)}
                style={[
                  styles.huchaBlock,
                  {
                    backgroundColor: userTokens.surface,
                    borderColor: selectedProjectId ? "rgba(78,205,196,0.3)" : userTokens.border,
                  },
                ]}
              >
                <View style={styles.huchaCircleColumn}>
                  <View style={styles.huchaCircleCanvas}>
                    <HuchaLiquidCanvas
                      valueMinor={previewHuchaMinor}
                      maxMinor={huchaReferenceMinor}
                      size={88}
                    />
                    <View style={styles.huchaCircleInner} pointerEvents="none">
                      <Text numberOfLines={1} style={styles.huchaCircleAmount}>
                        {formatMoneyWithSymbol(
                          previewHuchaMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.huchaCircleLabel, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "home.savings.hucha")}
                  </Text>
                </View>

                <View style={styles.huchaInfo}>
                  <Text style={[styles.huchaDescription, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "projects.hucha.subtitle")}
                  </Text>
                  <View style={styles.huchaStats}>
                    <View style={styles.huchaStat}>
                      <Text style={[styles.huchaStatLabel, { color: userTokens.textSecondary }]}>
                        {t(dictionary, "projects.hucha.thisMonth")}
                      </Text>
                      <Text style={styles.huchaStatValue}>
                        {formatMoneyWithSymbol(
                          huchaStats.currentMonthContributionMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                      </Text>
                    </View>
                    <View style={styles.huchaStat}>
                      <Text style={[styles.huchaStatLabel, { color: userTokens.textSecondary }]}>
                        {t(dictionary, "projects.hucha.monthlyAverage")}
                      </Text>
                      <Text style={styles.huchaStatValue}>
                        {formatMoneyWithSymbol(
                          huchaStats.averageMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.huchaChevron, { color: userTokens.textSecondary }]}>›</Text>

                <FlowTransferIndicator
                  visible={Boolean(selectedProjectId)}
                  direction={selectedMode}
                  left={tokens.spacing.lg + 44}
                />
              </TouchableOpacity>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: userTokens.textSecondary }]}>
                {localeCode === "en" ? "Active projects" : "Proyectos activos"}
              </Text>
            </View>

            <FlatList
              ref={flatListRef}
              horizontal
              data={carouselItems}
              keyExtractor={(item) => item.id}
              renderItem={renderCarouselItem}
              contentContainerStyle={styles.carouselContent}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              decelerationRate="fast"
              scrollEnabled={!isReordering}
            />

            <TouchableOpacity
              style={[
                styles.commitmentCard,
                {
                  backgroundColor: userTokens.surface,
                  borderColor: userTokens.border,
                },
              ]}
              activeOpacity={0.84}
              onPress={() => router.push("/(auth)/(tabs)/projects/savings")}
            >
              <View style={styles.commitmentContent}>
                <View style={styles.commitmentLeft}>
                  <Text style={[styles.commitmentLabel, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "projects.totalCommitment")}
                  </Text>
                  <Text style={[styles.commitmentValue, { color: userTokens.textPrimary }]}>
                    {formatMoneyWithSymbol(totalCommitmentMinor, baseCurrency, currencySymbol)}
                    <Text style={[styles.commitmentSuffix, { color: userTokens.textSecondary }]}>
                      {" "}
                      {t(dictionary, "projects.perMonth")}
                    </Text>
                  </Text>
                </View>
                <Text style={[styles.commitmentChevron, { color: userTokens.textSecondary }]}>
                  ›
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}

        <Modal
          transparent
          visible={isCreateOpen}
          animationType="slide"
          onRequestClose={() => setIsCreateOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setIsCreateOpen(false)} />
            <View
              style={[
                styles.modalSheet,
                { backgroundColor: userTokens.surface, borderColor: userTokens.border },
              ]}
            >
              <View style={[styles.modalHandle, { backgroundColor: userTokens.border }]} />
              <Text style={[styles.modalTitle, { color: userTokens.textPrimary }]}>
                {t(dictionary, "projects.create.title")}
              </Text>
              <Text style={[styles.modalDescription, { color: userTokens.textSecondary }]}>
                {t(dictionary, "projects.create.description")}
              </Text>

              <Input
                label={t(dictionary, "projects.create.nameLabel")}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={t(dictionary, "projects.create.namePlaceholder")}
              />

              <Input
                label={t(dictionary, "projects.create.emojiLabel")}
                value={emojiInput}
                onChangeText={setEmojiInput}
                maxLength={8}
              />
              <View style={styles.emojiRow}>
                {PROJECT_EMOJI_SUGGESTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiChip,
                      {
                        borderColor: emojiInput === emoji ? primaryActionColor : userTokens.border,
                        backgroundColor:
                          emojiInput === emoji ? userTokens.surfaceAlt : userTokens.surface,
                      },
                    ]}
                    onPress={() => setEmojiInput(emoji)}
                  >
                    <Text style={styles.emojiChipText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label={t(dictionary, "projects.create.targetLabel")}
                value={targetInput}
                onChangeText={(value) => setTargetInput(sanitizeNumericInput(value))}
                keyboardType="numeric"
                placeholder={t(dictionary, "projects.create.targetPlaceholder")}
              />

              <Input
                label={t(dictionary, "projects.create.priorityLabel")}
                value={priorityInput}
                onChangeText={(value) => setPriorityInput(value.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                placeholder={String(nextPriority)}
              />

              {createError ? <Text style={styles.createError}>{createError}</Text> : null}

              <View style={styles.modalActions}>
                <Button
                  variant="secondary"
                  title={t(dictionary, "common.cancel")}
                  onPress={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                />
                <Button
                  title={
                    isCreating
                      ? t(dictionary, "common.creating")
                      : t(dictionary, "projects.create.submit")
                  }
                  onPress={() => void handleCreate()}
                  disabled={!canEdit || isCreating}
                  loading={isCreating}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const addMonths = (monthKey: string, delta: number) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const date = new Date(year, month - 1 + delta, 1);
  return toMonthKey(date);
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  outerContainer: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  retryWrap: {
    marginTop: tokens.spacing.md,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  pageHeaderCopy: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "DMSans-Bold",
  },
  pageDescription: {
    marginTop: 4,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  pendingInline: {
    marginTop: 8,
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
  },
  monthCloseButtonWrap: {
    minWidth: 132,
  },
  huchaBlock: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: 18,
    paddingVertical: 20,
    overflow: "visible",
  },
  huchaCircleColumn: {
    alignItems: "center",
    gap: 6,
  },
  huchaCircleCanvas: {
    position: "relative",
    width: 88,
    height: 88,
  },
  huchaCircleInner: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  huchaCircleAmount: {
    fontSize: 13,
    lineHeight: 15,
    fontFamily: "DMSans-Bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  huchaCircleLabel: {
    fontSize: 9,
    lineHeight: 11,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontFamily: "DMSans-Medium",
  },
  huchaInfo: {
    flex: 1,
    minWidth: 0,
  },
  huchaDescription: {
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  huchaStats: {
    flexDirection: "row",
    gap: 24,
    marginTop: 10,
  },
  huchaStat: {
    gap: 2,
  },
  huchaStatLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontFamily: "DMSans-Regular",
  },
  huchaStatValue: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: "DMSans-SemiBold",
    color: SAVINGS_VALUE_COLOR,
  },
  huchaChevron: {
    fontSize: 24,
    lineHeight: 24,
    marginLeft: "auto",
  },
  flowLine: {
    position: "absolute",
    bottom: -1,
    width: 2,
    marginLeft: -1,
    borderRadius: 999,
    backgroundColor: HUCHA_ACCENT,
  },
  flowDots: {
    position: "absolute",
    bottom: -FLOW_HEIGHT,
    width: 4,
    height: FLOW_HEIGHT,
    marginLeft: -2,
  },
  flowDot: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: HUCHA_ACCENT,
  },
  sectionHeader: {
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontFamily: "DMSans-SemiBold",
  },
  carouselContent: {
    paddingRight: tokens.spacing.lg,
  },
  projectCardShell: {
    width: PROJECT_CARD_WIDTH,
  },
  projectCard: {
    width: PROJECT_CARD_WIDTH,
    minHeight: PROJECT_CARD_MIN_HEIGHT,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 18,
    alignItems: "center",
    overflow: "hidden",
  },
  projectRingSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  projectRingRow: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  arrowButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowButtonActiveAdd: {
    backgroundColor: "rgba(78,205,196,0.12)",
    borderColor: "rgba(78,205,196,0.45)",
  },
  arrowButtonActiveReturn: {
    backgroundColor: "rgba(116,198,157,0.12)",
    borderColor: "rgba(116,198,157,0.45)",
  },
  arrowButtonText: {
    fontSize: 15,
    lineHeight: 17,
    fontFamily: "DMSans-Bold",
  },
  projectEmoji: {
    fontSize: 28,
    lineHeight: 30,
  },
  projectName: {
    width: "100%",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "DMSans-SemiBold",
  },
  projectAmounts: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "DMSans-Regular",
  },
  projectPercent: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: "DMSans-Bold",
  },
  projectEtaBlock: {
    marginTop: 4,
    alignItems: "center",
    gap: 1,
  },
  projectEta: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    fontFamily: "DMSans-Regular",
  },
  projectEtaSub: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    fontFamily: "DMSans-Regular",
    opacity: 0.7,
  },
  projectNoPlan: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "DMSans-Medium",
    color: "#D97706",
    textAlign: "center",
  },
  detailButton: {
    marginTop: 12,
    minHeight: 32,
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  detailButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "DMSans-SemiBold",
  },
  transferPanel: {
    alignSelf: "stretch",
    marginHorizontal: -18,
    marginBottom: -18,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  transferHint: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "DMSans-Regular",
    marginBottom: 8,
    textAlign: "center",
  },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  transferInputWrap: {
    flex: 1,
    minHeight: 34,
    borderBottomWidth: 1,
    paddingLeft: 18,
    justifyContent: "center",
  },
  transferPrefix: {
    position: "absolute",
    left: 0,
    top: 7,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "DMSans-SemiBold",
  },
  transferInput: {
    paddingVertical: 6,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "DMSans-SemiBold",
  },
  confirmButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    lineHeight: 18,
    fontFamily: "DMSans-Bold",
    color: "#071312",
  },
  transferErrorText: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "DMSans-Medium",
    color: "#DC2626",
    textAlign: "center",
  },
  transferCancelButton: {
    marginTop: 8,
    alignSelf: "center",
  },
  transferCancelText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "DMSans-Regular",
  },
  addProjectCard: {
    width: PROJECT_CARD_WIDTH,
    minHeight: PROJECT_CARD_MIN_HEIGHT,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: tokens.radii.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
  },
  addProjectPlus: {
    fontSize: 30,
    lineHeight: 32,
    fontFamily: "DMSans-Regular",
  },
  addProjectLabel: {
    fontSize: 12,
    lineHeight: 15,
    textAlign: "center",
    fontFamily: "DMSans-Medium",
  },
  commitmentCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commitmentContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  commitmentLeft: {
    flex: 1,
  },
  commitmentLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "DMSans-Regular",
  },
  commitmentValue: {
    marginTop: 2,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "DMSans-Bold",
  },
  commitmentSuffix: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "DMSans-Medium",
  },
  commitmentChevron: {
    fontSize: 24,
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  modalSheet: {
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: tokens.spacing.lg,
  },
  modalHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    marginBottom: tokens.spacing.md,
  },
  modalTitle: {
    fontSize: tokens.typography.size.xl,
    fontFamily: "DMSans-Bold",
  },
  modalDescription: {
    marginTop: 4,
    marginBottom: tokens.spacing.md,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  emojiChip: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emojiChipText: {
    fontSize: 20,
  },
  createError: {
    color: "#DC2626",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  modalActions: {
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
});
