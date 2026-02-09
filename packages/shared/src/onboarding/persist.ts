import { normalizeCategoryName } from "../schemas/category";
import {
  getOccurrencesBetween,
  type RecurringItem,
} from "../recurring/recurring";
import type { OnboardingPayload } from "./types";

export type OnboardingDbClient = {
  from: (table: string) => any;
};

const normalizeSeedName = (value: string) =>
  normalizeCategoryName(value).toLowerCase();

/**
 * Persiste todos los datos del onboarding en una transacción lógica.
 * Se llama desde web (server action) y desde móvil (directamente).
 */
export async function persistOnboarding(
  client: OnboardingDbClient,
  payload: OnboardingPayload,
  userId: string,
  locale: "es" | "en"
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Insertar categorías
    const categoryRows = payload.selectedCategories.map((cat) => ({
      account_id: payload.accountId,
      name: locale === "en" ? cat.name_en : cat.name,
      icon_id: cat.icon_id,
      type: cat.type,
    }));

    let insertedCategories: Array<{ id: string; name: string }> = [];

    if (categoryRows.length > 0) {
      const { data, error: catError } = await client
        .from("categories")
        .insert(categoryRows)
        .select("id, name");

      if (catError) throw catError;
      insertedCategories = data ?? [];
    }

    // 2. Crear mapa nombre → id para vincular recurrentes
    const categoryMap = new Map<string, string>();
    for (const cat of insertedCategories) {
      categoryMap.set(normalizeSeedName(cat.name), cat.id);
    }

    // 3. Insertar recurrentes
    if (payload.recurrents.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const dayOfMonth = new Date().getUTCDate();

      const recurrentRows = payload.recurrents.map((rec) => {
        const normalizedName = rec.categoryName
          ? normalizeSeedName(rec.categoryName)
          : "";
        const categoryId = normalizedName
          ? categoryMap.get(normalizedName) ?? null
          : null;

        return {
          account_id: payload.accountId,
          type: rec.type,
          amount_minor: rec.amountMinor,
          currency: rec.currency,
          category_id: categoryId,
          merchant: rec.label,
          start_date: today,
          frequency: rec.frequency,
          interval: rec.interval,
          day_of_month: rec.dayOfMonth || dayOfMonth,
          is_paused: false,
          created_by: userId,
        };
      });

      const { data: insertedItems, error: recError } = await client
        .from("recurring_items")
        .insert(recurrentRows)
        .select(
          "id, account_id, type, amount_minor, currency, category_id, merchant, notes, start_date, frequency, interval, day_of_month, end_date, is_paused, created_by"
        );

      if (recError) throw recError;

      if (insertedItems && insertedItems.length > 0) {
        const now = new Date();
        const year = now.getUTCFullYear();
        const monthIndex = now.getUTCMonth();
        const monthStart = new Date(Date.UTC(year, monthIndex, 1))
          .toISOString()
          .slice(0, 10);
        const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0))
          .toISOString()
          .slice(0, 10);

        const pendingRows = insertedItems.flatMap((item) => {
          const recurringItem = item as RecurringItem;
          const occurrences = getOccurrencesBetween(
            recurringItem,
            monthStart,
            monthEnd
          );

          return occurrences.map((occurrence) => ({
            account_id: recurringItem.account_id,
            type: recurringItem.type,
            amount_minor: String(recurringItem.amount_minor),
            amount_base_minor: String(recurringItem.amount_minor),
            currency: recurringItem.currency,
            category_id: recurringItem.category_id ?? null,
            date: occurrence.date,
            merchant: recurringItem.merchant ?? null,
            notes: recurringItem.notes ?? null,
            created_by: recurringItem.created_by,
            recurring_item_id: recurringItem.id,
            recurring_occurrence_date: occurrence.date,
            fx_rate: "1",
            fx_date: occurrence.date,
          }));
        });

        if (pendingRows.length > 0) {
          const { error: pendingError } = await client
            .from("transactions")
            .upsert(pendingRows, {
              onConflict: "account_id,recurring_item_id,recurring_occurrence_date",
              ignoreDuplicates: true,
            });

          if (pendingError) throw pendingError;
        }
      }
    }

    // 4. Insertar goal si existe
    if (payload.goal) {
      const now = new Date();
      const monthKey = `${now.getUTCFullYear()}-${String(
        now.getUTCMonth() + 1
      ).padStart(2, "0")}`;

      const { error: goalError } = await client
        .from("financial_goals")
        .insert({
          account_id: payload.accountId,
          month: monthKey,
          type: "save",
          target_amount_base_minor: payload.goal.targetAmountMinor,
          created_by: userId,
        });

      if (goalError) throw goalError;
    }

    return { success: true };
  } catch (err) {
    console.error("Error persisting onboarding:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
