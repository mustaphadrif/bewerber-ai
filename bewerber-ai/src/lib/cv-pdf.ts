import { jsPDF } from "jspdf";
import type { CvData, CvEntry, CvOptions } from "@/lib/cv";
import { entryPeriod } from "@/lib/cv";

/**
 * Client-side PDF export of the CV.
 * All text is rendered as vector text (selectable) – no canvas for text.
 * The reference template ("referenz") is the default/main layout:
 * white A4, narrow margins, black typography, circular photo top-right,
 * section order PROFIL → BERUFSERFAHRUNG → PRAKTIKUM → SCHULBILDUNG →
 * KENNTNISSE → SPRACHEN.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TEXT_COLOR: [number, number, number] = [17, 24, 39]; // #111827
const MUTED_COLOR: [number, number, number] = [51, 65, 85]; // #334155

async function loadImageDataUrl(src: string): Promise<string | null> {
  try {
    if (src.startsWith("data:")) return src;
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Crop a square, centered circular PNG from any supported image source. */
async function circularPhotoDataUrl(src: string): Promise<string | null> {
  const raw = await loadImageDataUrl(src);
  if (!raw) return null;
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img load failed"));
      img.src = raw;
    });
    const size = Math.min(img.width, img.height);
    if (size <= 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, (img.width - size) / -2, (img.height - size) / -2);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function exportCvPdf(data: CvData, options: CvOptions): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const baseSize = options.fontSize;

  if (options.template === "referenz") {
    await renderReferenz(doc, data, baseSize, options);
  } else if (options.template === "modern") {
    renderModern(doc, data, baseSize, options);
  } else {
    renderClassic(doc, data, baseSize, options);
  }

  const fileName = `${(data.fullName || "Lebenslauf").replace(/\s+/g, "_")}_Lebenslauf.pdf`;
  doc.save(fileName);
}

/* ── Reference template (default) ─────────────────────────────────────────── */

async function renderReferenz(doc: jsPDF, data: CvData, baseSize: number, options: CvOptions): Promise<void> {
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const wrap = (str: string, size: number, maxW = CONTENT_W): string[] =>
    doc.splitTextToSize(str, maxW) as string[];

  const bulletLines = (description: string): string[] =>
    description
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  const emptyLine = () => {
    ensureSpace(8);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Noch keine Einträge.", MARGIN, y);
    y += 6;
  };

  // Photo (circular, top-right)
  const showPhoto = options.includePhoto && Boolean(data.photoDataUrl);
  const photoD = 30;
  let photo: string | null = null;
  if (showPhoto) {
    photo = await circularPhotoDataUrl(data.photoDataUrl as string);
  }
  const rightBound = showPhoto ? PAGE_W - MARGIN - photoD - 6 : PAGE_W - MARGIN;

  // ── Header ──
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const nameLines = wrap(data.fullName || "Name Vorname", 20, rightBound - MARGIN);
  for (const line of nameLines) {
    doc.text(line, MARGIN, y + 7);
    y += 8.5;
  }
  y += 1.5;

  if (data.headline) {
    doc.setFontSize(11);
    const headLines = wrap(data.headline, 11, rightBound - MARGIN);
    for (const line of headLines) {
      doc.text(line, MARGIN, y);
      y += 5.4;
    }
    y += 1.2;
  }

  // Contact row with icons (email, phone, location, birth date)
  const contactItems: { icon: "mail" | "phone" | "pin" | "calendar"; text: string }[] = [];
  if (data.contact.email) contactItems.push({ icon: "mail", text: data.contact.email });
  if (data.contact.phone) contactItems.push({ icon: "phone", text: data.contact.phone });
  if (data.location) contactItems.push({ icon: "pin", text: data.location });
  if (data.birthDate) contactItems.push({ icon: "calendar", text: data.birthDate });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  if (contactItems.length > 0) {
    const iconW = 4;
    const gap = 7;
    let x = MARGIN;
    let lineTop = y - 1.5;
    for (const item of contactItems) {
      const textW = doc.getTextWidth(item.text);
      const blockW = iconW + 1.5 + textW;
      if (x + blockW > rightBound && x > MARGIN) {
        lineTop += 5.8;
        x = MARGIN;
      }
      drawIcon(doc, item.icon, x, lineTop - 1.6, iconW);
      doc.text(item.text, x + iconW + 1.5, lineTop);
      x += blockW + gap;
    }
    y = lineTop + 6;
  }

  if (showPhoto && photo) {
    doc.addImage(photo, "PNG", PAGE_W - MARGIN - photoD, MARGIN + 2, photoD, photoD, undefined, "FAST");
  } else if (showPhoto && !photo) {
    doc.setDrawColor(...TEXT_COLOR);
    doc.setLineWidth(0.4);
    doc.circle(PAGE_W - MARGIN - photoD / 2, MARGIN + 2 + photoD / 2, photoD / 2, "S");
  }

  // Thin rule below the header
  ensureSpace(8);
  y += 1.5;
  doc.setDrawColor(...TEXT_COLOR);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  const section = (title: string) => {
    ensureSpace(18);
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 1.8;
    doc.setDrawColor(...TEXT_COLOR);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4.5;
  };

  const bodyText = (text: string, indent = 0) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_COLOR);
    const lines = wrap(text, 9.5, CONTENT_W - indent);
    for (const line of lines) {
      ensureSpace(4.6);
      doc.text(line, MARGIN + indent, y);
      y += 4.4;
    }
  };

  const entry = (e: CvEntry) => {
    const period = entryPeriod(e);
    const loc = e.location.trim();
    const rightLines = [period, loc].filter(Boolean);
    const bullets = bulletLines(e.description);
    const roleLines = wrap(e.role || e.company, 10, CONTENT_W * 0.62);
    const companyLines =
      e.company && e.company !== e.role ? wrap(e.company, 9.3, CONTENT_W * 0.62) : [];
    const bulletLineCount = bullets.reduce(
      (acc, b) => acc + Math.max(1, Math.ceil(b.length / 52)),
      0
    );
    const needed =
      roleLines.length * 4.8 +
      companyLines.length * 4.4 +
      Math.max(rightLines.length * 4.4 - 1.5, 0) +
      bulletLineCount * 4.4 +
      5;
    ensureSpace(needed);

    // Left: role (bold), right: period + location (right aligned)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_COLOR);
    let roleY = y;
    for (const line of roleLines) {
      doc.text(line, MARGIN, roleY);
      roleY += 4.8;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let rightY = y;
    for (const rl of rightLines) {
      doc.text(rl, PAGE_W - MARGIN, rightY, { align: "right" });
      rightY += 4.2;
    }
    y = Math.max(roleY - 1, rightY - 4.2 + 1);

    // Company (italic subtitle)
    if (companyLines.length > 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9.3);
      doc.setTextColor(...MUTED_COLOR);
      for (const line of companyLines) {
        doc.text(line, MARGIN, y);
        y += 4.4;
      }
    }

    // Bullets
    if (bullets.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...TEXT_COLOR);
      for (const b of bullets) {
        const lines = wrap(`•  ${b}`, 9.5, CONTENT_W - 4);
        for (const line of lines) {
          ensureSpace(4.6);
          doc.text(line, MARGIN + 4, y);
          y += 4.4;
        }
      }
    }
    y += 3;
  };

  // PROFIL
  if (data.about.trim()) {
    section("Profil");
    bodyText(data.about.trim());
    y += 2;
  }

  // BERUFSERFAHRUNG
  section(data.experience.title);
  if (data.experience.items.length === 0) emptyLine();
  for (const e of data.experience.items) entry(e);

  // PRAKTIKUM
  section(data.internships.title);
  if (data.internships.items.length === 0) emptyLine();
  for (const e of data.internships.items) entry(e);

  // SCHULBILDUNG
  section(data.education.title);
  if (data.education.items.length === 0) emptyLine();
  for (const e of data.education.items) entry(e);

  // KENNTNISSE – two columns
  section("Kenntnisse");
  if (data.skills.length === 0) {
    emptyLine();
  } else {
    y += renderGrid(doc, data.skills.map((s) => s.name), 2, ensureSpace, y);
  }

  // SPRACHEN – three columns
  section("Sprachen");
  if (data.languages.length === 0) {
    emptyLine();
  } else {
    y += renderGrid(
      doc,
      data.languages.map((l) => (l.level ? `${l.name}: ${l.level}` : l.name)),
      3,
      ensureSpace,
      y
    );
  }

  void baseSize;
}

/** Row-major grid renderer; returns the height consumed in mm. */
function renderGrid(
  doc: jsPDF,
  items: string[],
  cols: number,
  ensureSpace: (needed: number) => void,
  startY: number
): number {
  const colGap = 6;
  const colW = (CONTENT_W - colGap * (cols - 1)) / cols;
  const rows = Math.ceil(items.length / cols);

  // Pre-compute wrapped lines per item (row-major), track max lines per row.
  const linesPerItem: string[][] = items.map((name) => doc.splitTextToSize(`•  ${name}`, colW - 1) as string[]);
  const rowHeights: number[] = new Array(rows).fill(1);
  items.forEach((_, i) => {
    const row = Math.floor(i / cols);
    rowHeights[row] = Math.max(rowHeights[row], linesPerItem[i].length);
  });
  const totalH = rowHeights.reduce((acc, h) => acc + h * 4.4 + 1.5, 0) + 2;
  ensureSpace(totalH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT_COLOR);
  let ry = startY;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (i >= items.length) break;
      const x = MARGIN + col * (colW + colGap);
      linesPerItem[i].forEach((line, li) => {
        doc.text(line, x, ry + li * 4.4);
      });
    }
    ry += rowHeights[row] * 4.4 + 1.5;
  }
  return totalH;
}

/** Minimal vector icons for the contact row (drawing only – text stays selectable). */
function drawIcon(
  doc: jsPDF,
  kind: "mail" | "phone" | "pin" | "calendar",
  x: number,
  y: number,
  size: number
): void {
  doc.setDrawColor(...TEXT_COLOR);
  doc.setLineWidth(0.35);
  const s = size;
  if (kind === "mail") {
    doc.rect(x, y, s, s * 0.72, "S");
    doc.line(x, y, x + s / 2, y + s * 0.42);
    doc.line(x + s, y, x + s / 2, y + s * 0.42);
  } else if (kind === "phone") {
    doc.setLineWidth(0.45);
    doc.line(x + s * 0.18, y + s * 0.1, x + s * 0.82, y + s * 0.9);
    doc.line(x + s * 0.82, y + s * 0.1, x + s * 0.18, y + s * 0.9);
    doc.circle(x + s * 0.18, y + s * 0.1, s * 0.16, "S");
    doc.circle(x + s * 0.82, y + s * 0.9, s * 0.16, "S");
  } else if (kind === "pin") {
    doc.circle(x + s / 2, y + s * 0.34, s * 0.26, "S");
    doc.setLineWidth(0.5);
    doc.line(x + s / 2, y + s * 0.55, x + s / 2, y + s * 0.95);
  } else {
    // calendar
    doc.rect(x, y + s * 0.15, s, s * 0.85, "S");
    doc.line(x + s * 0.12, y, x + s * 0.12, y + s * 0.35);
    doc.line(x + s * 0.88, y, x + s * 0.88, y + s * 0.35);
    doc.line(x + s * 0.05, y + s * 0.48, x + s * 0.95, y + s * 0.48);
  }
}

/* ── Legacy variants (klar / klassisch / modern) ───────────────────────────── */

function renderModern(doc: jsPDF, data: CvData, baseSize: number, options: CvOptions): void {
  const accent = options.accentColor;
  const sidebarW = 62;
  const sidebarX = MARGIN;
  const mainX = MARGIN + sidebarW + 8;
  const mainW = CONTENT_W - sidebarW - 8;
  let y = 24;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setFillColor(accent);
  doc.rect(0, 0, sidebarW, PAGE_H, "F");

  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(baseSize + 1);
  doc.text("KONTAKT", sidebarX, y);
  y += 4;
  doc.setFontSize(baseSize - 1.5);
  doc.setFont("helvetica", "normal");
  const contactLines = [data.contact.email, data.contact.phone, data.location].filter(Boolean) as string[];
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
  addSidebarBlock("Sprachen", data.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)));

  y = 24;
  doc.setTextColor("#0f172a");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(baseSize + 5);
  doc.text(data.fullName, mainX, y);
  y += 7;
  if (data.headline) {
    doc.setTextColor(accent);
    doc.setFontSize(baseSize - 0.5);
    doc.text(data.headline, mainX, y);
    y += 5;
  }
  doc.setTextColor("#475569");
  doc.setFont("helvetica", "normal");
  if (data.about) {
    doc.setFontSize(baseSize - 1);
    const lines = doc.splitTextToSize(data.about, mainW) as string[];
    for (const line of lines) {
      doc.text(line, mainX, y);
      y += 4.5;
    }
    y += 2;
  }

  const section = (title: string) => {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(baseSize - 0.5);
    doc.setTextColor(accent);
    doc.text(title.toUpperCase(), mainX, y);
    y += 2;
    doc.setTextColor("#0f172a");
  };

  const entry = (e: CvEntry) => {
    ensureSpace(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(baseSize);
    doc.setTextColor("#0f172a");
    const roleLines = doc.splitTextToSize(e.role || e.company, mainW - 40) as string[];
    for (const line of roleLines) {
      doc.text(line, mainX, y);
      y += 4.5;
    }
    const range = entryPeriod(e);
    if (range) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(baseSize - 1.5);
      doc.setTextColor("#94a3b8");
      const rw = doc.getTextWidth(range);
      doc.text(range, mainX + mainW - rw, y - roleLines.length * 4.5 + 0.5);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(baseSize - 1);
    doc.setTextColor("#475569");
    doc.text(e.company, mainX, y);
    y += 4.5;
    const bullets = e.description
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const b of bullets) {
      const lines = doc.splitTextToSize(`• ${b}`, mainW) as string[];
      for (const line of lines) {
        doc.text(line, mainX, y);
        y += 4.2;
      }
    }
    y += 1.5;
  };

  section(data.experience.title);
  for (const e of data.experience.items) entry(e);
  section(data.internships.title);
  for (const e of data.internships.items) entry(e);
  section(data.education.title);
  for (const e of data.education.items) entry(e);
}

function renderClassic(doc: jsPDF, data: CvData, baseSize: number, options: CvOptions): void {
  const accent = options.accentColor;
  let y = 26;
  const centered = options.template === "klassisch";

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setTextColor("#0f172a");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(baseSize + 5);
  if (centered) doc.text(data.fullName, PAGE_W / 2, y, { align: "center" });
  else doc.text(data.fullName, MARGIN, y);
  y += 8;
  if (data.headline) {
    doc.setTextColor(accent);
    doc.setFontSize(baseSize - 0.5);
    if (centered) doc.text(data.headline, PAGE_W / 2, y, { align: "center" });
    else doc.text(data.headline, MARGIN, y);
    y += 6;
  }
  doc.setTextColor("#64748b");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(baseSize - 2);
  const contact = [data.contact.email, data.contact.phone, data.location].filter(Boolean).join(" · ");
  if (contact) {
    if (centered) doc.text(contact, PAGE_W / 2, y, { align: "center" });
    else doc.text(contact, MARGIN, y);
    y += 5;
  }
  if (centered) {
    doc.setDrawColor(accent);
    doc.setLineWidth(0.6);
    doc.line(PAGE_W / 2 - 15, y + 2, PAGE_W / 2 + 15, y + 2);
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
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 2.5;
    doc.setDrawColor(accent);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
    doc.setTextColor("#0f172a");
  };

  const entry = (e: CvEntry) => {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(baseSize);
    doc.setTextColor("#0f172a");
    const roleLines = doc.splitTextToSize(e.role || e.company, CONTENT_W - 45) as string[];
    for (const line of roleLines) {
      doc.text(line, MARGIN, y);
      y += 4.8;
    }
    const range = entryPeriod(e);
    if (range) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(baseSize - 1.5);
      doc.setTextColor("#94a3b8");
      const rw = doc.getTextWidth(range);
      doc.text(range, PAGE_W - MARGIN - rw, y - roleLines.length * 4.8 + 0.5);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(baseSize - 1);
    doc.setTextColor("#475569");
    doc.text(e.company, MARGIN, y);
    y += 4.8;
    const bullets = e.description
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const b of bullets) {
      const lines = doc.splitTextToSize(`• ${b}`, CONTENT_W) as string[];
      for (const line of lines) {
        doc.text(line, MARGIN, y);
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
    const lines = doc.splitTextToSize(data.about, CONTENT_W) as string[];
    for (const line of lines) {
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 2;
  }

  section(data.experience.title);
  for (const e of data.experience.items) entry(e);
  section(data.internships.title);
  for (const e of data.internships.items) entry(e);
  section(data.education.title);
  for (const e of data.education.items) entry(e);

  if (data.skills.length > 0 || data.languages.length > 0) {
    section("Fähigkeiten & Sprachen");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(baseSize - 1);
    doc.setTextColor("#334155");
    const skills = data.skills.map((s) => s.name).join(", ");
    const langs = data.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(", ");
    const combined = [skills, langs].filter(Boolean).join(" · ");
    const lines = doc.splitTextToSize(combined, CONTENT_W) as string[];
    for (const line of lines) {
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
  }
}
