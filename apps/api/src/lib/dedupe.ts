/**
 * US/EU crosspost detection. Community managers post the same announcement on
 * both regional forums (often a few minutes apart, sometimes with the date
 * reworded — "October 1" vs "1 October"), and official news is occasionally
 * posted twice in one region. Two posts are "the same" when they share an author
 * (EU usernames carry a "-1234" suffix), are close in time, and both their
 * thread titles and their text are near-identical as bags of words. The title
 * check matters for templated posts ("PTR Raid Testing: Mythic X" vs "Heroic X")
 * whose bodies are almost the same.
 */

export type DedupeCandidate = {
  username: string;
  createdAt: Date;
  topicTitle: string;
  text: string; // plain text (excerpt or body)
};

const WINDOW_MS = 48 * 3600 * 1000;
const MIN_SIMILARITY = 0.6;
const MIN_TITLE_SIMILARITY = 0.6;

export function normAuthor(u: string): string {
  return u.toLowerCase().replace(/-\d+$/, "");
}

export function words(s: string, max = 80): Set<string> {
  const toks = s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(toks.slice(0, max));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

export function isSamePost(a: DedupeCandidate, b: DedupeCandidate): boolean {
  if (normAuthor(a.username) !== normAuthor(b.username)) return false;
  if (Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) > WINDOW_MS) return false;
  if (jaccard(words(a.topicTitle), words(b.topicTitle)) < MIN_TITLE_SIMILARITY) return false;
  const wa = words(a.text);
  const wb = words(b.text);
  // Tiny replies ("Thanks!", "Fixed.") are too generic to compare loosely.
  if (wa.size < 8 || wb.size < 8) return [...wa].join(" ") === [...wb].join(" ") && wa.size > 0;
  return jaccard(wa, wb) >= MIN_SIMILARITY;
}

/** The first candidate that `post` duplicates, if any. */
export function findDuplicate<T extends DedupeCandidate>(post: DedupeCandidate, candidates: T[]): T | null {
  return candidates.find((c) => isSamePost(post, c)) ?? null;
}
