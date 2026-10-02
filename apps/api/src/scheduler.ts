import cron from "node-cron";
import { log } from "@/lib/log";
import { runTick } from "@/lib/tick";

/**
 * In-process scheduler for the Bun server (local dev, Docker): one tick every
 * minute (see lib/tick.ts: poll, edits every 15 min, backfill on a fresh
 * database). On Vercel, Vercel Cron calls /api/admin/tick instead. All forum
 * requests share one pacer (≥ 250 ms apart, 1 s during a backfill), see
 * lib/blizzard.ts.
 */
export function startScheduler(): void {
  const tick = async () => {
    try {
      await runTick();
    } catch (err) {
      log.error("tick.crash", { err: String(err) });
    }
  };
  cron.schedule("* * * * *", tick);
  log.info("scheduler.started", { tick: "every minute (edits every 15 min)" });
  void tick();
}
