import type { AuthorRole, Region } from "@farseer/shared";
import { log } from "@/lib/log";

/**
 * Client for the Blizzard WoW forums (Discourse). Everything we need is public
 * JSON, no key:
 *   - /groups/blizzard-tracker/posts.json — the "blue tracker": every staff post,
 *     newest first, 20 per page, paged with ?before_post_id=
 *   - /posts/{id}.json                    — one post's full cooked HTML + version
 *   - /posts/by_number/{topic}/{n}.json   — a post by its number (reply context)
 *   - /site.json                          — the category tree (ids differ per region)
 */

export const ORIGIN: Record<Region, string> = {
  us: "https://us.forums.blizzard.com",
  eu: "https://eu.forums.blizzard.com",
};
export const BASE: Record<Region, string> = {
  us: `${ORIGIN.us}/en/wow`,
  eu: `${ORIGIN.eu}/en/wow`,
};

const UA = "Farseer/0.1 (WoW blue post tracker; +https://github.com/salty-max/farseer)";

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: FetchFn = (input, init) => fetch(input, init);

/** Swap the transport (tests). */
export function setFetch(f: FetchFn): void {
  fetchImpl = f;
}

const RETRY_DELAYS_MS = [1_500, 5_000];

/**
 * Request pacing. The forums are Discourse, whose default per-IP limits are 50
 * requests / 10 s and 200 / min (Blizzard publishes nothing, and a backfill at
 * ~5 req/s did get 429s). Every request goes through one queue that keeps at
 * least `paceMs` between request starts, so no combination of jobs can burst.
 */
export const DEFAULT_PACE_MS = 250; // ≤ 4 req/s for the live jobs
let paceMs = DEFAULT_PACE_MS;
let nextSlot = 0;
let queue: Promise<void> = Promise.resolve();

/** Change the spacing between requests; returns the previous value. */
export function setPace(ms: number): number {
  const prev = paceMs;
  paceMs = ms;
  return prev;
}

function paced(): Promise<void> {
  const turn = queue.then(async () => {
    const wait = nextSlot - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    nextSlot = Date.now() + paceMs;
  });
  queue = turn.catch(() => {});
  return turn;
}

class HttpError extends Error {
  constructor(
    url: string,
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(`GET ${url} → ${status}`);
  }
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

async function getOnce<T>(url: string): Promise<T> {
  await paced();
  const res = await fetchImpl(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) return (await res.json()) as T;
  const ra = Number(res.headers.get("retry-after"));
  throw new HttpError(url, res.status, Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : null);
}

/** GET JSON, retrying rate limits (429), server errors and network failures —
 *  the forums throttle bursts like a backfill. Honours Retry-After. */
async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getOnce<T>(url);
    } catch (err) {
      const http = err instanceof HttpError ? err : null;
      if (http?.status === 429) {
        // Logged every time: in prod this is the signal that we're near the
        // forum's limits (or sharing an egress IP with someone who is).
        log.warn("forum.rate_limited", {
          path: new URL(url).pathname,
          retryAfterMs: http.retryAfterMs,
          attempt: attempt + 1,
          paceMs,
        });
      }
      if ((http && !http.retryable) || attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((r) => setTimeout(r, http?.retryAfterMs ?? RETRY_DELAYS_MS[attempt]));
    }
  }
}

/** One entry of the blue tracker feed (only the fields we use). */
export type TrackerPost = {
  id: number;
  excerpt: string; // HTML-ish, entity-encoded
  created_at: string;
  topic_id: number;
  topic_title: string;
  topic_slug: string;
  category_id: number;
  post_number: number;
  username: string;
  user_title: string | null;
  primary_group_name: string | null;
  avatar_template: string | null;
};

export async function fetchTracker(region: Region, beforePostId?: number): Promise<TrackerPost[]> {
  const q = beforePostId ? `?before_post_id=${beforePostId}` : "";
  const data = await getJson<{ posts?: TrackerPost[] }>(
    `${BASE[region]}/groups/blizzard-tracker/posts.json${q}`,
  );
  return data.posts ?? [];
}

export type ForumPost = {
  id: number;
  username: string;
  cooked: string;
  version: number;
  created_at: string;
  updated_at: string;
  topic_id: number;
  post_number: number;
  reply_to_post_number: number | null;
  staff?: boolean;
  primary_group_name?: string | null;
};

/** Whether a forum post was written by Blizzard (any staff or blue group). */
export function isBluePost(p: Pick<ForumPost, "username" | "staff" | "primary_group_name">): boolean {
  return p.staff === true || !!p.primary_group_name || p.username === "BlizzardEntertainment";
}

export function fetchPost(region: Region, id: number): Promise<ForumPost> {
  return getJson<ForumPost>(`${BASE[region]}/posts/${id}.json`);
}

export function fetchPostByNumber(region: Region, topicId: number, n: number): Promise<ForumPost> {
  return getJson<ForumPost>(`${BASE[region]}/posts/by_number/${topicId}/${n}.json`);
}

export type ForumCategory = { id: number; name: string; parent_category_id?: number | null };

export async function fetchCategories(region: Region): Promise<ForumCategory[]> {
  const data = await getJson<{ categories?: ForumCategory[] }>(`${BASE[region]}/site.json`);
  return data.categories ?? [];
}

/** Public URL of a post on the forums. */
export function postUrl(region: Region, slug: string, topicId: number, postNumber: number): string {
  return `${BASE[region]}/t/${slug}/${topicId}/${postNumber}`;
}

/** Discourse avatar templates are origin-relative with a `{size}` placeholder. */
export function avatarUrl(region: Region, template: string | null | undefined, size = 96): string | null {
  if (!template) return null;
  const path = template.replace("{size}", String(size));
  if (path.startsWith("//")) return `https:${path}`;
  if (path.startsWith("/")) return `${ORIGIN[region]}${path}`;
  return path;
}

/** Map a Discourse primary group to a coarse role. */
export function roleOf(group: string | null | undefined, username: string): AuthorRole {
  const g = (group ?? "").toLowerCase();
  if (username === "BlizzardEntertainment" || g === "api_users") return "official";
  if (/develop|design|engineer|producer|director|artist/.test(g)) return "developer";
  if (/community|cm\b/.test(g)) return "community";
  return "staff";
}
