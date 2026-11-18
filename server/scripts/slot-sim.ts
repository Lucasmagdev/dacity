/**
 * Audacity Jackpot: RTP simulation + RNG self-check. Not part of the build.
 *   node server/scripts/slot-sim.ts [rounds=300000]
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import { playRound, seededRandom, sha256Hex, hmacSha256, RULES } from "../src/slot/engine.ts";

// 1) the pure SHA-256 / HMAC match Node's
for (let i = 0; i < 200; i++) {
  const s = randomBytes(i).toString("hex");
  if (sha256Hex(s) !== createHash("sha256").update(s).digest("hex")) throw new Error("sha256 mismatch");
  const k = randomBytes(i % 90);
  const h = Buffer.from(hmacSha256(k, Buffer.from(s))).toString("hex");
  if (h !== createHmac("sha256", k).update(s).digest("hex")) throw new Error("hmac mismatch");
}
// 2) same seeds → same round
const a = playRound(seededRandom("server", "client", 7), { buy: true, maxWinX: 5000 });
const b = playRound(seededRandom("server", "client", 7), { buy: true, maxWinX: 5000 });
if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("not deterministic");
console.log("rng ok");

// 3) RTP
const N = Number(process.argv[2] || 300000);
const MAXW = 5000;
let paid = 0, hits = 0, heists = 0, heistPaid = 0, big = 0, cap = 0;
const jp: Record<string, number> = {};
for (let i = 0; i < N; i++) {
  const r = playRound(Math.random, { buy: false, maxWinX: MAXW });
  paid += r.totalX;
  if (r.totalX > 0) hits++;
  if (r.totalX >= 10) big++;
  if (r.capped) cap++;
  if (r.triggered) { heists++; heistPaid += r.free.reduce((t, s) => t + s.winX, 0); }
  for (const j of r.jackpots) jp[j] = (jp[j] ?? 0) + 1;
}
const B = 5000;
let buyPaid = 0;
for (let i = 0; i < B; i++) buyPaid += playRound(Math.random, { buy: true, maxWinX: MAXW }).totalX;
const BUY_COST = 60;
console.log({
  rtp: (paid / N).toFixed(4),
  hitRate: (hits / N).toFixed(3),
  heistEvery: Math.round(N / heists),
  avgHeistX: (heistPaid / heists).toFixed(1),
  bigWinEvery: Math.round(N / big),
  capped: cap,
  buyRtp: (buyPaid / B / BUY_COST).toFixed(4),
  jackpots: jp,
  heistSpins: RULES.heistSpins,
});
