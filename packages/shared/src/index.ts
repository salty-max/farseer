/**
 * @farseer/shared — the API wire contract. Source of truth for every JSON shape
 * exchanged between apps/api and apps/web.
 */

/** Blizzard forum regions we track (English forums only). */
export type Region = "us" | "eu";
export const REGIONS: Region[] = ["us", "eu"];

/** Which game a post is about. Derived from the forum category tree + title. */
export type Game = "retail" | "classic" | "forever";
export const GAMES: Game[] = ["retail", "classic", "forever"];

/**
 * What a post is. A post can carry several topics (a PTR hotfix is both).
 * Derived from category, title and author — see apps/api/src/lib/classify.ts.
 */
export type Topic =
  | "news" // official announcements (the BlizzardEntertainment account)
  | "hotfix"
  | "patchnotes" // patch / development notes
  | "ptr" // PTR, beta, "In Development"
  | "maintenance" // maintenance, realm restarts, outages
  | "bugs" // bug reports / known issues
  | "classes" // class-specific discussion
  | "community"; // everything else (replies in general discussion…)
export const TOPICS: Topic[] = [
  "news",
  "hotfix",
  "patchnotes",
  "ptr",
  "maintenance",
  "bugs",
  "classes",
  "community",
];

/** A blue author's role, from their Discourse primary group. */
export type AuthorRole = "developer" | "community" | "official" | "staff";

export type Author = {
  username: string;
  title: string | null; // "Community Manager", "Game Designer"…
  role: AuthorRole;
  avatarUrl: string | null;
};

/** The player post a blue reply answers, for context. */
export type ReplyContext = {
  username: string;
  excerpt: string; // plain text, truncated
  url: string;
};

/** A feed entry. */
export type PostSummary = {
  id: number; // our id
  region: Region; // where the canonical copy lives
  regions: Region[]; // every region it was posted in (US/EU crossposts are merged)
  author: Author;
  topicTitle: string;
  postNumber: number; // 1 = opened the thread; >1 = a reply
  excerpt: string; // plain text
  category: string; // forum category name, e.g. "Midnight: 12.1.5 Public Test Realm"
  game: Game;
  topics: Topic[];
  url: string; // the post on the Blizzard forums
  createdAt: string; // ISO
  editedAt: string | null; // ISO, set when we saw the post change after ingest
};

export type PostDetail = PostSummary & {
  html: string; // cooked forum HTML, links absolutized (sanitize before rendering)
  replyTo: ReplyContext | null;
};

export type PostsPage = {
  posts: PostSummary[];
  /** Pass as `before` to get the next (older) page; null when exhausted. */
  nextCursor: number | null;
};

/** Query params of GET /api/posts. All optional; lists are comma-separated. */
export type PostsQuery = {
  before?: number;
  after?: number; // only posts newer than this id (the "new posts" pill)
  limit?: number;
  games?: Game[];
  topics?: Topic[];
  regions?: Region[];
  author?: string;
  q?: string;
  devsOnly?: boolean;
  threadsOnly?: boolean; // only thread openers (post #1)
};

export type AuthorStat = { username: string; role: AuthorRole; title: string | null; count: number };

export type Meta = {
  authors: AuthorStat[];
  lastPolledAt: string | null;
  total: number;
};

/** Which posts a device wants pushed. Empty lists mean "any". */
export type PushFilters = {
  games: Game[];
  topics: Topic[];
  keywords: string[]; // case-insensitive, matched on title + body
  devsOnly: boolean;
  updates: boolean; // also notify when a tracked thread (hotfixes…) is edited
};

export const DEFAULT_PUSH_FILTERS: PushFilters = {
  games: ["retail"],
  topics: [],
  keywords: [],
  devsOnly: false,
  updates: true,
};

export type Lang = "en" | "fr";

export type SubscribeRequest = {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  deviceId: string;
  filters: PushFilters;
  lang: Lang;
  welcome?: boolean;
};
