import { jsPDF } from "jspdf";
import type { CvData, CvOptions } from "@/lib/cv";
import { formatRange } from "@/lib/cv";

/**
 * Client-side PDF export of the CV. Uses only the verified CvData passed in.
 * A4 layout with a restrained blue accent, mirrors the on-screen preview.
 */
export function exportCvPdf(data: CvData, options: CvOptions): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 20;
  const contentW = pageW - margin * 2;
  const accent = options.accentColor;
  const baseSize = options.fontSize;

  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const wrap = (str: string, size: number, indent = 0): string[] => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(str, contentW - indent) as string[];
    return lines as string[];
  };

  // ── Header ──
  if (options.template === "modern") {
    const sidebarW = 62;
    const sidebarX = margin;
    const mainX = margin + sidebarW + 8;

    // Sidebar background
    doc.setFillColor(accent);
    doc.rect(0, 0, sidebarW, pageH, "F");

    y = 24;
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(baseSize + 1);
    doc.text("KONTAKT", sidebarX, y);
    y += 4;
    doc.setFontSize(baseSize - 1.5);
    doc.setFont("helvetica", "normal");
    const contactLines = [data.contact.email, data.contact.phone, data.contact.city].filter(Boolean) as string[];
    for (const line of contactLines) {
      const parts = doc.splitTextToSize(line, sidebarW - 10) as string[];
      for (const part of parts) {
        doc.text(part, sidebarX, y);
        y += 4.5;
      }
      y += 1.5;
    }

    const addSidebarBlock = (title: string, items: string[]) => {
      if (items.length === 0) return;
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(baseSize - 1.5);
      doc.text(title.toUpperCase(), sidebarX, y);
      y += 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(baseSize - 2.5);
      for (const item of items) {
        const parts = doc.splitTextToSize(item, sidebarW - 10) as string[];
        for (const part of parts) {
          doc.text(part, sidebarX, y);
          y += 4;
        }
      }
    };
    addSidebarBlock("Fähigkeiten", data.skills.slice(0, 10).map((s) => s.name));
    addSidebarBlock("Sprachen", data.languages.map((l) => `${l.name} (${l.level})`));

    // Main column
    y = 24;
    doc.setTextColor("#0f172a");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(baseSize + 5);
    doc.text(data.fullName, mainX, y);
    y += 7;
    if (data.headline) {
      doc.setTextColor(accent);
      doc.setFontSize(baseSize - 0.5);
      doc.setFont("helvetica", "bold");
      doc.text(data.headline, mainX, y);
      y += 5;
    }
    doc.setTextColor("#475569");
    doc.setFont("helvetica", "normal");
    if (data.about) {
      doc.setFontSize(baseSize - 1);
      const lines = wrap(data.about, baseSize - 1) as string[];
      for (const line of lines) {
        doc.text(line, mainX, y);
        y += 4.5;
      }
      y += 2;
    }

    const section = (title: string, size = baseSize - 1) => {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(size + 0.5);
      doc.setTextColor(accent);
      doc.text(title.toUpperCase(), mainX, y);
      y += 2;
      doc.setTextColor("#0f172a");
    };

    const entry = (title: string, subtitle: string, range: string | undefined, text?: string | null) => {
      ensureSpace(18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(baseSize);
      doc.setTextColor("#0f172a");
      doc.text(title, mainX, y);
      if (range) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(baseSize - 1.5);
        doc.setTextColor("#94a3b8");
        const rw = doc.getTextWidth(range);
        doc.text(range, mainX + contentW - sidebarW - 8 - rw, y);
      }
      y += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(baseSize - 1);
      doc.setTextColor("#475569");
      doc.text(subtitle, mainX, y);
      y += 4.5;
      if (text) {
        const lines = wrap(text, baseSize - 1.5) as string[];
        for (const line of lines) {
          doc.text(line, mainX, y);
          y += 4.2;
        }
      }
      y += 1.5;
    };

    section(data.experience.title);
    for (const e of data.experience.items) {
      entry(e.position, `${e.company}${e.location ? ` · ${e.location}` : ""}`, formatRange(e.start_date, e.end_date, e.current), e.description);
    }
    section(data.education.title);
    for (const e of data.education.items) {
      entry(e.degree || "Abschluss", e.institution, e.end_date ? e.end_date.slice(0, 4) : undefined, e.field_of_study);
    }
  } else {
    // klar / klassisch
    y = 26;
    const centered = options.template === "klassisch";
    doc.setTextColor("#0f172a");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(baseSize + 5);
    if (centered) doc.text(data.fullName, pageW / 2, y, { align: "center" });
    else doc.text(data.fullName, margin, y);
    y += 8;
    if (data.headline) {
      doc.setTextColor(accent);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(baseSize - 0.5);
      if (centered) doc.text(data.headline, pageW / 2, y, { align: "center" });
      else doc.text(data.headline, margin, y);
      y += 6;
    }
    doc.setTextColor("#64748b");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(baseSize - 2);
    const contact = [data.contact.email, data.contact.phone, data.contact.city].filter(Boolean).join(" · ");
    if (contact) {
      if (centered) doc.text(contact, pageW / 2, y, { align: "center" });
      else doc.text(contact, margin, y);
      y += 5;
    }
    if (centered) {
      doc.setDrawColor(accent);
      doc.setLineWidth(0.6);
      doc.line(pageW / 2 - 15, y + 2, pageW / 2 + 15, y + 2);
      y += 8;
    } else {
      y += 4;
    }

    const section = (title: string) => {
      ensureSpace(20);
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(baseSize + 0.5);
      doc.setTextColor(accent);
      doc.text(title.toUpperCase(), margin, y);
      y += 2.5;
      doc.setDrawColor(accent);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
      doc.setTextColor("#0f172a");
    };

    const entry = (title: string, subtitle: string, range: string | undefined, text?: string | null) => {
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(baseSize);
      doc.setTextColor("#0f172a");
      doc.text(title, margin, y);
      if (range) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(baseSize - 1.5);
        doc.setTextColor("#94a3b8");
        const rw = doc.getTextWidth(range);
        doc.text(range, pageW - margin - rw, y);
      }
      y += 4.8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(baseSize - 1);
      doc.setTextColor("#475569");
      doc.text(subtitle, margin, y);
      y += 4.8;
      if (text) {
        const lines = wrap(text, baseSize - 1.5) as string[];
        for (const line of lines) {
          doc.text(line, margin, y);
          y += 4.2;
        }
      }
      y += 1.8;
    };

    if (data.about) {
      section("Profil");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(baseSize - 1);
      doc.setTextColor("#475569");
      const lines = wrap(data.about, baseSize - 1) as string[];
      for (const line of lines) {
        doc.text(line, margin, y);
        y += 4.5;
      }
      y += 2;
    }

    section(data.experience.title);
    if (data.experience.items.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(baseSize - 1);
      doc.setTextColor("#94a3b8");
      doc.text("Noch keine Einträge.", margin, y);
      y += 6;
    }
    for (const e of data.experience.items) {
      entry(e.position, `${e.company}${e.location ? ` · ${e.location}` : ""}`, formatRange(e.start_date, e.end_date, e.current), e.description);
    }

    section(data.education.title);
    if (data.education.items.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(baseSize - 1);
      doc.setTextColor("#94a3b8");
      doc.text("Noch keine Einträge.", margin, y);
      y += 6;
    }
    for (const e of data.education.items) {
      entry(e.degree || "Abschluss", e.institution, e.end_date ? e.end_date.slice(0, 4) : undefined, e.field_of_study);
    }

    if (data.skills.length > 0 || data.languages.length > 0) {
      section("Fähigkeiten & Sprachen");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(baseSize - 1);
      doc.setTextColor("#334155");
      const skills = data.skills.map((s) => s.name).join(", ");
      const langs = data.languages.map((l) => `${l.name} (${l.level})`).join(", ");
      const combined = [skills, langs].filter(Boolean).join(" · ");
      const lines = wrap(combined, baseSize - 1) as string[];
      for (const line of lines) {
        doc.text(line, margin, y);
        y += 4.5;
      }
    }
  }

  const fileName = `${data.fullName.replace(/\s+/g, "_")}_Lebenslauf.pdf`;
  doc.save(fileName);
}
