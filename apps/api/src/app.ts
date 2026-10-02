import type { SubscribeRequest } from "@farseer/shared";
import { Hono } from "hono";
import { authorizeCron } from "@/lib/auth";
import { runTick } from "@/lib/tick";
import { getMeta, getPost, listPosts, parsePostsQuery } from "@/lib/feed";
import { parseFilters } from "@/lib/filters";
import { backfill, pollAll, refreshEdits } from "@/lib/ingest";
import { log } from "@/lib/log";
import { asLang, DEFAULT_LANG } from "@/lib/notify";
import {
  isAllowedPushEndpoint,
  removeSubscription,
  saveSubscription,
  sendWelcome,
  vapidPublicKey,
} from "@/lib/push";

export const app = new Hono();

app.onError((err, c) => {
  log.error("http.error", { path: c.req.path, err: String(err) });
  return c.json({ error: "internal error" }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/posts", async (c) => c.json(await listPosts(parsePostsQuery(c.req.query()))));

app.get("/api/posts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "bad id" }, 400);
  const post = await getPost(id);
  return post ? c.json(post) : c.json({ error: "not found" }, 404);
});

app.get("/api/meta", async (c) => c.json(await getMeta()));

// ── push ─────────────────────────────────────────────────────────────────────

app.get("/api/push/key", (c) => c.json({ key: vapidPublicKey() }));

app.post("/api/push/subscribe", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<SubscribeRequest> | null;
  const sub = body?.subscription;
  const filters = parseFilters(body?.filters);
  if (
    !sub ||
    typeof sub.endpoint !== "string" ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string" ||
    !isAllowedPushEndpoint(sub.endpoint) ||
    typeof body?.deviceId !== "string" ||
    !filters
  ) {
    return c.json({ error: "bad subscription" }, 400);
  }
  const lang = asLang(body.lang) ?? DEFAULT_LANG;
  await saveSubscription(sub, body.deviceId.slice(0, 64), filters, lang);
  const welcomed = body.welcome ? await sendWelcome(sub, lang) : false;
  return c.json({ ok: true, welcomed });
});

app.post("/api/push/unsubscribe", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return c.json({ error: "bad request" }, 400);
  await removeSubscription(body.endpoint);
  return c.json({ ok: true });
});

// ── admin (Bearer CRON_SECRET) ───────────────────────────────────────────────

app.use("/api/admin/*", async (c, next) => {
  if (!authorizeCron(c.req.raw)) return c.json({ error: "unauthorized" }, 401);
  await next();
});
// The scheduler, for hosts without a long-lived process (Vercel Cron, GET).
app.on(["GET", "POST"], "/api/admin/tick", async (c) => c.json(await runTick()));
app.post("/api/admin/poll", async (c) => c.json(await pollAll()));
app.post("/api/admin/edits", async (c) => c.json(await refreshEdits()));
app.post("/api/admin/backfill", async (c) => c.json(await backfill(Number(c.req.query("pages") ?? 10))));
