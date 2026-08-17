"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { parsePastedText, parseRecipientFile, type RecipientParseResult } from "@/lib/email/parse";
import { normalizeEmail } from "@/lib/email/validation";
import { useI18n } from "@/lib/i18n/client";
import type { DraftRecipient } from "@/lib/email/types";
import { Plus, Upload, Trash2, Users } from "lucide-react";

interface RecipientImportProps {
  value: DraftRecipient[];
  onChange: (rows: DraftRecipient[]) => void;
  limit: number;
}

/**
 * Recipient import: paste, TXT/CSV/PDF upload, editable table.
 * Company/contact are NEVER inferred from the email address — they stay blank
 * unless an explicit CSV header provides them. PDFs use a no-dependency
 * text-layer/binary fallback and clearly report when nothing is found.
 */
export function RecipientImport({ value, onChange, limit }: RecipientImportProps) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const remaining = Math.max(0, limit - value.length);

  function merge(result: RecipientParseResult) {
    const existing = new Set(value.map((r) => r.email));
    const fresh = result.rows.filter((r) => !existing.has(r.email));
    const accepted = fresh.slice(0, remaining);
    const totalStats = [
      t("emailSender.statsTotal", { count: result.stats.input }),
      t("emailSender.statsValid", { count: result.stats.valid }),
      t("emailSender.statsInvalid", { count: result.stats.invalid }),
      t("emailSender.statsDuplicates", { count: result.stats.duplicatesRemoved }),
    ].join(" · ");
    const overflow = fresh.length - accepted.length;
    const parts: string[] = [totalStats];
    if (overflow > 0) parts.push(t("emailSender.overflowIgnored", { count: overflow, limit }));
    setNotice(parts.join(" · "));
    if (result.notice) {
      setNotice((n) => (n ? `${n} ${result.notice ?? ""}` : (result.notice ?? null)));
    }
    onChange([...value, ...accepted]);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    setBusy(true);
    try {
      const result = await parseRecipientFile(file);
      merge(result);
    } catch {
      setFileError(t("emailSender.fileError"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handlePaste() {
    setError(null);
    const result = parsePastedText(pasteText);
    if (result.stats.input === 0) {
      setError(t("emailSender.noInput"));
      return;
    }
    merge(result);
    setPasteText("");
  }

  function updateRow(index: number, patch: Partial<DraftRecipient>) {
    onChange(
      value.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (patch.email !== undefined) {
          next.email = patch.email;
          next.status = normalizeEmail(patch.email) ? "valid" : "invalid";
        }
        return next;
      })
    );
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {/* Upload + paste */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-dashed border-border p-4">
          <Label>{t("emailSender.importFile")}</Label>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("emailSender.pdfNote")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            loading={busy}
          >
            <Upload className="h-4 w-4" /> {t("emailSender.chooseFile")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.pdf,text/plain,text/csv,application/pdf"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          {fileError && <p className="mt-2 text-xs text-red-600">{fileError}</p>}
        </div>

        <div className="rounded-lg border border-border p-4">
          <Label htmlFor="recipient-paste">{t("emailSender.pasteAddresses")}</Label>
          <Textarea
            id="recipient-paste"
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={t("emailSender.pastePh")}
            className="mb-2"
          />
          <Button type="button" variant="outline" size="sm" onClick={handlePaste} disabled={!pasteText.trim()}>
            <Plus className="h-4 w-4" /> {t("emailSender.apply")}
          </Button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>

      {/* Stats */}
      {(notice || value.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          {notice && <span className="text-muted-foreground">{notice}</span>}
          {value.length > 0 && (
            <Badge variant="secondary">{t("emailSender.recipientsCount", { count: value.length, free: remaining })}</Badge>
          )}
        </div>
      )}

      {/* Editable recipient table */}
      {value.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("emailSender.email")}</th>
                <th className="px-3 py-2 font-medium">{t("emailSender.company")}</th>
                <th className="px-3 py-2 font-medium">{t("emailSender.contact")}</th>
                <th className="px-3 py-2 font-medium">{t("emailSender.status")}</th>
                <th className="px-3 py-2" aria-label={t("emailSender.actionAria")} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {value.map((row, index) => (
                <tr key={`${row.email}-${index}`}>
                  <td className="px-3 py-1.5">
                    <Input
                      value={row.email}
                      onChange={(e) => updateRow(index, { email: e.target.value })}
                      className={`h-8 text-xs ${row.status === "invalid" ? "border-red-300" : ""}`}
                      aria-label={t("emailSender.emailAria")}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={row.company}
                      onChange={(e) => updateRow(index, { company: e.target.value })}
                      className="h-8 text-xs"
                      aria-label={t("emailSender.company")}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={row.contact_name}
                      onChange={(e) => updateRow(index, { contact_name: e.target.value })}
                      className="h-8 text-xs"
                      aria-label={t("emailSender.contactAria")}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    {row.status === "valid" ? (
                      <Badge variant="success">{t("emailSender.valid")}</Badge>
                    ) : (
                      <Badge variant="destructive">{t("emailSender.invalid")}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={t("emailSender.removeAria", { email: row.email })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {value.length === 0 && !notice && (
        <Alert variant="info">
          {t("emailSender.emptyRecipientsHint")}
        </Alert>
      )}
    </div>
  );
}
