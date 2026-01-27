import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { AddAction } from "@/components/home/add-action";
import { HomeHero } from "@/components/home/home-hero";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import {
  buildHomeViewModel,
  CURRENCIES,
  formatMoneyWithSymbol,
  getDictionary,
  getMonthRange,
  isExpired,
  t,
  themeTokens,
  type UserRole,
  type CategoryIconKey,
} from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(role, user_id)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) {
    redirect("/select-account");
  }

  const cookieStore = await cookies();
  const cookieAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);

  if (!cookieAccountId) {
    redirect("/select-account");
  }

  const inviteEmail = user.email?.trim().toLowerCase();
  const { data: inviteRows } = inviteEmail
    ? await supabase
        .from("invites")
        .select("id, expires_at, status, invited_email, invitee_email")
        .or(
          `invited_email.ilike.${inviteEmail},invitee_email.ilike.${inviteEmail}`
        )
        .eq("status", "pending")
    : { data: [] as { expires_at: string; status: string | null }[] };

  const pendingInviteCount = (inviteRows ?? []).filter(
    (invite) => !isExpired(invite.expires_at)
  ).length;

  const mainAccount = accounts.find((account) => account.id === cookieAccountId);

  if (!mainAccount) {
    redirect("/select-account");
  }

  const mainAccountRole =
    (mainAccount?.account_members?.find((member) => member.user_id === user.id)
      ?.role as UserRole | undefined) ?? "viewer";

  const today = new Date();
  const monthRange = getMonthRange(today);
  const startDate = monthRange.start.toISOString().slice(0, 10);
  const endDate = monthRange.end.toISOString().slice(0, 10);
  const maxUpcomingDays = 30;
  const upcomingEnd = new Date(today);
  upcomingEnd.setDate(upcomingEnd.getDate() + maxUpcomingDays);
  const obligationsEnd =
    upcomingEnd > monthRange.end ? upcomingEnd : monthRange.end;
  const obligationsEndDate = obligationsEnd.toISOString().slice(0, 10);
  const upcomingStartDate = today.toISOString().slice(0, 10);
  const upcomingEndDate = upcomingEnd.toISOString().slice(0, 10);

  const { data: monthlyTransactions } = await supabase
    .from("transactions")
    .select(
      "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_at, category:categories(id, name, icon_id)"
    )
    .eq("account_id", mainAccount.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: recentTransactions } = await supabase
    .from("transactions")
    .select(
      "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_at, category:categories(id, name, icon_id)"
    )
    .eq("account_id", mainAccount.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: upcomingTransactions } = await supabase
    .from("transactions")
    .select(
      "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_at, category:categories(id, name, icon_id)"
    )
    .eq("account_id", mainAccount.id)
    .gte("date", upcomingStartDate)
    .lte("date", upcomingEndDate)
    .order("date", { ascending: true });

  const { data: obligations } = await supabase
    .from("obligations")
    .select(
      "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
    )
    .eq("account_id", mainAccount.id)
    .gte("due_date", startDate)
    .lte("due_date", obligationsEndDate)
    .order("due_date", { ascending: true });

  // Fetch categories for the transaction form
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, icon_id, type")
    .eq("account_id", mainAccount.id)
    .order("name");

  // Fetch top categories for expense and income
  const { data: topExpenseCategories } = await supabase.rpc(
    "get_top_categories",
    { p_account_id: mainAccount.id, p_tx_type: "expense", p_limit: 3 }
  );
  const { data: topIncomeCategories } = await supabase.rpc(
    "get_top_categories",
    { p_account_id: mainAccount.id, p_tx_type: "income", p_limit: 3 }
  );

  // Fetch merchant suggestions for expense and income
  const { data: expenseMerchantSuggestions } = await supabase.rpc(
    "get_merchant_suggestions",
    { p_account_id: mainAccount.id, p_tx_type: "expense", p_limit: 10 }
  );
  const { data: incomeMerchantSuggestions } = await supabase.rpc(
    "get_merchant_suggestions",
    { p_account_id: mainAccount.id, p_tx_type: "income", p_limit: 10 }
  );

  const viewModel = buildHomeViewModel({
    account: {
      id: mainAccount.id,
      name: mainAccount.name,
      base_currency: mainAccount.base_currency,
    },
    role: mainAccountRole,
    dictionary,
    obligations: obligations ?? [],
    monthlyTransactions: monthlyTransactions ?? [],
    upcomingTransactions: upcomingTransactions ?? [],
    recentTransactions: recentTransactions ?? [],
    month: today,
    nextDays: 7,
    recentLimit: 6,
    now: today,
  });

  const colors = themeTokens.light.colors;
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === mainAccount.base_currency)
      ?.symbol ?? mainAccount.base_currency;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const withAlpha = (color: string, alpha: number) => {
    if (color.startsWith("#") && color.length === 7) {
      const r = Number.parseInt(color.slice(1, 3), 16);
      const g = Number.parseInt(color.slice(3, 5), 16);
      const b = Number.parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.bg.primary, color: colors.text.primary }}
    >
      <TopNav />
      <AddAction
        canEdit={viewModel.permissions.canEdit}
        accountId={mainAccount.id}
        currency={mainAccount.base_currency}
        locale={locale}
        categories={categories ?? []}
        topCategories={{
          expense: topExpenseCategories ?? [],
          income: topIncomeCategories ?? [],
        }}
        merchantSuggestions={{
          expense: expenseMerchantSuggestions ?? [],
          income: incomeMerchantSuggestions ?? [],
        }}
      />
      <PageContainer className="flex flex-col gap-6">
        {pendingInviteCount > 0 && (
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: colors.state.neutral,
              backgroundColor: colors.bg.secondary,
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {t(dictionary, "invitations.pendingBadge")}
                </p>
                <p className="text-sm" style={{ color: colors.text.secondary }}>
                  {t(dictionary, "invitations.subtitle")}
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                style={{ borderColor: colors.action.secondary }}
              >
                <Link href="/invitations">
                  {t(dictionary, "invitations.viewCta")} ({pendingInviteCount})
                </Link>
              </Button>
            </div>
          </div>
        )}
        {viewModel.permissions.isGuestReadOnly && (
          <div className="flex justify-end">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: colors.action.secondary }}
            >
              {viewModel.copy.guestBadge}
            </span>
          </div>
        )}

        <HomeHero
          account={{
            id: mainAccount.id,
            name: mainAccount.name,
            base_currency: mainAccount.base_currency,
          }}
          role={mainAccountRole}
          dictionary={dictionary}
          locale={locale}
          obligations={obligations ?? []}
          monthlyTransactions={monthlyTransactions ?? []}
          upcomingTransactions={upcomingTransactions ?? []}
        />

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {t(dictionary, "dashboard.recentActivityTitle")}
            </h2>
            <Button variant="link" asChild style={{ color: colors.action.primary }}>
              <Link href="/transactions">{viewModel.copy.recentCta}</Link>
            </Button>
          </div>
          {viewModel.recentActivity.items.length === 0 ? (
            <p className="text-sm" style={{ color: colors.text.secondary }}>
              {viewModel.emptyStates.recent}
            </p>
          ) : (
            <div className="space-y-2">
              {viewModel.recentActivity.items.map((item) => {
                const isPending = item.date.getTime() > todayStart.getTime();
                const baseColor =
                  item.type === "income"
                    ? colors.state.positive
                    : colors.state.negative;
                const amountColor = isPending
                  ? withAlpha(baseColor, 0.55)
                  : baseColor;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                    style={{
                      borderColor: colors.state.neutral,
                      backgroundColor: colors.bg.secondary,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div style={{ opacity: isPending ? 0.6 : 1 }}>
                        <CategoryIcon
                          iconKey={item.iconId as CategoryIconKey}
                          size={20}
                          tone={item.type === "income" ? "positive" : "negative"}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs" style={{ color: colors.text.secondary }}>
                          {item.date.toLocaleDateString(locale, {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <p
                      className="text-sm font-semibold"
                      style={{
                        color: amountColor,
                      }}
                    >
                      {item.type === "income" ? "+" : "-"}
                      {formatMoneyWithSymbol(
                        item.amountMinor,
                        mainAccount.base_currency,
                        currencySymbol
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </PageContainer>
    </div>
  );
}
