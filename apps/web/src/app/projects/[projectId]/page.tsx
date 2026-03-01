import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENCIES } from "@poleursus/shared";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { ProjectDetailClient } from "./project-detail-client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

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

  const activeAccount = accounts.find((account) => account.id === cookieAccountId);
  if (!activeAccount) {
    redirect("/select-account");
  }

  const role = activeAccount.account_members?.[0]?.role ?? "viewer";
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === activeAccount.base_currency)
      ?.symbol ?? activeAccount.base_currency;

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("account_id", activeAccount.id)
    .maybeSingle();

  if (!project) {
    redirect("/projects");
  }

  const { data: accountProjectsForColor } = await supabase
    .from("projects")
    .select("id, color, is_hucha, created_at")
    .eq("account_id", activeAccount.id);

  const { data: contributions } = await supabase
    .from("project_contributions")
    .select("*")
    .eq("project_id", project.id)
    .order("period", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: recurringExpenses } = await supabase
    .from("recurring_items")
    .select("id, merchant, notes, amount_minor, currency, is_paused, type")
    .eq("account_id", activeAccount.id)
    .eq("type", "expense")
    .eq("currency", activeAccount.base_currency)
    .eq("is_paused", false)
    .order("amount_minor", { ascending: false });

  const userIds = Array.from(
    new Set((contributions ?? []).map((item) => item.user_id).filter(Boolean))
  );

  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds)
      : { data: [] };

  const userLabels = (profiles ?? []).reduce<Record<string, string>>((acc, profile) => {
    acc[profile.user_id] =
      profile.display_name?.trim() || profile.email?.trim() || profile.user_id.slice(0, 8);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <ProjectDetailClient
        accountId={activeAccount.id}
        role={role}
        baseCurrency={activeAccount.base_currency}
        currencySymbol={currencySymbol}
        initialProject={project}
        accountProjectsForColor={accountProjectsForColor ?? []}
        initialContributions={contributions ?? []}
        recurringExpenses={recurringExpenses ?? []}
        userLabels={userLabels}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
