import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth-actions";
import { formatDateTime } from "@/lib/utils";
import { LogOut, KeyRound, Database, User } from "lucide-react";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const aiConfigured = Boolean(process.env.COVER_LETTER_API_KEY);

  if (!user) return null; // layout redirects anyway

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Einstellungen</h1>
        <p className="mt-1 text-muted-foreground">Konto- und Systeminformationen.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Konto
          </CardTitle>
          <CardDescription>Deine Anmeldedaten bei Bewerber</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">E-Mail</div>
              <div className="mt-0.5 text-slate-800">{user.email}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nutzer-ID</div>
              <div className="mt-0.5 truncate font-mono text-xs text-slate-600">{user.id}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Registriert am</div>
              <div className="mt-0.5 text-slate-800">{formatDateTime(user.created_at)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Anbieter</div>
              <div className="mt-0.5">
                <Badge variant="blue">
                  {user.app_metadata?.provider ? String(user.app_metadata.provider) : "email"}
                </Badge>
              </div>
            </div>
          </div>
          <form action={signOutAction}>
            <Button variant="outline" size="sm">
              <LogOut className="h-4 w-4" /> Abmelden
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> Systemstatus
          </CardTitle>
          <CardDescription>Konfiguration der laufenden Instanz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusRow
            icon={Database}
            label="Supabase (Auth & Datenbank)"
            ok={supabaseConfigured}
            detail={supabaseConfigured ? "Verbindet, sobald ein Konto aktiv ist" : "NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY fehlen"}
          />
          <StatusRow
            icon={KeyRound}
            label="KI-Anbieter für Anschreiben"
            ok={aiConfigured}
            detail={aiConfigured ? "COVER_LETTER_API_KEY gesetzt" : "COVER_LETTER_API_KEY fehlt – manuelles Verfassen funktioniert immer"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  ok,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <Icon className="h-4.5 w-4.5 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <Badge variant={ok ? "success" : "warning"}>{ok ? "Aktiv" : "Hinweis"}</Badge>
    </div>
  );
}
