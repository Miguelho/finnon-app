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

const normalizeExpectedDate = (
  value: string | undefined,
  fallback: string
): string => {
  if (!value) return fallback;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return fallback;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  return isValid ? value : fallback;
};

const dayOfMonthFromDate = (value: string, fallback: number): number => {
  const day = Number(value.slice(8, 10));
  if (!Number.isInteger(day) || day < 1 || day > 31) return fallback;
  return day;
};

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
        const expectedDate = normalizeExpectedDate(rec.expectedDate, today);

        return {
          account_id: payload.accountId,
          type: rec.type,
          amount_minor: rec.amountMinor,
          currency: rec.currency,
          category_id: categoryId,
          merchant: rec.label,
          start_date: expectedDate,
          frequency: rec.frequency,
          interval: rec.interval,
          day_of_month:
            rec.dayOfMonth ||
            dayOfMonthFromDate(expectedDate, dayOfMonth),
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

        const pendingRows = insertedItems.flatMap((item: RecurringItem) => {
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
            paid_by: recurringItem.created_by,
            split_type: "personal" as const,
            split_details: null,
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

    // 4. Insertar primer proyecto si existe.
    if (payload.firstProject) {
      const nextProject = payload.firstProject;
      const targetMinor = Math.max(0, Math.round(nextProject.targetAmountMinor));
      const commitmentMinor = Math.max(
        0,
        Math.round(nextProject.monthlyCommitmentMinor)
      );

      if (targetMinor > 0 && commitmentMinor > 0) {
        const { data: existingProjects, error: existingProjectsError } = await client
          .from("projects")
          .select("priority, is_hucha")
          .eq("account_id", payload.accountId)
          .order("priority", { ascending: true });

        if (existingProjectsError) throw existingProjectsError;

        const usedPriorities = (existingProjects ?? [])
          .filter((project: { is_hucha?: boolean }) => !project.is_hucha)
          .map((project: { priority?: number }) => Number(project.priority ?? 0))
          .filter((value) => Number.isFinite(value) && value > 0);

        const nextPriority =
          usedPriorities.length > 0 ? Math.max(...usedPriorities) + 1 : 1;

        const { error: firstProjectError } = await client
          .from("projects")
          .insert({
            account_id: payload.accountId,
            name: nextProject.name.trim(),
            emoji: nextProject.emoji?.trim() || "🎯",
            target_amount_base_minor: targetMinor,
            monthly_commitment_base_minor: commitmentMinor,
            priority: nextPriority,
            status: "active",
            created_by: userId,
          });

        if (firstProjectError) throw firstProjectError;
      }
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
