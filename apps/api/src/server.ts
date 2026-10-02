import { serveStatic } from "hono/bun";
import { app } from "@/app";
import { initDb } from "@/db/local";
import { setLogFormat, setLogLevel } from "@/lib/log";
import { startScheduler } from "@/scheduler";

// Bun entry. Bun auto-loads .env/.env.local. `bun --watch src/server.ts` in dev.

initDb();
setLogLevel(process.env.LOG_LEVEL);
setLogFormat(process.env.LOG_FORMAT ?? "pretty");

// The built SPA (../web/dist) for the monolith deploy; in dev Vite serves it and
// proxies /api here.
app.use("/*", serveStatic({ root: "../web/dist" }));
app.get("*", serveStatic({ path: "../web/dist/index.html" }));

// The first tick backfills a fresh database before polling (see lib/tick.ts).
if (process.env.SCHEDULER !== "off") startScheduler();

const port = Number(process.env.PORT ?? 3000);
console.log(`Farseer API → http://localhost:${port}`);

export default { port, fetch: app.fetch };
