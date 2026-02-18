import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";

type SupportedLocale = "es" | "en";

const copy: Record<
  SupportedLocale,
  {
    title: string;
    description: string;
    heading: string;
    updatedLabel: string;
    updatedDate: string;
    intro: string;
    useTitle: string;
    useBody: string;
    accountTitle: string;
    accountBody: string;
    liabilityTitle: string;
    liabilityBody: string;
    contactTitle: string;
    contactBody: string;
    backToHome: string;
  }
> = {
  es: {
    title: "Términos y Condiciones | Finnon",
    description: "Términos y condiciones de uso de Finnon.",
    heading: "Términos y Condiciones",
    updatedLabel: "Última actualización",
    updatedDate: "18 de febrero de 2026",
    intro:
      "Estos términos regulan el uso de Finnon en web y móvil. Al usar la aplicación, aceptas estas condiciones.",
    useTitle: "Uso permitido",
    useBody:
      "Puedes usar Finnon para gestionar finanzas personales y compartidas de forma lícita. No está permitido usar la plataforma para actividades fraudulentas o que incumplan la ley.",
    accountTitle: "Cuenta y acceso",
    accountBody:
      "Eres responsable de la información de acceso a tu cuenta y de cualquier acción realizada desde ella. Finnon puede suspender acceso ante uso abusivo o riesgo de seguridad.",
    liabilityTitle: "Limitación de responsabilidad",
    liabilityBody:
      "Finnon se ofrece tal cual. Hacemos esfuerzos razonables para disponibilidad y precisión, pero no garantizamos ausencia total de errores, interrupciones o pérdidas indirectas.",
    contactTitle: "Contacto",
    contactBody: "Para consultas legales, escríbenos a contacto@finnon.app.",
    backToHome: "Volver al inicio",
  },
  en: {
    title: "Terms and Conditions | Finnon",
    description: "Terms and conditions for using Finnon.",
    heading: "Terms and Conditions",
    updatedLabel: "Last updated",
    updatedDate: "February 18, 2026",
    intro:
      "These terms govern the use of Finnon on web and mobile. By using the app, you agree to these conditions.",
    useTitle: "Permitted use",
    useBody:
      "You may use Finnon for personal and shared finance management in a lawful way. Fraudulent or illegal usage is not allowed.",
    accountTitle: "Account and access",
    accountBody:
      "You are responsible for your account access information and actions taken from your account. Finnon may suspend access in cases of abuse or security risk.",
    liabilityTitle: "Limitation of liability",
    liabilityBody:
      "Finnon is provided as-is. We make reasonable efforts for availability and accuracy, but we do not guarantee total absence of errors, interruptions, or indirect losses.",
    contactTitle: "Contact",
    contactBody: "For legal inquiries, contact us at contacto@finnon.app.",
    backToHome: "Back to home",
  },
};

const resolveLocale = (locale: string): SupportedLocale =>
  locale.toLowerCase().startsWith("en") ? "en" : "es";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(await getLocale());
  const t = copy[locale];

  return {
    title: t.title,
    description: t.description,
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function TermsPage() {
  const locale = resolveLocale(await getLocale());
  const t = copy[locale];

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[760px] rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
        <Link href="/" className="text-sm text-primary hover:underline">
          {t.backToHome}
        </Link>

        <article className="mt-4 space-y-5">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">
              {t.updatedLabel}: {t.updatedDate}
            </p>
          </header>

          <p className="text-sm leading-7 text-muted-foreground">{t.intro}</p>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{t.useTitle}</h2>
            <p className="text-sm leading-7 text-muted-foreground">{t.useBody}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{t.accountTitle}</h2>
            <p className="text-sm leading-7 text-muted-foreground">{t.accountBody}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{t.liabilityTitle}</h2>
            <p className="text-sm leading-7 text-muted-foreground">{t.liabilityBody}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{t.contactTitle}</h2>
            <p className="text-sm leading-7 text-muted-foreground">{t.contactBody}</p>
          </section>
        </article>
      </div>
    </main>
  );
}
