"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const tGlobal = useTranslations();
  const t = useTranslations("join");
  const [state, setState] = useState<JoinState>({ status: "loading" });

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setState({ status: "error", message: t("missingToken") });
      return;
    }

    async function processInvite(token: string) {
      setState({ status: "processing" });

      try {
        // 1. Check if user is authenticated (verified by Auth server)
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("[Join] getUser failed:", userError);
        }

        // 2. If no authenticated user, create anonymous session
        if (!user) {
          console.log("[Join] No authenticated user found, signing in anonymously...");
          const { data: anonData, error: anonError } =
            await supabase.auth.signInAnonymously();

          if (anonError || !anonData.session) {
            console.error("[Join] Anonymous auth failed:", anonError);
            setState({
              status: "error",
              message: t("guestSessionError"),
            });
            return;
          }

          console.log(
            "[Join] Anonymous session created:",
            anonData.user?.id
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
            message: errorData.errorKey
              ? tGlobal(errorData.errorKey, errorData.errorParams)
              : t("acceptError"),
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
          router.push("/home");
        }, 2000);
      } catch (error) {
        console.error("[Join] Error:", error);
        setState({
          status: "error",
          message: t("unexpectedError"),
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
            <CardTitle>{t("loadingTitle")}</CardTitle>
            <CardDescription>
              {t("loadingDescription")}
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
            <CardTitle>{t("errorTitle")}</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")} className="w-full">
              {t("loginCta")}
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
            <CardTitle>{t("successTitle")}</CardTitle>
            <CardDescription>{t("successDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("redirecting")}
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
