"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { isDemoEmail, parseDemoEmails } from "@poleursus/shared";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 8;

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [codeStep, setCodeStep] = useState<"request" | "verify">("request");

  const supabase = createClient();
  const demoEmails = parseDemoEmails(process.env.NEXT_PUBLIC_DEMO_EMAILS);
  const isCooldownActive = cooldownSeconds > 0;
  const queryError = searchParams.get("error");

  const queryErrorMessage = (() => {
    if (!queryError) return null;

    const normalized = queryError.toLowerCase();

    if (normalized.includes("no_code") || normalized.includes("missing")) {
      return t("redesign.authErrorNoCode");
    }

    if (normalized.includes("no_session")) {
      return t("redesign.authErrorNoSession");
    }

    if (
      normalized.includes("expired") ||
      normalized.includes("invalid") ||
      normalized.includes("token")
    ) {
      return t("redesign.authErrorExpired");
    }

    return t("redesign.authErrorGeneric");
  })();

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const submitLabel = (() => {
    if (codeStep === "request") {
      return loading ? t("otpSending") : t("redesign.continueButton");
    }
    return loading ? t("redesign.verifyingButton") : t("redesign.verifyCodeButton");
  })();

  const isSubmitDisabled =
    codeStep === "request"
      ? loading || isCooldownActive
      : loading || otpCode.length < OTP_LENGTH;

  const validateEmail = () => {
    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      setError(t("redesign.emailRequired"));
      return null;
    }

    if (!emailRegex.test(normalized)) {
      setError(t("redesign.emailInvalid"));
      return null;
    }

    return normalized;
  };

  const validateCode = () => {
    const normalized = otpCode.trim();

    if (!normalized) {
      setError(t("redesign.codeRequired"));
      return null;
    }

    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(normalized)) {
      setError(t("redesign.codeInvalid"));
      return null;
    }

    return normalized;
  };

  const sendCode = async () => {
    if (loading || isCooldownActive) return;

    const normalizedEmail = validateEmail();
    if (!normalizedEmail) return;

    if (isDemoEmail(normalizedEmail, demoEmails)) {
      console.warn("[Demo] Skipping OTP send for demo account");
      setCodeStep("verify");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpError) throw otpError;

      setCodeStep("verify");
      setCooldownSeconds(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("redesign.sendError"));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (loading) return;

    const normalizedCode = validateCode();
    if (!normalizedCode) return;

    const normalizedEmail = validateEmail();
    if (!normalizedEmail) return;

    setLoading(true);
    setError(null);

    try {
      if (isDemoEmail(normalizedEmail, demoEmails)) {
        console.warn("[Demo] Using demo login API");
        const response = await fetch("/api/auth/demo-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, otp: normalizedCode }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Demo login failed");
        }

        router.replace("/home");
        router.refresh();
        return;
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedCode,
        type: "email",
      });

      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("no_session");

      router.replace("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invalidOtp"));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (codeStep === "verify") {
      void verifyCode();
      return;
    }
    void sendCode();
  };

  return (
    <main className="min-h-screen bg-[#F6F5F1] lg:grid lg:grid-cols-[1fr_440px]">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#1A1A1A] px-14 py-12 lg:flex">
        <div
          className="flex items-center gap-3 animate-[finnon-fade-up_0.7s_ease-out_both]"
        >
          <Image
            src="/brand/icono.png"
            alt="Finnon"
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl"
          />
          <span className="text-[22px] font-semibold tracking-[-0.3px] text-white">Finnon</span>
        </div>

        <div
          className="max-w-[440px] animate-[finnon-fade-up_0.8s_ease-out_both]"
          style={{ animationDelay: "0.1s" }}
        >
          <h1 className="mb-5 text-[44px] font-semibold leading-[1.15] tracking-[-1px] text-white">
            {t("redesign.brandHeadline")}
          </h1>
          <p className="max-w-[380px] text-[17px] leading-[1.6] text-white/55">
            {t("redesign.brandDescription")}
          </p>

          <div
            className="mt-12 space-y-4 animate-[finnon-fade-up_0.8s_ease-out_both]"
            style={{ animationDelay: "0.25s" }}
          >
            <p className="flex items-center gap-3 text-sm text-white/45">
              <span className="h-2 w-2 rounded-full bg-[#B0BEC5]" />
              {t("redesign.featureShared")}
            </p>
            <p className="flex items-center gap-3 text-sm text-white/45">
              <span className="h-2 w-2 rounded-full bg-[#B0BEC5]" />
              {t("redesign.featureGoals")}
            </p>
            <p className="flex items-center gap-3 text-sm text-white/45">
              <span className="h-2 w-2 rounded-full bg-[#B0BEC5]" />
              {t("redesign.featureInsights")}
            </p>
          </div>
        </div>
      </section>

      <section className="relative min-h-screen overflow-hidden bg-[#F6F5F1] px-6 pb-10 pt-0 sm:px-8 lg:px-12 lg:py-12">
        <div className="absolute right-6 top-6 z-10 lg:right-10 lg:top-8">
          <LocaleSwitcher appearance="auth" />
        </div>

        <div
          className="relative -mx-6 mb-8 overflow-hidden bg-[#1A1A1A] px-6 pb-8 pt-16 text-center animate-[finnon-fade-up_0.8s_ease-out_both] sm:-mx-8 sm:px-8 lg:hidden"
          style={{ animationDelay: "0.05s" }}
        >
          <div className="mb-5 flex items-center justify-center gap-4">
            <Image
              src="/brand/icono.png"
              alt="Finnon"
              width={52}
              height={52}
              className="h-[52px] w-[52px] rounded-[12px]"
            />
            <span className="text-2xl font-semibold tracking-[-0.35px] text-white">
              Finnon
            </span>
          </div>

          <h1 className="mx-auto mb-2 max-w-[320px] text-[30px] font-semibold leading-[1.2] tracking-[-0.6px] text-white">
            {t("redesign.brandHeadline")}
          </h1>
          <p className="mx-auto max-w-[340px] text-[15px] leading-6 text-white/65">
            {t("redesign.brandDescription")}
          </p>

          <div
            className="pointer-events-none absolute right-4 top-[138px] flex items-end opacity-[0.18]"
            aria-hidden
          >
            <span className="h-12 w-12 rounded-full bg-white/40" />
            <span className="-ml-3 h-12 w-12 rounded-full bg-[#B0BEC5]/60" />
          </div>
        </div>

        <div className="mx-auto flex min-h-[80vh] w-full max-w-[380px] flex-col justify-start pt-0 lg:justify-center lg:pt-0">
          <div
            className="animate-[finnon-fade-up_0.8s_ease-out_both]"
            style={{ animationDelay: "0.15s" }}
          >
            <h2 className="mb-2 text-[26px] font-semibold tracking-[-0.3px] text-[#1A1A1A]">
              {t("redesign.welcomeTitle")}
            </h2>
            <p className="mb-9 text-[15px] leading-6 text-[#6B6B6B]">
              {t("redesign.welcomeSubtitle")}
            </p>

            {queryErrorMessage && (
              <div className="mb-5 rounded-[14px] border border-[#f1d3d3] bg-[#fff1f1] p-4">
                <p className="text-sm font-semibold text-[#7A2E2E]">
                  {t("redesign.authErrorTitle")}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#8B4B4B]">
                  {queryErrorMessage}
                </p>
                <p className="mt-2 text-xs text-[#8B4B4B]">{t("redesign.authErrorRetry")}</p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor={codeStep === "verify" ? "code" : "email"}
                  className="mb-2 block text-[13px] font-medium tracking-[0.2px] text-[#6B6B6B]"
                >
                  {codeStep === "verify"
                    ? t("otpLabel")
                    : t("redesign.emailLabel")}
                </label>
                <input
                  id={codeStep === "verify" ? "code" : "email"}
                  type={codeStep === "verify" ? "text" : "email"}
                  inputMode={codeStep === "verify" ? "numeric" : "email"}
                  pattern={codeStep === "verify" ? "[0-9]*" : undefined}
                  maxLength={codeStep === "verify" ? OTP_LENGTH : undefined}
                  value={codeStep === "verify" ? otpCode : email}
                  onChange={(event) => {
                    if (codeStep === "verify") {
                      setOtpCode(event.target.value.replace(/\D/g, ""));
                    } else {
                      setEmail(event.target.value);
                    }
                    setError(null);
                  }}
                  placeholder={
                    codeStep === "verify"
                      ? t("otpPlaceholder")
                      : t("redesign.emailPlaceholder")
                  }
                  autoComplete={codeStep === "verify" ? "one-time-code" : "email"}
                  disabled={loading}
                  className={`w-full rounded-[14px] border border-[#E5E3DE] bg-white px-[18px] py-4 text-base text-[#1A1A1A] outline-none transition-[border-color,box-shadow] placeholder:text-[#9A9A9A] focus:border-[#2D2D2D] focus:shadow-[0_0_0_3px_rgba(45,45,45,0.06)] ${
                    codeStep === "verify" ? "text-center tracking-[0.22em]" : ""
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="w-full rounded-[14px] bg-[#2D2D2D] px-4 py-4 text-base font-medium text-white transition hover:bg-[#444] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLabel}
              </button>

              <p className="pt-1 text-center text-[13px] leading-6 text-[#9A9A9A]">
                {codeStep === "request" ? (
                  <span className="text-[#6B6B6B]">{t("otpPageDescription")}</span>
                ) : (
                  <span className="text-[#6B6B6B]">
                    {t("otpDescription", { email: email.trim() })}
                  </span>
                )}
              </p>

              {codeStep === "verify" && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setCodeStep("request");
                      setOtpCode("");
                      setError(null);
                    }}
                    className="text-[12.5px] text-[#6B6B6B] underline decoration-[#E5E3DE] underline-offset-2"
                  >
                    {t("otpBackButton")}
                  </button>
                </div>
              )}

              {isCooldownActive && (
                <p className="rounded-md border border-[#E5E3DE] bg-white/50 p-3 text-center text-xs text-[#6B6B6B]">
                  {t("redesign.cooldown", { seconds: cooldownSeconds })}
                </p>
              )}

              {error && (
                <p className="rounded-md border border-[#f1d3d3] bg-[#fff1f1] p-3 text-center text-xs text-[#B54848]">
                  {error}
                </p>
              )}
            </form>

            <div className="mt-8 border-t border-[#E5E3DE] pt-6 text-center">
              <p className="text-xs leading-6 text-[#9A9A9A]">
                {t("redesign.footerLine1")}
                <br />
                {t("redesign.footerLine2")}
              </p>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute bottom-12 right-12 hidden items-end opacity-[0.12] lg:flex"
          aria-hidden
        >
          <span className="h-[72px] w-[72px] rounded-full bg-[#1A1A1A]" />
          <span className="-ml-[18px] h-[72px] w-[72px] rounded-full bg-[#B0BEC5]" />
        </div>
      </section>
    </main>
  );
}
