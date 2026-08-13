import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { FileText } from "lucide-react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const envMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <FileText className="h-5 w-5" />
        </span>
        <span className="text-xl font-semibold tracking-tight">Bewerber</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {envMissing && (
            <div className="mb-4 space-y-2">
              <Alert variant="warning">
                Demo-Modus: Supabase ist noch nicht verbunden. Nach dem Setzen von{" "}
                <code className="rounded bg-white/60 px-1">NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
                <code className="rounded bg-white/60 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
                in <code className="rounded bg-white/60 px-1">.env.local</code> funktioniert die echte Anmeldung.
              </Alert>
            </div>
          )}
          {children}
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Bewerber · Datenschutz · Impressum
      </p>
    </div>
  );
}
