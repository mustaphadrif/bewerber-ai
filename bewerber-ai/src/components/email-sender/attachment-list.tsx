"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, UploadCloud, Loader2 } from "lucide-react";
import type { AttachmentMeta } from "@/lib/email/types";

interface AttachmentListProps {
  value: AttachmentMeta[];
  onChange: (attachments: AttachmentMeta[]) => void;
}

const ALLOWED_TYPES: Array<{ ext: string; mime: string }> = [
  { ext: "pdf", mime: "application/pdf" },
  { ext: "doc", mime: "application/msword" },
  { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { ext: "jpg", mime: "image/jpeg" },
  { ext: "jpeg", mime: "image/jpeg" },
  { ext: "png", mime: "image/png" },
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_SIZE = 18 * 1024 * 1024; // 18 MB (Gmail 25 MB message limit)
const MAX_FILES = 5;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowed(name: string, mime: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_TYPES.some((t) => t.ext === ext && (t.mime === mime || (mime === "" && ext === t.ext)));
}

/**
 * Attachment list with real server upload: file bytes are stored server-side
 * only (email_attachments); the browser keeps metadata incl. the storage id.
 * Upload state is shown truthfully (uploading → uploaded / error).
 */
export function AttachmentList({ value, onChange }: AttachmentListProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;
    setError(null);

    const picked = Array.from(files);
    const problems: string[] = [];
    const valid: File[] = [];
    const currentTotal = value.reduce((sum, a) => sum + a.size, 0);
    let total = currentTotal;

    for (const file of picked) {
      if (!isAllowed(file.name, file.type)) {
        problems.push(`${file.name} (nicht unterstützt)`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        problems.push(`${file.name} (größer als 10 MB)`);
        continue;
      }
      if (value.length + valid.length >= MAX_FILES) {
        problems.push(`maximal ${MAX_FILES} Anhänge`);
        break;
      }
      if (total + file.size > MAX_TOTAL_SIZE) {
        problems.push(`${file.name} (Gesamtgröße > 18 MB)`);
        continue;
      }
      total += file.size;
      valid.push(file);
    }

    if (valid.length === 0) {
      if (problems.length > 0) setError(`Nicht hinzugefügt: ${problems.join(", ")}.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    // Upload bytes to the server (they never touch localStorage).
    const form = new FormData();
    for (const file of valid) form.append("files", file);
    setUploading(true);
    try {
      const response = await fetch("/api/email-sender/attachments", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as
        | { ok: true; attachments: Array<{ storage_id: string; name: string; size: number; type: string }> }
        | { ok: false; error?: string }
        | null;
      if (!response.ok || !body || !body.ok || !("attachments" in body)) {
        setError((body && "error" in body && body.error) || "Upload fehlgeschlagen.");
        return;
      }
      const next = body.attachments.map((a) => ({
        name: a.name,
        size: a.size,
        type: a.type,
        storage_id: a.storage_id,
      }));
      onChange([...value, ...next]);
    } catch {
      setError("Upload fehlgeschlagen (Netzwerk). Bitte erneut versuchen.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || value.length >= MAX_FILES}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {uploading ? "Wird hochgeladen…" : "Anhänge hinzufügen"}
        </Button>
        {uploading && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <UploadCloud className="h-3.5 w-3.5" /> Dateien werden serverseitig gespeichert…
          </span>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Erlaubt: PDF, DOC, DOCX, JPG, JPEG, PNG (max. 10 MB je Datei, zusammen max. 18 MB, {MAX_FILES} insgesamt).
        Die Dateien werden beim Hinzufügen sicher auf dem Server gespeichert und beim Versand vom Server-Worker an
        Gmail angehängt — im Browser bleiben nur Metadaten.
      </p>
      {value.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {value.map((a, index) => (
            <li key={`${a.name}-${index}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-slate-800">{a.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatSize(a.size)}</span>
              {a.storage_id ? (
                <span className="shrink-0 text-xs text-emerald-700">gespeichert</span>
              ) : (
                <span className="shrink-0 text-xs text-amber-700">nicht hochgeladen</span>
              )}
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={`${a.name} entfernen`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
