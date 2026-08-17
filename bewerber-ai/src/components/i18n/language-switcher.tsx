"use client";

/**
 * Accessible language switcher.
 * - Listbox pattern: trigger button (aria-haspopup, aria-expanded) + option
 *   buttons with aria-selected; full keyboard support (arrows, Home/End,
 *   Escape); closes on outside click / Escape / selection.
 * - Persists via useI18n().setLocale (localStorage + cookie).
 */
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { LOCALE_OPTIONS, LOCALES, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = LOCALE_OPTIONS[locale];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function select(next: Locale) {
    setLocale(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((v) => {
        const next = !v;
        if (next) setActiveIndex(Math.max(0, LOCALES.indexOf(locale)));
        return next;
      });
    }
  }

  function onOptionKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(LOCALES.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(LOCALES.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(LOCALES[index]);
    }
  }

  const focusedIndex = open ? activeIndex : -1;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language.current", { name: current.native })}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          compact ? "h-8" : "h-9"
        }`}
      >
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline">{current.native}</span>
        <span className="sm:hidden">{current.short}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("language.label")}
          className="absolute end-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {LOCALES.map((code, index) => {
            const option = LOCALE_OPTIONS[code];
            const selected = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={focusedIndex === index ? 0 : -1}
                ref={(el) => {
                  if (focusedIndex === index) el?.focus();
                }}
                onClick={() => select(code)}
                onKeyDown={(e) => onOptionKeyDown(e, index)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selected ? "bg-primary/10 font-medium text-primary" : "text-slate-700 hover:bg-muted"
                }`}
              >
                <span className="flex-1">{option.native}</span>
                {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
