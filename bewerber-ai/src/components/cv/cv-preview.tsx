import type { CvData, CvEntry, CvOptions } from "@/lib/cv";
import { entryPeriod } from "@/lib/cv";
import { Calendar, Mail, MapPin, Phone } from "lucide-react";

/**
 * Live CV preview — a pure function of the editable CV data + options.
 * The reference template mirrors the generated PDF (A4, narrow margins,
 * circular photo top-right, thin black rules, exact section order).
 * Rendered with inline styles; print CSS paginates to A4 with natural breaks.
 */
export function CvPreview({ data, options }: { data: CvData; options: CvOptions }) {
  const { template, fontSize, accentColor } = options;
  const accent = { color: accentColor };

  if (template === "referenz") {
    return <ReferenzPreview data={data} options={options} />;
  }

  if (template === "modern") {
    return (
      <div className="cv-paper flex overflow-hidden rounded-lg bg-white text-left shadow-inner" style={{ fontSize }}>
        <aside className="w-[34%] shrink-0 px-6 py-8 text-white" style={{ background: accentColor }}>
          <SidebarBlock title="Kontakt" items={contactLines(data)} />
          <SidebarBlock title="Fähigkeiten" items={data.skills.slice(0, 10).map((s) => s.name)} />
          <SidebarBlock title="Sprachen" items={data.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name))} />
        </aside>
        <div className="flex-1 px-7 py-8">
          <h1 className="text-2xl font-bold" style={{ color: accentColor }}>{data.fullName}</h1>
          {data.headline && <p className="mt-0.5 text-sm font-medium text-slate-500">{data.headline}</p>}
          {data.about && <p className="mt-3 text-[0.92em] leading-relaxed text-slate-600">{data.about}</p>}
          <Section title={data.experience.title} accent={accent}>
            {data.experience.items.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </Section>
          <Section title={data.internships.title} accent={accent}>
            {data.internships.items.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </Section>
          <Section title={data.education.title} accent={accent}>
            {data.education.items.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </Section>
        </div>
      </div>
    );
  }

  const centered = template === "klassisch";
  return (
    <div className="cv-paper rounded-lg bg-white px-10 py-10 text-left shadow-inner" style={{ fontSize }}>
      <header className={centered ? "text-center" : ""}>
        <h1 className="text-2xl font-bold text-slate-900">{data.fullName}</h1>
        {data.headline && (
          <p className="mt-1 text-sm font-medium" style={accent}>{data.headline}</p>
        )}
        <p className="mt-2 text-[0.88em] text-slate-500">{contactLines(data).join(" · ")}</p>
      </header>

      {template === "klassisch" && <div className="mx-auto mt-4 h-px w-24" style={{ background: accentColor }} />}

      {data.about && (
        <section className="mt-5">
          <h2 className="mb-1.5 text-[1.05em] font-semibold uppercase tracking-wide" style={accent}>Profil</h2>
          <p className="text-[0.92em] leading-relaxed text-slate-600">{data.about}</p>
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-[1.05em] font-semibold uppercase tracking-wide" style={accent}>{data.experience.title}</h2>
        {data.experience.items.length === 0 && <EmptyLine />}
        {data.experience.items.map((e) => (
          <Entry key={e.id} e={e} />
        ))}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-[1.05em] font-semibold uppercase tracking-wide" style={accent}>{data.internships.title}</h2>
        {data.internships.items.length === 0 && <EmptyLine />}
        {data.internships.items.map((e) => (
          <Entry key={e.id} e={e} />
        ))}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-[1.05em] font-semibold uppercase tracking-wide" style={accent}>{data.education.title}</h2>
        {data.education.items.length === 0 && <EmptyLine />}
        {data.education.items.map((e) => (
          <Entry key={e.id} e={e} />
        ))}
      </section>

      {(data.skills.length > 0 || data.languages.length > 0) && (
        <section className="mt-5">
          <h2 className="mb-2 text-[1.05em] font-semibold uppercase tracking-wide" style={accent}>Fähigkeiten & Sprachen</h2>
          <p className="text-[0.92em] text-slate-700">
            {data.skills.map((s) => s.name).join(", ")}
            {data.skills.length > 0 && data.languages.length > 0 ? " · " : ""}
            {data.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(", ")}
          </p>
        </section>
      )}
    </div>
  );
}

/* ── Reference template preview ────────────────────────────────────────────── */

function ReferenzPreview({ data, options }: { data: CvData; options: CvOptions }) {
  const showPhoto = options.includePhoto && Boolean(data.photoDataUrl);
  const contact: { icon: "mail" | "phone" | "pin" | "calendar"; text: string }[] = [];
  if (data.contact.email) contact.push({ icon: "mail", text: data.contact.email });
  if (data.contact.phone) contact.push({ icon: "phone", text: data.contact.phone });
  if (data.location) contact.push({ icon: "pin", text: data.location });
  if (data.birthDate) contact.push({ icon: "calendar", text: data.birthDate });

  return (
    <div className="cv-referenz cv-sheet cv-print-root relative mx-auto rounded-lg bg-white px-[11mm] py-[11mm] text-left text-[#111827] shadow-inner">
      <style>{REFERENZ_PRINT_CSS}</style>

      {/* Header: name/title left, circular photo right */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-[#111827]">{data.fullName || "Name Vorname"}</h1>
          {data.headline && (
            <p className="mt-1 text-[12px] font-semibold text-[#111827]">{data.headline}</p>
          )}
        </div>
        {showPhoto ? (
          <img
            src={data.photoDataUrl as string}
            alt="Bewerbungsfoto"
            className="cv-photo h-[30mm] w-[30mm] shrink-0 rounded-full border border-slate-200 object-cover"
          />
        ) : null}
      </header>

      {/* Contact row with icons */}
      {contact.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[10.5px] text-[#111827]">
          {contact.map((c) => (
            <span key={c.icon + c.text} className="flex items-center gap-1.5">
              <ContactIcon kind={c.icon} />
              <span>{c.text}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3.5 border-t-2 border-[#111827]" />

      {data.about.trim() && (
        <section className="cv-avoid mt-4">
          <SectionTitle>Profil</SectionTitle>
          <p className="mt-1 whitespace-pre-line text-[10.5px] leading-relaxed text-[#111827]">{data.about}</p>
        </section>
      )}

      <SectionBlock title={data.experience.title} items={data.experience.items} />
      <SectionBlock title={data.internships.title} items={data.internships.items} />
      <SectionBlock title={data.education.title} items={data.education.items} />

      {/* Kenntnisse – two columns */}
      <section className="cv-avoid mt-4">
        <SectionTitle>Kenntnisse</SectionTitle>
        {data.skills.length === 0 ? (
          <EmptyLine />
        ) : (
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] font-semibold text-[#111827]">
            {data.skills.map((s) => (
              <span key={s.name} className="flex gap-1.5">
                <span aria-hidden>•</span>
                <span>{s.name}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Sprachen – three columns */}
      <section className="cv-avoid mt-4">
        <SectionTitle>Sprachen</SectionTitle>
        {data.languages.length === 0 ? (
          <EmptyLine />
        ) : (
          <div className="mt-1 grid grid-cols-3 gap-x-4 gap-y-1 text-[10.5px] text-[#111827]">
            {data.languages.map((l) => (
              <span key={l.name} className="flex gap-1.5">
                <span aria-hidden>•</span>
                <span>{l.level ? `${l.name}: ${l.level}` : l.name}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionBlock({ title, items }: { title: string; items: CvEntry[] }) {
  return (
    <section className="cv-avoid mt-4">
      <SectionTitle>{title}</SectionTitle>
      {items.length === 0 ? (
        <EmptyLine />
      ) : (
        <div className="mt-1 space-y-3">
          {items.map((e) => (
            <Entry key={e.id} e={e} />
          ))}
        </div>
      )}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11.5px] font-bold uppercase tracking-wide text-[#111827]">{children}</h2>;
}

function Entry({ e }: { e: CvEntry }) {
  const period = entryPeriod(e);
  return (
    <div className="cv-avoid-break">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-bold text-[#111827]">{e.role || e.company}</span>
        {(period || e.location) && (
          <span className="shrink-0 text-right text-[9.5px] text-[#111827]">
            {period}
            {period && e.location ? <br /> : " "}
            {e.location}
          </span>
        )}
      </div>
      {e.company && e.company !== e.role && (
        <div className="text-[10px] italic text-[#334155]">{e.company}</div>
      )}
      {e.description.trim() && (
        <ul className="mt-0.5 space-y-0.5 text-[10.5px] leading-relaxed text-[#111827]">
          {e.description.split("\n").map((line, i) =>
            line.trim() ? (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden>•</span>
                <span>{line.trim()}</span>
              </li>
            ) : null
          )}
        </ul>
      )}
    </div>
  );
}

function ContactIcon({ kind }: { kind: "mail" | "phone" | "pin" | "calendar" }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (kind === "mail") return <Mail className={cls} aria-hidden />;
  if (kind === "phone") return <Phone className={cls} aria-hidden />;
  if (kind === "pin") return <MapPin className={cls} aria-hidden />;
  return <Calendar className={cls} aria-hidden />;
}

/* ── Shared helpers for the legacy templates ───────────────────────────────── */

function contactLines(data: CvData): string[] {
  return [data.contact.email, data.contact.phone, data.location].filter(Boolean) as string[];
}

function SidebarBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-[0.85em] font-semibold uppercase tracking-widest opacity-90">{title}</h3>
      <ul className="space-y-1 text-[0.85em] leading-snug opacity-90">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent: { color: string }; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-[1.05em] font-semibold uppercase tracking-wide" style={accent}>{title}</h2>
      {children}
    </section>
  );
}

function EmptyLine() {
  return <p className="mt-1 text-[10px] italic text-slate-400">Noch keine Einträge.</p>;
}

/* ── Print styles: A4 pagination, breaks only when content needs them ─────── */

const REFERENZ_PRINT_CSS = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { background: #fff !important; }
  .cv-print-root { box-shadow: none !important; border-radius: 0 !important; width: 210mm; min-height: 296mm; }
  .cv-avoid { break-inside: avoid; }
  .cv-avoid-break { break-inside: avoid; }
  .cv-photo { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
