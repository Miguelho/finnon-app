"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  computeProjectProgress,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getProjectReserveTransferTotalsMap,
  getReserveContainerBalanceMinor,
  getReserveContainerStats,
  getReserveTransferDirection,
  parseMoneyToMinor,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type Project,
  type ReserveContainer,
  type ReserveTransfer,
} from "@poleursus/shared";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReserveDetailClientProps = {
  accountId: string;
  locale: "es" | "en";
  canEdit: boolean;
  baseCurrency: string;
  currencySymbol: string;
  reserveContainer: ReserveContainer;
  projects: Project[];
  monthCloses: MonthClose[];
  monthCloseAllocations: MonthCloseAllocation[];
  reserveTransfers: ReserveTransfer[];
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

const formatDateLabel = (value: string | Date | null | undefined, locale: "es" | "en") => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export function ReserveDetailClient({
  accountId,
  locale,
  canEdit,
  baseCurrency,
  currencySymbol,
  reserveContainer,
  projects,
  monthCloses,
  monthCloseAllocations,
  reserveTransfers,
}: ReserveDetailClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { emitMutation } = useWebDataCache();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [amountInput, setAmountInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const monthClosesById = useMemo(
    () => new Map(monthCloses.map((monthClose) => [monthClose.id, monthClose])),
    [monthCloses]
  );

  const reserveBalanceMinor = useMemo(
    () =>
      getReserveContainerBalanceMinor({
        reserveContainerId: reserveContainer.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
      }),
    [monthCloseAllocations, reserveContainer.id, reserveTransfers]
  );

  const reserveStats = useMemo(
    () =>
      getReserveContainerStats({
        reserveContainerId: reserveContainer.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
        monthClosesById,
        currentPeriod: toMonthKey(new Date()),
      }),
    [monthCloseAllocations, monthClosesById, reserveContainer.id, reserveTransfers]
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
    const reserveTransferTotals = getProjectReserveTransferTotalsMap(reserveTransfers);
    reserveTransferTotals.forEach((amountMinor, projectId) => {
      byProject.set(projectId, (byProject.get(projectId) ?? 0n) + amountMinor);
    });
    return byProject;
  }, [monthCloseAllocations, reserveTransfers]);

  const eligibleProjects = useMemo(
    () =>
      projects
        .filter((project) => project.status === "active")
        .map((project) => {
          const progress = computeProjectProgress({
            project,
            fundedMinor: fundedByProject.get(project.id) ?? 0n,
          });
          return {
            project,
            remainingMinor: progress.remainingMinor,
          };
        })
        .filter((entry) => entry.remainingMinor > 0n),
    [fundedByProject, projects]
  );

  const parsedTransferAmount = useMemo(() => {
    const raw = amountInput.trim();
    if (!raw) return { amountMinor: 0n, error: null as string | null };

    const parsed = parseMoneyToMinor(raw, baseCurrency);
    if (typeof parsed === "object" && "error" in parsed) {
      return {
        amountMinor: 0n,
        error: locale === "en" ? "Review the amount." : "Revisa el importe.",
      };
    }

    return { amountMinor: parsed, error: null as string | null };
  }, [amountInput, baseCurrency, locale]);

  const selectedProjectEntry =
    eligibleProjects.find((entry) => entry.project.id === selectedProjectId) ?? null;

  const activityRows = useMemo(() => {
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
            locale === "en"
              ? `Month close ${period ? formatMonthLabel(period, locale) : ""}`.trim()
              : `Cierre ${period ? formatMonthLabel(period, locale) : ""}`.trim(),
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
            ? `${project.emoji || "\u{1F3AF}"} ${project.name}`
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
  }, [locale, monthCloseAllocations, monthClosesById, projects, reserveContainer.id, reserveTransfers]);

  const canTransfer =
    canEdit &&
    selectedProjectId.length > 0 &&
    parsedTransferAmount.error === null &&
    parsedTransferAmount.amountMinor > 0n &&
    parsedTransferAmount.amountMinor <= reserveBalanceMinor &&
    parsedTransferAmount.amountMinor <= (selectedProjectEntry?.remainingMinor ?? 0n);

  const handleTransfer = async () => {
    if (!canTransfer || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase.rpc("transfer_reserve_to_project", {
        p_account_id: accountId,
        p_source_reserve_container_id: reserveContainer.id,
        p_destination_project_id: selectedProjectId,
        p_amount_base_minor: parsedTransferAmount.amountMinor.toString(),
      });

      if (error) throw error;

      await emitMutation("reserve_transfers", "insert");
      setAmountInput("");
      setSuccessMessage(
        locale === "en" ? "Transfer confirmed." : "Transferencia confirmada."
      );
      router.refresh();
    } catch (error) {
      console.error("[ReserveDetail][web] transfer error", error);
      setErrorMessage(
        locale === "en"
          ? "Couldn't move money to the project."
          : "No se pudo mover dinero al proyecto."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/savings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {locale === "en" ? "Back to savings" : "Volver a ahorro"}
        </Link>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {locale === "en" ? "Reserve container" : "Contenedor de reserva"}
          </p>
          <h1 className="text-3xl font-semibold">
            {reserveContainer.emoji || "\u{1F437}"} {reserveContainer.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "en"
              ? "Generic reserve that receives whatever remains after the month close."
              : "Reserva genérica que recibe lo que sobra tras el cierre mensual."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "Balance" : "Saldo"}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(reserveBalanceMinor, baseCurrency, currencySymbol)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "This month" : "Este mes"}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(
                reserveStats.currentMonthContributionMinor,
                baseCurrency,
                currencySymbol
              )}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "Monthly average" : "Media mensual"}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(reserveStats.averageMinor, baseCurrency, currencySymbol)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "Best month" : "Mejor mes"}
            </p>
            <p className="text-xl font-semibold">
              {reserveStats.bestMonth
                ? formatMoneyWithSymbol(
                    reserveStats.bestMonth.amountMinor,
                    baseCurrency,
                    currencySymbol
                  )
                : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {locale === "en" ? "Move to project" : "Mover a proyecto"}
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {eligibleProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {locale === "en"
                ? "There are no active projects that can receive more funding."
                : "No hay proyectos activos que puedan recibir más financiación."}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {locale === "en" ? "Destination project" : "Proyecto destino"}
                </label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        locale === "en" ? "Choose a project" : "Elige un proyecto"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleProjects.map((entry) => (
                      <SelectItem key={entry.project.id} value={entry.project.id}>
                        {entry.project.emoji || "\u{1F3AF}"} {entry.project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {locale === "en" ? "Amount" : "Importe"}
                </label>
                <Input
                  value={amountInput}
                  onChange={(event) => setAmountInput(sanitizeNumericInput(event.target.value))}
                  inputMode="decimal"
                  placeholder="0"
                  disabled={!canEdit}
                />
              </div>
            </div>
          )}

          {selectedProjectEntry ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="text-muted-foreground">
                {locale === "en" ? "Remaining to fund" : "Pendiente de financiar"}:{" "}
                <span className="font-semibold text-foreground">
                  {formatMoneyWithSymbol(
                    selectedProjectEntry.remainingMinor,
                    baseCurrency,
                    currencySymbol
                  )}
                </span>
              </p>
            </div>
          ) : null}

          {parsedTransferAmount.error ? (
            <p className="text-sm text-destructive">{parsedTransferAmount.error}</p>
          ) : null}
          {parsedTransferAmount.amountMinor > reserveBalanceMinor ? (
            <p className="text-sm text-destructive">
              {locale === "en"
                ? "The amount exceeds the available reserve balance."
                : "El importe supera el saldo disponible de la reserva."}
            </p>
          ) : null}
          {selectedProjectEntry &&
          parsedTransferAmount.amountMinor > selectedProjectEntry.remainingMinor ? (
            <p className="text-sm text-destructive">
              {locale === "en"
                ? "The amount exceeds the remaining funding need of the project."
                : "El importe supera la necesidad restante del proyecto."}
            </p>
          ) : null}
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

          <div className="flex justify-end">
            <Button onClick={handleTransfer} disabled={!canTransfer || isSubmitting}>
              {isSubmitting
                ? locale === "en"
                  ? "Moving..."
                  : "Moviendo..."
                : locale === "en"
                  ? "Move to project"
                  : "Mover a proyecto"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {locale === "en" ? "History" : "Historial"}
          </h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {activityRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {locale === "en" ? "There is no history yet." : "Todavía no hay historial."}
            </p>
          ) : (
            activityRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.secondary}
                    {row.createdAt ? ` · ${formatDateLabel(row.createdAt, locale)}` : ""}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    row.amountMinor >= 0n ? "text-emerald-700" : "text-slate-900"
                  }`}
                >
                  {row.amountMinor >= 0n ? "+" : "-"}
                  {formatMoneyWithSymbol(
                    row.amountMinor >= 0n ? row.amountMinor : -row.amountMinor,
                    baseCurrency,
                    currencySymbol
                  )}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
