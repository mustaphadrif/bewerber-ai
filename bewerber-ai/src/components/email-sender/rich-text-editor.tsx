"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Link2 } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
}

const TOOLBAR_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-muted hover:text-slate-900 disabled:opacity-40";

/**
 * Safe contenteditable editor with a toolbar for bold / italic / lists / links.
 * Images are supported conceptually via the attachment list (no inline embeds).
 * Personalization variables ({{company}}, {{contact_name}}, {{email}}) can be
 * inserted at the caret position.
 */
export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  // Initialize the DOM once; subsequent updates come from user input only.
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML, el.innerText);
  }

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  function insertVariable(name: string) {
    editorRef.current?.focus();
    document.execCommand("insertText", false, `{{${name}}}`);
    emit();
  }

  function handleLink() {
    if (!linkOpen) {
      setLinkOpen(true);
      return;
    }
    const url = linkUrl.trim();
    if (url) {
      exec("createLink", url.startsWith("http") ? url : `https://${url}`);
    }
    setLinkOpen(false);
    setLinkUrl("");
  }

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-card shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/50">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        <button type="button" className={TOOLBAR_BUTTON} title="Fett" aria-label="Fett" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" className={TOOLBAR_BUTTON} title="Kursiv" aria-label="Kursiv" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" className={TOOLBAR_BUTTON} title="Aufzählung" aria-label="Aufzählungsliste" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
          <List className="h-4 w-4" />
        </button>
        <button type="button" className={TOOLBAR_BUTTON} title="Nummerierte Liste" aria-label="Nummerierte Liste" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="h-4 w-4" />
        </button>
        <button type="button" className={TOOLBAR_BUTTON} title="Link einfügen" aria-label="Link einfügen" onMouseDown={(e) => e.preventDefault()} onClick={handleLink}>
          <Link2 className="h-4 w-4" />
        </button>

        {linkOpen && (
          <span className="flex items-center gap-1 pl-1">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLink();
                if (e.key === "Escape") setLinkOpen(false);
              }}
              placeholder="https://…"
              className="h-8 w-48 rounded-md border border-input bg-card px-2 text-xs"
              autoFocus
            />
            <button type="button" className={TOOLBAR_BUTTON} onClick={handleLink} aria-label="Link bestätigen">
              OK
            </button>
          </span>
        )}

        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Variablen</span>
        {(["company", "contact_name", "email"] as const).map((name) => (
          <button
            key={name}
            type="button"
            className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertVariable(name)}
            title={`{{${name}}} einfügen`}
          >
            {'{{'}
            {name}
            {'}}'}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        className="min-h-[220px] px-4 py-3 text-sm leading-relaxed text-slate-800 focus:outline-none empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/70"
      />
    </div>
  );
}
