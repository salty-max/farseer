import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { state } from "@/db/schema";
import { backfill, pollAll, refreshEdits } from "@/lib/ingest";
import { log } from "@/lib/log";
import { getState, setState } from "@/lib/state";

/**
 * One scheduler tick, every minute: poll the US + EU blue trackers and push
 * what's new; on every 15th minute, also re-check recent hotfix / patch-notes
 * threads for edits. On a fresh database, the first tick backfills instead
 * (history without pushes, so the poller doesn't push a backlog).
 *
 * Called by the in-process scheduler (Bun server) or by Vercel Cron through
 * /api/admin/tick. A lease in the `state` table keeps two ticks from running
 * at once (two instances polling together would push the same post twice).
 */
const LEASE_KEY = "lease:tick";
const LEASE_MS = 5 * 60_000; // a crashed tick frees the lease after this

async function acquireLease(): Promise<boolean> {
  const until = new Date(Date.now() + LEASE_MS).toISOString();
  const rows = await db
    .insert(state)
    .values({ key: LEASE_KEY, value: until })
    .onConflictDoUpdate({
      target: state.key,
      set: { value: until, updatedAt: new Date() },
      setWhere: sql`${state.value}::timestamptz < now()`,
    })
    .returning({ key: state.key });
  return rows.length > 0;
}

async function releaseLease(): Promise<void> {
  await db.delete(state).where(eq(state.key, LEASE_KEY));
}

export type TickResult =
  | { ran: false }
  | { ran: true; backfilled?: number; fresh: number; fired: number; edited?: number; ms: number };

export async function runTick(now = new Date()): Promise<TickResult> {
  const started = Date.now();
  if (!(await acquireLease())) {
    log.info("tick.skipped", { reason: "another tick is running" });
    return { ran: false };
  }
  try {
    if ((await getState("backfilled")) !== "1") {
      log.info("backfill.start");
      // ~36 s per page (paced at 1 request/s): 10 pages would outlast a
      // serverless function (300 s); the rest of the history isn't needed.
      const r = await backfill(process.env.VERCEL ? 3 : 10);
      await setState("backfilled", "1");
      log.info("backfill.done", r);
      return { ran: true, backfilled: r.fresh, fresh: 0, fired: 0, ms: Date.now() - started };
    }
    const { fresh, fired } = await pollAll();
    const edits = now.getUTCMinutes() % 15 === 0 ? await refreshEdits() : null;
    return { ran: true, fresh, fired, ...(edits ? { edited: edits.edited } : {}), ms: Date.now() - started };
  } finally {
    await releaseLease();
  }
}
