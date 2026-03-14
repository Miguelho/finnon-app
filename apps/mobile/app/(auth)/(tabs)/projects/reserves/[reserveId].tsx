import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  computeProjectProgress,
  CURRENCIES,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getProjectReserveTransferTotalsMap,
  getReserveContainerBalanceMinor,
  getReserveContainerStats,
  getReserveTransferDirection,
  parseMoneyToMinor,
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
import { Button } from "../../../../../src/components/Button";
import { Card } from "../../../../../src/components/Card";
import { Input } from "../../../../../src/components/Input";

const tokens = themeTokens.light;

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

export default function ReserveDetailScreen() {
  const { reserveId } = useLocalSearchParams<{ reserveId: string }>();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const insets = useSafeAreaInsets();
  const localeCode: "es" | "en" = locale === "en" ? "en" : "es";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [reserveContainer, setReserveContainer] = useState<ReserveContainer | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [monthCloses, setMonthCloses] = useState<MonthClose[]>([]);
  const [monthCloseAllocations, setMonthCloseAllocations] = useState<MonthCloseAllocation[]>([]);
  const [reserveTransfers, setReserveTransfers] = useState<ReserveTransfer[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [amountInput, setAmountInput] = useState("");

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

      setCanEdit((account.account_members?.[0]?.role ?? "viewer") !== "viewer");
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
  }, [localeCode, reserveId, selectedAccountId, user]);

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

  const selectedProjectEntry =
    eligibleProjects.find((entry) => entry.project.id === selectedProjectId) ?? null;

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
  }, [localeCode, monthCloseAllocations, monthClosesById, projects, reserveContainer, reserveTransfers]);

  const canTransfer =
    canEdit &&
    Boolean(reserveContainer) &&
    selectedProjectId.length > 0 &&
    parsedTransferAmount.error === null &&
    parsedTransferAmount.amountMinor > 0n &&
    parsedTransferAmount.amountMinor <= reserveBalanceMinor &&
    parsedTransferAmount.amountMinor <= (selectedProjectEntry?.remainingMinor ?? 0n);

  const handleTransfer = async () => {
    if (!selectedAccountId || !reserveContainer || !canTransfer || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const { error: rpcError } = await supabase.rpc("transfer_reserve_to_project", {
        p_account_id: selectedAccountId,
        p_source_reserve_container_id: reserveContainer.id,
        p_destination_project_id: selectedProjectId,
        p_amount_base_minor: parsedTransferAmount.amountMinor.toString(),
      });

      if (rpcError) throw rpcError;

      setAmountInput("");
      setMessage(locale === "en" ? "Transfer confirmed." : "Transferencia confirmada.");
      await loadData();
    } catch (transferError) {
      console.error("[ReserveDetail][mobile] transfer error", transferError);
      setError(
        locale === "en"
          ? "Couldn't move money to the project."
          : "No se pudo mover dinero al proyecto."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <Stack.Screen options={{ title: reserveContainer.name }} />
      <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: tokens.spacing.xxl + insets.bottom + 64 },
          ]}
        >
          {error ? (
            <Card>
              <Text style={[styles.errorText, { color: userTokens.textPrimary }]}>{error}</Text>
            </Card>
          ) : null}

          <Card>
            <Text style={[styles.eyebrow, { color: userTokens.textSecondary }]}>
              {locale === "en" ? "Reserve container" : "Contenedor de reserva"}
            </Text>
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {reserveContainer.emoji || "🐷"} {reserveContainer.name}
            </Text>
            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
              {locale === "en"
                ? "Generic reserve that receives whatever remains after the month close."
                : "Reserva genérica que recibe lo que sobra tras el cierre mensual."}
            </Text>
          </Card>

          <View style={styles.summaryGrid}>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Balance" : "Saldo"}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(reserveBalanceMinor, baseCurrency, currencySymbol)}
              </Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "This month" : "Este mes"}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(
                  reserveStats.currentMonthContributionMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </Text>
            </Card>
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Average" : "Media"}
              </Text>
              <Text style={[styles.summaryValue, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(reserveStats.averageMinor, baseCurrency, currencySymbol)}
              </Text>
            </Card>
          </View>

          <Card>
            <Text style={[styles.cardTitle, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "Move to project" : "Mover a proyecto"}
            </Text>

            <View style={styles.projectChipWrap}>
              {eligibleProjects.map((entry) => {
                const selected = entry.project.id === selectedProjectId;
                return (
                  <TouchableOpacity
                    key={entry.project.id}
                    onPress={() => setSelectedProjectId(entry.project.id)}
                    style={[
                      styles.projectChip,
                      {
                        borderColor: selected ? primaryActionColor : userTokens.border,
                        backgroundColor: selected ? userTokens.surfaceAlt : userTokens.surface,
                      },
                    ]}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.projectChipText, { color: userTokens.textPrimary }]}>
                      {entry.project.emoji || "🎯"} {entry.project.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label={locale === "en" ? "Amount" : "Importe"}
              value={amountInput}
              onChangeText={(value) => setAmountInput(sanitizeNumericInput(value))}
              keyboardType="numeric"
              placeholder="0"
              disabled={!canEdit}
              error={parsedTransferAmount.error ?? undefined}
            />

            {selectedProjectEntry ? (
              <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Remaining to fund" : "Pendiente de financiar"}:{" "}
                {formatMoneyWithSymbol(
                  selectedProjectEntry.remainingMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </Text>
            ) : null}

            {parsedTransferAmount.amountMinor > reserveBalanceMinor ? (
              <Text style={styles.inlineError}>
                {locale === "en"
                  ? "The amount exceeds the available reserve balance."
                  : "El importe supera el saldo disponible de la reserva."}
              </Text>
            ) : null}
            {selectedProjectEntry &&
            parsedTransferAmount.amountMinor > selectedProjectEntry.remainingMinor ? (
              <Text style={styles.inlineError}>
                {locale === "en"
                  ? "The amount exceeds the remaining funding need of the project."
                  : "El importe supera la necesidad restante del proyecto."}
              </Text>
            ) : null}
            {message ? <Text style={styles.successText}>{message}</Text> : null}

            <View style={styles.actions}>
              <Button
                title={
                  isSubmitting
                    ? locale === "en"
                      ? "Moving..."
                      : "Moviendo..."
                    : locale === "en"
                      ? "Move to project"
                      : "Mover a proyecto"
                }
                onPress={() => void handleTransfer()}
                disabled={!canTransfer || isSubmitting}
                loading={isSubmitting}
              />
            </View>
          </Card>

          <Card>
            <Text style={[styles.cardTitle, { color: userTokens.textPrimary }]}>
              {locale === "en" ? "History" : "Historial"}
            </Text>
            <View style={styles.historyList}>
              {activityRows.length === 0 ? (
                <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                  {locale === "en" ? "There is no history yet." : "Todavía no hay historial."}
                </Text>
              ) : (
                activityRows.map((row) => (
                  <View
                    key={row.id}
                    style={[
                      styles.historyRow,
                      {
                        borderColor: userTokens.border,
                        backgroundColor: userTokens.surface,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.historyTitle, { color: userTokens.textPrimary }]}>
                        {row.label}
                      </Text>
                      <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
                        {row.secondary}
                        {row.createdAt ? ` · ${formatDateLabel(row.createdAt, localeCode)}` : ""}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.historyAmount,
                        { color: row.amountMinor >= 0n ? "#15803D" : userTokens.textPrimary },
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
                ))
              )}
            </View>
          </Card>
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
  eyebrow: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
    marginBottom: tokens.spacing.xs,
  },
  title: {
    fontSize: tokens.typography.size.xl,
    fontFamily: "DMSans-Bold",
  },
  subtitle: {
    marginTop: 4,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  summaryGrid: {
    gap: tokens.spacing.sm,
  },
  summaryCard: {
    paddingVertical: tokens.spacing.sm,
  },
  summaryLabel: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
  },
  cardTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
    marginBottom: tokens.spacing.sm,
  },
  projectChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  projectChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  projectChipText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  actions: {
    marginTop: tokens.spacing.md,
  },
  historyList: {
    gap: tokens.spacing.sm,
  },
  historyRow: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  historyTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
  },
  historyAmount: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Bold",
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  inlineError: {
    marginTop: 4,
    color: "#DC2626",
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
  },
  successText: {
    marginTop: tokens.spacing.sm,
    color: "#15803D",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
});
