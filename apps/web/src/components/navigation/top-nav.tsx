import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { FinnonMark } from "@/components/brand/finnon-mark";
import { TopNavLinks } from "@/components/navigation/top-nav-links";
import { NotificationDropdown } from "@/components/navigation/notification-dropdown";
import { SettingsDrawer } from "@/components/settings/settings-drawer";
import { AddActionTrigger } from "@/components/navigation/add-action-trigger";
import { cn } from "@/lib/utils";
import {
  buildSettingsMenuVM,
  getDictionary,
  navigationItems,
  t,
  themeTokens,
  type AvatarColorToken,
} from "@poleursus/shared";
import { Plus } from "lucide-react";

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
    .select("id, name, base_currency, account_members!inner(user_id, role)")
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
  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? accounts[0];
  const activeRole =
    activeAccount?.account_members?.find((member) => member.user_id === user.id)
      ?.role ?? "viewer";
  const canEdit = activeRole !== "viewer";

  const settingsLabelKey =
    navigationItems.find((item) => item.key === "settings")?.labelKey ??
    ("navigation.settings" as const);
  const settingsLabel = t(dictionary, settingsLabelKey);
  const openSettingsLabel = locale === "es" ? "Abrir ajustes" : "Open settings";
  const actionsLabel = locale === "es" ? "Acciones" : "Actions";
  const settingsMenu = buildSettingsMenuVM(dictionary, "web");

  const formatTimeAgo = (value: Date, currentLocale: string) => {
    const diffMs = Date.now() - value.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const isEs = currentLocale.startsWith("es");

    if (diffMinutes < 1) {
      return isEs ? "Hace unos segundos" : "Just now";
    }
    if (diffMinutes < 60) {
      return isEs
        ? `Hace ${diffMinutes} min`
        : `${diffMinutes} min ago`;
    }
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return isEs
        ? `Hace ${diffHours} hora${diffHours === 1 ? "" : "s"}`
        : `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    }
    const diffDays = Math.round(diffHours / 24);
    return isEs
      ? `Hace ${diffDays} día${diffDays === 1 ? "" : "s"}`
      : `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  };

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

  const activitySince = new Date();
  activitySince.setDate(activitySince.getDate() - 7);

  const { data: activityRows } = activeAccountId
    ? await supabase
        .from("transactions")
        .select("id, created_by, created_at")
        .eq("account_id", activeAccountId)
        .gte("created_at", activitySince.toISOString())
        .neq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as { id: string; created_by: string | null; created_at: string }[] };

  const activityByUser = new Map<
    string,
    { count: number; latest: Date }
  >();

  (activityRows ?? []).forEach((row) => {
    if (!row.created_by) return;
    const createdAt = new Date(row.created_at);
    const existing = activityByUser.get(row.created_by);
    if (existing) {
      existing.count += 1;
      if (createdAt > existing.latest) {
        existing.latest = createdAt;
      }
    } else {
      activityByUser.set(row.created_by, { count: 1, latest: createdAt });
    }
  });

  const activityUserIds = Array.from(activityByUser.keys());
  const { data: activityProfiles } = activityUserIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", activityUserIds)
    : { data: [] as { user_id: string; display_name: string | null; email: string | null }[] };

  const profileMap = new Map(
    (activityProfiles ?? []).map((item) => [item.user_id, item])
  );

  const notifications = activityUserIds
    .map((userId) => {
      const activity = activityByUser.get(userId);
      if (!activity) return null;
      const profileInfo = profileMap.get(userId);
      const fallbackName =
        profileInfo?.display_name ??
        profileInfo?.email ??
        (locale.startsWith("es") ? "Usuario" : "User");
      const userName = profileInfo?.display_name ?? fallbackName;
      const userInitial = (userName?.trim().charAt(0) || "?").toUpperCase();

      return {
        id: userId,
        userInitial,
        userName,
        count: activity.count,
        timeAgo: formatTimeAgo(activity.latest, locale),
        sortValue: activity.latest.getTime(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.sortValue ?? 0) - (a?.sortValue ?? 0))
    .slice(0, 5)
    .map((item) => ({
      id: item?.id ?? "",
      userInitial: item?.userInitial ?? "?",
      userName: item?.userName ?? "",
      count: item?.count ?? 0,
      timeAgo: item?.timeAgo ?? "",
    }));

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
          <div className="hidden sm:flex items-center">
            {activeAccount ? (
              <AddActionTrigger
                canEdit={canEdit}
                accountId={activeAccount.id}
                currency={activeAccount.base_currency}
                locale={locale}
                variant="top-nav"
              />
            ) : (
              <Link
                href="/transactions?new=1"
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 sm:px-4 sm:py-1.5"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Añadir</span>
              </Link>
            )}
          </div>
          <NotificationDropdown notifications={notifications} />
          <SettingsDrawer
            settingsLabel={settingsLabel}
            openLabel={openSettingsLabel}
            actionsLabel={actionsLabel}
            profile={profileData}
            menu={settingsMenu}
          />
        </div>
      </div>
    </div>
  );
}
