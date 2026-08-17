import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getI18n } from "@/lib/i18n/server";
import { FileText } from "lucide-react";

export async function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { t } = await getI18n();
  const envMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex w-full max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <FileText className="h-5 w-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Bewerber</span>
        </Link>
        <LanguageSwitcher />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {envMissing && (
            <div className="mb-4 space-y-2">
              <Alert variant="warning">{t("auth.demoMode")}</Alert>
            </div>
          )}
          {children}
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground">
        {t("auth.footer", { year: new Date().getFullYear() })}
      </p>
    </div>
  );
}
