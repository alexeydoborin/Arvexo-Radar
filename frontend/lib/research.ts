import "server-only";

export type ResearchNote = { slug: string; title: string; excerpt: string; url: string };

const SITE = "https://arvexo.ru";
const LIST_URL = `${SITE}/ru/research`;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === "#") {
        const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .trim();
}

/** Extracts published notes from the server-rendered arvexo.ru research page. */
export function parseResearchNotes(html: string): ResearchNote[] {
  const notes: ResearchNote[] = [];
  const card = /<a\b[^>]*class="[^"]*research-note[^"]*"[^>]*href="\/ru\/research\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(card)) {
    const [, slug, inner] = match;
    const title = /<h3[^>]*>([\s\S]*?)<\/h3>/.exec(inner)?.[1];
    if (!title) continue;
    const excerpt = /<p[^>]*>([\s\S]*?)<\/p>/.exec(inner)?.[1] ?? "";
    notes.push({ slug, title: decode(title), excerpt: decode(excerpt), url: `${SITE}/ru/research/${slug}` });
  }
  return notes;
}

/** Latest notes from the main site. Cached for 15 minutes; returns [] if the site is unreachable. */
export async function getLatestResearch(limit = 3): Promise<ResearchNote[]> {
  try {
    const response = await fetch(LIST_URL, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    return parseResearchNotes(await response.text()).slice(0, limit);
  } catch {
    return [];
  }
}
