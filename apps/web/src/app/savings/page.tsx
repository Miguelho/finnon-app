import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENCIES } from "@poleursus/shared";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { SavingsClient } from "./savings-client";

export default async function SavingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, base_currency, account_members!inner(user_id)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) redirect("/select-account");

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "es";
  if (!activeAccountId) redirect("/select-account");

  const activeAccount = accounts.find((account) => account.id === activeAccountId);
  if (!activeAccount) redirect("/select-account");

  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === activeAccount.base_currency)?.symbol ??
    activeAccount.base_currency;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <SavingsClient
        accountId={activeAccount.id}
        baseCurrency={activeAccount.base_currency}
        currencySymbol={currencySymbol}
        locale={locale}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
