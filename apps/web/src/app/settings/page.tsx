import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildSettingsMenuVM, getDictionary } from "@poleursus/shared";
import { cookies } from "next/headers";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
  const viewModel = buildSettingsMenuVM(dictionary, "web");

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
