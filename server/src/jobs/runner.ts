/**
 * Runs each background job on its own timer. Before every run the job takes a lease in the database, so
 * with several server instances only one runs each job at a time. A failing run is logged and retried on
 * the next tick: one bad RPC response never stops the server.
 */
import { acquireLease } from "../db.js";
import { log } from "../log.js";

type Status = { lastRun: string | null; lastOk: string | null; lastError: string | null; runs: number; leader: boolean };
const status: Record<string, Status> = {};

export const jobStatus = () => status;

let stopping = false;
export const stopJobs = () => {
  stopping = true;
};

export function every(name: string, intervalMs: number, fn: () => Promise<void>) {
  const s: Status = (status[name] = { lastRun: null, lastOk: null, lastError: null, runs: 0, leader: false });
  const ttl = Math.ceil((intervalMs * 3) / 1000) + 30;

  const tick = async () => {
    if (stopping) return;
    try {
      s.leader = await acquireLease(name, ttl);
      if (s.leader) {
        s.lastRun = new Date().toISOString();
        s.runs++;
        await fn();
        s.lastOk = new Date().toISOString();
        s.lastError = null;
      }
    } catch (e) {
      s.lastError = (e as Error).message;
      log.error(name, "run failed", { error: s.lastError });
    } finally {
      if (!stopping) setTimeout(tick, intervalMs);
    }
  };
  setTimeout(tick, 1000 + Math.random() * 2000);
}
