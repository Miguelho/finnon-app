import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { NetworkNoticeProvider } from "@/components/network/network-notice";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finnon",
  description: "Personal finance manager",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <NetworkNoticeProvider>{children}</NetworkNoticeProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
