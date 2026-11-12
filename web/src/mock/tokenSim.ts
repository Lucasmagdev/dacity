/**
 * $RESOURCE network SIMULATOR (mock only).
 *
 * The token isn't live yet and mock mode has a single player, so the token page would sit still.
 * This generates believable game-wide activity (other bosses buying med kits, weapons, vests, fusing,
 * claiming all, and trading the token) so the page can be built and tuned. Your own burns are added
 * on top. The page labels it as simulated.
 *
 * Deterministic: each minute since `simStart` is seeded by its index, so numbers survive reloads and
 * "new" burns appear in real time as the clock passes their timestamp.
 *
 * In production, replace with on-chain reads: totalSupply(), Transfer(to = 0x0 / dead) events for burns,
 * the game contract's ItemBought / Fused / ClaimedAll events for categories, and the pool balance.
 */
import { CLAIM_ALL_FEE_RES, FUSION_RECIPES, MEDKIT_PRICE_RES, RESOURCE, VEST, WEAPONS } from "../config/game";

export type BurnCategory = "medkit" | "weapon" | "vest" | "fusion" | "claimAll";

export type BurnEvent = { at: number; amount: number; category: BurnCategory; who: string; label: string };

const MIN = 60_000;
const KEY = "dacity.tokensim.start";
/** history shown when the simulator first runs */
const HISTORY_MS = 3 * 24 * 60 * MIN;

function simStart() {
  try {
    const v = Number(localStorage.getItem(KEY));
    if (v > 0) return v;
    const start = Math.floor((Date.now() - HISTORY_MS) / MIN) * MIN;
    localStorage.setItem(KEY, String(start));
    return start;
  } catch {
    return Math.floor((Date.now() - HISTORY_MS) / MIN) * MIN;
  }
}

/** mulberry32: tiny seeded PRNG */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("");

type Bucket = { burns: BurnEvent[]; volume: number; volumeAt: number };

const cache = new Map<number, Bucket>();

/** Activity in minute `i` after simStart. Busier in the evening (UTC), like a real game. */
function bucket(start: number, i: number): Bucket {
  const hit = cache.get(i);
  if (hit) return hit;
  const r = rng(i * 2654435761 + 1337);
  const t0 = start + i * MIN;
  const hour = new Date(t0).getUTCHours();
  const busy = 0.55 + 0.45 * Math.sin(((hour - 8) / 24) * Math.PI * 2) + 0.35; // ~0.45..1.35
  const n = Math.floor(r() * 2.2 * busy + r() * 0.8);
  const burns: BurnEvent[] = [];
  for (let k = 0; k < n; k++) {
    const who = `0x${hex(r, 4)}…${hex(r, 4)}`;
    const at = t0 + Math.floor(r() * MIN);
    const x = r();
    if (x < 0.34) burns.push({ at, who, category: "medkit", amount: MEDKIT_PRICE_RES, label: "Med kit" });
    else if (x < 0.58) {
      const g = 1 + Math.floor(r() * 9);
      burns.push({ at, who, category: "claimAll", amount: CLAIM_ALL_FEE_RES * g, label: `Claim all · ${g} gangsters` });
    } else if (x < 0.8) {
      const ws = Object.values(WEAPONS);
      const w = ws[Math.min(ws.length - 1, Math.floor(r() ** 1.6 * ws.length))];
      burns.push({ at, who, category: "weapon", amount: w.priceRes, label: w.name });
    } else if (x < 0.9) burns.push({ at, who, category: "vest", amount: VEST.priceRes, label: VEST.name });
    else {
      const f = FUSION_RECIPES[Math.min(FUSION_RECIPES.length - 1, Math.floor(r() ** 2 * FUSION_RECIPES.length))];
      burns.push({ at, who, category: "fusion", amount: f.fee, label: "Fusion" });
    }
  }
  const b: Bucket = { burns, volume: Math.round((2_000 + r() * 38_000) * busy), volumeAt: t0 + Math.floor(r() * MIN) };
  cache.set(i, b);
  return b;
}

export type TokenSnapshot = {
  simBurned: number;
  burned24h: number;
  burned1h: number;
  byCategory: Record<BurnCategory, { amount: number; count: number }>;
  volume24h: number;
  taxTotal: number;
  tax24h: number;
  recent: BurnEvent[];
  /** supply at hourly points over the last 24h (oldest first), simulated burns only */
  supply24h: { t: number; burnedBefore: number }[];
};

/** Everything the token page needs, as of `now`. */
export function snapshot(now = Date.now()): TokenSnapshot {
  const start = simStart();
  const last = Math.floor((now - start) / MIN);
  const day = now - 24 * 60 * MIN;
  const hour = now - 60 * MIN;
  const byCategory: TokenSnapshot["byCategory"] = {
    medkit: { amount: 0, count: 0 },
    weapon: { amount: 0, count: 0 },
    vest: { amount: 0, count: 0 },
    fusion: { amount: 0, count: 0 },
    claimAll: { amount: 0, count: 0 },
  };
  let simBurned = 0;
  let burned24h = 0;
  let burned1h = 0;
  let volumeTotal = 0;
  let volume24h = 0;
  const recent: BurnEvent[] = [];
  // hourly checkpoints for the chart
  const points = Array.from({ length: 25 }, (_, h) => ({ t: now - (24 - h) * 60 * MIN, burnedBefore: 0 }));

  for (let i = 0; i <= last; i++) {
    const b = bucket(start, i);
    for (const e of b.burns) {
      if (e.at > now) continue;
      simBurned += e.amount;
      byCategory[e.category].amount += e.amount;
      byCategory[e.category].count++;
      if (e.at > day) burned24h += e.amount;
      if (e.at > hour) burned1h += e.amount;
      if (e.at > now - 10 * MIN) recent.push(e);
      for (const p of points) if (e.at <= p.t) p.burnedBefore += e.amount;
    }
    if (b.volumeAt <= now) {
      volumeTotal += b.volume;
      if (b.volumeAt > day) volume24h += b.volume;
    }
  }
  recent.sort((a, b) => b.at - a.at);
  const tax = RESOURCE.taxPct / 100;
  return {
    simBurned,
    burned24h,
    burned1h,
    byCategory,
    volume24h,
    taxTotal: volumeTotal * tax,
    tax24h: volume24h * tax,
    recent: recent.slice(0, 30),
    supply24h: points,
  };
}
