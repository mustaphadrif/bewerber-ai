import type { CvData, CvOptions } from "@/lib/cv";
import { formatRange } from "@/lib/cv";

/**
 * Live CV preview — a pure function of verified profile data + options.
 * Rendered with inline styles so it mirrors the generated PDF.
 */
export function CvPreview({ data, options }: { data: CvData; options: CvOptions }) {
  const { template, fontSize, accentColor } = options;
  const accent = { color: accentColor };

  if (template === "modern") {
    return (
      <div className="cv-paper flex overflow-hidden rounded-lg bg-white text-left shadow-inner" style={{ fontSize }}>
        {/* Sidebar */}
        <aside className="w-[34%] shrink-0 px-6 py-8 text-white" style={{ background: accentColor }}>
          <SidebarBlock title="Kontakt" items={contactLines(data)} />
          <SidebarBlock title="Fähigkeiten" items={data.skills.slice(0, 10).map((s) => s.name)} />
          <SidebarBlock title="Sprachen" items={data.languages.map((l) => `${l.name} (${l.level})`)} />
        </aside>
        {/* Main */}
        <div className="flex-1 px-7 py-8">
          <h1 className="text-2xl font-bold" style={{ color: accentColor }}>{data.fullName}</h1>
          {data.headline && <p className="mt-0.5 text-sm font-medium text-slate-500">{data.headline}</p>}
          {data.about && <p className="mt-3 text-[0.92em] leading-relaxed text-slate-600">{data.about}</p>}
          <Section title={data.experience.title} accent={accent}>
            {data.experience.items.map((e) => (
              <Entry key={e.id} title={e.position} subtitle={`${e.company}${e.location ? ` · ${e.location}` : ""}`} range={formatRange(e.start_date, e.end_date, e.current)} text={e.description} />
            ))}
          </Section>
          <Section title={data.education.title} accent={accent}>
            {data.education.items.map((e) => (
              <Entry key={e.id} title={e.degree || "Abschluss"} subtitle={e.institution} range={e.end_date ? e.end_date.slice(0, 4) : undefined} text={e.field_of_study} />
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
          <Entry key={e.id} title={e.position} subtitle={`${e.company}${e.location ? ` · ${e.location}` : ""}`} range={formatRange(e.start_date, e.end_date, e.current)} text={e.description} />
        ))}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-[1.05em] font-semibold uppercase tracking-wide" style={accent}>{data.education.title}</h2>
        {data.education.items.length === 0 && <EmptyLine />}
        {data.education.items.map((e) => (
          <Entry key={e.id} title={e.degree || "Abschluss"} subtitle={e.institution} range={e.end_date ? e.end_date.slice(0, 4) : undefined} text={e.field_of_study} />
        ))}
      </section>

      {(data.skills.length > 0 || data.languages.length > 0) && (
        <section className="mt-5">
          <h2 className="mb-2 text-[1.05em] font-semibold uppercase tracking-wide" style={accent}>Fähigkeiten & Sprachen</h2>
          <p className="text-[0.92em] text-slate-700">
            {data.skills.map((s) => s.name).join(", ")}
            {data.skills.length > 0 && data.languages.length > 0 ? " · " : ""}
            {data.languages.map((l) => `${l.name} (${l.level})`).join(", ")}
          </p>
        </section>
      )}
    </div>
  );
}

function contactLines(data: CvData): string[] {
  return [data.contact.email, data.contact.phone, data.contact.city].filter(Boolean) as string[];
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

function Entry({ title, subtitle, range, text }: { title: string; subtitle: string; range?: string; text?: string | null }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-slate-800">{title}</span>
        {range && <span className="shrink-0 text-[0.85em] text-slate-400">{range}</span>}
      </div>
      <div className="text-[0.9em] font-medium text-slate-500">{subtitle}</div>
      {text && <p className="mt-0.5 text-[0.9em] leading-relaxed text-slate-600">{text}</p>}
    </div>
  );
}

function EmptyLine() {
  return <p className="text-[0.9em] italic text-slate-400">Noch keine Einträge – ergänze sie im Profil.</p>;
}
