import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDictionary, t, mapUserToUserDetailsVM } from "@poleursus/shared";
import { cookies } from "next/headers";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import { UserAvatarSettings } from "@/components/settings/user-avatar-settings";
import { UserSignOutRow } from "@/components/settings/user-signout";

export default async function UserDetailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const viewModel = mapUserToUserDetailsVM(user);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <PageContainer className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t(dictionary, "settings.userDetails.title")}
          </h1>
          <p className="text-muted-foreground">
            {t(dictionary, "settings.userDetails.subtitle")}
          </p>
        </div>

        <UserAvatarSettings userId={viewModel.userId} email={viewModel.email} />

        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {t(dictionary, "settings.userDetails.fields.email")}
              </div>
              <div className="text-foreground">{viewModel.email}</div>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {t(dictionary, "settings.userDetails.fields.id")}
              </div>
              <div className="text-sm text-muted-foreground font-mono">
                {viewModel.userId}
              </div>
            </div>
          </CardContent>
        </Card>
        <UserSignOutRow />
      </PageContainer>
    </div>
  );
}
