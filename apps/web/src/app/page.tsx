import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  const supabase = await createClient();

  // Obtener usuario actual
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Obtener cuentas del usuario
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*, account_members!inner(role)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) {
    redirect("/onboarding");
  }

  const mainAccount = accounts[0];

  // Función para cerrar sesión
  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {tCommon("appName")}
            </h1>
            <p className="text-muted-foreground">{tCommon("tagline")}</p>
          </div>
          <div className="flex gap-2">
            <LocaleSwitcher />
            <form action={signOut}>
              <Button variant="outline" type="submit">
                {t("signOut")}
              </Button>
            </form>
          </div>
        </div>

        {/* Welcome Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t("welcome")}</CardTitle>
            <CardDescription>{t("welcomeDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">{t("emailLabel")}:</span>{" "}
                {user.email}
              </p>
              <p className="text-sm">
                <span className="font-medium">{t("activeAccountLabel")}:</span>{" "}
                {mainAccount.name}
              </p>
              <p className="text-sm">
                <span className="font-medium">{t("baseCurrencyLabel")}:</span>{" "}
                {mainAccount.base_currency}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder para features futuras */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/transactions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("transactionsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("transactionsDescription")}
              </p>
            </CardContent>
          </Card>
          </Link>

          <Link href="/categories">
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("categoriesTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("categoriesDescription")}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("summaryTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("summaryDescription")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
