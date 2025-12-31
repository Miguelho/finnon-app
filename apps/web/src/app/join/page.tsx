"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type JoinState =
  | { status: "loading" }
  | { status: "processing" }
  | { status: "success"; accountId: string }
  | { status: "error"; message: string };

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<JoinState>({ status: "loading" });

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setState({ status: "error", message: "No se proporcionó token de invitación" });
      return;
    }

    async function processInvite(token: string) {
      setState({ status: "processing" });

      try {
        // 1. Check if user has a session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        // 2. If no session, create anonymous session
        if (!session) {
          console.log("[Join] No session found, signing in anonymously...");
          const { data: anonData, error: anonError } =
            await supabase.auth.signInAnonymously();

          if (anonError || !anonData.session) {
            console.error("[Join] Anonymous auth failed:", anonError);
            setState({
              status: "error",
              message: "No se pudo crear sesión de invitado. Por favor intenta de nuevo.",
            });
            return;
          }

          console.log(
            "[Join] Anonymous session created:",
            anonData.session.user.id
          );

          // Wait a moment to ensure cookies are set before calling API
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // 3. Call accept invite API
        const response = await fetch("/api/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setState({
            status: "error",
            message: errorData.error || "No se pudo aceptar la invitación",
          });
          return;
        }

        const data = await response.json();

        // 4. Save active account to localStorage
        localStorage.setItem("finnon:activeAccountId", data.accountId);

        // 4.1 Sync active account cookie for server-rendered pages
        await fetch("/api/active-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: data.accountId }),
        });

        // 5. Show success state
        setState({ status: "success", accountId: data.accountId });

        // 6. Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } catch (error) {
        console.error("[Join] Error:", error);
        setState({
          status: "error",
          message: "Ocurrió un error inesperado",
        });
      }
    }

    processInvite(token);
  }, [searchParams, router]);

  if (state.status === "loading" || state.status === "processing") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Uniéndote a la cuenta...</CardTitle>
            <CardDescription>
              Por favor espera mientras procesamos tu invitación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error de invitación</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")} className="w-full">
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>¡Éxito!</CardTitle>
            <CardDescription>Te has unido a la cuenta exitosamente</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Redirigiendo al panel de control...
            </p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
