"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  computeProjectMonthlyAllocation,
  distributeProjectSurplusProportionally,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  parseMoneyToMinor,
  type Project,
  type ProjectContribution,
  type UserRole,
} from "@poleursus/shared";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type MonthCloseClientProps = {
  accountId: string;
  role: UserRole;
  currentUserId: string;
  monthKey: string;
  pendingMonthKeys: string[];
  monthStart: string;
  baseCurrency: string;
  currencySymbol: string;
  actualSavedMinor: string;
  projects: Project[];
  huchaProject: Project | null;
  existingContributions: ProjectContribution[];
  userLabels: Record<string, string>;
};

type AllocationMode = "hucha" | "proportional" | "manual";

type ParsedRow = {
  projectId: string;
  amountMinor: bigint;
  error: string | null;
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

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

const formatSignedMoney = (
  value: bigint,
  baseCurrency: string,
  currencySymbol: string
) => {
  const abs = value < 0n ? -value : value;
  const formatted = formatMoneyWithSymbol(abs, baseCurrency, currencySymbol);
  if (value === 0n) return formatted;
  return value > 0n ? `+${formatted}` : `-${formatted}`;
};

export function MonthCloseClient({
  accountId,
  role,
  currentUserId,
  monthKey,
  pendingMonthKeys,
  monthStart,
  baseCurrency,
  currencySymbol,
  actualSavedMinor,
  projects,
  huchaProject,
  existingContributions,
  userLabels,
}: MonthCloseClientProps) {
  const locale = useLocale();
  const router = useRouter();
  const tProjects = useTranslations("projects");
  const tCommon = useTranslations("common");
  const tGlobal = useTranslations();
  const supabase = useMemo(() => createClient(), []);
  const { emitMutation } = useWebDataCache();

  const canEdit = role !== "viewer";

  const actualSaved = useMemo(() => {
    try {
      return BigInt(actualSavedMinor);
    } catch {
      return 0n;
    }
  }, [actualSavedMinor]);

  const allocatableMinor = actualSaved > 0n ? actualSaved : 0n;

  const commitments = useMemo(
    () =>
      projects.map((project) => ({
        project,
        commitmentMinor: toMinor(project.monthly_commitment_base_minor ?? 0),
      })),
    [projects]
  );

  const allocationResult = useMemo(
    () =>
      computeProjectMonthlyAllocation({
        projects: commitments.map((row) => ({
          projectId: row.project.id,
          priority: row.project.priority,
          commitmentMinor: row.commitmentMinor,
        })),
        actualSavedMinor: allocatableMinor,
      }),
    [allocatableMinor, commitments]
  );

  const surplusProportional = useMemo(
    () =>
      distributeProjectSurplusProportionally({
        projects: commitments.map((row) => ({
          projectId: row.project.id,
          priority: row.project.priority,
          commitmentMinor: row.commitmentMinor,
        })),
        surplusMinor: allocationResult.surplusMinor,
      }),
    [allocationResult.surplusMinor, commitments]
  );

  const suggestedByProject = useMemo(() => {
    const map = new Map<string, bigint>();
    allocationResult.allocations.forEach((row) => {
      map.set(row.projectId, row.allocatedMinor);
    });
    return map;
  }, [allocationResult.allocations]);

  const proportionalByProject = useMemo(() => {
    const map = new Map<string, bigint>();
    surplusProportional.forEach((row) => {
      map.set(row.projectId, row.allocatedSurplusMinor);
    });
    return map;
  }, [surplusProportional]);

  const groupedExisting = useMemo(() => {
    const map = new Map<
      string,
      {
        actualMinor: bigint;
        committedMinor: bigint;
        confirmed: boolean;
        userId: string | null;
        confirmedAt: string | null;
      }
    >();

    existingContributions.forEach((entry) => {
      const current =
        map.get(entry.project_id) ??
        {
          actualMinor: 0n,
          committedMinor: 0n,
          confirmed: false,
          userId: null,
          confirmedAt: null,
        };

      const nextConfirmedAt =
        typeof entry.confirmed_at === "string" ? entry.confirmed_at : null;

      map.set(entry.project_id, {
        actualMinor: current.actualMinor + toMinor(entry.actual_amount_base_minor),
        committedMinor:
          current.committedMinor + toMinor(entry.committed_amount_base_minor ?? 0),
        confirmed: current.confirmed || Boolean(entry.confirmed),
        userId: entry.user_id ?? current.userId,
        confirmedAt: nextConfirmedAt ?? current.confirmedAt,
      });
    });

    return map;
  }, [existingContributions]);

  const isInitiallyConfirmed = useMemo(() => {
    if (projects.length === 0) return false;
    return projects.every((project) => groupedExisting.get(project.id)?.confirmed);
  }, [groupedExisting, projects]);

  const initialMode: AllocationMode = isInitiallyConfirmed
    ? "manual"
    : "hucha";

  const initialInputs = useMemo(() => {
    const result: Record<string, string> = {};
    commitments.forEach(({ project }) => {
      const existing = groupedExisting.get(project.id);
      const suggested = suggestedByProject.get(project.id) ?? 0n;
      const value = existing?.actualMinor ?? suggested;
      result[project.id] = formatMinorToMoney(value, baseCurrency);
    });
    return result;
  }, [baseCurrency, commitments, groupedExisting, suggestedByProject]);

  const [allocationMode, setAllocationMode] = useState<AllocationMode>(initialMode);
  const [inputsByProject, setInputsByProject] = useState<Record<string, string>>(
    initialInputs
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmedRows, setConfirmedRows] = useState<ProjectContribution[]>(
    existingContributions
  );

  const isFullyConfirmed = useMemo(() => {
    if (projects.length === 0) return false;

    const confirmedProjectIds = new Set(
      confirmedRows
        .filter((row) => row.confirmed)
        .map((row) => row.project_id)
    );

    return projects.every((project) => confirmedProjectIds.has(project.id));
  }, [confirmedRows, projects]);

  const applyAutomaticMode = (mode: Exclude<AllocationMode, "manual">) => {
    const next: Record<string, string> = {};
    commitments.forEach(({ project }) => {
      const base = suggestedByProject.get(project.id) ?? 0n;
      const extra =
        mode === "proportional" ? proportionalByProject.get(project.id) ?? 0n : 0n;
      next[project.id] = formatMinorToMoney(base + extra, baseCurrency);
    });

    setAllocationMode(mode);
    setInputsByProject(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const parsedAllocations = useMemo(() => {
    const parsedRows: ParsedRow[] = commitments.map(({ project }) => {
      const raw = (inputsByProject[project.id] ?? "").trim();
      if (!raw) {
        return { projectId: project.id, amountMinor: 0n, error: null };
      }

      const parsed = parseMoneyToMinor(raw, baseCurrency);
      if (typeof parsed === "object" && "error" in parsed) {
        return {
          projectId: project.id,
          amountMinor: 0n,
          error: tGlobal(parsed.error.key, parsed.error.params),
        };
      }

      return {
        projectId: project.id,
        amountMinor: parsed,
        error: null,
      };
    });

    const map = new Map(parsedRows.map((row) => [row.projectId, row]));
    const totalAssignedMinor = parsedRows.reduce(
      (total, row) => total + row.amountMinor,
      0n
    );
    const hasErrors = parsedRows.some((row) => row.error !== null);

    return {
      rows: parsedRows,
      byProject: map,
      totalAssignedMinor,
      hasErrors,
    };
  }, [baseCurrency, commitments, inputsByProject, tGlobal]);

  const overAssignedMinor =
    parsedAllocations.totalAssignedMinor > allocatableMinor
      ? parsedAllocations.totalAssignedMinor - allocatableMinor
      : 0n;

  const unassignedMinor =
    allocatableMinor > parsedAllocations.totalAssignedMinor
      ? allocatableMinor - parsedAllocations.totalAssignedMinor
      : 0n;

  const deficitAfterAssignMinor =
    allocationResult.totalCommittedMinor > parsedAllocations.totalAssignedMinor
      ? allocationResult.totalCommittedMinor - parsedAllocations.totalAssignedMinor
      : 0n;

  const latestConfirmation = useMemo(() => {
    const confirmed = confirmedRows
      .filter((row) => row.confirmed)
      .sort((a, b) => {
        const aDate =
          typeof a.confirmed_at === "string"
            ? new Date(a.confirmed_at).getTime()
            : 0;
        const bDate =
          typeof b.confirmed_at === "string"
            ? new Date(b.confirmed_at).getTime()
            : 0;
        return bDate - aDate;
      });

    return confirmed[0] ?? null;
  }, [confirmedRows]);

  const handleInputChange = (projectId: string, value: string) => {
    setAllocationMode("manual");
    setInputsByProject((previous) => ({
      ...previous,
      [projectId]: sanitizeNumericInput(value),
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleConfirm = async () => {
    if (!canEdit || isSaving) return;

    if (projects.length === 0 && !huchaProject) {
      setErrorMessage(tProjects("monthClose.noProjects"));
      return;
    }

    if (parsedAllocations.hasErrors) {
      setErrorMessage(tProjects("monthClose.fixErrors"));
      return;
    }

    if (overAssignedMinor > 0n) {
      setErrorMessage(
        tProjects("monthClose.overAssigned", {
          amount: formatMoneyWithSymbol(overAssignedMinor, baseCurrency, currencySymbol),
        })
      );
      return;
    }

    if (unassignedMinor > 0n && !huchaProject) {
      setErrorMessage(tProjects("monthClose.huchaMissing"));
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const nowIso = new Date().toISOString();
      const payload = commitments.map(({ project, commitmentMinor }) => {
        const parsed = parsedAllocations.byProject.get(project.id);
        const assignedMinor = parsed?.amountMinor ?? 0n;
        const suggestedMinor =
          (suggestedByProject.get(project.id) ?? 0n) +
          (allocationMode === "proportional"
            ? proportionalByProject.get(project.id) ?? 0n
            : 0n);

        return {
          account_id: accountId,
          project_id: project.id,
          user_id: currentUserId,
          period: monthStart,
          committed_amount_base_minor: String(commitmentMinor),
          actual_amount_base_minor: String(assignedMinor),
          source: assignedMinor === suggestedMinor ? "automatic" : "manual",
          confirmed: true,
          confirmed_at: nowIso,
          updated_at: nowIso,
        };
      });

      if (huchaProject && unassignedMinor > 0n) {
        payload.push({
          account_id: accountId,
          project_id: huchaProject.id,
          user_id: currentUserId,
          period: monthStart,
          committed_amount_base_minor: "0",
          actual_amount_base_minor: String(unassignedMinor),
          source: "automatic",
          confirmed: true,
          confirmed_at: nowIso,
          updated_at: nowIso,
        });
      }

      const { data, error } = await supabase
        .from("project_contributions")
        .upsert(payload, { onConflict: "project_id,period" })
        .select("*");

      if (error) throw error;

      setConfirmedRows((data as ProjectContribution[]) ?? []);
      await emitMutation("project_contributions", "upsert");
      setSuccessMessage(tProjects("monthClose.confirmed"));
      router.refresh();
    } catch (error) {
      console.error("[Projects] Month close confirm error", error);
      setErrorMessage(tGlobal("errors.internalServer"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tProjects("backToList")}
        </Link>
      </div>

      {pendingMonthKeys.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">
              {tProjects("monthClose.pendingMonthsListTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {tProjects("monthClose.pendingMonthsListHint")}
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingMonthKeys.map((pendingKey) => (
                <Button
                  key={pendingKey}
                  asChild
                  size="sm"
                  variant={pendingKey === monthKey ? "default" : "outline"}
                >
                  <Link href={`/projects/month-close?month=${pendingKey}`}>
                    {formatMonthLabel(pendingKey, locale)}
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">{tProjects("monthClose.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {tProjects("monthClose.subtitle", {
              month: formatMonthLabel(monthKey, locale),
            })}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">{tProjects("monthClose.actualSaved")}</p>
            <p className="text-xl font-semibold">
              {formatSignedMoney(actualSaved, baseCurrency, currencySymbol)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">
              {tProjects("monthClose.totalCommitted")}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(
                allocationResult.totalCommittedMinor,
                baseCurrency,
                currencySymbol
              )}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">{tProjects("monthClose.allocatable")}</p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(allocatableMinor, baseCurrency, currencySymbol)}
            </p>
          </div>
        </CardContent>
      </Card>

      {isFullyConfirmed && latestConfirmation ? (
        <Card>
          <CardContent className="space-y-1 p-4 text-sm">
            <p className="font-medium text-emerald-600">{tProjects("monthClose.alreadyConfirmed")}</p>
            <p className="text-muted-foreground">
              {tProjects("monthClose.confirmedBy", {
                name:
                  latestConfirmation.user_id
                    ? userLabels[latestConfirmation.user_id] ?? latestConfirmation.user_id.slice(0, 8)
                    : tProjects("history.unknownUser"),
              })}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {projects.length === 0 && !huchaProject ? (
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm text-muted-foreground">{tProjects("monthClose.noProjects")}</p>
            <Button asChild variant="outline">
              <Link href="/projects">{tProjects("backToList")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {allocationResult.surplusMinor > 0n ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-medium">{tProjects("monthClose.surplusTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {tProjects("monthClose.surplusDescription", {
                    amount: formatMoneyWithSymbol(
                      allocationResult.surplusMinor,
                      baseCurrency,
                      currencySymbol
                    ),
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={allocationMode === "hucha" ? "default" : "outline"}
                    onClick={() => applyAutomaticMode("hucha")}
                    disabled={!canEdit}
                  >
                    {tProjects("monthClose.surplusToHucha")}
                  </Button>
                  <Button
                    type="button"
                    variant={allocationMode === "proportional" ? "default" : "outline"}
                    onClick={() => applyAutomaticMode("proportional")}
                    disabled={!canEdit}
                  >
                    {tProjects("monthClose.surplusProportional")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="space-y-4 p-6">
              {commitments.map(({ project, commitmentMinor }) => {
                const parsed = parsedAllocations.byProject.get(project.id);
                const assignedMinor = parsed?.amountMinor ?? 0n;
                const isFulfilled = commitmentMinor > 0n && assignedMinor >= commitmentMinor;
                const hasDeficit = commitmentMinor > 0n && assignedMinor < commitmentMinor;

                return (
                  <div key={project.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">
                          {project.emoji} {project.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {tProjects("monthClose.projectCommitment", {
                            amount: formatMoneyWithSymbol(
                              commitmentMinor,
                              baseCurrency,
                              currencySymbol
                            ),
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        {isFulfilled ? (
                          <p className="text-xs font-medium text-emerald-600">
                            {tProjects("history.statusFulfilled")}
                          </p>
                        ) : hasDeficit ? (
                          <p className="text-xs font-medium text-amber-600">
                            {tProjects("history.statusDeficit")}
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-muted-foreground">
                            {tProjects("history.statusNoPlan")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <label className="text-xs text-muted-foreground">
                        {tProjects("monthClose.projectAssigned")}
                      </label>
                      <Input
                        value={inputsByProject[project.id] ?? ""}
                        onChange={(event) =>
                          handleInputChange(project.id, event.target.value)
                        }
                        inputMode="decimal"
                        placeholder="0"
                        disabled={!canEdit}
                      />
                      {parsed?.error ? (
                        <p className="text-xs text-destructive">{parsed.error}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="text-muted-foreground">
                {tProjects("monthClose.toHucha", {
                  amount: formatMoneyWithSymbol(unassignedMinor, baseCurrency, currencySymbol),
                })}
              </p>
              <p className="text-muted-foreground">
                {tProjects("monthClose.deficit", {
                  amount: formatMoneyWithSymbol(
                    deficitAfterAssignMinor,
                    baseCurrency,
                    currencySymbol
                  ),
                })}
              </p>
              {errorMessage ? <p className="text-destructive">{errorMessage}</p> : null}
              {successMessage ? <p className="text-emerald-600">{successMessage}</p> : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/projects")}
              disabled={isSaving}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                !canEdit ||
                isSaving ||
                parsedAllocations.hasErrors ||
                overAssignedMinor > 0n
              }
            >
              {isSaving ? tProjects("monthClose.confirming") : tProjects("monthClose.confirmCta")}
            </Button>
          </div>
        </>
      )}
    </PageContainer>
  );
}
