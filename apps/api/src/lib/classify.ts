import type { AuthorRole, Game, Topic } from "@farseer/shared";

/**
 * Derive a post's game and topics from where it was posted (category + parent
 * category), its thread title and its author. The forum's category tree is the
 * strongest signal ("WoW Classic › The Burning Crusade Classic"); the title is
 * the fallback for generic categories (official news lands in Community).
 */
export type ClassifyInput = {
  category: string;
  parentCategory: string | null;
  title: string;
  role: AuthorRole;
};

const FOREVER = /\bforever\b/i;
const CLASSIC = /\bclassic\b|season of discovery|hardcore|anniversary|\bera\b/i;

export function gameOf({ category, parentCategory, title }: ClassifyInput): Game {
  const where = `${parentCategory ?? ""} ${category}`;
  if (FOREVER.test(where)) return "forever";
  if (CLASSIC.test(where)) return "classic";
  if (FOREVER.test(title)) return "forever";
  if (CLASSIC.test(title)) return "classic";
  return "retail";
}

export function topicsOf({ category, parentCategory, title, role }: ClassifyInput): Topic[] {
  const where = `${parentCategory ?? ""} ${category}`;
  const out = new Set<Topic>();
  if (role === "official") out.add("news");
  if (/hot ?fix/i.test(title)) out.add("hotfix");
  if (/\b(patch|development|dev|release) notes\b/i.test(title)) out.add("patchnotes");
  if (/\bPTR\b|public test|\bbeta\b|\balpha\b|in development/i.test(`${where} ${title}`)) out.add("ptr");
  if (/maintenance|restart|downtime|outage|\boffline\b|login issue|connection issue/i.test(title))
    out.add("maintenance");
  if (/\bbugs?\b|known issues|technical support/i.test(`${where} ${title}`)) out.add("bugs");
  if (/^classes$/i.test(parentCategory ?? "") || /^classes$/i.test(category)) out.add("classes");
  if (out.size === 0) out.add("community");
  return [...out];
}

export function classify(input: ClassifyInput): { game: Game; topics: Topic[] } {
  return { game: gameOf(input), topics: topicsOf(input) };
}
