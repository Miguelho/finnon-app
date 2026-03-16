import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { HUCHA_PROJECT_COLOR, PROJECT_PALETTE } from "@poleursus/shared";
import { formatCurrencyParts, toMinor } from "./utils";
import { SummaryCardShell } from "./SummaryCardShell";
import { HuchaLiquidCanvas } from "@/components/hucha/hucha-liquid-canvas";

type ProjectRowItem = {
  id: string;
  name: string;
  emoji: string;
  currentAmountMinor: bigint;
  goalAmountMinor: bigint;
  color: string;
};

type ProjectsRowProps = {
  projects: ProjectRowItem[];
  huchaAmountMinor: bigint;
  totalSavingsMinor: bigint;
  plannedMinor?: bigint;
  availableMinor?: bigint;
  needsRebalance?: boolean;
  currentMonth: string;
  currencySymbol: string;
  onPress: () => void;
  locale?: string;
};

const clampProgress = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

function ProjectRing({
  progress,
  size,
  color,
  trackColor,
  emoji,
  completed,
}: {
  progress: number;
  size: number;
  color: string;
  trackColor: string;
  emoji: string;
  completed: boolean;
}) {
  const normalized = clampProgress(progress);
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - normalized * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={
            completed
              ? { filter: `drop-shadow(0 0 5px ${color})` }
              : undefined
          }
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[15px]">
        {emoji}
      </div>
      {completed ? (
        <span className="absolute -bottom-[2px] -right-[2px] inline-flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[#6DC9A0] text-[9px] font-bold text-black">
          ✓
        </span>
      ) : null}
    </div>
  );
}

export function ProjectsRow({
  projects,
  huchaAmountMinor,
  totalSavingsMinor,
  plannedMinor = 0n,
  availableMinor = 0n,
  needsRebalance = false,
  currentMonth,
  currencySymbol,
  onPress,
  locale = "es-ES",
}: ProjectsRowProps) {
  const t = useTranslations();
  const isHero = projects.length === 1;
  const visibleProjects = projects.slice(0, 3);
  const multiProjectRingSize = visibleProjects.length <= 2 ? 40 : 34;
  const savingsTitle = locale.startsWith("en") ? "Savings" : "Ahorro";
  const savingsVisualMaxMinor = totalSavingsMinor > 0n ? totalSavingsMinor : 1n;
  const ringTrack = "rgba(255,255,255,0.06)";
  const totalParts = formatCurrencyParts(totalSavingsMinor, currencySymbol, locale);
  const huchaParts = formatCurrencyParts(huchaAmountMinor, currencySymbol, locale);
  const plannedParts = formatCurrencyParts(plannedMinor, currencySymbol, locale);
  const availableParts = formatCurrencyParts(availableMinor, currencySymbol, locale);
  const hero = projects[0] ?? null;
  const heroCurrentParts = hero
    ? formatCurrencyParts(hero.currentAmountMinor, currencySymbol, locale)
    : null;
  const heroGoalParts = hero
    ? formatCurrencyParts(hero.goalAmountMinor, currencySymbol, locale)
    : null;

  return (
    <button type="button" onClick={onPress} className="w-full text-left">
      <SummaryCardShell className="w-full rounded-[14px] border-[color:rgba(255,255,255,0.12)] px-[13px] py-[14px] transition-opacity hover:opacity-[0.96]">
        {isHero && hero ? (
          <>
            <div className="flex items-center gap-3">
              <ProjectRing
                progress={Number(hero.currentAmountMinor) / Number(hero.goalAmountMinor || 1n)}
                size={50}
                color={hero.color}
                trackColor={ringTrack}
                emoji={hero.emoji}
                completed={hero.currentAmountMinor >= hero.goalAmountMinor}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[var(--account-text-primary)]">
                  {hero.name}
                </p>
                <p className="mt-[2px] text-[11px] text-[var(--account-text-secondary)]">
                  {t("home.savings.summary.progress", {
                    current: heroCurrentParts?.full ?? "",
                    goal: heroGoalParts?.full ?? "",
                  })}
                  {hero.currentAmountMinor >= hero.goalAmountMinor
                    ? ` · ${t("home.savings.summary.completed")}! 🎉`
                    : ""}
                </p>
              </div>
              <p
                className="font-balance text-[12px] font-semibold"
                style={{ color: hero.color }}
              >
                {hero.currentAmountMinor >= hero.goalAmountMinor
                  ? "✓"
                  : `${Math.round(
                      (Number(hero.currentAmountMinor) /
                        Number(hero.goalAmountMinor || 1n)) *
                        100
                    )}%`}
              </p>
              <ChevronRight className="h-4 w-4 text-[var(--account-text-tertiary)]" />
            </div>

            <div className="mt-2 flex items-center justify-between gap-4 border-t border-[color:rgba(255,255,255,0.12)] pt-[10px]">
              <p className="text-[10px] text-[var(--account-text-secondary)]">
                🐷 {t("home.savings.hucha")}{" "}
                <span
                  className="font-balance text-[11px] font-semibold"
                  style={{ color: HUCHA_PROJECT_COLOR }}
                >
                  {huchaParts.full}
                </span>
              </p>
              <p className="text-[10px] text-[var(--account-text-secondary)]">
                {t("home.savings.summary.totalLabel")}{" "}
                <span className="font-balance text-[11px] font-semibold text-[var(--account-text-primary)]">
                  {totalParts.full}
                </span>
              </p>
            </div>
            <p
              className="mt-2 text-[10px]"
              style={{
                color: needsRebalance
                  ? "#E0956A"
                  : "var(--account-text-secondary)",
              }}
            >
              {needsRebalance
                ? `${t("projects.monthClose.deficit", { amount: plannedParts.full })}`
                : `${t("home.savings.savedThisMonth")}: ${totalParts.full} · ${t("projects.monthClose.projectAssigned")}: ${plannedParts.full} · ${t("projects.monthClose.allocatable")}: ${availableParts.full}`}
            </p>
          </>
        ) : (
          <>
            <div className="flex min-h-[116px] items-stretch gap-3">
              <div className="flex min-w-[126px] shrink-0 items-center gap-3">
                <div className="relative h-[72px] w-[72px] shrink-0">
                  <HuchaLiquidCanvas
                    valueMinor={totalSavingsMinor}
                    maxMinor={savingsVisualMaxMinor}
                    size={72}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2">
                    <span className="font-balance text-center text-[11px] leading-[1.05] text-[var(--account-text-primary)]">
                      {totalParts.full}
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold tracking-[0.2px] text-[var(--account-text-tertiary)]">
                    {savingsTitle}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--account-text-secondary)]">
                    {currentMonth}
                  </p>
                </div>
              </div>

              <div className="ml-auto flex shrink-0 items-stretch gap-2 sm:gap-3">
                {visibleProjects.map((project) => {
                  return (
                    <div
                      key={project.id}
                      className="flex w-[78px] flex-col items-center justify-between rounded-[12px] border border-[color:rgba(255,255,255,0.08)] bg-[var(--account-surface-alt)] px-2 py-3"
                    >
                      <ProjectRing
                        progress={
                          Number(project.currentAmountMinor) / Number(project.goalAmountMinor || 1n)
                        }
                        size={multiProjectRingSize + 6}
                        color={project.color}
                        trackColor={ringTrack}
                        emoji={project.emoji}
                        completed={project.currentAmountMinor >= project.goalAmountMinor}
                      />
                      <span
                        className="mt-2 line-clamp-2 w-full text-center text-[9px] leading-[11px]"
                        style={{ color: project.color }}
                      >
                        {project.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex shrink-0 items-center justify-center">
                <ChevronRight className="h-4 w-4 text-[var(--account-text-tertiary)]" />
              </div>
            </div>
          </>
        )}
      </SummaryCardShell>
    </button>
  );
}

// Compatibility export for existing imports.
export const SavingsMonthCard = ({
  projectsMinor,
  huchaMinor,
  savingsMinor,
  plannedMinor = 0,
  availableMinor = 0,
  needsRebalance = false,
  onPress,
  monthLabel,
  currencySymbol,
  locale = "es-ES",
}: {
  projectsMinor: bigint | number | string;
  huchaMinor: bigint | number | string;
  savingsMinor: bigint | number | string;
  plannedMinor?: bigint | number | string;
  availableMinor?: bigint | number | string;
  needsRebalance?: boolean;
  onPress: () => void;
  monthLabel: string;
  currencySymbol: string;
  locale?: string;
}) => {
  const t = useTranslations();
  const projectsValue = toMinor(projectsMinor);
  return (
    <ProjectsRow
      projects={[
        {
          id: "fallback",
          name: t("home.savings.summary.fallbackProjectName"),
          emoji: "🎯",
          currentAmountMinor: projectsValue,
          goalAmountMinor: projectsValue > 0n ? projectsValue : 1n,
          color: PROJECT_PALETTE[0],
        },
      ]}
      huchaAmountMinor={toMinor(huchaMinor)}
      totalSavingsMinor={toMinor(savingsMinor)}
      plannedMinor={toMinor(plannedMinor)}
      availableMinor={toMinor(availableMinor)}
      needsRebalance={needsRebalance}
      currentMonth={monthLabel}
      currencySymbol={currencySymbol}
      onPress={onPress}
      locale={locale}
    />
  );
};
