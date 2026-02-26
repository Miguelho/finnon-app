import type { ReactElement, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { NetworkNoticeProvider } from "@/components/network/network-notice";
import { WebUserThemeProvider } from "@/components/theme/web-user-theme-provider";
import { getThemePrehydrateScript } from "@/components/theme/theme-prehydrate-script";
import { WebDataCacheProvider } from "@/cache/WebDataCacheProvider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Finnon",
  description: "Personal finance manager",
  icons: {
    icon: [
      {
        url: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark-16x16.png",
        sizes: "16x16",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon-dark-32x32.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    shortcut: [
      {
        url: "/favicon-32x32.png",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactElement> {
  const locale = await getLocale();
  const messages = await getMessages();
  const themePrehydrateScript = getThemePrehydrateScript();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themePrehydrateScript,
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <NetworkNoticeProvider>
            <WebUserThemeProvider>
              <WebDataCacheProvider>{children}</WebDataCacheProvider>
            </WebUserThemeProvider>
          </NetworkNoticeProvider>
          <Toaster />
          <Analytics />
          <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
