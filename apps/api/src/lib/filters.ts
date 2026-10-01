import type { AuthorRole, Game, PushFilters, Topic } from "@farseer/shared";
import { GAMES, TOPICS } from "@farseer/shared";

/** What a push filter is evaluated against. */
export type Matchable = {
  game: Game;
  topics: Topic[];
  role: AuthorRole;
  topicTitle: string;
  text: string;
};

/**
 * Does a device want this post? Every non-empty criterion must pass: game AND
 * topic AND (devs-only) AND, if keywords are set, at least one keyword appearing
 * in the title or body (case-insensitive, whole-word prefix match so "mage"
 * doesn't fire on "damage" but "hotfix" catches "hotfixes").
 */
export function matchesFilters(p: Matchable, f: PushFilters): boolean {
  if (f.games.length > 0 && !f.games.includes(p.game)) return false;
  if (f.topics.length > 0 && !p.topics.some((t) => f.topics.includes(t))) return false;
  if (f.devsOnly && p.role !== "developer") return false;
  if (f.keywords.length > 0) {
    const hay = `${p.topicTitle}\n${p.text}`;
    if (!f.keywords.some((k) => keywordRegex(k)?.test(hay))) return false;
  }
  return true;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function keywordRegex(k: string): RegExp | null {
  const kw = k.trim();
  if (!kw) return null;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(kw)}`, "iu");
}

/** Validate untrusted filters from a subscribe request; null if malformed. */
export function parseFilters(v: unknown): PushFilters | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const list = <T extends string>(x: unknown, allowed: readonly T[]): T[] | null =>
    Array.isArray(x) && x.every((i) => allowed.includes(i as T)) ? [...new Set(x as T[])] : null;
  const games = list(o.games ?? [], GAMES);
  const topics = list(o.topics ?? [], TOPICS);
  const kws = o.keywords ?? [];
  if (!games || !topics || !Array.isArray(kws) || !kws.every((k) => typeof k === "string")) return null;
  const keywords = [...new Set((kws as string[]).map((k) => k.trim().slice(0, 40)).filter(Boolean))].slice(0, 30);
  return { games, topics, keywords, devsOnly: o.devsOnly === true, updates: o.updates !== false };
}
