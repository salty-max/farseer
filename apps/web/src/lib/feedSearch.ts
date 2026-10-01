import { GAMES, REGIONS, TOPICS, type Game, type PostsQuery, type Region, type Topic } from "@farseer/shared";
import { createStore } from "@/lib/store";

/** The feed's URL search params — the filter state lives in the URL so it's
 *  shareable and survives back/forward. */
export type FeedSearch = {
  game?: Game;
  topics?: Topic[];
  region?: Region;
  author?: string;
  q?: string;
  devs?: boolean;
  threads?: boolean;
};

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && allowed.includes(v as T) ? (v as T) : undefined;

export function validateFeedSearch(s: Record<string, unknown>): FeedSearch {
  const topics = Array.isArray(s.topics)
    ? s.topics.filter((x): x is Topic => TOPICS.includes(x as Topic))
    : typeof s.topics === "string"
      ? s.topics.split(",").filter((x): x is Topic => TOPICS.includes(x as Topic))
      : [];
  const out: FeedSearch = {
    game: pick(s.game, GAMES),
    topics: topics.length ? topics : undefined,
    region: pick(s.region, REGIONS),
    author: typeof s.author === "string" && s.author ? s.author : undefined,
    q: typeof s.q === "string" && s.q ? s.q : s.q != null && s.q !== "" ? String(s.q) : undefined,
    devs: s.devs === true || s.devs === "true" ? true : undefined,
    threads: s.threads === true || s.threads === "true" ? true : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as FeedSearch;
}

export function toPostsQuery(s: FeedSearch): PostsQuery {
  return {
    games: s.game ? [s.game] : undefined,
    topics: s.topics,
    regions: s.region ? [s.region] : undefined,
    author: s.author,
    q: s.q,
    devsOnly: s.devs,
    threadsOnly: s.threads,
  };
}

export function hasFilters(s: FeedSearch): boolean {
  return Object.keys(s).length > 0;
}

/** The last feed filters, so the Feed tab returns to them. */
export const lastFeedSearch = createStore<{ search: FeedSearch }>("farseer:feed", { search: {} });
