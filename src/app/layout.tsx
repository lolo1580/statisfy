import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ToastProvider } from "@/components/toast";
import { getI18n } from "@/i18n/server";
import { THEME_COOKIE, defaultTheme, isTheme } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Statisfy",
  description:
    "Self-hosted dashboard to explore your Spotify listening statistics.",
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dictionary } = await getI18n();
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : defaultTheme;

  return (
    <html
      lang={locale}
      data-theme={theme === "system" ? undefined : theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <I18nProvider locale={locale} dictionary={dictionary}>
          <ToastProvider>
            <ServiceWorkerRegister />
            {children}
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
