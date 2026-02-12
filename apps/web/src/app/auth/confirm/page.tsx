"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export default function AuthConfirmPage() {
  const t = useTranslations("authConfirm");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"redirecting" | "error">("redirecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const hasCode = searchParams.has("code");
    const hasTokenHash = searchParams.has("token_hash");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      setStatus("error");
      setErrorMessage(errorDescription || error);
      return;
    }

    if (hasCode || hasTokenHash) {
      router.replace(`/auth/callback${query.length > 0 ? `?${query}` : ""}`);
      return;
    }

    setStatus("error");
    setErrorMessage(t("missingCode"));
  }, [router, searchParams, t]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-red-500">{errorMessage}</p>
          <button
            onClick={() => router.push("/login?error=no_session")}
            className="mt-4 underline"
          >
            {t("backToLogin")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p>{t("redirecting")}</p>
      </div>
    </div>
  );
}
