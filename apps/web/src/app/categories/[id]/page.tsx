import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { TopNav } from "@/components/navigation/top-nav";
import { CategoryDetailClient } from "./category-detail-client";
import { getMonthRangeFromKey, toMonthKey } from "@poleursus/shared";

type CategoryDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getQueryValue = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function CategoryDetailPage({
  params,
  searchParams,
}: CategoryDetailPageProps) {
  const supabase = await createClient();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(role)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) {
    redirect("/select-account");
  }

  const cookieStore = await cookies();
  const cookieAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  if (!cookieAccountId) {
    redirect("/select-account");
  }

  const activeAccount = accounts.find(
    (account) => account.id === cookieAccountId
  );

  if (!activeAccount) {
    redirect("/select-account");
  }

  const monthParam = getQueryValue(resolvedSearchParams?.month);
  const { start, end, monthKey } = getMonthRangeFromKey(
    monthParam ?? toMonthKey(new Date())
  );

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, icon_id, type, account_id")
    .eq("id", resolvedParams.id)
    .eq("account_id", activeAccount.id)
    .maybeSingle();

  if (!category) {
    notFound();
  }

  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      "id, type, amount_minor, amount_base_minor, currency, date, merchant, notes, created_at"
    )
    .eq("account_id", activeAccount.id)
    .eq("category_id", category.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <TopNav containerClassName="max-w-6xl" />
      <CategoryDetailClient
        category={category}
        transactions={transactions || []}
        baseCurrency={activeAccount.base_currency}
        monthKey={monthKey}
      />
    </div>
  );
}
