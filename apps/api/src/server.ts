import { serveStatic } from "hono/bun";
import { app } from "@/app";
import { initDb } from "@/db/local";
import { backfill } from "@/lib/ingest";
import { log, setLogFormat, setLogLevel } from "@/lib/log";
import { getState, setState } from "@/lib/state";
import { startScheduler } from "@/scheduler";

// Bun entry. Bun auto-loads .env/.env.local. `bun --watch src/server.ts` in dev.

initDb();
setLogLevel(process.env.LOG_LEVEL);
setLogFormat(process.env.LOG_FORMAT ?? "pretty");

// The built SPA (../web/dist) for the monolith deploy; in dev Vite serves it and
// proxies /api here.
app.use("/*", serveStatic({ root: "../web/dist" }));
app.get("*", serveStatic({ path: "../web/dist/index.html" }));

if (process.env.SCHEDULER !== "off") {
  // First boot: fill in the tracker history (no pushes) before live polling, so
  // the feed isn't empty and the poller doesn't push a backlog.
  void (async () => {
    if ((await getState("backfilled")) !== "1") {
      log.info("backfill.start");
      const r = await backfill(10);
      await setState("backfilled", "1");
      log.info("backfill.done", r);
    }
    startScheduler();
  })().catch((err) => log.error("boot.crash", { err: String(err) }));
}

const port = Number(process.env.PORT ?? 3000);
console.log(`Farseer API → http://localhost:${port}`);

export default { port, fetch: app.fetch };
