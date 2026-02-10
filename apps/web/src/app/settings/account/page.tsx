import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDictionary, t } from "@poleursus/shared";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import { ActiveAccountDetails } from "@/components/settings/active-account-details";

export default async function ActiveAccountPage() {
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
  const activeAccountId =
    cookieStore.get("finnon:activeAccountId")?.value ?? "";
  if (!activeAccountId) {
    redirect("/select-account");
  }

  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const title = t(
    dictionary,
    "settings.menu.sections.account.items.activeAccount.title"
  );
  const description = t(
    dictionary,
    "settings.menu.sections.account.items.activeAccount.description"
  );
  const activeAccount = accounts.find((account) => account.id === activeAccountId);
  if (!activeAccount) {
    redirect("/select-account");
  }
  const activeRole =
    activeAccount.account_members?.[0]?.role ?? "viewer";

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <PageContainer className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <ActiveAccountDetails
          account={{
            id: activeAccount.id,
            name: activeAccount.name,
            base_currency: activeAccount.base_currency,
          }}
          currentUserId={user.id}
          role={activeRole}
        />
      </PageContainer>
    </div>
  );
}
