import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDictionary, t } from "@poleursus/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cookies } from "next/headers";

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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t(dictionary, "settings.title")}
          </h1>
          <p className="text-muted-foreground">
            {t(dictionary, "settings.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t(dictionary, "settings.accountTitle")}</CardTitle>
            <CardDescription>
              {t(dictionary, "settings.accountDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t(dictionary, "settings.featuresIntro")}
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>{t(dictionary, "settings.featureInviteCreate")}</li>
              <li>{t(dictionary, "settings.featureInviteList")}</li>
              <li>{t(dictionary, "settings.featureInviteRevoke")}</li>
              <li>{t(dictionary, "settings.featureInviteAnalytics")}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
