"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/category-icon";
import {
  addMonths,
  CURRENCIES,
  formatMonthLabel,
  formatMoneyWithSymbol,
  themeTokens,
} from "@poleursus/shared";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type Transaction = {
  id: string;
  type: "income" | "expense";
  amount_minor: string;
  amount_base_minor: string | null;
  currency: string;
  date: string;
  merchant: string | null;
  notes: string | null;
  created_at: string;
};

type CategoryDetailClientProps = {
  category: Category;
  transactions: Transaction[];
  baseCurrency: string;
  monthKey: string;
};

const toMinorAmount = (transaction: Transaction): bigint => {
  const value =
    transaction.amount_base_minor ?? transaction.amount_minor ?? "0";
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

export function CategoryDetailClient({
  category,
  transactions,
  baseCurrency,
  monthKey,
}: CategoryDetailClientProps) {
  const router = useRouter();
  const t = useTranslations();
  const tTransactions = useTranslations("transactions");
  const locale = useLocale();
  const colors = themeTokens.light.colors;
  const monthLabel = formatMonthLabel(monthKey, locale);
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === baseCurrency)?.symbol ??
    baseCurrency;

  const goToMonth = (nextMonth: string) => {
    router.push(`/categories/${category.id}?month=${nextMonth}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CategoryIcon
            iconId={category.icon_id}
            size={28}
            tone="muted"
            accessibilityLabel={category.name}
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {category.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {category.type === "income"
                ? t("categories.incomeLabel")
                : t("categories.expenseLabel")}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push("/categories")}>
          {t("common.back")}
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("categories.currentMonthLabel")}
            </p>
            <p className="text-lg font-semibold">{monthLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => goToMonth(addMonths(monthKey, -1))}
            >
              {tTransactions("previousMonth")}
            </Button>
            <Button
              variant="outline"
              onClick={() => goToMonth(addMonths(monthKey, 1))}
            >
              {tTransactions("nextMonth")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {tTransactions("movimientosCount", { count: transactions.length })}
        </h2>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("categories.transactionsEmptyRange")}
            </p>
          ) : (
            transactions.map((transaction) => {
              const amountMinor = toMinorAmount(transaction);
              const amountLabel = formatMoneyWithSymbol(
                amountMinor,
                baseCurrency,
                currencySymbol
              );
              const displayName =
                transaction.merchant || category.name || t("categories.title");

              return (
                <div
                  key={transaction.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex items-start gap-3">
                    <CategoryIcon
                      iconId={category.icon_id}
                      size={20}
                      tone="muted"
                      accessibilityLabel={category.name}
                    />
                    <div>
                      <p className="font-medium">{displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString(locale)}
                        {transaction.notes && (
                          <span className="ml-2">• {transaction.notes}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div
                    className="text-sm font-semibold"
                    style={{
                      color:
                        transaction.type === "income"
                          ? colors.state.positive
                          : colors.state.negative,
                    }}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {amountLabel}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
