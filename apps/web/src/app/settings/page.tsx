import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDictionary, t } from "@poleursus/shared";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";

export default async function SettingsPage() {
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
  const subtitle =
    locale === "es" ? "Abre el panel desde el avatar." : "Open the panel from the avatar.";

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <PageContainer className="space-y-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t(dictionary, "settings.title")}
          </h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
      </PageContainer>
    </div>
  );
}
