import { useTranslations } from "next-intl";
import type { Project, ProjectProgress, HomeProjectWidgetState } from "@poleursus/shared";
import { formatCurrencyParts, toMinor } from "./utils";

type ObjectiveStatus = "on-track" | "at-risk" | "off-track";

type ObjectiveData = {
  status: ObjectiveStatus;
  currentMinor: bigint | string | number;
  targetMinor: bigint | string | number;
  messageHtml: string;
};

type ActiveProjectData = {
  project: Project;
  progress: ProjectProgress;
  monthlyImpactPercent: number;
};

type ProjectObjectiveWidgetProps = {
  widgetState: HomeProjectWidgetState;
  activeProject: ActiveProjectData | null;
  objective: ObjectiveData | null;
  participantCount?: number;
  onViewProject: (projectId: string) => void;
  onCreateProject: () => void;
  onCreateGoal: () => void;
  currencySymbol: string;
  locale?: string;
  monoClassName?: string;
};

const statusBar: Record<ObjectiveStatus, string> = {
  "on-track": "bg-[var(--account-income)]",
  "at-risk": "bg-amber-400",
  "off-track": "bg-[var(--account-expense)]",
};

const statusBadge: Record<ObjectiveStatus, string> = {
  "on-track":
    "border-[var(--account-income-light)] bg-[var(--account-income-bg)] text-[var(--account-income)]",
  "at-risk": "border-amber-500/30 bg-amber-500/15 text-amber-600",
  "off-track":
    "border-[var(--account-expense-light)] bg-[var(--account-expense-bg)] text-[var(--account-expense)]",
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const formatMonthYear = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);

export function ProjectObjectiveWidget({
  widgetState,
  activeProject,
  objective,
  participantCount,
  onViewProject,
  onCreateProject,
  onCreateGoal,
  currencySymbol,
  locale = "es",
  monoClassName,
}: ProjectObjectiveWidgetProps) {
  const t = useTranslations();
  const safeParticipantCount = Math.max(1, participantCount ?? 1);

  if (widgetState.state === "empty") {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-8 text-center">
        <p className="text-4xl">✨</p>
        <h3 className="mt-3 text-lg font-semibold text-foreground">
          {t("mobile.home.projectEmptyTitle", { participants: safeParticipantCount })}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("mobile.home.projectEmptyDescription", { participants: safeParticipantCount })}
        </p>
        <button
          type="button"
          onClick={onCreateProject}
          className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {t("mobile.home.projectCreateCta")}
        </button>
      </div>
    );
  }

  if (widgetState.state === "completed") {
    const completedProject = widgetState.project;
    const completedAmount = formatCurrencyParts(
      toMinor(completedProject.target_amount_base_minor),
      currencySymbol,
      locale
    ).full;

    return (
      <div className="rounded-xl border border-[var(--account-income-light)] bg-[var(--account-income-bg)] px-6 py-7 text-center">
        <p className="text-4xl">{completedProject.emoji || "🎯"}</p>
        <h3 className="mt-2 text-xl font-semibold text-[var(--account-income)]">
          {t("mobile.home.projectCompletedTitle", { name: completedProject.name })}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("mobile.home.projectCompletedDescription", {
            amount: completedAmount,
            participants: safeParticipantCount,
          })}
        </p>
        <p className="mt-3 text-3xl">🎉</p>
        <button
          type="button"
          onClick={() => onViewProject(completedProject.id)}
          className="mt-4 rounded-lg border border-[var(--account-income-light)] px-4 py-2 text-sm font-semibold text-[var(--account-income)]"
        >
          {t("mobile.home.projectCompletedCta")}
        </button>
      </div>
    );
  }

  if (widgetState.state === "all_done") {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-8 text-center">
        <p className="text-4xl">🌟</p>
        <h3 className="mt-3 text-lg font-semibold text-foreground">
          {t("mobile.home.projectAllDoneTitle", { participants: safeParticipantCount })}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("mobile.home.projectAllDoneDescription")}
        </p>
        <button
          type="button"
          onClick={onCreateProject}
          className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {t("mobile.home.projectAllDoneCta")}
        </button>
      </div>
    );
  }

  if (!activeProject) return null;

  const saved = formatCurrencyParts(
    activeProject.progress.savedMinor,
    currencySymbol,
    locale
  ).full;
  const target = formatCurrencyParts(
    activeProject.progress.targetMinor,
    currencySymbol,
    locale
  ).full;
  const projectProgressPercent = clampPercent(
    Math.round(activeProject.progress.progressRatio * 100)
  );

  const savedNum = objective ? Number(toMinor(objective.currentMinor)) : 0;
  const targetNum = objective ? Number(toMinor(objective.targetMinor)) : 0;
  const barScale = Math.max(savedNum, targetNum, 1);
  const fillPercent = clampPercent(Math.round((Math.max(0, savedNum) / barScale) * 100));
  const markerPercent = clampPercent(Math.round((targetNum / barScale) * 100));

  const statusIconChar =
    objective?.status === "on-track" ? "✓" : objective?.status === "off-track" ? "✕" : "!";

  const objectiveCurrent = objective
    ? formatCurrencyParts(toMinor(objective.currentMinor), currencySymbol, locale).full
    : null;
  const objectiveTarget = objective
    ? formatCurrencyParts(toMinor(objective.targetMinor), currencySymbol, locale).full
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-5 pb-4 pt-5">
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="text-3xl">{activeProject.project.emoji || "🎯"}</span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground">
                {activeProject.project.name}
              </h3>
              <p className={`text-xs text-muted-foreground ${monoClassName ?? ""}`}>
                {saved} {t("projects.of")} {target}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onViewProject(activeProject.project.id)}
            className="shrink-0 text-[13px] font-semibold text-primary hover:underline"
          >
            {t("mobile.home.projectViewDetail")}
          </button>
        </div>

        <div className="h-2 rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${projectProgressPercent}%` }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--account-income)]">{projectProgressPercent}%</span>
          <span className="text-muted-foreground">
            {activeProject.progress.estimatedCompletionDate
              ? `📅 ${formatMonthYear(activeProject.progress.estimatedCompletionDate, locale)}`
              : t("mobile.home.projectNoPlan", { participants: safeParticipantCount })}
          </span>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="px-5 pb-5 pt-4">
        {objective ? (
          <>
            <div className="mb-2.5 flex items-center gap-2.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-[6px] border text-xs font-semibold ${statusBadge[objective.status]}`}
              >
                {statusIconChar}
              </div>
              <p className="text-sm font-semibold text-foreground">
                {t("mobile.home.objectiveHeadlineLabel", {
                  amount: objectiveTarget,
                })}
              </p>
            </div>

            <div className="relative h-1.5 rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${statusBar[objective.status]}`}
                style={{ width: `${fillPercent}%` }}
              />
              <div
                className="absolute -top-1 h-3 w-0.5 rounded bg-foreground"
                style={{ left: `${markerPercent}%` }}
              />
            </div>

            <div className="mt-1.5 flex text-xs">
              {savedNum > targetNum ? (
                <>
                  <span className={`text-muted-foreground text-right ${monoClassName ?? ""}`} style={{ flex: markerPercent }}>
                    {objectiveTarget}
                  </span>
                  <strong className={`text-foreground text-right ${monoClassName ?? ""}`} style={{ flex: 100 - markerPercent }}>
                    {objectiveCurrent}
                  </strong>
                </>
              ) : savedNum < targetNum ? (
                <>
                  <strong className={`text-foreground ${monoClassName ?? ""}`}>
                    {objectiveCurrent}
                  </strong>
                  <span className={`flex-1 text-right text-muted-foreground ${monoClassName ?? ""}`}>
                    {objectiveTarget}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex-1" />
                  <strong
                    className={monoClassName ?? ""}
                    style={{ color: "var(--account-income)" }}
                  >
                    {objectiveCurrent} ✓
                  </strong>
                </>
              )}
            </div>

            <div className="mt-3 rounded-lg bg-secondary/60 px-3 py-2.5">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {t("mobile.home.projectMotivationMessage", {
                  project: activeProject.project.name,
                  percent: activeProject.monthlyImpactPercent,
                  participants: safeParticipantCount,
                })}
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-secondary/60 px-3 py-3">
            <p className="text-sm text-muted-foreground">
              {t("mobile.home.emptyGoalDescription")}
            </p>
            <button
              type="button"
              onClick={onCreateGoal}
              className="mt-2 text-sm font-semibold text-primary hover:underline"
            >
              {t("mobile.home.emptyGoalCta")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
