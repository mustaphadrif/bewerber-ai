"use server";

/**
 * Cover letter generation with an explicit provider boundary.
 *
 * Contract:
 *  - The prompt is built ONLY from verified profile data (server-side, from DB).
 *  - If no AI credential is configured, we REFUSE to invent qualifications and
 *    return a clear error telling the operator to set COVER_LETTER_API_KEY.
 *  - Any OpenAI-compatible chat-completions endpoint can be used.
 */

export interface GenerateCoverLetterInput {
  companyName: string;
  jobTitle: string;
  recipientName?: string | null;
  tone: "professionell" | "motiviert" | "formell";
  keyPoints?: string[];
  companyNotes?: string;
  jobUrl?: string | null;
}

export interface VerifiedProfileForLetter {
  fullName: string;
  headline: string;
  about: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  experience: Array<{ company: string; position: string; start: string | null; end: string | null; current: boolean; description: string | null }>;
  education: Array<{ institution: string; degree: string | null; field: string | null; end: string | null }>;
  skills: string[];
  languages: string[];
}

export type GenerateResult =
  | { ok: true; content: string; model: string }
  | { ok: false; error: string; code: "no-credential" | "provider-error" | "invalid-input" };

export async function generateCoverLetter(
  profile: VerifiedProfileForLetter,
  input: GenerateCoverLetterInput
): Promise<GenerateResult> {
  const apiKey = process.env.COVER_LETTER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      code: "no-credential",
      error:
        "Für die KI-Erstellung des Anschreibens wird ein Anbieter-Schlüssel benötigt. " +
        "Setze COVER_LETTER_API_KEY (und optional COVER_LETTER_API_URL, COVER_LETTER_MODEL) in der Umgebung. " +
        "Bewerber erfindet keine Qualifikationen – ohne Schlüssel wird kein Text generiert.",
    };
  }

  const apiUrl = process.env.COVER_LETTER_API_URL ?? "https://api.openai.com/v1";
  const model = process.env.COVER_LETTER_MODEL ?? "gpt-4o-mini";

  const experienceLines = profile.experience
    .map((e) => {
      const range = [e.start, e.current ? "heute" : e.end].filter(Boolean).join(" – ");
      const desc = e.description ? `: ${e.description}` : "";
      return `- ${e.position} bei ${e.company} (${range})${desc}`;
    })
    .join("\n") || "–";

  const educationLines = profile.education
    .map((e) => `- ${e.degree ?? "Abschluss"}${e.field ? ` in ${e.field}` : ""} an der ${e.institution}${e.end ? ` (${e.end.slice(0, 4)})` : ""}`)
    .join("\n") || "–";

  const system = `Du bist ein professioneller deutschsprachiger Karriere-Coach und Bewerbungsberater. Schreibe ein überzeugendes, ehrliches Anschreiben auf Deutsch. Erfinde KEINE Qualifikationen, Projekte oder Fakten, die nicht in den Nutzerdaten stehen. Verwende nur die bereitgestellten, verifizierten Informationen. Halte dich an maximal 350 Wörter, gliedere in: Anrede, Einleitung, Motivation, Qualifikationen, Abschluss mit Grußformel.`;

  const user = `STELLENANGEBOT:
Unternehmen: ${input.companyName}
Position: ${input.jobTitle}
${input.recipientName ? `Ansprechpartner: ${input.recipientName}` : ""}
${input.jobUrl ? `Stellenausschreibung: ${input.jobUrl}` : ""}
${input.companyNotes ? `Notizen zum Unternehmen: ${input.companyNotes}` : ""}
${input.keyPoints?.length ? `Schwerpunkte der Bewerbung: ${input.keyPoints.join(", ")}` : ""}

VERIFIZIERTES PROFIL DES BEWERBERS:
Name: ${profile.fullName}
Berufsbezeichnung: ${profile.headline || "–"}
Über mich: ${profile.about || "–"}
Stadt: ${profile.city || "–"}
Berufserfahrung:
${experienceLines}
Ausbildung:
${educationLines}
Fähigkeiten: ${profile.skills.join(", ") || "–"}
Sprachen: ${profile.languages.join(", ") || "–"}

Tonfall: ${input.tone}.
Formales Anredeformat: Bei unbekanntem Ansprechpartner verwende "Sehr geehrte Damen und Herren,".`;

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 700,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        code: "provider-error",
        error: `Der KI-Anbieter antwortete mit ${response.status}.${body ? ` Details: ${body.slice(0, 300)}` : ""}`,
      };
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, code: "provider-error", error: "Der KI-Anbieter lieferte eine leere Antwort." };
    }
    return { ok: true, content, model };
  } catch (err) {
    return {
      ok: false,
      code: "provider-error",
      error: `Verbindung zum KI-Anbieter fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
