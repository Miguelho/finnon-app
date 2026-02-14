"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/locale-switcher";

const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 8;

export default function LoginOTPPage() {
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const router = useRouter();
  const supabase = createClient();
  const isCooldownActive = cooldownSeconds > 0;

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isCooldownActive || email.trim().length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setStep("otp");
      setCooldownSeconds(60);
    } catch (err) {
      console.error("Send OTP error:", err);
      setError(err instanceof Error ? err.message : t("sendError"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) throw error;

      if (data.session) {
        // Redirigir al dashboard
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      setError(
        err instanceof Error ? err.message : t("invalidOtp")
      );
    } finally {
      setLoading(false);
    }
  };

  if (step === "otp") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="absolute right-4 top-4">
          <LocaleSwitcher />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("otpTitle")}</CardTitle>
            <CardDescription>
              {t("otpDescription", { email })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">{t("otpLabel")}</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  placeholder={t("otpPlaceholder")}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  disabled={loading}
                  maxLength={OTP_MAX_LENGTH}
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              {isCooldownActive && (
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  {t("cooldownMessage", { seconds: cooldownSeconds })}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setError(null);
                  }}
                  disabled={loading}
                  className="flex-1"
                >
                  {t("otpBackButton")}
                </Button>
                <Button
                  type="submit"
                  disabled={loading || otp.length < OTP_MIN_LENGTH}
                  className="flex-1"
                >
                  {loading ? t("otpVerifying") : t("otpVerifyButton")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>
            {t("otpPageDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {isCooldownActive && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {t("cooldownMessage", { seconds: cooldownSeconds })}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || isCooldownActive}
            >
              {loading ? t("otpSending") : t("otpSendButton")}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {t("otpHelp")}{" "}
              <a href="/login" className="underline">
                {t("otpHelpCta")}
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
