import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/client";
import { dirOf } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: {
    default: "Bewerber – Deine Bewerbung. Einfacher. Schneller. Smarter.",
    template: "%s | Bewerber",
  },
  description:
    "Bewerber hilft dir, Lebenslauf, Anschreiben und Bewerbungen in einem Tool zu verwalten – einfach, schnell, smarter.",
};

/**
 * Root layout: renders <html lang/dir> per the persisted locale (cookie,
 * kept in sync with localStorage["bewerber-locale"]) and wraps the app in
 * the i18n provider. The inline script applies the persisted locale before
 * hydration to avoid any language/direction flash.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={dirOf(locale)} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem("bewerber-locale");if(l==="de"||l==="en"||l==="ar"){document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="app-backdrop min-h-screen antialiased">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
