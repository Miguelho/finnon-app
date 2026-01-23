import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { FinnonMark } from "@/components/brand/finnon-mark";
import { TopNavLinks } from "@/components/navigation/top-nav-links";
import { SettingsDrawer } from "@/components/settings/settings-drawer";
import { cn } from "@/lib/utils";
import {
  buildSettingsMenuVM,
  getDictionary,
  navigationItems,
  t,
  themeTokens,
  type AvatarColorToken,
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
    .select("id, name, base_currency, account_members!inner(user_id)")
    .eq("account_members.user_id", user.id)
    .order("name", { ascending: true });

  if (!accounts || accounts.length === 0) return null;

  const accountIds = accounts.map((account) => account.id);
  const { data: members } =
    accountIds.length > 0
      ? await supabase
          .from("account_members")
          .select("account_id")
          .in("account_id", accountIds)
      : { data: [] as { account_id: string }[] };

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

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const homeAriaLabel = locale === "es" ? "Ir a inicio" : "Go to home";
  const activeAccountId =
    cookieStore.get("finnon:activeAccountId")?.value ??
    accountsWithCounts[0]?.id ??
    "";

  const settingsLabelKey =
    navigationItems.find((item) => item.key === "settings")?.labelKey ??
    ("navigation.settings" as const);
  const settingsLabel = t(dictionary, settingsLabelKey);
  const openSettingsLabel = locale === "es" ? "Abrir ajustes" : "Open settings";
  const actionsLabel = locale === "es" ? "Acciones" : "Actions";
  const settingsMenu = buildSettingsMenuVM(dictionary, "web");

  const colors = themeTokens.light.colors;
  const navItems = [
    { href: "/", label: t(dictionary, "navigation.home"), iconKey: "home" },
    {
      href: "/transactions",
      label: t(dictionary, "transactions.pageTitle"),
      iconKey: "transactions",
    },
    { href: "/goal", label: t(dictionary, "goal.pageTitle"), iconKey: "goal" },
    {
      href: "/account",
      label: t(dictionary, "navigation.account"),
      iconKey: "account",
    },
  ];
  const containerClasses = cn(
    "mx-auto flex w-full items-center justify-between gap-4 px-4 py-3",
    containerClassName ?? "max-w-6xl"
  );

  const profileEmail = profile?.email ?? user.email ?? "";
  const profileName = profile?.display_name ?? user.user_metadata?.name ?? null;
  const profileData = {
    userId: profile?.user_id ?? user.id,
    email: profileEmail,
    displayName: profileName,
    avatarPath: profile?.avatar_path ?? null,
    fallbackText: profile?.avatar_fallback_text ?? null,
    fallbackBgToken:
      (profile?.avatar_fallback_bg_token as AvatarColorToken | null) ?? null,
  };

  return (
    <div
      className="sticky top-0 z-10 w-full border-b"
      style={{
        backgroundColor: colors.bg.primary,
        borderColor: colors.state.neutral,
      }}
    >
      <div className={containerClasses}>
        {/* Logo */}
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

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <TopNavLinks items={navItems} />
          <SettingsDrawer
            settingsLabel={settingsLabel}
            openLabel={openSettingsLabel}
            actionsLabel={actionsLabel}
            profile={profileData}
            accounts={accountsWithCounts}
            activeAccountId={activeAccountId}
            menu={settingsMenu}
          />
        </div>
      </div>
    </div>
  );
}
