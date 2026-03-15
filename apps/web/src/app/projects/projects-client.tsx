"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  assignProjectColor,
  buildProjectColorMap,
  computeProjectProgress,
  DEFAULT_PROJECT_EMOJI,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getMonthlyProjectCommitmentTotal,
  getProjectColor,
  getProjectReserveTransferTotalsMap,
  getReserveContainerStats,
  parseMoneyToMinor,
  PROJECT_EMOJI_SUGGESTIONS,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Project,
  type ReserveContainer,
  type ReserveTransfer,
  type UserRole,
} from "@poleursus/shared";
import {
  Check,
  ChevronRight,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelFooter,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { ProjectProgressRing } from "@/components/projects/project-progress-ring";

type ProjectsClientProps = {
  accountId: string;
  currentUserId: string;
  role: UserRole;
  baseCurrency: string;
  currencySymbol: string;
  initialProjects: Project[];
  reserveContainers: ReserveContainer[];
  fundingPlans: MonthlyProjectFundingPlan[];
  monthCloses: MonthClose[];
  monthCloseAllocations: MonthCloseAllocation[];
  reserveTransfers: ReserveTransfer[];
  initialExtraContributions: Array<{
    project_id: string | null;
    amount_base_minor: string | number | bigint | null;
  }>;
  hasPendingMonthlyClose: boolean;
  pendingMonthKey: string;
};

type TransferMode = "add" | "ret";

type ProjectViewModel = {
  project: Project;
  projectColor: string;
  progress: ReturnType<typeof computeProjectProgress>;
  progressPercent: number;
  durationLabel: string | null;
  dateLabel: string | null;
  returnableMinor: bigint;
};

const HUCHA_ACCENT = "#4ECDC4";
const RETURN_ACCENT = "#74C69D";

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

const clampRatio = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const formatDurationLabel = (months: number, locale: string) => {
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

const formatEstimatedDate = (date: Date, locale: string) =>
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

function HuchaLiquidCanvas({
  amountLabel,
  ratio,
  size = 88,
}: {
  amountLabel: string;
  ratio: number;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRatioRef = useRef(clampRatio(ratio));
  const currentRatioRef = useRef(clampRatio(ratio));
  const waveOffsetRef = useRef(0);

  useEffect(() => {
    targetRatioRef.current = clampRatio(ratio);
  }, [ratio]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frame = 0;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.41;
    const trackWidth = size * 0.068;

    const draw = () => {
      currentRatioRef.current +=
        (targetRatioRef.current - currentRatioRef.current) * 0.04;
      waveOffsetRef.current += 0.028;

      context.clearRect(0, 0, size, size);

      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.strokeStyle = "rgba(255,255,255,0.07)";
      context.lineWidth = trackWidth;
      context.stroke();

      context.save();
      context.beginPath();
      context.arc(cx, cy, radius - 1, 0, Math.PI * 2);
      context.clip();

      const fillTop =
        cy + radius - clampRatio(currentRatioRef.current) * radius * 2;

      const gradient = context.createLinearGradient(0, cy - radius, 0, cy + radius);
      gradient.addColorStop(0, "#4ECDC4CC");
      gradient.addColorStop(1, "#26A69AEE");
      context.fillStyle = gradient;
      context.fillRect(cx - radius, fillTop, radius * 2, cy + radius - fillTop);

      if (currentRatioRef.current > 0.03 && currentRatioRef.current < 0.97) {
        context.beginPath();
        for (let index = 0; index < 25; index += 1) {
          const x = cx - radius + (index / 24) * radius * 2;
          const y =
            fillTop +
            Math.sin((index / 24) * Math.PI * 4 + waveOffsetRef.current) * 2.5;
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.strokeStyle = "rgba(78,205,196,0.5)";
        context.lineWidth = 1.8;
        context.stroke();
      }

      context.restore();

      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.strokeStyle = "rgba(78,205,196,0.35)";
      context.lineWidth = 1.8;
      context.stroke();

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [size]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <span
          className="text-center text-[14px] font-bold leading-none"
          style={{ color: HUCHA_ACCENT }}
        >
          {amountLabel}
        </span>
      </div>
    </div>
  );
}

export function ProjectsClient({
  accountId,
  currentUserId,
  role,
  baseCurrency,
  currencySymbol,
  initialProjects,
  reserveContainers,
  fundingPlans,
  monthCloses,
  monthCloseAllocations,
  reserveTransfers,
  initialExtraContributions,
  hasPendingMonthlyClose,
  pendingMonthKey,
}: ProjectsClientProps) {
  const locale = useLocale();
  const router = useRouter();
  const tProjects = useTranslations("projects");
  const tCommon = useTranslations("common");
  const tGlobal = useTranslations();
  const supabase = useMemo(() => createClient(), []);
  const { emitMutation } = useWebDataCache();

  const canEdit = role !== "viewer";

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const reorderTimeoutRef = useRef<number | null>(null);
  const selectTimeoutRef = useRef<number | null>(null);

  const [projects, setProjects] = useState<Project[]>(
    [...initialProjects].sort((a, b) => a.priority - b.priority)
  );
  const [extraContributions] = useState(initialExtraContributions);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<TransferMode | null>(null);
  const [transferInput, setTransferInput] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [fadingProjectId, setFadingProjectId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [emojiInput, setEmojiInput] = useState(DEFAULT_PROJECT_EMOJI);
  const [targetInput, setTargetInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("");

  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current !== null) {
        window.clearTimeout(reorderTimeoutRef.current);
      }
      if (selectTimeoutRef.current !== null) {
        window.clearTimeout(selectTimeoutRef.current);
      }
    };
  }, []);

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
    extraContributions.forEach((row) => {
      if (!row.project_id) return;
      byProject.set(
        row.project_id,
        (byProject.get(row.project_id) ?? 0n) + toMinor(row.amount_base_minor)
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
    () => new Map<string, MonthClose>(monthCloses.map((monthClose) => [monthClose.id, monthClose])),
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
      projects.map((project) => {
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
              ? formatDurationLabel(progress.monthsLeft, locale)
              : null,
          dateLabel: progress.estimatedCompletionDate
            ? formatEstimatedDate(progress.estimatedCompletionDate, locale)
            : null,
          returnableMinor: maxBigInt(reserveTransferTotalsByProject.get(project.id) ?? 0n, 0n),
        };
      }),
    [
      extraContributionsByProject,
      fundedByProject,
      locale,
      plannedByProject,
      projectColorMap,
      projects,
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
      addHint: locale === "en" ? "Available in Hucha" : "Disponible en hucha",
      retHint:
        locale === "en"
          ? "Available to return"
          : "Disponible para devolver a hucha",
      selectDirection:
        locale === "en"
          ? "Choose a direction to move money."
          : "Elige una direccion para mover dinero.",
      addError:
        locale === "en"
          ? "Couldn't move money from Hucha."
          : "No se pudo mover dinero desde la hucha.",
      retError:
        locale === "en"
          ? "Couldn't return money to Hucha."
          : "No se pudo devolver dinero a la hucha.",
      maxError:
        locale === "en"
          ? "Amount exceeds what is available."
          : "El importe supera lo disponible.",
    }),
    [locale]
  );

  const parsedTransferAmount = useMemo(() => {
    const trimmed = transferInput.trim();
    if (!trimmed) {
      return { amountMinor: 0n, error: null as string | null };
    }

    const parsed = parseMoneyToMinor(trimmed, baseCurrency);
    if (typeof parsed === "object" && "error" in parsed) {
      return {
        amountMinor: 0n,
        error: tGlobal(parsed.error.key, parsed.error.params),
      };
    }

    if (parsed <= 0n) {
      return { amountMinor: 0n, error: tGlobal("money.invalidAmount") };
    }

    return { amountMinor: parsed, error: null as string | null };
  }, [baseCurrency, tGlobal, transferInput]);

  const transferMaxMinor = useMemo(() => {
    if (!selectedMode || !selectedProjectModel) return 0n;
    if (selectedMode === "add") return maxBigInt(huchaStats.accumulatedMinor, 0n);
    return maxBigInt(selectedProjectModel.returnableMinor, 0n);
  }, [huchaStats.accumulatedMinor, selectedMode, selectedProjectModel]);

  const transferValidationError = useMemo(() => {
    if (!selectedMode || !transferInput.trim()) return null;
    if (parsedTransferAmount.error) return parsedTransferAmount.error;
    if (parsedTransferAmount.amountMinor > transferMaxMinor) {
      return transferCopy.maxError;
    }
    return null;
  }, [parsedTransferAmount, selectedMode, transferCopy.maxError, transferInput, transferMaxMinor]);

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

  const huchaLevelRatio = useMemo(() => {
    if (huchaReferenceMinor <= 0n) return 0;
    return clampRatio((Number(previewHuchaMinor) / Number(huchaReferenceMinor)) * 0.72);
  }, [huchaReferenceMinor, previewHuchaMinor]);

  const nextPriority = useMemo(() => {
    const highest = projects.reduce((max, project) => Math.max(max, project.priority), 0);
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
    if (!canEdit || isCreating) return;

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setCreateError(tProjects("validation.nameRequired"));
      return;
    }

    const parsedTarget = parseMoneyToMinor(targetInput.trim(), baseCurrency);
    if (typeof parsedTarget === "object" && "error" in parsedTarget) {
      setCreateError(tGlobal(parsedTarget.error.key, parsedTarget.error.params));
      return;
    }

    if (parsedTarget <= 0n) {
      setCreateError(tGlobal("money.invalidAmount"));
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
      const { data, error } = await supabase
        .from("projects")
        .insert({
          account_id: accountId,
          name: trimmedName,
          emoji: emojiInput.trim() || DEFAULT_PROJECT_EMOJI,
          color: nextColor,
          target_amount_base_minor: String(parsedTarget),
          priority: safePriority,
          status: "active",
          created_by: currentUserId,
        })
        .select("*")
        .single();

      if (error) throw error;

      setProjects((previous) =>
        [...previous, data as Project].sort((a, b) => a.priority - b.priority)
      );
      await emitMutation("projects", "insert");
      setIsCreateOpen(false);
    } catch (error) {
      console.error("[Projects] Create error", error);
      setCreateError(tGlobal("errors.internalServer"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectProject = (projectId: string) => {
    if (isReordering || selectedProjectId === projectId) return;

    if (reorderTimeoutRef.current !== null) {
      window.clearTimeout(reorderTimeoutRef.current);
    }
    if (selectTimeoutRef.current !== null) {
      window.clearTimeout(selectTimeoutRef.current);
    }

    setIsReordering(true);
    setSelectedProjectId(null);
    setSelectedMode(null);
    setTransferInput("");
    setTransferError(null);
    setFadingProjectId(projectId);

    reorderTimeoutRef.current = window.setTimeout(() => {
      setProjects((current) => moveProjectToFront(current, projectId));
      scrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" });

      window.requestAnimationFrame(() => {
        setFadingProjectId(null);
        selectTimeoutRef.current = window.setTimeout(() => {
          setSelectedProjectId(projectId);
          setIsReordering(false);
        }, 180);
      });
    }, 180);
  };

  const handleToggleMode = (mode: TransferMode) => {
    if (!canEdit || !selectedProjectModel) return;
    setTransferError(null);
    setTransferInput("");
    setSelectedMode((current) => (current === mode ? null : mode));
  };

  const handleCancelTransfer = () => {
    setSelectedProjectId(null);
    setSelectedMode(null);
    setTransferInput("");
    setTransferError(null);
  };

  const handleConfirmTransfer = async () => {
    if (
      !selectedProjectModel ||
      !selectedMode ||
      !huchaReserve ||
      !isTransferValid ||
      isSubmittingTransfer
    ) {
      return;
    }

    setIsSubmittingTransfer(true);
    setTransferError(null);

    try {
      if (selectedMode === "add") {
        const { error } = await supabase.rpc("transfer_reserve_to_project", {
          p_account_id: accountId,
          p_source_reserve_container_id: huchaReserve.id,
          p_destination_project_id: selectedProjectModel.project.id,
          p_amount_base_minor: parsedTransferAmount.amountMinor.toString(),
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("transfer_project_to_hucha", {
          p_account_id: accountId,
          p_project_id: selectedProjectModel.project.id,
          p_amount_base_minor: parsedTransferAmount.amountMinor.toString(),
        });

        if (error) throw error;
      }

      setSelectedProjectId(null);
      setSelectedMode(null);
      setTransferInput("");
      await emitMutation("reserve_transfers", "insert");
      await emitMutation("projects", "update");
      router.refresh();
    } catch (error) {
      console.error("[Projects] Transfer error", error);
      setTransferError(selectedMode === "add" ? transferCopy.addError : transferCopy.retError);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{tProjects("pageTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tProjects("pageDescription")}
          </p>
          {hasPendingMonthlyClose ? (
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {locale === "en"
                ? `Pending close: ${formatMonthLabel(pendingMonthKey, locale)}`
                : `Cierre pendiente: ${formatMonthLabel(pendingMonthKey, locale)}`}
            </p>
          ) : null}
        </div>

        <Button asChild variant="outline">
          <Link
            href={
              hasPendingMonthlyClose
                ? `/projects/month-close?month=${pendingMonthKey}`
                : "/projects/month-close"
            }
          >
            {hasPendingMonthlyClose
              ? locale === "en"
                ? "Review close"
                : "Revisar cierre"
              : tProjects("monthClose.openCta")}
          </Link>
        </Button>
      </div>

      {huchaReserve ? (
        <Link
          href={`/reserves/${huchaReserve.id}`}
          className="relative flex items-center gap-[18px] overflow-visible rounded-[14px] border bg-card px-[22px] py-5 transition-colors hover:border-[rgba(255,255,255,0.13)]"
          style={{
            borderColor: selectedProjectId ? "rgba(78,205,196,0.3)" : "hsl(var(--border))",
          }}
        >
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <HuchaLiquidCanvas
              amountLabel={formatMoneyWithSymbol(previewHuchaMinor, baseCurrency, currencySymbol)}
              ratio={huchaLevelRatio}
            />
            <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {tGlobal("home.savings.hucha")}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{tProjects("hucha.subtitle")}</p>
            <div className="mt-2.5 flex gap-6">
              <div>
                <p className="text-[11px] text-muted-foreground">{tProjects("hucha.thisMonth")}</p>
                <p className="text-sm font-semibold" style={{ color: HUCHA_ACCENT }}>
                  {formatMoneyWithSymbol(
                    huchaStats.currentMonthContributionMinor,
                    baseCurrency,
                    currencySymbol
                  )}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {tProjects("hucha.monthlyAverage")}
                </p>
                <p className="text-sm font-semibold" style={{ color: HUCHA_ACCENT }}>
                  {formatMoneyWithSymbol(huchaStats.averageMinor, baseCurrency, currencySymbol)}
                </p>
              </div>
            </div>
          </div>

          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />

          <span
            className={`projects-flow-line ${selectedProjectId ? "on" : ""}`}
            style={{ left: 44 }}
          />
          {selectedMode ? (
            <span
              className="projects-flow-points on"
              style={{
                left: 43,
                ["--flow-direction" as string]:
                  selectedMode === "ret" ? "reverse" : "normal",
              }}
            >
              <span className="projects-flow-dot" />
              <span className="projects-flow-dot" />
              <span className="projects-flow-dot" />
            </span>
          ) : null}
        </Link>
      ) : null}

      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {locale === "en" ? "Active projects" : "Proyectos activos"}
        </p>

        <div
          ref={scrollerRef}
          className="projects-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {projectViewModels.map((entry) => {
            const isSelected = selectedProjectId === entry.project.id;
            const isAddMode = isSelected && selectedMode === "add";
            const isReturnMode = isSelected && selectedMode === "ret";
            const panelHint = selectedMode
              ? `${
                  selectedMode === "add" ? transferCopy.addHint : transferCopy.retHint
                }: ${formatMoneyWithSymbol(
                  selectedMode === "add"
                    ? huchaStats.accumulatedMinor
                    : entry.returnableMinor,
                  baseCurrency,
                  currencySymbol
                )}`
              : transferCopy.selectDirection;

            return (
              <div
                key={entry.project.id}
                className="min-w-[190px] max-w-[210px] snap-start"
                style={{
                  opacity: fadingProjectId === entry.project.id ? 0 : 1,
                  transition: "opacity 180ms ease",
                }}
              >
                <div
                  className="flex h-full min-h-[286px] cursor-pointer flex-col overflow-hidden rounded-[14px] border bg-card px-[18px] pb-[18px] pt-[18px] transition-all duration-300"
                  style={{
                    borderColor: isSelected
                      ? "rgba(78,205,196,0.22)"
                      : "hsl(var(--border))",
                    transform: isSelected ? "translateY(-3px)" : "translateY(0)",
                    boxShadow: isSelected ? "0 8px 28px rgba(0,0,0,0.12)" : "none",
                  }}
                  onClick={() => handleSelectProject(entry.project.id)}
                >
                  <div className="mb-3 flex min-h-[80px] items-center justify-center gap-2">
                    {isSelected ? (
                      <button
                        type="button"
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border text-sm transition-colors"
                        style={{
                          borderColor: isReturnMode
                            ? "rgba(116,198,157,0.45)"
                            : "hsl(var(--border))",
                          backgroundColor: isReturnMode
                            ? "rgba(116,198,157,0.12)"
                            : "transparent",
                          color: isReturnMode ? RETURN_ACCENT : "hsl(var(--muted-foreground))",
                        }}
                        disabled={!canEdit}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleMode("ret");
                        }}
                        aria-label={locale === "en" ? "Return to Hucha" : "Devolver a hucha"}
                      >
                        ↑
                      </button>
                    ) : null}

                    <ProjectProgressRing
                      progress={entry.progress.progressRatio}
                      size={80}
                      strokeWidth={6}
                      progressColor={entry.projectColor}
                      center={
                        <span className="text-[28px] leading-none">
                          {entry.project.emoji || DEFAULT_PROJECT_EMOJI}
                        </span>
                      }
                    />

                    {isSelected ? (
                      <button
                        type="button"
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border text-sm transition-colors"
                        style={{
                          borderColor: isAddMode
                            ? "rgba(78,205,196,0.45)"
                            : "hsl(var(--border))",
                          backgroundColor: isAddMode
                            ? "rgba(78,205,196,0.12)"
                            : "transparent",
                          color: isAddMode ? HUCHA_ACCENT : "hsl(var(--muted-foreground))",
                        }}
                        disabled={!canEdit}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleMode("add");
                        }}
                        aria-label={locale === "en" ? "Add from Hucha" : "Anadir desde hucha"}
                      >
                        ↓
                      </button>
                    ) : null}
                  </div>

                  <p className="truncate text-center text-sm font-semibold">{entry.project.name}</p>
                  <p className="mt-1 text-center text-[11px] text-muted-foreground">
                    {formatMoneyWithSymbol(
                      entry.progress.fundedReservedMinor,
                      baseCurrency,
                      currencySymbol
                    )}{" "}
                    {tProjects("of")}{" "}
                    {formatMoneyWithSymbol(entry.progress.targetMinor, baseCurrency, currencySymbol)}
                  </p>
                  <p
                    className="mt-1 text-center text-[13px] font-bold"
                    style={{ color: entry.projectColor }}
                  >
                    {entry.progressPercent}%
                  </p>

                  {entry.durationLabel && entry.dateLabel ? (
                    <div className="mt-1 text-center text-[11px] leading-[1.35] text-muted-foreground">
                      <p>{entry.durationLabel}</p>
                      <p className="text-[10px] opacity-70">{entry.dateLabel}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-center text-[11px] text-amber-600">
                      {tProjects("noPlan")}
                    </p>
                  )}

                  {isSelected ? (
                    <button
                      type="button"
                      className="mt-3 min-h-8 w-full rounded-full border bg-card px-3 py-1.5 text-center text-xs font-semibold transition-colors hover:bg-muted/30"
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/projects/${entry.project.id}`);
                      }}
                    >
                      {locale === "en" ? "View detail" : "Ver detalle"}
                    </button>
                  ) : null}

                  {isSelected ? (
                    <div className="mx-[-18px] mb-[-18px] mt-[14px] border-t bg-muted/30 px-[14px] pb-3 pt-3">
                      <p className="mb-2 text-center text-[11px] text-muted-foreground">
                        {panelHint}
                      </p>

                      {selectedMode ? (
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 border-b border-border">
                            <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-muted-foreground">
                              €
                            </span>
                            <input
                              value={transferInput}
                              onChange={(event) =>
                                setTransferInput(sanitizeNumericInput(event.target.value))
                              }
                              inputMode="decimal"
                              placeholder="0"
                              className="w-full bg-transparent py-1.5 pl-4 text-base font-semibold outline-none placeholder:text-muted-foreground"
                              onClick={(event) => event.stopPropagation()}
                            />
                          </div>

                          <button
                            type="button"
                            className="flex h-[30px] w-[30px] items-center justify-center rounded-full transition-opacity"
                            style={{
                              backgroundColor: HUCHA_ACCENT,
                              opacity: isTransferValid ? 1 : 0.35,
                            }}
                            disabled={!isTransferValid || isSubmittingTransfer}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleConfirmTransfer();
                            }}
                            aria-label={locale === "en" ? "Confirm transfer" : "Confirmar transferencia"}
                          >
                            <Check
                              className="h-3.5 w-3.5"
                              strokeWidth={3}
                              style={{ color: "rgba(10,10,10,0.9)" }}
                            />
                          </button>
                        </div>
                      ) : null}

                      {transferValidationError || transferError ? (
                        <p className="mt-2 text-center text-[11px] font-medium text-destructive">
                          {transferValidationError ?? transferError}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        className="mt-2 block w-full text-center text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCancelTransfer();
                        }}
                      >
                        {tCommon("cancel")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="flex min-h-[286px] min-w-[190px] snap-start flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed bg-transparent px-4 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            onClick={openCreate}
            disabled={!canEdit}
            style={{ opacity: canEdit ? 1 : 0.45 }}
          >
            <Plus className="h-8 w-8" strokeWidth={1.5} />
            <span className="text-sm font-medium">{tProjects("newProject")}</span>
          </button>
        </div>
      </div>

      <Link
        href="/savings"
        className="block rounded-[14px] border bg-card px-5 py-4 transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{tProjects("totalCommitment")}</p>
            <p className="text-[28px] font-semibold leading-none">
              {formatMoneyWithSymbol(totalCommitmentMinor, baseCurrency, currencySymbol)}
              <span className="ml-1 text-base font-medium text-muted-foreground">
                {tProjects("perMonth")}
              </span>
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </Link>

      <SlidePanel open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{tProjects("create.title")}</SlidePanelTitle>
            <SlidePanelDescription>
              {tProjects("create.description")}
            </SlidePanelDescription>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">{tProjects("create.nameLabel")}</Label>
              <Input
                id="project-name"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                placeholder={tProjects("create.namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-emoji">{tProjects("create.emojiLabel")}</Label>
              <Input
                id="project-emoji"
                value={emojiInput}
                onChange={(event) => setEmojiInput(event.target.value)}
                maxLength={8}
              />
              <div className="flex flex-wrap gap-2">
                {PROJECT_EMOJI_SUGGESTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-md border px-2 py-1 text-lg"
                    onClick={() => setEmojiInput(emoji)}
                    aria-label={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-target">{tProjects("create.targetLabel")}</Label>
              <Input
                id="project-target"
                value={targetInput}
                onChange={(event) => setTargetInput(sanitizeNumericInput(event.target.value))}
                inputMode="decimal"
                placeholder={tProjects("create.targetPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-priority">{tProjects("create.priorityLabel")}</Label>
              <Input
                id="project-priority"
                value={priorityInput}
                onChange={(event) =>
                  setPriorityInput(event.target.value.replace(/[^0-9]/g, ""))
                }
                inputMode="numeric"
                placeholder={String(nextPriority)}
              />
            </div>

            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}
          </SlidePanelBody>
          <SlidePanelFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!canEdit || isCreating}>
              {isCreating ? tCommon("creating") : tProjects("create.submit")}
            </Button>
          </SlidePanelFooter>
        </SlidePanelContent>
      </SlidePanel>

      <style jsx>{`
        .projects-flow-line {
          position: absolute;
          bottom: -1px;
          width: 2px;
          height: 0;
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            rgba(78, 205, 196, 0.55),
            rgba(78, 205, 196, 0)
          );
          transition: height 0.45s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
        }

        .projects-flow-line.on {
          height: 28px;
        }

        .projects-flow-points {
          position: absolute;
          bottom: -28px;
          width: 4px;
          height: 28px;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .projects-flow-points.on {
          opacity: 1;
        }

        .projects-flow-dot {
          position: absolute;
          left: 0;
          top: 0;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: ${HUCHA_ACCENT};
          animation: projectsFlowDot 1.5s ease-in-out infinite;
          animation-direction: var(--flow-direction, normal);
        }

        .projects-flow-dot:nth-child(2) {
          animation-delay: 0.5s;
        }

        .projects-flow-dot:nth-child(3) {
          animation-delay: 1s;
        }

        @keyframes projectsFlowDot {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateY(24px);
            opacity: 0;
          }
        }

        .projects-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </PageContainer>
  );
}
