import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  addMonths,
  CURRENCIES,
  getMonthRangeFromKey,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type Project,
  type ReserveContainer,
  type ReserveTransfer,
} from "@poleursus/shared";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { ReserveDetailClient } from "./reserve-detail-client";

export default async function ReserveDetailPage({
  params,
}: {
  params: Promise<{ reserveId: string }>;
}) {
  const { reserveId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, base_currency, account_members!inner(role)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) {
    redirect("/select-account");
  }

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "es";
  if (!activeAccountId) {
    redirect("/select-account");
  }

  const activeAccount = accounts.find((account) => account.id === activeAccountId);
  if (!activeAccount) {
    redirect("/select-account");
  }

  const canEdit =
    (activeAccount.account_members?.[0] as { role?: string } | undefined)?.role !== "viewer";
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === activeAccount.base_currency)?.symbol ??
    activeAccount.base_currency;
  const currentMonthKey = toMonthKey(new Date());
  const historyStartMonthKey = addMonths(currentMonthKey, -3);
  const historyStartRange = getMonthRangeFromKey(historyStartMonthKey);
  const currentMonthRange = getMonthRangeFromKey(currentMonthKey);

  const [
    reserveResult,
    projectsResult,
    monthClosesResult,
    monthCloseAllocationsResult,
    reserveTransfersResult,
    transactionsResult,
  ] = await Promise.all([
    supabase
      .from("reserve_containers")
      .select("*")
      .eq("account_id", activeAccount.id)
      .eq("id", reserveId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("*")
      .eq("account_id", activeAccount.id)
      .not("target_amount_base_minor", "is", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("month_closes")
      .select("*")
      .eq("account_id", activeAccount.id)
      .order("period", { ascending: false }),
    supabase
      .from("month_close_allocations")
      .select("*")
      .eq("account_id", activeAccount.id),
    supabase
      .from("reserve_transfers")
      .select("*")
      .eq("account_id", activeAccount.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, type, amount_minor, amount_base_minor, date")
      .eq("account_id", activeAccount.id)
      .gte("date", historyStartRange.start)
      .lte("date", currentMonthRange.end)
      .order("date", { ascending: true }),
  ]);

  if (reserveResult.error) throw reserveResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (monthClosesResult.error) throw monthClosesResult.error;
  if (monthCloseAllocationsResult.error) throw monthCloseAllocationsResult.error;
  if (reserveTransfersResult.error) throw reserveTransfersResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  const reserveContainer = reserveResult.data as ReserveContainer | null;
  if (!reserveContainer) {
    redirect("/savings");
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <ReserveDetailClient
        accountId={activeAccount.id}
        locale={locale}
        canEdit={canEdit}
        baseCurrency={activeAccount.base_currency}
        currencySymbol={currencySymbol}
        reserveContainer={reserveContainer}
        projects={(projectsResult.data ?? []) as Project[]}
        monthCloses={(monthClosesResult.data ?? []) as MonthClose[]}
        monthCloseAllocations={
          (monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]
        }
        reserveTransfers={(reserveTransfersResult.data ?? []) as ReserveTransfer[]}
        recentTransactions={
          (transactionsResult.data ?? []) as Array<{
            id: string;
            type: "income" | "expense";
            amount_minor: string | number | null;
            amount_base_minor: string | number | null;
            date: string;
          }>
        }
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
