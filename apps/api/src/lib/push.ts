import type { Lang, PushFilters } from "@farseer/shared";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscription, type SubscriptionRow } from "@/db/schema";
import { matchesFilters, type Matchable } from "@/lib/filters";
import { log } from "@/lib/log";
import { asLang, DEFAULT_LANG, renderNotify, type NotifyMessage } from "@/lib/notify";
import { sendPush, type PushSub, type Vapid } from "@/lib/webpush";

/** VAPID config from the environment, or null if push isn't set up. */
export function getVapid(): Vapid | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/**
 * Hosts the browser push services hand out. /api/push/subscribe is
 * unauthenticated, and whatever endpoint it stores is later POSTed to — without
 * this allowlist the server could be pointed at any URL.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  ".push.apple.com",
  "updates.push.services.mozilla.com",
  ".notify.windows.com",
  ".push.microsoft.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some((h) => (h.startsWith(".") ? host.endsWith(h) : host === h));
}

export async function saveSubscription(
  sub: PushSub,
  deviceId: string,
  filters: PushFilters,
  lang: Lang,
): Promise<void> {
  await db
    .insert(pushSubscription)
    .values({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, deviceId, filters, lang })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, deviceId, filters, lang },
    });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscription).where(inArray(pushSubscription.endpoint, [endpoint]));
}

/** What the service worker receives (see apps/web/public/push-sw.js). */
export type PushPayload = { title: string; body: string; url: string; tag: string };

/** A blue post is news for about a day; past that, a late push is noise. */
const TTL = 24 * 3600;

async function sendTo(
  s: SubscriptionRow,
  message: NotifyMessage,
  url: string,
  tag: string,
  vapid: Vapid,
): Promise<"ok" | "gone" | "failed"> {
  const r = renderNotify(message, asLang(s.lang) ?? DEFAULT_LANG);
  const payload: PushPayload = { title: r.title, body: r.body, url, tag };
  try {
    const res = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid, {
      ttl: TTL,
      urgency: "normal",
    });
    if (res.ok) return "ok";
    if (res.gone) return "gone";
    log.warn("push.send.failed", { status: res.status, endpoint: s.endpoint.slice(0, 40) });
  } catch (err) {
    log.warn("push.send.error", { err: String(err) });
  }
  return "failed";
}

/** Best-effort confirmation push so enabling notifications proves the chain. */
export async function sendWelcome(sub: PushSub, lang: Lang): Promise<boolean> {
  const vapid = getVapid();
  if (!vapid) return false;
  const row = { ...sub, p256dh: sub.keys.p256dh, auth: sub.keys.auth, lang } as unknown as SubscriptionRow;
  return (await sendTo(row, { id: "welcome" }, "/", "welcome", vapid)) === "ok";
}

export type DeliveryResult = { sent: number; targets: number };

/**
 * Fan a post out to every subscription whose filters match it. Dead
 * subscriptions (404/410) are pruned. `kind: "edited"` only reaches devices that
 * opted into update notifications.
 */
export async function deliverPost(
  post: Matchable & { id: number; username: string; postNumber: number; excerpt: string; version: number },
  kind: "new" | "edited",
): Promise<DeliveryResult> {
  const vapid = getVapid();
  if (!vapid) return { sent: 0, targets: 0 };
  const subs = await db.select().from(pushSubscription);
  const targets = subs.filter(
    (s) => matchesFilters(post, s.filters) && (kind === "new" || s.filters.updates),
  );
  if (targets.length === 0) return { sent: 0, targets: 0 };

  const message: NotifyMessage =
    kind === "new"
      ? { id: "post", author: post.username, title: post.topicTitle, reply: post.postNumber > 1, excerpt: post.excerpt }
      : { id: "edited", author: post.username, title: post.topicTitle };
  const url = `/post/${post.id}`;
  // Each edit gets its own tag so it doesn't silently replace the original alert.
  const tag = kind === "new" ? `p${post.id}` : `p${post.id}v${post.version}`;

  let sent = 0;
  const dead: string[] = [];
  for (const s of targets) {
    const r = await sendTo(s, message, url, tag, vapid);
    if (r === "ok") sent++;
    else if (r === "gone") dead.push(s.endpoint);
  }
  if (dead.length) await db.delete(pushSubscription).where(inArray(pushSubscription.endpoint, dead));
  return { sent, targets: targets.length - dead.length };
}
