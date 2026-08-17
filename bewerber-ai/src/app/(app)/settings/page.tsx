import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth-actions";
import { LogOut, KeyRound, Database, User } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.settings") };
}

export default async function SettingsPage() {
  const { t, formatDateTime } = await getI18n();
  const user = await getSessionUser();
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const aiConfigured = Boolean(process.env.COVER_LETTER_API_KEY);

  if (!user) return null; // layout redirects anyway

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("settings.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> {t("settings.account")}
          </CardTitle>
          <CardDescription>{t("settings.accountDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("settings.email")}</div>
              <div className="mt-0.5 text-slate-800">{user.email}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("settings.userId")}</div>
              <div className="mt-0.5 truncate font-mono text-xs text-slate-600">{user.id}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("settings.registeredAt")}</div>
              <div className="mt-0.5 text-slate-800">{formatDateTime(user.created_at)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("settings.provider")}</div>
              <div className="mt-0.5">
                <Badge variant="blue">
                  {user.app_metadata?.provider ? String(user.app_metadata.provider) : "email"}
                </Badge>
              </div>
            </div>
          </div>
          <form action={signOutAction}>
            <Button variant="outline" size="sm">
              <LogOut className="h-4 w-4" /> {t("common.logout")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> {t("settings.system")}
          </CardTitle>
          <CardDescription>{t("settings.systemDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusRow
            icon={Database}
            label={t("settings.supabaseLabel")}
            ok={supabaseConfigured}
            detail={supabaseConfigured ? t("settings.supabaseOk") : t("settings.supabaseMissing")}
            statusLabel={supabaseConfigured ? t("settings.active") : t("settings.hint")}
          />
          <StatusRow
            icon={KeyRound}
            label={t("settings.aiLabel")}
            ok={aiConfigured}
            detail={aiConfigured ? t("settings.aiOk") : t("settings.aiMissing")}
            statusLabel={aiConfigured ? t("settings.active") : t("settings.hint")}
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
  statusLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  ok: boolean;
  detail: string;
  statusLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <Icon className="h-4.5 w-4.5 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <Badge variant={ok ? "success" : "warning"}>{statusLabel}</Badge>
    </div>
  );
}
