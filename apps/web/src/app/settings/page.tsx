import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildSettingsMenuVM, getDictionary, t } from "@poleursus/shared";
import { cookies } from "next/headers";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import { AccountDetailsCard } from "@/components/settings/account-details-card";

type AccountDetailItem = {
  label: string;
  value: string;
  valueTitle?: string;
  monospace?: boolean;
  copyValue?: string;
};

export default async function SettingsPage() {
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

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const viewModel = buildSettingsMenuVM(dictionary, "web");

  const activeAccountId =
    cookieStore.get("finnon:activeAccountId")?.value ?? accounts?.[0]?.id;
  const activeAccount =
    accounts?.find((account) => account.id === activeAccountId) ?? accounts?.[0];

  const { data: members } =
    activeAccount?.id
      ? await supabase
          .from("account_members")
          .select("user_id")
          .eq("account_id", activeAccount.id)
      : { data: null };

  const memberCount = members?.length;
  const activeRole = activeAccount?.account_members?.[0]?.role;
  const roleLabels = {
    admin: t(dictionary, "invites.roleAdmin"),
    contributor: t(dictionary, "invites.roleContributor"),
    viewer: t(dictionary, "invites.roleViewer"),
  } as const;
  const activeRoleLabel = activeRole ? roleLabels[activeRole] : null;

  const accountDetails = [
    activeAccount?.name
      ? {
          label: t(dictionary, "common.nameLabel"),
          value: activeAccount.name,
        }
      : null,
    activeAccount?.id
      ? {
          label: t(dictionary, "account.idLabel"),
          value: activeAccount.id.slice(0, 8),
          valueTitle: activeAccount.id,
          monospace: true,
          copyValue: activeAccount.id,
        }
      : null,
    activeAccount?.base_currency
      ? {
          label: t(dictionary, "dashboard.baseCurrencyLabel"),
          value: activeAccount.base_currency,
        }
      : null,
    typeof memberCount === "number"
      ? {
          label: t(dictionary, "dashboard.participantsLabel"),
          value: String(memberCount),
        }
      : null,
    activeRoleLabel
      ? {
          label: t(dictionary, "invites.roleLabel"),
          value: activeRoleLabel,
        }
      : null,
  ].filter((item): item is AccountDetailItem => Boolean(item));

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <PageContainer className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {viewModel.title}
          </h1>
          <p className="text-muted-foreground">{viewModel.subtitle}</p>
        </div>

        {accountDetails.length > 0 ? (
          <AccountDetailsCard
            title={t(dictionary, "account.title")}
            description={t(dictionary, "account.description")}
            items={accountDetails}
            copyLabel={t(dictionary, "common.copy")}
          />
        ) : null}

        {viewModel.sections.map((section) => (
          <div key={section.id} className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {section.title}
            </h2>
            <Card>
              <CardContent className="p-0">
                {section.items.map((item, index) => (
                  <Link
                    key={item.id}
                    href={item.route}
                    className={`flex items-center justify-between p-4 hover:bg-muted/50 transition-colors ${
                      index !== section.items.length - 1 ? "border-b" : ""
                    }`}
                  >
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xl">›</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}
      </PageContainer>
    </div>
  );
}
