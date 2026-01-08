import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AccountSwitcher } from "@/components/home/account-switcher";
import { FinnonMark } from "@/components/brand/finnon-mark";
import { TopNavLinks } from "@/components/navigation/top-nav-links";
import { cn } from "@/lib/utils";
import {
  getDictionary,
  navigationItems,
  t,
  themeTokens,
} from "@poleursus/shared";

type TopNavProps = {
  containerClassName?: string;
};

export async function TopNav({ containerClassName }: TopNavProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(role, user_id)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) return null;

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const homeAriaLabel = locale === "es" ? "Ir a inicio" : "Go to home";

  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? accounts[0];

  const accountsForSwitcher = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    base_currency: account.base_currency,
    memberCount: account.account_members?.length ?? 1,
  }));

  const settingsLabelKey =
    navigationItems.find((item) => item.key === "settings")?.labelKey ??
    ("navigation.settings" as const);

  const colors = themeTokens.light.colors;
  const navItems = [
    { href: "/", label: t(dictionary, "navigation.home") },
    { href: "/transactions", label: t(dictionary, "transactions.pageTitle") },
    { href: "/account", label: t(dictionary, "navigation.account") },
    { href: "/settings", label: t(dictionary, settingsLabelKey) },
  ];
  const containerClasses = cn(
    "mx-auto flex w-full items-center justify-center gap-4 px-4 py-3",
    containerClassName ?? "max-w-6xl"
  );

  return (
    <div
      className="sticky top-0 z-10 w-full border-b"
      style={{
        backgroundColor: colors.bg.primary,
        borderColor: colors.state.neutral,
      }}
    >
      <div className={containerClasses}>
        {/* Izquierda: Logo + Finnon */}
        <div className="flex shrink-0 items-center">
          <Link
            href="/"
            aria-label={homeAriaLabel}
            className="flex items-center gap-2 rounded-md px-2 py-1"
            style={{ color: colors.text.primary }}
          >
            <FinnonMark mode="iconWordmark" size="md" />
          </Link>
        </div>

        <TopNavLinks
          items={navItems}
          className="min-w-0 flex-1 justify-center"
        />

        {/* Derecha: Account Switcher */}
        <div className="flex shrink-0 items-center">
          <AccountSwitcher
            accounts={accountsForSwitcher}
            initialActiveAccountId={
              activeAccount?.id ?? accountsForSwitcher[0]?.id
            }
          />
        </div>
      </div>
    </div>
  );
}
