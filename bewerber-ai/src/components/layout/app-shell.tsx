"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signOutAction } from "@/lib/auth-actions";
import { initials } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  PenLine,
  Briefcase,
  Building2,
  Mail,
  User,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

export interface AppUser {
  email: string | null;
  fullName: string | null;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lebenslauf", label: "Lebenslauf", icon: FileText },
  { href: "/anschreiben", label: "Anschreiben", icon: PenLine },
  { href: "/bewerbungen", label: "Bewerbungen", icon: Briefcase },
  { href: "/unternehmen", label: "Unternehmen", icon: Building2 },
  { href: "/email-sender", label: "E-Mail Sender", icon: Mail },
  { href: "/profile", label: "Profil", icon: User },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export function AppShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const name = user.fullName || user.email || "Benutzer";

  function handleSignOut() {
    setSigningOut(true);
    void signOutAction();
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-slate-600 hover:bg-muted hover:text-slate-900"
            }`}
          >
            <item.icon className="h-4.5 w-4.5" />
            {item.label}
            {item.href === "/lebenslauf" && <Badge variant="blue" className="ml-auto text-[10px]">PDF</Badge>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border/70 bg-card px-3 py-6 lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <FileText className="h-4.5 w-4.5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Bewerber</span>
        </Link>
        {nav}
        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/50 px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {initials(name.split(" ")[0], name.split(" ").slice(1).join(" "))}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-800">{name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-slate-600" onClick={handleSignOut} loading={signingOut}>
            <LogOut className="h-4 w-4" /> Abmelden
          </Button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border/70 bg-card/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">Bewerber</span>
        </Link>
        <button onClick={() => setMobileOpen((v) => !v)} aria-label="Menü" className="rounded-lg p-2 hover:bg-muted">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-white pt-14 lg:hidden">
          <div className="flex h-full flex-col gap-4 overflow-y-auto px-4 py-4">
            {nav}
            <div className="mt-auto space-y-2 border-t border-border pt-4">
              <div className="truncate text-sm font-medium text-slate-800">{name}</div>
              <Button variant="ghost" size="sm" className="w-full justify-start text-slate-600" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" /> Abmelden
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:ml-60 lg:px-10 lg:pt-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
