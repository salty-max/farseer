/**
 * Push pipeline simulation: `bun run db:sim`.
 *
 * Drives the REAL notify path (filters → copy → aes128gcm → delivery → dedup)
 * against a fake push service, with three subscriptions:
 *   - "retail-hotfix"  games=[retail] topics=[hotfix]          → should fire
 *   - "kw-shaman"      keywords=[shaman]                       → should fire (fr copy)
 *   - "classic-only"   games=[classic]                         → should NOT fire
 * Then re-runs the notifier to prove a post is only pushed once, and cleans up.
 * Needs VAPID_* in .env.local.
 */
import { eq, like } from "drizzle-orm";
import { db } from "@/db";
import { initDb } from "@/db/local";
import { posts, pushSubscription } from "@/db/schema";
import { notifyPending } from "@/lib/ingest";
import { setLogFormat } from "@/lib/log";
import { getVapid, saveSubscription } from "@/lib/push";
import { DEFAULT_PUSH_FILTERS, type PushFilters } from "@farseer/shared";

setLogFormat("pretty");
const sql = initDb();
if (!getVapid()) {
  console.error("VAPID_* not set — run `bun run vapid` and fill apps/api/.env.local");
  process.exit(1);
}

const b64 = (u: ArrayBuffer | Uint8Array) => Buffer.from(u instanceof Uint8Array ? u : new Uint8Array(u)).toString("base64url");
async function fakeBrowserKeys() {
  const kp = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  return { p256dh: b64(await crypto.subtle.exportKey("raw", kp.publicKey)), auth: b64(crypto.getRandomValues(new Uint8Array(16))) };
}

const PREFIX = "https://fcm.googleapis.com/fcm/send/farseer-sim-";
const subs: [string, Partial<PushFilters>, "en" | "fr"][] = [
  ["retail-hotfix", { games: ["retail"], topics: ["hotfix"] }, "en"],
  ["kw-shaman", { games: [], keywords: ["shaman"] }, "fr"],
  ["classic-only", { games: ["classic"] }, "en"],
];
for (const [name, f, lang] of subs) {
  await saveSubscription({ endpoint: PREFIX + name, keys: await fakeBrowserKeys() }, `sim-${name}`, { ...DEFAULT_PUSH_FILTERS, ...f }, lang);
}

// Intercept the push service.
const hits: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith(PREFIX)) {
    hits.push(url.slice(PREFIX.length));
    return new Response(null, { status: 201 });
  }
  return realFetch(input, init);
}) as typeof fetch;

const [post] = await db
  .insert(posts)
  .values({
    region: "us",
    forumPostId: -Date.now() % 1_000_000_000,
    topicId: 1,
    topicSlug: "sim",
    topicTitle: "World of Warcraft: Midnight Hotfixes – SIM",
    postNumber: 1,
    categoryId: 0,
    category: "General Discussion",
    username: "SimBlue",
    role: "community",
    excerpt: "Shaman: Fixed an issue where Totemic Recall did not reset Earth Elemental.",
    text: "Shaman: Fixed an issue where Totemic Recall did not reset Earth Elemental.",
    game: "retail",
    topics: ["hotfix"],
    regions: ["us"],
    createdAt: new Date(),
  })
  .returning();

let ok = true;
const check = (label: string, cond: boolean) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  ok &&= cond;
};

const first = await notifyPending();
check("matching subscriptions were pushed", hits.includes("retail-hotfix") && hits.includes("kw-shaman"));
check("non-matching subscription was skipped", !hits.includes("classic-only"));
check("one post fired", first.fired === 1);
const [after] = await db.select().from(posts).where(eq(posts.id, post.id));
check("post marked notified", after.notifiedAt != null);
hits.length = 0;
await notifyPending();
check("no duplicate push on the next tick", hits.length === 0);

await db.delete(posts).where(eq(posts.id, post.id));
await db.delete(pushSubscription).where(like(pushSubscription.endpoint, `${PREFIX}%`));
globalThis.fetch = realFetch;
await sql.end();
process.exit(ok ? 0 : 1);
