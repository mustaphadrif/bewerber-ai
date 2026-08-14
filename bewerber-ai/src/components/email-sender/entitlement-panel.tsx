"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { activateEntitlement } from "@/lib/email/actions";
import { formatDate } from "@/lib/utils";

interface EntitlementPanelProps {
  limit: number;
  status: "standard" | "premium";
  activatedAt: string | null;
  dailySent: number;
}

/**
 * Shows the real server-side daily usage (never fictional numbers) and lets
 * the user redeem an activation code. The code is validated only server-side
 * against EMAIL_SENDER_ACTIVATION_CODE; the env value never reaches the client.
 */
export function EntitlementPanel({ limit, status, activatedAt, dailySent }: EntitlementPanelProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await activateEntitlement(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(result.message ?? "Aktivierung erfolgreich.");
      setCode("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Nutzung & Limit
          {status === "premium" && <Badge variant="success">Premium</Badge>}
        </CardTitle>
        <CardDescription>
          Tageslimit (gesendete E-Mails heute) und Empfängerlimit pro Kampagne.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div className="text-xl font-semibold text-slate-900">
              {dailySent} / {limit}
            </div>
            <div className="text-xs text-muted-foreground">Tageslimit (heute)</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div className="text-xl font-semibold text-slate-900">{limit}</div>
            <div className="text-xs text-muted-foreground">Empfänger pro Kampagne</div>
          </div>
        </div>

        {activatedAt && (
          <p className="text-xs text-muted-foreground">
            Premium aktiviert am {formatDate(activatedAt)}.
          </p>
        )}

        {status === "standard" ? (
          <form onSubmit={submit} className="space-y-2">
            <Label htmlFor="activation-code">Aktivierungscode einlösen</Label>
            <div className="flex gap-2">
              <Input
                id="activation-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Aktivierungscode"
                autoComplete="off"
              />
              <Button type="submit" loading={pending} disabled={!code.trim()}>
                Aktivieren
              </Button>
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
          </form>
        ) : (
          <p className="text-xs text-emerald-700">Premium ist aktiv — Limit 400 Empfänger pro Kampagne.</p>
        )}
      </CardContent>
    </Card>
  );
}
