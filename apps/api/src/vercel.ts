import { getRequestListener } from "@hono/node-server";
import { app } from "@/app";
import { initDb } from "@/db/local";
import { setLogFormat, setLogLevel } from "@/lib/log";

// Vercel entry: the whole API as one Node.js function (bundled by
// scripts/vercel-build.sh). The web app is served by Vercel's CDN, and
// Vercel Cron calls /api/admin/tick every minute.

initDb();
setLogLevel(process.env.LOG_LEVEL);
setLogFormat(process.env.LOG_FORMAT ?? "json");

export default getRequestListener(app.fetch);
