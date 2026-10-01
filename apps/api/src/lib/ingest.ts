import type { Region, ReplyContext } from "@farseer/shared";
import { REGIONS } from "@farseer/shared";
import { and, arrayOverlaps, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, posts, type PostRow } from "@/db/schema";
import {
  avatarUrl,
  fetchCategories,
  fetchPost,
  fetchPostByNumber,
  fetchTracker,
  isBluePost,
  setPace,
  ORIGIN,
  postUrl,
  roleOf,
  type TrackerPost,
} from "@/lib/blizzard";
import { classify } from "@/lib/classify";
import { findDuplicate } from "@/lib/dedupe";
import { absolutize, htmlToText, oneLine, truncate } from "@/lib/html";
import { log } from "@/lib/log";
import { deliverPost } from "@/lib/push";
import { setState } from "@/lib/state";

/** A post older than this when we first see it is history, not news: no push. */
const FRESH_MS = 6 * 3600 * 1000;
const DEDUPE_WINDOW_MS = 48 * 3600 * 1000;

// ── categories ────────────────────────────────────────────────────────────────

type Cat = { name: string; parentId: number | null };
const catCache = new Map<Region, Map<number, Cat>>();
const catRefreshedAt = new Map<Region, number>();

async function loadCategories(region: Region): Promise<Map<number, Cat>> {
  let m = catCache.get(region);
  if (!m) {
    const rows = await db.select().from(categories).where(eq(categories.region, region));
    m = new Map(rows.map((r) => [r.id, { name: r.name, parentId: r.parentId }]));
    catCache.set(region, m);
  }
  return m;
}

/** Category name + parent name; refreshes the tree from the forum (at most
 *  every 10 min) when it meets an id it doesn't know. */
async function categoryInfo(region: Region, id: number): Promise<{ name: string; parent: string | null }> {
  let m = await loadCategories(region);
  if (!m.has(id) && Date.now() - (catRefreshedAt.get(region) ?? 0) > 10 * 60_000) {
    catRefreshedAt.set(region, Date.now());
    try {
      const cats = await fetchCategories(region);
      if (cats.length) {
        await db
          .insert(categories)
          .values(cats.map((c) => ({ region, id: c.id, name: c.name, parentId: c.parent_category_id ?? null })))
          .onConflictDoUpdate({
            target: [categories.region, categories.id],
            set: { name: sql`excluded.name`, parentId: sql`excluded.parent_id` },
          });
        m = new Map(cats.map((c) => [c.id, { name: c.name, parentId: c.parent_category_id ?? null }]));
        catCache.set(region, m);
      }
    } catch (err) {
      log.warn("categories.refresh.failed", { region, err: String(err) });
    }
  }
  const c = m.get(id);
  if (!c) return { name: "General", parent: null };
  return { name: c.name, parent: c.parentId != null ? (m.get(c.parentId)?.name ?? null) : null };
}

// ── one post ──────────────────────────────────────────────────────────────────

/** Drop quoted blocks (the player text a blue is answering) — keyword matching
 *  and dedupe should only see what the blue wrote. */
export function stripQuotes(html: string): string {
  return html.replace(/<aside[^>]*class="[^"]*quote[^"]*"[^>]*>[\s\S]*?<\/aside>/gi, "");
}

/** The blue's own words; a post that is nothing but a quote (a "see this
 *  thread" signpost) keeps the quoted text rather than going blank. */
export function blueText(cooked: string): string {
  return htmlToText(stripQuotes(cooked)) || htmlToText(cooked);
}

async function replyContext(
  region: Region,
  tp: TrackerPost,
  n: number,
): Promise<{ context: ReplyContext; blue: boolean } | null> {
  try {
    const rp = await fetchPostByNumber(region, tp.topic_id, n);
    return {
      context: {
        username: rp.username.replace(/-\d+$/, ""),
        excerpt: truncate(oneLine(htmlToText(stripQuotes(rp.cooked))), 280),
        url: postUrl(region, tp.topic_slug, tp.topic_id, n),
      },
      blue: isBluePost(rp),
    };
  } catch {
    return null;
  }
}

/** Was this thread opened by Blizzard? Cached per topic (openers never change). */
const blueThreadCache = new Map<string, boolean>();
async function isBlueThread(region: Region, tp: TrackerPost): Promise<boolean> {
  const key = `${region}:${tp.topic_id}`;
  const cached = blueThreadCache.get(key);
  if (cached !== undefined) return cached;
  let blue: boolean;
  const [opener] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.region, region), eq(posts.topicId, tp.topic_id), eq(posts.postNumber, 1)));
  if (opener) blue = true; // every stored post is a blue post
  else {
    try {
      blue = isBluePost(await fetchPostByNumber(region, tp.topic_id, 1));
    } catch (err) {
      // Unknown even after retries: show it rather than lose a real update.
      log.warn("thread.opener.failed", { region, topic: tp.topic_id, err: String(err) });
      return true;
    }
  }
  blueThreadCache.set(key, blue);
  return blue;
}

/**
 * Community managers spend most of their forum time answering players ("We're
 * working on it!"). That's support chatter, not news: a CM/staff reply counts
 * as chatter when it's in a player's thread or answers a player's post. Their
 * updates to Blizzard threads (hotfix entries, PTR notes additions, known
 * issues) and every developer post are kept.
 */
export function isChatter(p: {
  role: PostRow["role"];
  postNumber: number;
  blueThread: boolean;
  answersPlayer: boolean;
}): boolean {
  if (p.postNumber <= 1) return false;
  if (p.role !== "community" && p.role !== "staff") return false;
  return !p.blueThread || p.answersPlayer;
}

export async function ingestOne(
  region: Region,
  tp: TrackerPost,
  opts: { notify: boolean },
): Promise<PostRow | null> {
  const cat = await categoryInfo(region, tp.category_id);
  const role = roleOf(tp.primary_group_name, tp.username);
  let html: string | null = null;
  let text = oneLine(htmlToText(tp.excerpt));
  let version = 1;
  let replyTo: ReplyContext | null = null;
  let answersPlayer = false;
  try {
    const fp = await fetchPost(region, tp.id);
    html = absolutize(fp.cooked, ORIGIN[region]);
    text = blueText(fp.cooked) || text;
    version = fp.version;
    if (fp.reply_to_post_number) {
      const r = await replyContext(region, tp, fp.reply_to_post_number);
      replyTo = r?.context ?? null;
      answersPlayer = r ? !r.blue : false;
    }
  } catch (err) {
    log.warn("post.detail.failed", { region, id: tp.id, err: String(err) });
  }

  const chatter =
    tp.post_number > 1 && (role === "community" || role === "staff")
      ? isChatter({ role, postNumber: tp.post_number, blueThread: await isBlueThread(region, tp), answersPlayer })
      : false;

  const createdAt = new Date(tp.created_at);
  const { game, topics } = classify({ category: cat.name, parentCategory: cat.parent, title: tp.topic_title, role });

  const candidates = await db
    .select()
    .from(posts)
    .where(
      and(
        isNull(posts.dupOf),
        eq(posts.chatter, chatter),
        gte(posts.createdAt, new Date(createdAt.getTime() - DEDUPE_WINDOW_MS)),
        lte(posts.createdAt, new Date(createdAt.getTime() + DEDUPE_WINDOW_MS)),
      ),
    );
  const dup = findDuplicate(
    { username: tp.username, createdAt, topicTitle: tp.topic_title, text },
    candidates.map((c) => ({ ...c, text: c.text || c.excerpt })),
  );

  const isNews = opts.notify && !dup && !chatter && Date.now() - createdAt.getTime() < FRESH_MS;
  const [row] = await db
    .insert(posts)
    .values({
      region,
      forumPostId: tp.id,
      topicId: tp.topic_id,
      topicSlug: tp.topic_slug,
      topicTitle: tp.topic_title,
      postNumber: tp.post_number,
      categoryId: tp.category_id,
      category: cat.name,
      username: tp.username,
      userTitle: tp.user_title || null,
      role,
      avatarUrl: avatarUrl(region, tp.avatar_template),
      excerpt: truncate(oneLine(text), 320),
      html,
      text,
      replyTo,
      game,
      topics,
      regions: [region],
      dupOf: dup?.id ?? null,
      chatter,
      version,
      createdAt,
      notifiedAt: isNews ? null : new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (row && dup && !dup.regions.includes(region)) {
    await db
      .update(posts)
      .set({ regions: sql`array_append(${posts.regions}, ${region})` })
      .where(eq(posts.id, dup.id));
  }
  return row ?? null;
}

// ── polling ───────────────────────────────────────────────────────────────────

/**
 * Pull the tracker for one region and ingest what's new. Pages further back
 * (up to `maxPages`) until it reaches a post it already knows, so a downtime
 * longer than one page (20 posts) leaves no gap. Hotfix threads get renamed
 * ("…Hotfixes – Updated 29 September"); the stored title follows.
 */
export async function pollRegion(
  region: Region,
  {
    maxPages = 5,
    notify = true,
    stopAtKnown = true,
  }: { maxPages?: number; notify?: boolean; stopAtKnown?: boolean } = {},
): Promise<{ fresh: number }> {
  const fresh: TrackerPost[] = [];
  let before: number | undefined;
  for (let page = 0; page < maxPages; page++) {
    const list = await fetchTracker(region, before);
    if (list.length === 0) break;
    const known = await db
      .select({ forumPostId: posts.forumPostId, topicTitle: posts.topicTitle })
      .from(posts)
      .where(and(eq(posts.region, region), inArray(posts.forumPostId, list.map((p) => p.id))));
    const knownTitle = new Map(known.map((k) => [k.forumPostId, k.topicTitle]));

    for (const p of list) {
      const title = knownTitle.get(p.id);
      if (title === undefined) fresh.push(p);
      else if (title !== p.topic_title) {
        await db
          .update(posts)
          .set({ topicTitle: p.topic_title, topicSlug: p.topic_slug })
          .where(and(eq(posts.region, region), eq(posts.topicId, p.topic_id)));
      }
    }
    if (stopAtKnown && known.length > 0) break; // caught up with what we already have
    before = list[list.length - 1].id;
  }

  // Oldest first, so a crosspost's canonical copy is the earlier one.
  fresh.sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const p of fresh) {
    await ingestOne(region, p, { notify });
  }
  if (fresh.length) log.info("poll.ingested", { region, fresh: fresh.length });
  return { fresh: fresh.length };
}

/** Push every not-yet-notified canonical post. A post whose fan-out failed
 *  everywhere is retried on the next tick, until it's no longer fresh. */
export async function notifyPending(): Promise<{ fired: number }> {
  const pending = await db
    .select()
    .from(posts)
    .where(and(isNull(posts.notifiedAt), isNull(posts.dupOf), eq(posts.chatter, false)))
    .orderBy(asc(posts.createdAt))
    .limit(30);
  let fired = 0;
  for (const p of pending) {
    const stale = Date.now() - p.createdAt.getTime() > FRESH_MS;
    const r = stale ? { sent: 0, targets: 0 } : await deliverPost(p, "new");
    if (r.sent > 0 || r.targets === 0 || stale) {
      await db.update(posts).set({ notifiedAt: new Date() }).where(eq(posts.id, p.id));
    }
    if (r.sent > 0) fired++;
  }
  if (fired) log.info("push.fired", { posts: fired });
  return { fired };
}

/** One full tick: every region, then the push fan-out. */
export async function pollAll(): Promise<{ fresh: number; fired: number }> {
  let fresh = 0;
  for (const region of REGIONS) {
    try {
      fresh += (await pollRegion(region)).fresh;
    } catch (err) {
      log.warn("poll.failed", { region, err: String(err) });
    }
  }
  const { fired } = await notifyPending();
  await setState("lastPolledAt", new Date().toISOString());
  return { fresh, fired };
}

/**
 * Living threads (hotfixes, patch notes, PTR notes, maintenance) get their first
 * post edited in place. Re-check the recent ones and record new versions.
 */
export async function refreshEdits({ days = 7, limit = 10 } = {}): Promise<{ edited: number }> {
  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        isNull(posts.dupOf),
        eq(posts.postNumber, 1),
        gte(posts.createdAt, new Date(Date.now() - days * 86400_000)),
        arrayOverlaps(posts.topics, ["hotfix", "patchnotes", "ptr", "maintenance"]),
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit);
  let edited = 0;
  for (const r of rows) {
    try {
      const fp = await fetchPost(r.region, r.forumPostId);
      if (fp.version <= r.version) continue;
      const text = blueText(fp.cooked);
      const [updated] = await db
        .update(posts)
        .set({
          html: absolutize(fp.cooked, ORIGIN[r.region]),
          text,
          excerpt: truncate(oneLine(text), 320),
          version: fp.version,
          editedAt: new Date(fp.updated_at),
        })
        .where(eq(posts.id, r.id))
        .returning();
      edited++;
      await deliverPost(updated, "edited");
    } catch (err) {
      log.warn("edits.refresh.failed", { id: r.id, err: String(err) });
    }
  }
  if (edited) log.info("edits.found", { edited });
  return { edited };
}

/** History import spacing: ~1 req/s keeps a backfill (≈2–3 requests per post)
 *  far below Discourse's 50 req / 10 s, at the cost of a few minutes once. */
const BACKFILL_PACE_MS = 1_000;

/**
 * First-boot history: page back through each region's tracker, no pushes.
 * Slows every forum request to ~1/s while it runs (live jobs included, should
 * they overlap via the admin route).
 */
export async function backfill(pages = 10): Promise<{ fresh: number }> {
  const prev = setPace(BACKFILL_PACE_MS);
  try {
    let fresh = 0;
    for (const region of REGIONS) {
      fresh += (await pollRegion(region, { maxPages: pages, notify: false, stopAtKnown: false })).fresh;
    }
    return { fresh };
  } finally {
    setPace(prev);
  }
}
