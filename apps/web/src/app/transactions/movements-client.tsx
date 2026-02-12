"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CURRENCIES,
  formatDateISO,
  formatMinorToMoney,
  getPeriodEnd,
  getPeriodRange,
  getOccurrencesBetween,
  getOccurrenceKey,
  isFutureDay,
  movementsTokens,
  type MerchantSuggestion,
  type Period,
  type RecurringItem,
  type TopCategory,
  type TransactionDraft,
  type AvatarColorToken,
} from "@poleursus/shared";
import { ChevronDown, Check, X, Search, Repeat } from "lucide-react";
import { AddTransactionForm } from "@/components/add-transaction";
import { PageContainer } from "@/components/layout/page-container";
import { CategoryIcon } from "@/components/category-icon";
import { UserAvatar } from "@/components/user-avatar";
import { PeriodSelector } from "@/components/shared/PeriodSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { cn } from "@/lib/utils";
import { confirmRecurringTransaction, updateTransaction } from "./actions";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
  account_id?: string;
};

type Transaction = {
  id: string;
  account_id: string;
  type: "income" | "expense";
  amount_minor: string;
  currency: string;
  amount_base_minor: string;
  fx_rate?: string | null;
  fx_date?: string | null;
  category_id: string | null;
  date: string;
  merchant: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  category?: Category | null;
  recurring_item_id?: string | null;
  recurring_occurrence_date?: string | null;
};

type Profile = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: AvatarColorToken | null;
};

type MovementsClientProps = {
  accountId: string;
  baseCurrency: string;
  initialTransactions: Transaction[];
  initialRecurringItems: RecurringItem[];
  initialPeriod: Period;
  initialCategoryFilter: string | null;
  categories: Category[];
  initialTopCategories: {
    expense: TopCategory[];
    income: TopCategory[];
  };
  initialMerchantSuggestions: {
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  };
  profiles: Profile[];
  role: "viewer" | "contributor" | "admin";
};

type Movement = {
  id: string;
  title: string;
  amountMinor: bigint;
  date: string;
  categoryId: string | null;
  categoryName: string;
  categoryIconId: string | null;
  subcategory?: string | null;
  userId: string;
  accountId: string;
  status: "confirmed" | "pending";
  type: "income" | "expense";
  merchant?: string | null;
  recurringItemId?: string | null;
  recurringOccurrenceDate?: string | null;
};

type RecurringTemplate = {
  id: string;
  templateId: string;
  title: string;
  amountMinor: bigint;
  expectedDate: string;
  categoryId: string | null;
  categoryName: string;
  categoryIconId: string | null;
  subcategory?: string | null;
  userId: string;
  accountId: string;
  type: "income" | "expense";
  currency: string;
};

const design = movementsTokens;

const toBigInt = (value: unknown) => {
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return 0n;
  }
};

const parseFilterParam = (value: string | null) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const mapTransactionToMovement = (row: Transaction): Movement => {
  const amountMinor = toBigInt(row.amount_base_minor ?? row.amount_minor);
  const status = isFutureDay(row.date) ? "pending" : "confirmed";
  const categoryName = row.category?.name ?? "Sin categoría";
  const title = row.merchant?.trim() || categoryName || "Movimiento";

  return {
    id: row.id,
    title,
    amountMinor,
    date: row.date,
    categoryId: row.category_id,
    categoryName,
    categoryIconId: row.category?.icon_id ?? null,
    subcategory: row.notes?.trim() || null,
    userId: row.created_by,
    accountId: row.account_id,
    status,
    type: row.type,
    merchant: row.merchant,
    recurringItemId: row.recurring_item_id ?? null,
    recurringOccurrenceDate: row.recurring_occurrence_date ?? null,
  };
};

const sortByDateDesc = (items: Movement[]) =>
  [...items].sort((a, b) => {
    if (a.date === b.date) return a.id.localeCompare(b.id);
    return a.date < b.date ? 1 : -1;
  });

const groupByDate = (items: Movement[]) => {
  const map = new Map<string, Movement[]>();
  items.forEach((item) => {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  });
  return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
};

const formatDateLabel = (value: string, locale: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
  });

const toPercent = (part: bigint, total: bigint) => {
  if (part <= 0n || total <= 0n) return 0;
  return Number((part * 10000n) / total) / 100;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatSignedAmount = (
  amountMinor: bigint,
  currencyCode: string,
  currencySymbol: string
) => {
  const absoluteValue = amountMinor < 0n ? -amountMinor : amountMinor;
  const formatted = formatMinorToMoney(absoluteValue, currencyCode);
  if (amountMinor < 0n) return `-${currencySymbol}${formatted}`;
  return `${currencySymbol}${formatted}`;
};

const formatIncomeAmount = (
  amountMinor: bigint,
  currencyCode: string,
  currencySymbol: string
) => `${currencySymbol}${formatMinorToMoney(amountMinor, currencyCode)}`;

const formatExpenseAmount = (
  amountMinor: bigint,
  currencyCode: string,
  currencySymbol: string
) => {
  const absoluteValue = amountMinor < 0n ? -amountMinor : amountMinor;
  return `-${currencySymbol}${formatMinorToMoney(absoluteValue, currencyCode)}`;
};

function FilterDropdown({
  label,
  options,
  selectedIds,
  onToggle,
}: {
  label: string;
  options: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter((option) =>
      option.name.toLowerCase().includes(trimmed)
    );
  }, [options, query]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-[#6B6B6B] transition hover:bg-[#F5F5F5]"
        >
          {label}
          {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          <ChevronDown size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Buscar ${label.toLowerCase()}...`}
          className="h-8 text-sm"
        />
        <div className="mt-2 max-h-48 overflow-auto">
          {filtered.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-[#F5F5F5]"
                onClick={() => onToggle(option.id)}
              >
                <span className="truncate">{option.name}</span>
                {isSelected ? <Check size={14} /> : null}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Sin resultados
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MovementsSummary({
  movements,
  currencySymbol,
  currencyCode,
}: {
  movements: Movement[];
  currencySymbol: string;
  currencyCode: string;
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(() => {
    let totalIncome = 0n;
    let totalExpense = 0n;
    let confirmedIncome = 0n;
    let confirmedExpense = 0n;

    movements.forEach((movement) => {
      if (movement.type === "income") {
        totalIncome += movement.amountMinor;
        if (movement.status === "confirmed") confirmedIncome += movement.amountMinor;
      } else {
        totalExpense += movement.amountMinor;
        if (movement.status === "confirmed") confirmedExpense += movement.amountMinor;
      }
    });

    const combinedTotal = totalIncome + totalExpense;
    const incomeRatio = clampPercent(toPercent(totalIncome, combinedTotal));
    const expenseRatio = clampPercent(toPercent(totalExpense, combinedTotal));
    const incomeConfirmedRatio = clampPercent(
      toPercent(confirmedIncome, totalIncome)
    );
    const expenseConfirmedRatio = clampPercent(
      toPercent(confirmedExpense, totalExpense)
    );

    return {
      totalIncome,
      totalExpense,
      confirmedIncome,
      confirmedExpense,
      balance: totalIncome - totalExpense,
      confirmedBalance: confirmedIncome - confirmedExpense,
      incomeRatio,
      expenseRatio,
      incomeConfirmedRatio,
      expenseConfirmedRatio,
      hasIncome: totalIncome > 0n,
      hasExpense: totalExpense > 0n,
      isEmpty: movements.length === 0,
      movementCount: movements.length,
    };
  }, [movements]);

  useEffect(() => {
    if (!isTooltipOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (tooltipRef.current?.contains(target)) return;
      if (infoButtonRef.current?.contains(target)) return;
      setIsTooltipOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isTooltipOpen]);

  const hasSingleType =
    !summary.isEmpty && (summary.hasIncome ? !summary.hasExpense : summary.hasExpense);
  const movementCountLabel = `${summary.movementCount} ${
    summary.movementCount === 1 ? "movimiento" : "movimientos"
  }`;

  return (
    <div className="space-y-2">
      <div className="mb-[14px] text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#9B9B9B]">
          BALANCE
        </div>
        <div
          className="text-[30px] font-bold tracking-[-1px]"
          style={{
            color:
              summary.balance < 0n ? design.colors.expenseRed : design.colors.textPrimary,
          }}
        >
          {formatSignedAmount(summary.balance, currencyCode, currencySymbol)}
        </div>
        <div className="text-xs text-[#9B9B9B]">
          {formatSignedAmount(summary.confirmedBalance, currencyCode, currencySymbol)} confirmado
        </div>
      </div>

      {summary.isEmpty ? (
        <p className="mb-2 text-center text-sm font-medium text-[#9B9B9B]">
          Sin movimientos en este periodo
        </p>
      ) : (
        <div className="mb-[18px]">
          <div className="relative mb-2 flex items-center gap-2">
            <div className="flex h-[10px] flex-1 overflow-hidden gap-[2px]">
              {summary.hasIncome && (
                <div
                  className={cn(
                    "flex overflow-hidden",
                    summary.hasExpense
                      ? "rounded-l-[100px]"
                      : "rounded-[100px]"
                  )}
                  style={{
                    flex: summary.hasExpense ? summary.incomeRatio : 100,
                    transition: "flex 0.3s ease",
                  }}
                >
                  <div
                    className="h-[10px]"
                    style={{
                      backgroundColor: design.colors.incomeSolid,
                      flex: summary.incomeConfirmedRatio,
                      transition: "flex 0.3s ease",
                    }}
                  />
                  <div
                    className="h-[10px]"
                    style={{
                      backgroundColor: design.colors.incomePending,
                      flex: Math.max(0, 100 - summary.incomeConfirmedRatio),
                      transition: "flex 0.3s ease",
                    }}
                  />
                </div>
              )}

              {summary.hasExpense && (
                <div
                  className={cn(
                    "flex overflow-hidden",
                    summary.hasIncome
                      ? "rounded-r-[100px]"
                      : "rounded-[100px]"
                  )}
                  style={{
                    flex: summary.hasIncome ? summary.expenseRatio : 100,
                    transition: "flex 0.3s ease",
                  }}
                >
                  <div
                    className="h-[10px]"
                    style={{
                      backgroundColor: design.colors.expenseSolid,
                      flex: summary.expenseConfirmedRatio,
                      transition: "flex 0.3s ease",
                    }}
                  />
                  <div
                    className="h-[10px]"
                    style={{
                      backgroundColor: design.colors.expensePending,
                      flex: Math.max(0, 100 - summary.expenseConfirmedRatio),
                      transition: "flex 0.3s ease",
                    }}
                  />
                </div>
              )}
            </div>

            <button
              ref={infoButtonRef}
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#E5E5E5] text-[11px] font-semibold text-[#9B9B9B] transition hover:border-[#9B9B9B] hover:text-[#6B6B6B]"
              onClick={() => setIsTooltipOpen((prev) => !prev)}
              aria-label="Mostrar leyenda de colores"
            >
              i
            </button>

            {isTooltipOpen && (
              <div
                ref={tooltipRef}
                className="absolute right-0 top-[calc(100%+8px)] z-50 w-[220px] rounded-[8px] bg-[#1A1A1A] px-[14px] py-[10px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
              >
                <span className="absolute right-[5px] top-[-5px] h-[10px] w-[10px] rotate-45 bg-[#1A1A1A]" />
                <div className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="h-[6px] w-[10px] rounded-[3px] bg-white opacity-90" />
                  <span>Color sólido = confirmado</span>
                </div>
                <div className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="h-[6px] w-[10px] rounded-[3px] bg-white opacity-35" />
                  <span>Color suave = pendiente</span>
                </div>
              </div>
            )}
          </div>

          {hasSingleType ? (
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-sm font-bold"
                  style={{
                    color: summary.hasIncome
                      ? design.colors.incomeGreen
                      : design.colors.expenseRed,
                  }}
                >
                  {summary.hasIncome
                    ? formatIncomeAmount(summary.totalIncome, currencyCode, currencySymbol)
                    : formatExpenseAmount(summary.totalExpense, currencyCode, currencySymbol)}
                </span>
                <span className="text-[11px] text-[#9B9B9B]">
                  {summary.hasIncome
                    ? formatIncomeAmount(
                        summary.confirmedIncome,
                        currencyCode,
                        currencySymbol
                      )
                    : formatExpenseAmount(
                        summary.confirmedExpense,
                        currencyCode,
                        currencySymbol
                      )}{" "}
                  confirmados
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[13px] text-[#9B9B9B]">{movementCountLabel}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold" style={{ color: design.colors.incomeGreen }}>
                  {formatIncomeAmount(summary.totalIncome, currencyCode, currencySymbol)}
                </span>
                <span className="text-[11px] text-[#9B9B9B]">
                  {formatIncomeAmount(summary.confirmedIncome, currencyCode, currencySymbol)} confirmados
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-bold" style={{ color: design.colors.expenseRed }}>
                  {formatExpenseAmount(summary.totalExpense, currencyCode, currencySymbol)}
                </span>
                <span className="text-[11px] text-[#9B9B9B]">
                  {formatExpenseAmount(summary.confirmedExpense, currencyCode, currencySymbol)} confirmados
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MovementRow({
  movement,
  profile,
  currencySymbol,
  currencyCode,
  variant,
  onClick,
}: {
  movement: Movement;
  profile?: Profile;
  currencySymbol: string;
  currencyCode: string;
  variant: "default" | "pending";
  onClick?: (id: string) => void;
}) {
  const amountColor =
    movement.type === "income" ? design.colors.incomeGreen : design.colors.expenseRed;
  const formatted = formatMinorToMoney(
    movement.amountMinor < 0n ? -movement.amountMinor : movement.amountMinor,
    currencyCode
  );
  const amountLabel =
    movement.type === "expense"
      ? `-${currencySymbol}${formatted}`
      : `${currencySymbol}${formatted}`;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-xl border px-3 py-2 text-left transition hover:bg-[#F5F5F5]",
        variant === "pending" && "bg-[#FFF8E6] border-[#F5D990]"
      )}
      onClick={() => onClick?.(movement.id)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F5F5]">
          <CategoryIcon
            iconKey={movement.categoryIconId ?? "Receipt"}
            size={18}
            tone="muted"
            accessibilityLabel={movement.categoryName}
          />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[#1A1A1A]">
            {movement.title}
          </div>
          <div className="truncate text-xs text-[#6B6B6B]">
            {movement.categoryName}
            {movement.subcategory ? ` · ${movement.subcategory}` : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-sm font-semibold" style={{ color: amountColor, opacity: variant === "pending" ? 0.7 : 1 }}>
          {amountLabel}
        </span>
        <UserAvatar
          email={profile?.email ?? null}
          userId={movement.userId}
          avatarPath={profile?.avatar_path ?? null}
          fallbackText={profile?.avatar_fallback_text ?? null}
          fallbackBgToken={profile?.avatar_fallback_bg_token ?? null}
          size={20}
        />
      </div>
    </button>
  );
}

function MovementGroup({
  label,
  variant,
  movements,
  totalAmount,
  dotColor,
  currencyCode,
  currencySymbol,
  profilesById,
  locale,
  isCollapsed = false,
  onToggleCollapse,
  onPressMovement,
}: {
  label: string;
  variant: "pending" | "done";
  movements: Movement[];
  totalAmount: bigint;
  dotColor: string;
  currencyCode: string;
  currencySymbol: string;
  profilesById: Record<string, Profile>;
  locale: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onPressMovement?: (id: string) => void;
}) {
  const grouped = useMemo(() => groupByDate(movements), [movements]);
  const absoluteValue = totalAmount < 0n ? -totalAmount : totalAmount;
  const formattedTotal = `${totalAmount < 0n ? "-" : ""}${currencySymbol}${formatMinorToMoney(
    absoluteValue,
    currencyCode
  )}`;
  const formattedTotalLabel = `(${formattedTotal})`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <span className="text-xs font-bold text-[#1A1A1A]">
          {label.toUpperCase()}
        </span>
        <span className="text-xs text-[#6B6B6B]">
          — {movements.length} movimientos
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-semibold text-[#1A1A1A]">
            {formattedTotalLabel}
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              className="text-xs font-medium text-[#6B6B6B]"
              onClick={onToggleCollapse}
            >
              {isCollapsed ? "Mostrar" : "Ocultar"}
            </button>
          )}
        </div>
      </div>
      {!isCollapsed &&
        grouped.map(([date, items]) => (
          <div key={date} className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
              <span>{formatDateLabel(date, locale)}</span>
              <span className="h-px flex-1 bg-[#F0F0F0]" />
            </div>
            <div className="space-y-2">
              {items.map((movement) => (
                <MovementRow
                  key={movement.id}
                  movement={movement}
                  profile={profilesById[movement.userId]}
                  currencySymbol={currencySymbol}
                  currencyCode={currencyCode}
                  variant={variant === "pending" ? "pending" : "default"}
                  onClick={onPressMovement}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function RecurrentSection({
  recurrents,
  currencyCode,
  currencySymbol,
  totalAmount,
  isCollapsed,
  onToggleCollapse,
  onRegister,
  onRegisterAll,
  locale,
  disabled,
}: {
  recurrents: RecurringTemplate[];
  currencyCode: string;
  currencySymbol: string;
  totalAmount: bigint;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRegister: (id: string) => void;
  onRegisterAll: () => void;
  locale: string;
  disabled?: boolean;
}) {
  if (recurrents.length === 0) return null;
  const absoluteValue = totalAmount < 0n ? -totalAmount : totalAmount;
  const formattedTotal = `${totalAmount < 0n ? "-" : ""}${currencySymbol}${formatMinorToMoney(
    absoluteValue,
    currencyCode
  )}`;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: design.colors.recurrentPurpleBg,
        borderColor: design.colors.recurrentPurpleBorder,
      }}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: design.colors.recurrentPurple }}>
            <Repeat size={16} />
            Por registrar
          </span>
          <span className="text-xs" style={{ color: design.colors.recurrentPurple }}>
            {recurrents.length}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold" style={{ color: design.colors.recurrentPurple }}>
            ({formattedTotal})
          </span>
          <button
            type="button"
            className="text-xs text-[#6B6B6B]"
            onClick={onToggleCollapse}
          >
            {isCollapsed ? "Mostrar" : "Ocultar"}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-3 space-y-3">
          {recurrents.map((item) => (
            <RecurrentCard
              key={item.id}
              item={item}
              currencyCode={currencyCode}
              currencySymbol={currencySymbol}
              locale={locale}
              onRegister={onRegister}
              disabled={disabled}
            />
          ))}
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: design.colors.recurrentPurple }}
            onClick={onRegisterAll}
            disabled={disabled}
          >
            Registrar todos ({recurrents.length})
          </button>
        </div>
      )}
    </div>
  );
}

function RecurrentCard({
  item,
  currencyCode,
  currencySymbol,
  locale,
  onRegister,
  disabled,
}: {
  item: RecurringTemplate;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  onRegister: (id: string) => void;
  disabled?: boolean;
}) {
  const [isRemoving, setIsRemoving] = useState(false);
  const formattedDate = useMemo(
    () =>
      new Date(`${item.expectedDate}T00:00:00`).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
      }),
    [item.expectedDate, locale]
  );
  const amount = formatMinorToMoney(item.amountMinor, currencyCode);
  const amountLabel =
    item.type === "expense"
      ? `-${currencySymbol}${amount}`
      : `${currencySymbol}${amount}`;
  const metaParts = [item.categoryName];
  if (item.subcategory) metaParts.push(item.subcategory);
  metaParts.push(formattedDate);

  const handleRegister = () => {
    if (disabled || isRemoving) return;
    setIsRemoving(true);
    setTimeout(() => onRegister(item.id), 220);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border px-3 py-2 transition-all",
        isRemoving && "translate-x-3 opacity-0"
      )}
      style={{
        backgroundColor: design.colors.recurrentPurpleBg,
        borderColor: design.colors.recurrentPurpleBorder,
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
          <CategoryIcon
            iconKey={item.categoryIconId ?? "Receipt"}
            size={16}
            tone="muted"
            accessibilityLabel={item.categoryName}
          />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[#1A1A1A]">
            {item.title}
          </div>
          <div className="truncate text-xs text-[#6B6B6B]">
            {metaParts.join(" · ")}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-sm font-semibold text-[#1A1A1A]">{amountLabel}</span>
        <button
          type="button"
          className="rounded-full px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: design.colors.recurrentPurple }}
          onClick={handleRegister}
          disabled={disabled}
        >
          Registrar
        </button>
      </div>
    </div>
  );
}

export function MovementsClient({
  accountId,
  baseCurrency,
  initialTransactions,
  initialRecurringItems,
  initialPeriod,
  initialCategoryFilter,
  categories,
  initialTopCategories,
  initialMerchantSuggestions,
  profiles,
  role,
}: MovementsClientProps) {
  const router = useRouter();

  const [selectedPeriod, setSelectedPeriod] = useState<Period>(initialPeriod);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [recurrents, setRecurrents] = useState<RecurringItem[]>(initialRecurringItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<Array<"income" | "expense">>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>(() =>
    parseFilterParam(initialCategoryFilter)
  );
  const [merchantFilters, setMerchantFilters] = useState<string[]>([]);
  const [isRecurrentCollapsed, setIsRecurrentCollapsed] = useState(
    !initialCategoryFilter
  );
  const [isPendingCollapsed, setIsPendingCollapsed] = useState(
    !initialCategoryFilter
  );
  const [isDoneCollapsed, setIsDoneCollapsed] = useState(!initialCategoryFilter);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TransactionDraft | null>(null);

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  useEffect(() => {
    setRecurrents(initialRecurringItems);
  }, [initialRecurringItems]);

  useEffect(() => {
    setSelectedPeriod(initialPeriod);
  }, [initialPeriod]);

  useEffect(() => {
    setCategoryFilters(parseFilterParam(initialCategoryFilter));
  }, [initialCategoryFilter]);

  useEffect(() => {
    if (!initialCategoryFilter) return;
    setIsRecurrentCollapsed(false);
    setIsPendingCollapsed(false);
    setIsDoneCollapsed(false);
  }, [initialCategoryFilter]);

  const locale = useMemo(
    () => (typeof navigator !== "undefined" ? navigator.language : "es"),
    []
  );
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === baseCurrency)?.symbol ??
    baseCurrency;
  const canEdit = role !== "viewer";

  const profilesById = useMemo(() => {
    const map: Record<string, Profile> = {};
    profiles.forEach((profile) => {
      map[profile.user_id] = profile;
    });
    return map;
  }, [profiles]);

  const movements = useMemo(
    () => transactions.map(mapTransactionToMovement),
    [transactions]
  );

  const selectedTransaction = useMemo(
    () => transactions.find((item) => item.id === selectedTransactionId) ?? null,
    [selectedTransactionId, transactions]
  );

  const isSearchMode = searchQuery.trim().length > 0;

  const filteredMovements = useMemo(() => {
    let items = movements;
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      items = items.filter((movement) => {
        return (
          movement.title.toLowerCase().includes(query) ||
          movement.categoryName.toLowerCase().includes(query) ||
          (movement.subcategory ?? "").toLowerCase().includes(query)
        );
      });
    }

    if (categoryFilters.length > 0) {
      items = items.filter((movement) =>
        movement.categoryId ? categoryFilters.includes(movement.categoryId) : false
      );
    }

    if (merchantFilters.length > 0) {
      items = items.filter((movement) =>
        movement.merchant ? merchantFilters.includes(movement.merchant) : false
      );
    }

    if (typeFilters.length > 0) {
      items = items.filter((movement) => typeFilters.includes(movement.type));
    }

    return items;
  }, [movements, searchQuery, categoryFilters, merchantFilters, typeFilters]);

  const groupedByStatus = useMemo(() => {
    const pending: Movement[] = [];
    const confirmed: Movement[] = [];
    filteredMovements.forEach((movement) => {
      if (movement.status === "pending") pending.push(movement);
      else confirmed.push(movement);
    });
    return { pending: sortByDateDesc(pending), confirmed: sortByDateDesc(confirmed) };
  }, [filteredMovements]);

  const counts = useMemo(() => {
    let income = 0;
    let expense = 0;
    movements.forEach((movement) => {
      if (movement.type === "income") income += 1;
      if (movement.type === "expense") expense += 1;
    });
    return { income, expense };
  }, [movements]);

  const merchantOptions = useMemo(() => {
    const unique = new Set<string>();
    movements.forEach((movement) => {
      if (movement.merchant) unique.add(movement.merchant);
    });
    return Array.from(unique).map((name) => ({ id: name, name }));
  }, [movements]);

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ id: category.id, name: category.name })),
    [categories]
  );

  const unregisteredRecurrents = useMemo(() => {
    if (!recurrents.length) return [];
    const now = new Date();
    const range = getPeriodRange(selectedPeriod, now);
    const rangeStart = formatDateISO(range.start);
    const rangeEnd = formatDateISO(getPeriodEnd(selectedPeriod, now));

    const existingKeys = new Set(
      movements
        .filter((movement) => movement.recurringItemId && movement.recurringOccurrenceDate)
        .map((movement) =>
          getOccurrenceKey(
            movement.recurringItemId as string,
            movement.recurringOccurrenceDate as string
          )
        )
    );

    const categoriesById = categories.reduce<Record<string, Category>>((acc, category) => {
      acc[category.id] = category;
      return acc;
    }, {});

    return recurrents
      .filter((item) => !item.is_paused)
      .flatMap((item) =>
        getOccurrencesBetween(item, rangeStart, rangeEnd)
          .filter((occurrence) => !existingKeys.has(occurrence.key))
          .map((occurrence) => {
            const category = item.category_id ? categoriesById[item.category_id] : undefined;
            return {
              id: `${item.id}:${occurrence.date}`,
              templateId: item.id,
              title: item.merchant?.trim() || category?.name || "Movimiento recurrente",
              amountMinor: toBigInt(item.amount_minor),
              expectedDate: occurrence.date,
              categoryId: item.category_id ?? null,
              categoryName: category?.name ?? "Sin categoría",
              categoryIconId: category?.icon_id ?? null,
              subcategory: item.notes?.trim() || null,
              userId: item.created_by,
              accountId: item.account_id,
              type: item.type,
              currency: item.currency,
            } as RecurringTemplate;
          })
      );
  }, [recurrents, categories, movements, selectedPeriod]);

  const recurrentTotal = useMemo(
    () =>
      unregisteredRecurrents.reduce(
        (acc, item) => (item.type === "income" ? acc + item.amountMinor : acc - item.amountMinor),
        0n
      ),
    [unregisteredRecurrents]
  );

  const handleRegisterRecurrent = useCallback(
    async (id: string) => {
      if (role === "viewer") return;
      const target = unregisteredRecurrents.find((item) => item.id === id);
      if (!target) return;
      setIsRegistering(true);
      const result = await confirmRecurringTransaction({
        recurring_item_id: target.templateId,
        occurrence_date: target.expectedDate,
      });
      if (result.success && result.data) {
        const category = categories.find(
          (item) => item.id === (result.data as Transaction).category_id
        );
        const nextTransaction = {
          ...(result.data as Transaction),
          category: category ? { ...category } : null,
        };
        setTransactions((prev) => [nextTransaction, ...prev]);
      }
      setIsRegistering(false);
    },
    [categories, role, unregisteredRecurrents]
  );

  const handleRegisterAll = useCallback(async () => {
    if (role === "viewer") return;
    setIsRegistering(true);
    for (const item of unregisteredRecurrents) {
      await handleRegisterRecurrent(item.id);
    }
    setIsRegistering(false);
  }, [handleRegisterRecurrent, role, unregisteredRecurrents]);

  const toggleTypeFilter = (type: "income" | "expense") => {
    setTypeFilters((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type]
    );
  };

  const clearFilters = () => {
    setTypeFilters([]);
    setCategoryFilters([]);
    setMerchantFilters([]);
  };

  const handleOpenEdit = useCallback(
    (movementId: string) => {
      if (!canEdit) return;
      const transaction = transactions.find((item) => item.id === movementId);
      if (!transaction) return;
      setSelectedTransactionId(movementId);
      setEditDraft({
        type: transaction.type,
        name: "",
        date: transaction.date,
        amount: formatMinorToMoney(
          toBigInt(transaction.amount_minor),
          transaction.currency
        ),
        currency: transaction.currency,
        categoryId: transaction.category_id ?? null,
        merchant: transaction.merchant ?? "",
        notes: transaction.notes ?? "",
        photos: [],
        isObligation: false,
        obligationType: null,
        scheduledDate: null,
        scheduledDateOverridden: false,
      });
      setIsEditOpen(true);
    },
    [canEdit, transactions]
  );

  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setSelectedTransactionId(null);
    setEditDraft(null);
  };

  const handleEditSubmit = useCallback(
    async (draft: TransactionDraft) => {
      if (!selectedTransaction || !canEdit) {
        throw new Error("Movimiento no disponible");
      }
      const result = await updateTransaction(selectedTransaction.id, {
        type: draft.type,
        amount: draft.amount,
        currency: draft.currency,
        category_id: draft.categoryId ?? null,
        date: draft.date,
        merchant: draft.merchant.trim() || null,
        notes: draft.notes.trim() || null,
        fx_rate: selectedTransaction.fx_rate
          ? String(selectedTransaction.fx_rate)
          : "1",
      });

      if (!result.success || !result.data) {
        throw new Error("No se pudo guardar el movimiento.");
      }

      const updated = result.data as Transaction;
      const category = categories.find((item) => item.id === updated.category_id);
      const nextTransaction = {
        ...updated,
        category: category ? { ...category } : null,
      };
      setTransactions((prev) =>
        prev.map((item) => (item.id === nextTransaction.id ? nextTransaction : item))
      );
    },
    [canEdit, categories, selectedTransaction]
  );

  const handlePeriodChange = useCallback(
    (newPeriod: Period) => {
      setSelectedPeriod(newPeriod);

      const params = new URLSearchParams();
      params.set("period", newPeriod);
      if (categoryFilters.length > 0) {
        params.set("category", categoryFilters[0]);
      }

      router.push(`/transactions?${params.toString()}`);
    },
    [categoryFilters, router]
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("period", selectedPeriod);
    if (categoryFilters.length > 0) {
      params.set("category", categoryFilters.join(","));
    }
    if (merchantFilters.length > 0) {
      params.set("merchant", merchantFilters.join(","));
    }
    if (typeFilters.length > 0) {
      params.set("type", typeFilters.join(","));
    }

    router.replace(`/transactions?${params.toString()}`, { scroll: false });
  }, [selectedPeriod, categoryFilters, merchantFilters, typeFilters, router]);

  const showPendingGroup = groupedByStatus.pending.length > 0;

  const activeTags = useMemo(() => {
    const tags: Array<{ id: string; label: string; type: "type" | "category" | "merchant" }> = [];
    typeFilters.forEach((type) => {
      tags.push({
        id: type,
        label: type === "income" ? "Ingresos" : "Gastos",
        type: "type",
      });
    });
    categoryFilters.forEach((id) => {
      const category = categories.find((item) => item.id === id);
      if (category) tags.push({ id, label: category.name, type: "category" });
    });
    merchantFilters.forEach((name) => tags.push({ id: name, label: name, type: "merchant" }));
    return tags;
  }, [categoryFilters, categories, merchantFilters, typeFilters]);

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#1A1A1A]">Movimientos</h1>
      </div>

      <div
        className={cn(
          "transition-all duration-200 overflow-hidden",
          isSearchMode ? "max-h-0 opacity-0" : "max-h-20 opacity-100"
        )}
      >
        <PeriodSelector selected={selectedPeriod} onChange={handlePeriodChange} />
      </div>

      <div className="space-y-2">
        <MovementsSummary
          movements={filteredMovements}
          currencySymbol={currencySymbol}
          currencyCode={baseCurrency}
        />
        <div className="flex justify-end">
          <button
            type="button"
            className="text-xs font-medium text-[#0065FF]"
            onClick={() => router.push("/recurrentes")}
          >
            Recurrentes →
          </button>
        </div>
      </div>

      {unregisteredRecurrents.length > 0 ? (
        <RecurrentSection
          recurrents={unregisteredRecurrents}
          currencyCode={baseCurrency}
          currencySymbol={currencySymbol}
          totalAmount={recurrentTotal}
          isCollapsed={isRecurrentCollapsed}
          onToggleCollapse={() => setIsRecurrentCollapsed((prev) => !prev)}
          onRegister={handleRegisterRecurrent}
          onRegisterAll={handleRegisterAll}
          locale={locale}
          disabled={isRegistering || role === "viewer"}
        />
      ) : null}

      <div className="space-y-3">
        <div className="relative flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
          <Search size={16} className="text-[#9B9B9B]" />
          <input
            className="flex-1 text-sm outline-none placeholder:text-[#9B9B9B]"
            placeholder="Buscar movimiento, comercio, importe..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
          {(isSearchFocused || searchQuery.trim().length > 0) && (
            <span className="rounded-full bg-[#E6F0FF] px-2 py-1 text-[10px] font-semibold text-[#0065FF]">
              Búsqueda en periodo
            </span>
          )}
          {searchQuery.trim().length > 0 && (
            <button type="button" onClick={() => setSearchQuery("")}>
              <X size={14} className="text-[#9B9B9B]" />
            </button>
          )}
        </div>

        {isSearchMode && (
          <div className="flex items-center justify-between rounded-xl bg-[#E6F0FF] px-3 py-2 text-xs font-medium text-[#0065FF]">
            🔍 Mostrando resultados del periodo seleccionado
            <button type="button" onClick={() => setSearchQuery("")}>
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
              typeFilters.includes("income")
                ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                : "border-neutral-200 bg-white text-[#6B6B6B]"
            )}
            onClick={() => toggleTypeFilter("income")}
          >
            Ingresos <span className="text-[10px]">{counts.income}</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
              typeFilters.includes("expense")
                ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                : "border-neutral-200 bg-white text-[#6B6B6B]"
            )}
            onClick={() => toggleTypeFilter("expense")}
          >
            Gastos <span className="text-[10px]">{counts.expense}</span>
          </button>
          <span className="mx-1 h-5 w-px bg-[#E5E5E5]" />
          <FilterDropdown
            label="Categoría"
            options={categoryOptions}
            selectedIds={categoryFilters}
            onToggle={(id) =>
              setCategoryFilters((current) =>
                current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
              )
            }
          />
          <FilterDropdown
            label="Comercio"
            options={merchantOptions}
            selectedIds={merchantFilters}
            onToggle={(id) =>
              setMerchantFilters((current) =>
                current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
              )
            }
          />
        </div>

        {activeTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeTags.map((tag) => (
              <button
                key={`${tag.type}:${tag.id}`}
                type="button"
                className="flex items-center gap-2 rounded-full bg-[#E6F0FF] px-3 py-1 text-[11px] font-semibold text-[#0065FF]"
                onClick={() => {
                  if (tag.type === "type") {
                    toggleTypeFilter(tag.id as "income" | "expense");
                  }
                  if (tag.type === "category") {
                    setCategoryFilters((current) => current.filter((item) => item !== tag.id));
                  }
                  if (tag.type === "merchant") {
                    setMerchantFilters((current) => current.filter((item) => item !== tag.id));
                  }
                }}
              >
                {tag.label}
                <X size={12} />
              </button>
            ))}
            <button
              type="button"
              className="text-[11px] font-medium text-[#6B6B6B]"
              onClick={clearFilters}
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {showPendingGroup && (
          <MovementGroup
            label="Pendientes"
            variant="pending"
            movements={groupedByStatus.pending}
            totalAmount={groupedByStatus.pending.reduce(
              (acc, movement) =>
                movement.type === "income" ? acc + movement.amountMinor : acc - movement.amountMinor,
              0n
            )}
            dotColor={design.colors.pendingAmber}
            currencyCode={baseCurrency}
            currencySymbol={currencySymbol}
            profilesById={profilesById}
            locale={locale}
            isCollapsed={isPendingCollapsed}
            onToggleCollapse={() => setIsPendingCollapsed((prev) => !prev)}
            onPressMovement={canEdit ? handleOpenEdit : undefined}
          />
        )}

        <MovementGroup
          label="Realizados"
          variant="done"
          movements={groupedByStatus.confirmed}
          totalAmount={groupedByStatus.confirmed.reduce(
            (acc, movement) =>
              movement.type === "income" ? acc + movement.amountMinor : acc - movement.amountMinor,
            0n
          )}
          dotColor={design.colors.incomeGreen}
          currencyCode={baseCurrency}
          currencySymbol={currencySymbol}
          profilesById={profilesById}
          locale={locale}
          isCollapsed={isDoneCollapsed}
          onToggleCollapse={() => setIsDoneCollapsed((prev) => !prev)}
          onPressMovement={canEdit ? handleOpenEdit : undefined}
        />
      </div>

      {canEdit && (
        <SlidePanel
          open={isEditOpen}
          onOpenChange={(open) => (open ? setIsEditOpen(true) : handleCloseEdit())}
        >
          <SlidePanelContent>
            <SlidePanelHeader>
              <SlidePanelTitle>Editar movimiento</SlidePanelTitle>
              <SlidePanelDescription>
                Actualiza los datos del movimiento seleccionado.
              </SlidePanelDescription>
            </SlidePanelHeader>
            <SlidePanelBody className="p-0">
              <div className="px-6 py-4">
                {editDraft && (
                  <AddTransactionForm
                    key={selectedTransactionId ?? "edit"}
                    mode="edit"
                    initialDraft={editDraft}
                    allowObligation={false}
                    accountId={accountId}
                    currency={baseCurrency}
                    locale={locale}
                    categories={categories}
                    topCategories={initialTopCategories}
                    merchantSuggestions={initialMerchantSuggestions}
                    onSubmitDraft={handleEditSubmit}
                    onSuccess={handleCloseEdit}
                    onCancel={handleCloseEdit}
                  />
                )}
              </div>
            </SlidePanelBody>
          </SlidePanelContent>
        </SlidePanel>
      )}

    </PageContainer>
  );
}
