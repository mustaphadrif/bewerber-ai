import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bewerber – Deine Bewerbung. Einfacher. Schneller. Smarter.",
    template: "%s | Bewerber",
  },
  description:
    "Bewerber hilft dir, Lebenslauf, Anschreiben und Bewerbungen in einem Tool zu verwalten – einfach, schnell, smarter.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="app-backdrop min-h-screen antialiased">{children}</body>
    </html>
  );
}
