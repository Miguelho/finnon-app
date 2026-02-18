import Link from "next/link";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

type SupportedLocale = "es" | "en";

const copy: Record<
  SupportedLocale,
  {
    title: string;
    description: string;
    eyebrow: string;
    headline: string;
    subheadline: string;
    ctaPrimary: string;
    ctaSecondary: string;
    featuresTitle: string;
    features: string[];
    legal: string;
    privacy: string;
    deleteAccount: string;
  }
> = {
  es: {
    title: "Finnon | Finanzas compartidas sin complicaciones",
    description:
      "Controla gastos, pagos recurrentes y objetivos en pareja desde una sola app.",
    eyebrow: "Now in beta",
    headline: "Finanzas compartidas sin hojas de cálculo",
    subheadline:
      "Organiza gastos en pareja, sigue pagos recurrentes y visualiza el mes completo con claridad.",
    ctaPrimary: "Entrar",
    ctaSecondary: "Ir a la app",
    featuresTitle: "Todo lo que necesitas",
    features: [
      "Calendario semanal de gastos e ingresos",
      "Cuenta compartida en tiempo real",
      "Objetivos de ahorro y simulación",
    ],
    legal: "Enlaces legales",
    privacy: "Privacidad",
    deleteAccount: "Eliminar cuenta",
  },
  en: {
    title: "Finnon | Shared finances without complexity",
    description:
      "Track expenses, recurring payments and goals together in one app.",
    eyebrow: "Now in beta",
    headline: "Shared finances without spreadsheets",
    subheadline:
      "Track shared spending, recurring payments, and monthly progress with a simple workflow.",
    ctaPrimary: "Sign in",
    ctaSecondary: "Open app",
    featuresTitle: "Everything you need",
    features: [
      "Weekly expenses and income calendar",
      "Real-time shared account",
      "Savings goals and forecasting",
    ],
    legal: "Legal links",
    privacy: "Privacy",
    deleteAccount: "Delete account",
  },
};

const resolveLocale = (locale: string): SupportedLocale =>
  locale.toLowerCase().startsWith("en") ? "en" : "es";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(await getLocale());
  const current = copy[locale];

  return {
    title: current.title,
    description: current.description,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: "https://finnon.app/",
    },
  };
}

export default async function LandingPage() {
  const locale = resolveLocale(await getLocale());
  const t = copy[locale];

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-10 text-[#0f172a] sm:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="flex items-center justify-between">
          <p className="text-xl font-semibold tracking-tight">Finnon</p>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm font-medium text-[#0f172a] hover:bg-[#eef2ff]"
            >
              {t.ctaPrimary}
            </Link>
            <Link
              href="/home"
              className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b]"
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </header>

        <section className="rounded-3xl border border-[#e2e8f0] bg-white p-8 shadow-sm sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#475569]">{t.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">{t.headline}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#475569]">{t.subheadline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1e293b]"
            >
              {t.ctaPrimary}
            </Link>
            <Link
              href="/home"
              className="rounded-full border border-[#cbd5e1] px-5 py-3 text-sm font-semibold text-[#0f172a] hover:bg-[#f8fafc]"
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e2e8f0] bg-white p-8 shadow-sm sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">{t.featuresTitle}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {t.features.map((feature) => (
              <li key={feature} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm">
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e2e8f0] py-6 text-sm text-[#64748b]">
          <span>© 2026 Finnon</span>
          <div className="flex items-center gap-5">
            <span>{t.legal}</span>
            <Link href="/privacy" className="hover:text-[#0f172a]">
              {t.privacy}
            </Link>
            <Link href="/delete-account" className="hover:text-[#0f172a]">
              {t.deleteAccount}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
