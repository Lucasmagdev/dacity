/**
 * Audacity Game payment server (Railway).
 *
 *   price        every 30s   $AMMO USD price → database (items are priced from its 10-min average)
 *   deposits     every 15s   find USDC / AMMO transfers on Solana and credit them (+ instantly on request)
 *   withdrawals  every 20s   mark withdrawals the players sent as 'sent'
 *   burns        every 5min  burn the AMMO spent in the game, on-chain
 *   + the HTTP API the web app uses for deposits and withdrawals
 */
import { env } from "./env.js";
import { ammo, pool } from "./chain.js";
import { INSTANCE } from "./db.js";
import { log } from "./log.js";
import { startHttp } from "./http.js";
import { every, stopJobs } from "./jobs/runner.js";
import { priceTick } from "./jobs/price.js";
import { depositsTick } from "./jobs/deposits.js";
import { withdrawalsTick } from "./jobs/withdrawals.js";
import { burnsTick } from "./jobs/burns.js";

log.info("boot", "starting", {
  instance: INSTANCE,
  network: env.network,
  pool: pool.publicKey.toBase58(),
  ammoWallet: ammo.publicKey.toBase58(),
  ammoMint: env.ammoMint || "(not launched)",
  workers: env.workers,
});

const server = startHttp();

if (env.workers) {
  every("price", 30_000, priceTick);
  every("deposits", 15_000, depositsTick);
  every("withdrawals", 20_000, withdrawalsTick);
  every("burns", 5 * 60_000, burnsTick);
}

const shutdown = (sig: string) => {
  log.info("boot", `${sig}: shutting down`);
  stopJobs();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (e) => log.error("boot", "unhandled rejection", { error: String(e) }));
