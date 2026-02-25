"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  formatMonthLabel,
  computeProjectProgress,
  formatMoneyWithSymbol,
  getMonthlyProjectCommitmentTotal,
  parseMoneyToMinor,
  type Project,
  type ProjectContribution,
  type UserRole,
} from "@poleursus/shared";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  initialContributions: ProjectContribution[];
  hasPendingMonthlyClose: boolean;
  pendingMonthKey: string;
};

const DEFAULT_EMOJI = "\u{1F3AF}";
const EMOJI_SUGGESTIONS = [
  "\u{1F3AF}",
  "\u{1F3F0}",
  "\u{1F4BB}",
  "\u{1F697}",
  "\u{1F3E0}",
  "\u{2708}\u{FE0F}",
  "\u{1F3D6}\u{FE0F}",
  "\u{1F6B2}",
  "\u{1F4CD}",
];

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

type TranslateFn = (key: any, values?: Record<string, unknown>) => string;

const formatDuration = (months: number, t: TranslateFn) => {
  if (months <= 0) return t("simulator.reached");
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years > 0 && remainingMonths > 0) {
    return t("simulator.durationYearMonth", {
      years,
      months: remainingMonths,
    });
  }

  if (years > 0) {
    return t("simulator.durationYears", { years });
  }

  return t("simulator.durationMonths", { months: remainingMonths });
};

const formatEstimatedDate = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);

export function ProjectsClient({
  accountId,
  currentUserId,
  role,
  baseCurrency,
  currencySymbol,
  initialProjects,
  initialContributions,
  hasPendingMonthlyClose,
  pendingMonthKey,
}: ProjectsClientProps) {
  const locale = useLocale();
  const tProjects = useTranslations("projects");
  const tCommon = useTranslations("common");
  const tGlobal = useTranslations();
  const supabase = useMemo(() => createClient(), []);

  const canEdit = role !== "viewer";

  const [projects, setProjects] = useState<Project[]>(
    [...initialProjects].sort((a, b) => a.priority - b.priority)
  );
  const [contributions] = useState<ProjectContribution[]>(initialContributions);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [emojiInput, setEmojiInput] = useState(DEFAULT_EMOJI);
  const [targetInput, setTargetInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("");

  const contributionsByProject = useMemo(() => {
    const byProject = new Map<string, ProjectContribution[]>();

    contributions.forEach((contribution) => {
      const current = byProject.get(contribution.project_id) ?? [];
      current.push(contribution);
      byProject.set(contribution.project_id, current);
    });

    return byProject;
  }, [contributions]);

  const totalCommitmentMinor = useMemo(
    () => getMonthlyProjectCommitmentTotal(projects, { activeOnly: true }),
    [projects]
  );

  const nextPriority = useMemo(() => {
    const highest = projects.reduce(
      (max, project) => Math.max(max, project.priority),
      0
    );
    return highest + 1;
  }, [projects]);

  const openCreate = () => {
    setCreateError(null);
    setNameInput("");
    setEmojiInput(DEFAULT_EMOJI);
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

    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          account_id: accountId,
          name: trimmedName,
          emoji: emojiInput.trim() || DEFAULT_EMOJI,
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
      setIsCreateOpen(false);
    } catch (error) {
      console.error("[Projects] Create error", error);
      setCreateError(tGlobal("errors.internalServer"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{tProjects("pageTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tProjects("pageDescription")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/projects/month-close?month=${pendingMonthKey}`}>
              {tProjects("monthClose.openCta")}
            </Link>
          </Button>
          <Button
            onClick={openCreate}
            disabled={!canEdit}
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {tProjects("newProject")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-2 p-4">
          <div>
            <p className="text-sm text-muted-foreground">{tProjects("totalCommitment")}</p>
            <p className="text-2xl font-semibold">
              {formatMoneyWithSymbol(totalCommitmentMinor, baseCurrency, currencySymbol)}
              <span className="ml-1 text-base font-medium text-muted-foreground">
                {tProjects("perMonth")}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {hasPendingMonthlyClose ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">{tProjects("monthClose.pendingTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {tProjects("monthClose.pendingDescription", {
                  month: formatMonthLabel(pendingMonthKey, locale),
                })}
              </p>
            </div>
            <Button asChild>
              <Link href={`/projects/month-close?month=${pendingMonthKey}`}>
                {tProjects("monthClose.reviewCta")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">{tProjects("emptyTitle")}</h2>
            <p className="text-sm text-muted-foreground">{tProjects("emptyDescription")}</p>
            <Button onClick={openCreate} disabled={!canEdit}>
              {tProjects("newProject")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => {
            const progress = computeProjectProgress({
              project,
              contributions: contributionsByProject.get(project.id) ?? [],
            });

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-xl border p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProjectProgressRing
                      progress={progress.progressRatio}
                      size={78}
                      strokeWidth={7}
                      center={
                        <span className="text-2xl leading-none">
                          {project.emoji || DEFAULT_EMOJI}
                        </span>
                      }
                    />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{project.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatMoneyWithSymbol(
                          progress.savedMinor,
                          baseCurrency,
                          currencySymbol
                        )}{" "}
                        {tProjects("of")}{" "}
                        {formatMoneyWithSymbol(
                          progress.targetMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {Math.round(progress.progressRatio * 100)}%
                    </p>
                    {progress.monthsLeft !== null && progress.estimatedCompletionDate ? (
                      <p className="text-xs text-muted-foreground">
                        {tProjects("estimatedDate", {
                          duration: formatDuration(progress.monthsLeft, tProjects),
                          date: formatEstimatedDate(progress.estimatedCompletionDate, locale),
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600">{tProjects("noPlan")}</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

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
                {EMOJI_SUGGESTIONS.map((emoji) => (
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
                onChange={(event) =>
                  setTargetInput(sanitizeNumericInput(event.target.value))
                }
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
    </div>
  );
}
