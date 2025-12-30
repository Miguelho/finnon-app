import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">
            Gestiona tu cuenta y preferencias
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de cuenta</CardTitle>
            <CardDescription>
              Gestión de invitaciones y otras funciones próximamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Esta página incluirá:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>Crear y gestionar links de invitación</li>
              <li>Ver invitaciones activas</li>
              <li>Revocar invitaciones</li>
              <li>Ver análisis de uso de invitaciones</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
