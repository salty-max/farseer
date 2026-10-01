import type { Game, PostDetail, PostsPage, PostsQuery, PostSummary, Region, Topic } from "@farseer/shared";
import { GAMES, REGIONS, TOPICS } from "@farseer/shared";
import { and, arrayOverlaps, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { posts, type PostRow } from "@/db/schema";
import { postUrl } from "@/lib/blizzard";
import { getState } from "@/lib/state";

/**
 * When a search hits deep inside a post, the opening excerpt doesn't show why it
 * matched: return the passage around the first hit instead.
 */
export function searchSnippet(text: string, q: string, before = 50, after = 220): string | null {
  const flat = text.replace(/\s+/g, " ");
  const i = flat.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return null;
  const start = Math.max(0, flat.lastIndexOf(" ", Math.max(0, i - before)) + 1);
  const endSpace = flat.indexOf(" ", i + q.length + after);
  const end = endSpace < 0 ? flat.length : endSpace;
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

export function toSummary(p: PostRow, q?: string): PostSummary {
  return {
    id: p.id,
    region: p.region,
    regions: p.regions,
    author: { username: p.username.replace(/-\d+$/, ""), title: p.userTitle, role: p.role, avatarUrl: p.avatarUrl },
    topicTitle: p.topicTitle,
    postNumber: p.postNumber,
    excerpt: (q && searchSnippet(p.text, q)) || p.excerpt,
    category: p.category,
    game: p.game,
    topics: p.topics,
    url: postUrl(p.region, p.topicSlug, p.topicId, p.postNumber),
    createdAt: p.createdAt.toISOString(),
    editedAt: p.editedAt?.toISOString() ?? null,
  };
}

const csv = <T extends string>(v: string | undefined, allowed: readonly T[]): T[] | undefined => {
  if (!v) return undefined;
  const out = v.split(",").filter((x): x is T => allowed.includes(x as T));
  return out.length ? out : undefined;
};
const int = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Parse GET /api/posts query params (untrusted). */
export function parsePostsQuery(q: Record<string, string | undefined>): PostsQuery {
  return {
    before: int(q.before),
    after: int(q.after),
    limit: Math.min(int(q.limit) ?? 30, 100),
    games: csv<Game>(q.games, GAMES),
    topics: csv<Topic>(q.topics, TOPICS),
    regions: csv<Region>(q.regions, REGIONS),
    author: q.author?.trim() || undefined,
    q: q.q?.trim().slice(0, 100) || undefined,
    devsOnly: q.devsOnly === "1" || q.devsOnly === "true",
    threadsOnly: q.threadsOnly === "1" || q.threadsOnly === "true",
  };
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Newest first, ordered by (created_at, id); cursors are post ids. */
export async function listPosts(q: PostsQuery): Promise<PostsPage> {
  const limit = q.limit ?? 30;
  const where: SQL[] = [isNull(posts.dupOf), eq(posts.chatter, false)];
  if (q.games) where.push(sql`${posts.game} in ${q.games}`);
  if (q.topics) where.push(arrayOverlaps(posts.topics, q.topics));
  if (q.regions) where.push(arrayOverlaps(posts.regions, q.regions));
  if (q.devsOnly) where.push(eq(posts.role, "developer"));
  if (q.threadsOnly) where.push(eq(posts.postNumber, 1));
  if (q.author) where.push(sql`regexp_replace(${posts.username}, '-[0-9]+$', '') ilike ${q.author}`);
  if (q.q) {
    const pat = `%${likeEscape(q.q)}%`;
    where.push(or(ilike(posts.topicTitle, pat), ilike(posts.text, pat), ilike(posts.username, pat))!);
  }
  if (q.before) {
    where.push(
      sql`(${posts.createdAt}, ${posts.id}) < (select created_at, id from posts where id = ${q.before})`,
    );
  }
  if (q.after) {
    where.push(
      sql`(${posts.createdAt}, ${posts.id}) > (select created_at, id from posts where id = ${q.after})`,
    );
  }
  const rows = await db
    .select()
    .from(posts)
    .where(and(...where))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    posts: page.map((p) => toSummary(p, q.q)),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

export async function getPost(id: number): Promise<PostDetail | null> {
  const [p] = await db.select().from(posts).where(eq(posts.id, id));
  if (!p) return null;
  // A crosspost link (e.g. an old push) resolves to the canonical copy.
  if (p.dupOf != null) return getPost(p.dupOf);
  return { ...toSummary(p), html: p.html ?? `<p>${p.excerpt}</p>`, replyTo: p.replyTo ?? null };
}

export async function getMeta() {
  const name = sql<string>`regexp_replace(${posts.username}, '-[0-9]+$', '')`;
  const authors = await db
    .select({
      username: name,
      role: sql<PostRow["role"]>`max(${posts.role})`,
      title: sql<string | null>`max(${posts.userTitle})`,
      count: count(),
    })
    .from(posts)
    .where(and(isNull(posts.dupOf), eq(posts.chatter, false)))
    .groupBy(name)
    .orderBy(desc(count()));
  const total = authors.reduce((n, a) => n + Number(a.count), 0);
  return {
    authors: authors.map((a) => ({ ...a, count: Number(a.count) })),
    total,
    lastPolledAt: await getState("lastPolledAt"),
  };
}
