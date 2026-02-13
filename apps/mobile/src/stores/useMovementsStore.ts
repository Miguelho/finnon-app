import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { getVerifiedUser } from "../lib/auth";
import {
  formatDateISO,
  getPeriodEnd,
  getPeriodRange,
  isFutureDay,
  getOccurrenceKey,
  getOccurrencesBetween,
  type Period,
  type RecurringItem,
} from "@poleursus/shared";
import type {
  Category,
  Movement,
  MovementFilter,
  MovementsSummary,
  RecurringTemplate,
  UserProfile,
} from "../types/movements";

type MovementsStore = {
  selectedPeriod: Period;
  filters: MovementFilter;
  isSearchMode: boolean;
  isRecurrentSectionCollapsed: boolean;

  periodMovements: Movement[];
  searchMovements: Movement[];
  categories: Category[];
  recurringItems: RecurringItem[];
  profilesById: Record<string, UserProfile>;
  baseCurrency: string;

  setPeriod: (period: Period) => void;
  toggleTypeFilter: (type: "income" | "expense") => void;
  setCategoryFilter: (categoryIds: string[]) => void;
  setMerchantFilter: (merchantNames: string[]) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;

  setPeriodMovements: (movements: Movement[]) => void;
  setSearchMovements: (movements: Movement[]) => void;
  setCategories: (categories: Category[]) => void;
  setRecurringItems: (items: RecurringItem[]) => void;
  setProfilesById: (profiles: Record<string, UserProfile>) => void;
  mergeProfilesById: (profiles: Record<string, UserProfile>) => void;
  setBaseCurrency: (currency: string) => void;

  registerRecurrent: (templateId: string) => Promise<void>;
  registerAllRecurrents: () => Promise<void>;
  setRecurrentSectionCollapsed: (collapsed: boolean) => void;
  toggleRecurrentCollapse: () => void;
};

const defaultFilters: MovementFilter = {
  types: [],
  categoryIds: [],
  merchantNames: [],
  searchQuery: "",
};

const toBigInt = (value: unknown) => {
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return 0n;
  }
};

type TransactionRow = {
  id: string;
  account_id: string;
  type: "income" | "expense";
  amount_minor: string | number;
  amount_base_minor?: string | number | null;
  currency: string;
  category_id: string | null;
  date: string;
  merchant: string | null;
  notes: string | null;
  created_by: string;
  recurring_item_id?: string | null;
  recurring_occurrence_date?: string | null;
  category?: {
    id: string;
    name: string;
    icon_id: string | null;
    type?: "income" | "expense" | null;
  } | null;
};

const mapTransactionToMovement = (row: TransactionRow): Movement => {
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

const buildUnregisteredRecurrents = (state: {
  selectedPeriod: Period;
  periodMovements: Movement[];
  recurringItems: RecurringItem[];
  categories: Category[];
  baseCurrency: string;
}): RecurringTemplate[] => {
  const { selectedPeriod, periodMovements, recurringItems, categories } = state;
  if (!recurringItems.length) return [];

  const now = new Date();
  const range = getPeriodRange(selectedPeriod, now);
  const rangeStart = formatDateISO(range.start);
  const rangeEnd = formatDateISO(getPeriodEnd(selectedPeriod, now));
  const categoriesById = categories.reduce<Record<string, Category>>(
    (acc, category) => {
      acc[category.id] = category;
      return acc;
    },
    {}
  );

  const existingKeys = new Set(
    periodMovements
      .filter((movement) => movement.recurringItemId && movement.recurringOccurrenceDate)
      .map((movement) =>
        getOccurrenceKey(
          movement.recurringItemId as string,
          movement.recurringOccurrenceDate as string
        )
      )
  );

  return recurringItems
    .filter((item) => !item.is_paused)
    .flatMap((item) =>
      getOccurrencesBetween(item, rangeStart, rangeEnd)
        .filter((occurrence) => !existingKeys.has(occurrence.key))
        .map((occurrence) => {
          const category = item.category_id
            ? categoriesById[item.category_id]
            : undefined;
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
            isRegisteredThisMonth: false,
          };
        })
    );
};

const matchesSearchQuery = (movement: Movement, query: string) => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return (
    movement.title.toLowerCase().includes(trimmed) ||
    movement.categoryName.toLowerCase().includes(trimmed) ||
    (movement.subcategory ?? "").toLowerCase().includes(trimmed)
  );
};

export const useMovementsStore = create<MovementsStore>((set, get) => {
  return {
    selectedPeriod: "month",
    filters: defaultFilters,
    isSearchMode: false,
    isRecurrentSectionCollapsed: true,

    periodMovements: [],
    searchMovements: [],
    categories: [],
    recurringItems: [],
    profilesById: {},
    baseCurrency: "EUR",

    setPeriod: (period) => {
      set({ selectedPeriod: period });
    },
    toggleTypeFilter: (type) => {
      const current = get().filters.types;
      const next = current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type];
      set({ filters: { ...get().filters, types: next } });
    },
    setCategoryFilter: (categoryIds) => {
      set({ filters: { ...get().filters, categoryIds } });
    },
    setMerchantFilter: (merchantNames) => {
      set({ filters: { ...get().filters, merchantNames } });
    },
    setSearchQuery: (query) => {
      const trimmed = query.trim();
      set({
        filters: { ...get().filters, searchQuery: query },
        isSearchMode: trimmed.length > 0,
      });
    },
    clearFilters: () => {
      const currentSearch = get().filters.searchQuery;
      set({
        filters: { ...defaultFilters, searchQuery: currentSearch },
        isSearchMode: currentSearch.trim().length > 0,
      });
    },

    setPeriodMovements: (movements) => {
      set({ periodMovements: sortByDateDesc(movements) });
    },
    setSearchMovements: (movements) => {
      set({ searchMovements: sortByDateDesc(movements) });
    },
    setCategories: (categories) => {
      set({ categories });
    },
    setRecurringItems: (items) => {
      set({ recurringItems: items });
    },
    setProfilesById: (profiles) => {
      set({ profilesById: profiles });
    },
    mergeProfilesById: (profiles) => {
      set((state) => ({
        profilesById: { ...state.profilesById, ...profiles },
      }));
    },
    setBaseCurrency: (currency) => {
      set({ baseCurrency: currency });
    },

    registerRecurrent: async (templateId) => {
      const state = get();
      const recurrents = buildUnregisteredRecurrents(state);
      const target = recurrents.find((item) => item.id === templateId);
      if (!target) return;

      if (target.currency !== state.baseCurrency) {
        throw new Error("Solo se pueden registrar recurrentes en la moneda base.");
      }

      const user = await getVerifiedUser();

      if (!user) {
        throw new Error("Usuario no autenticado.");
      }

      const payload = {
        account_id: target.accountId,
        type: target.type,
        amount_minor: String(target.amountMinor),
        currency: target.currency,
        amount_base_minor: String(target.amountMinor),
        fx_rate: "1",
        fx_date: target.expectedDate,
        category_id: target.categoryId,
        date: target.expectedDate,
        merchant: target.title,
        notes: target.subcategory,
        created_by: user.id,
        recurring_item_id: target.templateId,
        recurring_occurrence_date: target.expectedDate,
      };

      const { data, error } = await supabase
        .from("transactions")
        .upsert([payload], {
          onConflict: "account_id,recurring_item_id,recurring_occurrence_date",
          ignoreDuplicates: true,
        })
        .select("*, category:categories(id, name, icon_id, type)")
        .single();

      if (error) {
        throw error;
      }

      if (!data) return;

      const movement = mapTransactionToMovement(data as TransactionRow);
      const updatedPeriodMovements = sortByDateDesc([
        movement,
        ...state.periodMovements,
      ]);

      const searchQuery = state.filters.searchQuery.trim();
      const shouldAppendToSearch =
        searchQuery.length > 0 && matchesSearchQuery(movement, searchQuery);
      const updatedSearchMovements = shouldAppendToSearch
        ? sortByDateDesc([movement, ...state.searchMovements])
        : state.searchMovements;

      set({
        periodMovements: updatedPeriodMovements,
        searchMovements: updatedSearchMovements,
      });
    },
    registerAllRecurrents: async () => {
      const state = get();
      const recurrents = buildUnregisteredRecurrents(state);
      for (const recurrent of recurrents) {
        await get().registerRecurrent(recurrent.id);
      }
    },
    setRecurrentSectionCollapsed: (collapsed) => {
      set({ isRecurrentSectionCollapsed: collapsed });
    },
    toggleRecurrentCollapse: () => {
      set({ isRecurrentSectionCollapsed: !get().isRecurrentSectionCollapsed });
    },
  };
});

export const selectUnregisteredRecurrents = (state: MovementsStore) =>
  buildUnregisteredRecurrents(state);

export const selectMovementsSummary = (
  movements: Movement[]
): MovementsSummary => {
  let totalIncome = 0n;
  let totalExpense = 0n;
  let confirmedIncome = 0n;
  let confirmedExpense = 0n;

  movements.forEach((movement) => {
    if (movement.type === "income") {
      totalIncome += movement.amountMinor;
      if (movement.status === "confirmed") {
        confirmedIncome += movement.amountMinor;
      }
    } else {
      totalExpense += movement.amountMinor;
      if (movement.status === "confirmed") {
        confirmedExpense += movement.amountMinor;
      }
    }
  });

  return {
    totalIncome,
    totalExpense,
    totalBalance: totalIncome - totalExpense,
    confirmedIncome,
    confirmedExpense,
    confirmedBalance: confirmedIncome - confirmedExpense,
  };
};
