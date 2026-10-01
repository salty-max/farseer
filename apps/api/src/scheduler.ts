import cron from "node-cron";
import { pollAll, refreshEdits } from "@/lib/ingest";
import { log } from "@/lib/log";

/** Run a job unless the previous run of it is still going. */
function guarded(name: string, job: () => Promise<unknown>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (err) {
      log.error(`${name}.crash`, { err: String(err) });
    } finally {
      running = false;
    }
  };
}

/**
 * In-process scheduler (the server is a long-lived process on Northflank):
 *   - every minute: poll the US + EU blue trackers (2 requests when idle) and
 *     push anything new
 *   - every 15 min: re-check recent hotfix / patch-notes threads for edits
 */
export function startScheduler(): void {
  const poll = guarded("poll", pollAll);
  const edits = guarded("edits", refreshEdits);
  cron.schedule("* * * * *", poll);
  cron.schedule("*/15 * * * *", edits);
  log.info("scheduler.started", { poll: "every minute", edits: "every 15 min" });
  void poll();
}
