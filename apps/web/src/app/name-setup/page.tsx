"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NameSetupPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedName = displayName.trim();

  useEffect(() => {
    let cancelled = false;

    async function loadUserProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        console.warn("[NameSetupWeb] User not ready in client; waiting.", userError);
        setIsLoading(false);
        return;
      }

      const metadataName =
        (typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : ""
        ).trim();

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[NameSetupWeb] Failed to load display_name:", error);
      }

      const profileName =
        typeof data?.display_name === "string" ? data.display_name.trim() : "";
      const resolvedName = profileName || metadataName;

      if (resolvedName) {
        router.replace("/");
        router.refresh();
        setIsLoading(false);
        return;
      }

      setDisplayName(metadataName);
      setIsLoading(false);
    }

    void loadUserProfile();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedName || isSaving) return;

    setIsSaving(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: normalizedName,
        full_name: normalizedName,
      },
    });

    if (error) {
      console.error("[NameSetupWeb] Failed to save display_name:", error);
      setError(t("settings.userProfile.errors.saveDisplayName"));
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    router.replace("/");
    router.refresh();
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold">
            {t("nameSetup.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("nameSetup.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("nameSetup.label")}
              </label>
              <Input
                autoFocus
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t("nameSetup.placeholder")}
                maxLength={80}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={!normalizedName || isSaving}>
              {isSaving ? t("common.saving") : t("nameSetup.continue")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
