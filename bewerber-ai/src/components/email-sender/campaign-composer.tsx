"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { OnlineStatus } from "@/components/email-sender/online-status";
import { RecipientImport } from "@/components/email-sender/recipient-import";
import { RichTextEditor } from "@/components/email-sender/rich-text-editor";
import { AttachmentList } from "@/components/email-sender/attachment-list";
import { createCampaign, queueStart } from "@/lib/email/actions";
import { loadCampaignDraft, saveCampaignDraft, clearCampaignDraft, formatSavedAt } from "@/lib/email/draft";
import { useOnlineStatus } from "@/lib/email/use-online-status";
import type { AttachmentMeta, CampaignDraft, CampaignRecipientInput, DraftRecipient } from "@/lib/email/types";
import { ArrowLeft, Save, Send, Trash2, Info } from "lucide-react";

interface CampaignComposerProps {
  initialLimit: number;
}

/**
 * New campaign composer. Offline-first:
 * - draft (title/subject/body/recipients/attachments) persists to localStorage
 *   for unsent content only — never OAuth tokens;
 * - sending is blocked while offline;
 * - the browser-close warning reflects the honest local-draft behavior and
 *   never claims that sending continues when the connection is lost.
 */
export function CampaignComposer({ initialLimit }: CampaignComposerProps) {
  const router = useRouter();
  const online = useOnlineStatus() === "online";

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [recipients, setRecipients] = useState<DraftRecipient[]>([]);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [draftInfo, setDraftInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore local draft on mount (content only, no tokens).
  useEffect(() => {
    const draft = loadCampaignDraft();
    if (draft) {
      setTitle(draft.title);
      setSubject(draft.subject);
      setBodyHtml(draft.bodyHtml);
      setBodyText("");
      setRecipients(draft.recipients);
      setAttachments(draft.attachments);
      if (draft.savedAt) {
        setDraftInfo(`Entwurf vom ${formatSavedAt(draft.savedAt)} Uhr geladen.`);
      }
    }
  }, []);

  // Debounced autosave of unsent content.
  useEffect(() => {
    if (!dirtyRef.current && !title && !subject && !bodyHtml && recipients.length === 0 && attachments.length === 0) {
      return;
    }
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const draft: CampaignDraft = {
        title,
        subject,
        bodyHtml,
        recipients,
        attachments,
        savedAt: new Date().toISOString(),
      };
      saveCampaignDraft(draft);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, subject, bodyHtml, recipients, attachments]);

  // Honest browser-close warning: only unsaved draft content is at risk.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function discardDraft() {
    clearCampaignDraft();
    setTitle("");
    setSubject("");
    setBodyHtml("");
    setBodyText("");
    setRecipients([]);
    setAttachments([]);
    setDraftInfo(null);
    dirtyRef.current = false;
  }

  const buildInput = useCallback(() => {
    const validRecipients: DraftRecipient[] = recipients.filter(
      (r) => r.status === "valid" && r.email.trim()
    );
    const recipientInput: CampaignRecipientInput[] = validRecipients.map((r) => ({
      email: r.email.trim(),
      company: r.company.trim() || null,
      contact_name: r.contact_name.trim() || null,
    }));
    return {
      title,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
      recipients: recipientInput,
      attachments,
    };
  }, [title, subject, bodyHtml, bodyText, recipients, attachments]);

  function submit(andStart: boolean) {
    setError(null);
    startTransition(async () => {
      const created = await createCampaign(buildInput());
      if (!created.ok) {
        setError(created.error);
        return;
      }
      const campaignId = created.campaignId;
      if (!campaignId) return;
      clearCampaignDraft();
      dirtyRef.current = false;

      if (andStart) {
        const started = await queueStart(campaignId);
        if (!started.ok) {
          router.push(`/email-sender/${campaignId}?start=failed`);
          return;
        }
      }
      router.push(`/email-sender/${campaignId}`);
      router.refresh();
    });
  }

  const invalidCount = recipients.filter((r) => r.status === "invalid").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/email-sender" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Zurück zum E-Mail Sender
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Neue Kampagne</h1>
            <p className="mt-1 text-muted-foreground">
              Erstelle Inhalt und Empfängerliste. Versendet wird erst nach dem Start.
            </p>
          </div>
          <OnlineStatus />
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {draftInfo && (
        <Alert variant="info" className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" /> {draftInfo}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={discardDraft}>
            <Trash2 className="h-3.5 w-3.5" /> Verwerfen
          </Button>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Kampagnendaten</CardTitle>
          <CardDescription>Name und Betreffzeile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="c-title">Kampagnenname *</Label>
            <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Sommeraktion 2026" />
          </div>
          <div>
            <Label htmlFor="c-subject">Betreff</Label>
            <Input id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="z. B. Ihr Ansprechpartner bei Muster GmbH" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nachricht</CardTitle>
          <CardDescription>
            Formatierung: fett, kursiv, Listen und Links. Bilder werden über die Anhangsliste
            ergänzt (konzeptuell unterstützt, kein Inline-Bild).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <RichTextEditor
            value={bodyHtml}
            onChange={(html, text) => {
              setBodyHtml(html);
              setBodyText(text);
            }}
            placeholder="Nachricht eingeben…"
          />
          <Alert variant="info" className="text-xs">
            {`Personalisierung: Füge über die Schaltflächen im Editor Variablen ein. Beispieltexte
            (fiktiv): „Sehr geehrte/r {{contact_name}}, bei {{company}} freuen wir uns auf den Kontakt
            unter {{email}}.“ — Ungesetzte Variablen bleiben leer.`}
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empfänger</CardTitle>
          <CardDescription>
            Import (TXT/CSV/PDF) oder Einfügen — Limit: {initialLimit} pro Kampagne.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecipientImport value={recipients} onChange={setRecipients} limit={initialLimit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anhänge</CardTitle>
          <CardDescription>
            Dateien werden beim Hinzufügen sicher auf dem Server gespeichert und beim Versand vom
            Server-Worker an Gmail angehängt — im Browser bleiben nur Metadaten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttachmentList value={attachments} onChange={setAttachments} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Hinweis: Schließt du den Browser, bleibt der Entwurf lokal gespeichert. Der Versandstatus
            wird serverseitig geführt — nach einer Verbindungsunterbrechung wird er erst bei erneuter
            Verbindung aktualisiert.
          </p>
          <div className="flex shrink-0 gap-2">
            {draftInfo && (
              <Button type="button" variant="outline" onClick={discardDraft}>
                <Trash2 className="h-4 w-4" /> Verwerfen
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => submit(false)}
              disabled={!online || pending}
            >
              <Save className="h-4 w-4" /> Als Entwurf speichern
            </Button>
            <Button
              type="button"
              onClick={() => submit(true)}
              loading={pending}
              disabled={!online || pending || recipients.length === 0 || invalidCount > 0}
            >
              <Send className="h-4 w-4" /> Erstellen &amp; in Warteschlange
            </Button>
          </div>
        </CardContent>
      </Card>

      {!online && (
        <Alert variant="warning">
          Du bist offline. Es kann nichts gesendet werden — der Entwurf wird weiterhin lokal gespeichert.
        </Alert>
      )}
      {online && invalidCount > 0 && (
        <Alert variant="warning">
          {invalidCount} Empfängerzeile(n) enthalten eine ungültige E-Mail-Adresse und werden beim
          Speichern nicht übernommen.
        </Alert>
      )}
    </div>
  );
}
