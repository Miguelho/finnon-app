import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { AccountSwitcher } from "@/components/home/account-switcher";
import { AddAction } from "@/components/home/add-action";
import {
  buildHomeViewModel,
  CURRENCIES,
  formatMoneyWithSymbol,
  getDictionary,
  getIconById,
  getMonthRange,
  t,
  themeTokens,
  type UserRole,
} from "@poleursus/shared";

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
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const cookieAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const mainAccount =
    accounts.find((account) => account.id === cookieAccountId) ?? accounts[0];

  const mainAccountRole =
    (mainAccount?.account_members?.find((member) => member.user_id === user.id)
      ?.role as UserRole | undefined) ?? "viewer";

  const { data: members } = await supabase
    .from("account_members")
    .select("account_id")
    .in(
      "account_id",
      accounts.map((account) => account.id)
    );

  const memberCounts = (members ?? []).reduce<Record<string, number>>(
    (acc, member) => {
      acc[member.account_id] = (acc[member.account_id] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const accountsWithCounts = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    base_currency: account.base_currency,
    memberCount: memberCounts[account.id] ?? 0,
  }));

  const monthRange = getMonthRange(new Date());
  const startDate = monthRange.start.toISOString().slice(0, 10);
  const endDate = monthRange.end.toISOString().slice(0, 10);
  const upcomingEnd = new Date();
  upcomingEnd.setDate(upcomingEnd.getDate() + 7);
  const obligationsEnd =
    upcomingEnd > monthRange.end ? upcomingEnd : monthRange.end;
  const obligationsEndDate = obligationsEnd.toISOString().slice(0, 10);

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

  const { data: obligations } = await supabase
    .from("obligations")
    .select(
      "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
    )
    .eq("account_id", mainAccount.id)
    .gte("due_date", startDate)
    .lte("due_date", obligationsEndDate)
    .order("due_date", { ascending: true });

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
    recentTransactions: recentTransactions ?? [],
    month: new Date(),
    nextDays: 7,
    recentLimit: 6,
  });

  const colors = themeTokens.light.colors;
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === mainAccount.base_currency)
      ?.symbol ?? mainAccount.base_currency;

  const upcomingItems = viewModel.upcoming.items.slice(0, 5);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.bg.primary, color: colors.text.primary }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AccountSwitcher
              accounts={accountsWithCounts}
              initialActiveAccountId={mainAccount.id}
            />
            {viewModel.permissions.isGuestReadOnly && (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: colors.action.secondary }}
              >
                {viewModel.copy.guestBadge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <AddAction canEdit={viewModel.permissions.canEdit} />
            <Button variant="outline" asChild>
              <Link href="/settings">{t(dictionary, "dashboard.settingsCta")}</Link>
            </Button>
          </div>
        </div>

        <section
          className="rounded-2xl border p-6"
          style={{
            borderColor: colors.state.neutral,
            backgroundColor: colors.bg.surface,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">
              {t(dictionary, "dashboard.thisMonth")}
            </h1>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {viewModel.copy.committedLabel}
              </p>
              <p className="text-2xl font-semibold">
                {formatMoneyWithSymbol(
                  viewModel.monthlyHero.committedMinor,
                  mainAccount.base_currency,
                  currencySymbol
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {viewModel.copy.pendingLabel}
              </p>
              <p className="text-2xl font-semibold">
                {formatMoneyWithSymbol(
                  viewModel.monthlyHero.pendingMinor,
                  mainAccount.base_currency,
                  currencySymbol
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {viewModel.monthlyHero.paidLabel}
              </p>
              <p className="text-2xl font-semibold">
                {formatMoneyWithSymbol(
                  viewModel.monthlyHero.paidMinor,
                  mainAccount.base_currency,
                  currencySymbol
                )}
              </p>
            </div>
          </div>

          <div
            className="mt-5 border-t pt-4"
            style={{ borderColor: colors.state.neutral }}
          >
            {viewModel.monthlyHero.nextObligation ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t(dictionary, "dashboard.nextObligation")}
                  </p>
                  <p className="text-sm font-semibold">
                    {viewModel.monthlyHero.nextObligation.name} ·{" "}
                    {viewModel.monthlyHero.nextObligation.dueDate.toLocaleDateString(locale, {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatMoneyWithSymbol(
                    viewModel.monthlyHero.nextObligation.amountMinor,
                    mainAccount.base_currency,
                    currencySymbol
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {viewModel.emptyStates.obligations.title}
                </p>
                <Button variant="outline" asChild>
                  <Link href="/transactions?new=1&kind=obligation">
                    {viewModel.emptyStates.obligations.cta}
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {!viewModel.monthlyHero.hasActivity && (
            <div
              className="mt-4 border-t pt-4"
              style={{ borderColor: colors.state.neutral }}
            >
              <p className="text-sm text-muted-foreground">
                {viewModel.emptyStates.activity.title}
              </p>
              <Button className="mt-2" variant="outline" asChild>
                <Link href="/transactions?new=1&type=expense">
                  {viewModel.emptyStates.activity.cta}
                </Link>
              </Button>
            </div>
          )}

          {viewModel.permissions.isGuestReadOnly && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {viewModel.copy.guestBlurb}
              </p>
              <Button variant="secondary" asChild>
                <Link href="/onboarding">{viewModel.copy.guestCta}</Link>
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {t(dictionary, "dashboard.upcomingTitle")}
            </h2>
            {upcomingItems.length > 0 && (
              <Button variant="link" asChild>
                <Link href="/transactions">{viewModel.copy.upcomingCta}</Link>
              </Button>
            )}
          </div>
          {upcomingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {viewModel.emptyStates.upcoming}
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                  style={{
                    borderColor: colors.state.neutral,
                    backgroundColor: colors.bg.secondary,
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.dueDate.toLocaleDateString(locale, {
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatMoneyWithSymbol(
                      item.amountMinor,
                      mainAccount.base_currency,
                      currencySymbol
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {t(dictionary, "dashboard.recentActivityTitle")}
            </h2>
            <Button variant="link" asChild>
              <Link href="/transactions">{viewModel.copy.recentCta}</Link>
            </Button>
          </div>
          {viewModel.recentActivity.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {viewModel.emptyStates.recent}
            </p>
          ) : (
            <div className="space-y-2">
              {viewModel.recentActivity.items.map((item) => {
                const icon = item.iconId ? getIconById(item.iconId) : null;
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
                      <span className="text-lg">
                        {icon?.emoji || (item.type === "income" ? "↑" : "↓")}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.date.toLocaleDateString(locale, {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        item.type === "income" ? "text-emerald-600" : "text-rose-600"
                      }`}
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
      </div>
    </div>
  );
}
