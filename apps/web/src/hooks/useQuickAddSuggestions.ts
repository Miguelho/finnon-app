"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeQuickAddSuggestions,
  formatDateISO,
  type QuickAddSuggestion,
  type Transaction,
  type TransactionType,
} from "@poleursus/shared";
import { useCachedTransactionsRange } from "@/cache/hooks";
import { createClient } from "@/lib/supabase/client";

const subtractDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
};

export function useQuickAddSuggestions(
  accountId: string,
  type: TransactionType
): {
  suggestions: QuickAddSuggestion[];
  isLoading: boolean;
} {
  const supabase = useMemo(() => createClient(), []);
  const loadCachedTransactionsRange = useCachedTransactionsRange();
  const [suggestions, setSuggestions] = useState<QuickAddSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    const interval = setInterval(() => {
      const nextDayKey = new Date().toDateString();
      setDayKey((prev) => (prev === nextDayKey ? prev : nextDayKey));
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!accountId) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const today = new Date();
      const start = formatDateISO(subtractDays(today, 90));
      const end = formatDateISO(today);

      try {
        const transactions = await loadCachedTransactionsRange<Transaction[]>({
          accountId,
          start,
          end,
          loader: async () => {
            const { data, error } = await supabase
              .from("transactions")
              .select(
                "id, account_id, type, amount_minor, currency, category_id, date, merchant, created_at"
              )
              .eq("account_id", accountId)
              .gte("date", start)
              .lte("date", end)
              .order("date", { ascending: false })
              .order("created_at", { ascending: false });
            if (error) throw error;
            return (data ?? []) as Transaction[];
          },
        });

        if (cancelled) return;
        setSuggestions(computeQuickAddSuggestions(transactions, type, today));
      } catch (error) {
        console.error("[useQuickAddSuggestions] Failed to load suggestions:", error);
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accountId, dayKey, loadCachedTransactionsRange, supabase, type]);

  return { suggestions, isLoading };
}
