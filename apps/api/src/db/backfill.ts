import { initDb } from "@/db/local";
import { backfill } from "@/lib/ingest";
import { setLogFormat } from "@/lib/log";
import { setState } from "@/lib/state";

// One-off history import: `bun run db:backfill [pages]` (20 posts per page per region).
setLogFormat("pretty");
const sql = initDb();
const pages = Number(process.argv[2] ?? 10);
const r = await backfill(pages);
await setState("backfilled", "1");
console.log(`backfilled ${r.fresh} posts`);
await sql.end();
