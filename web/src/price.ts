/**
 * $AMMO price in USD.
 *
 * Item prices and fees are set in dollars (config/game.ts) and paid in AMMO at the current price,
 * so they cost the same in dollars whether the token is at a $4.6k or a $10M market cap.
 *
 *  - LIVE: once TOKEN.address (the mint) is set, the price comes from DexScreener (free, no key),
 *    with Jupiter's price API as a fallback. $AMMO is paired with TTWO, and both APIs already return
 *    the price converted to USD. The price used is the AVERAGE of the samples from the last
 *    TWAP_WINDOW_MS, not the last tick: at a tiny market cap anyone can spike the price for a minute
 *    to buy items with fewer tokens, and an average makes that expensive.
 *  - SIMULATED: before launch there is no token, so the price comes from a market cap chosen in the
 *    admin panel (default: pump.fun's ~$4.6k starting cap).
 *
 * This runs in the browser for display. With real money the SERVER must fetch the price, average it
 * and lock a quote for ~60s at purchase time: a price computed in the browser can be faked.
 */
import { useSyncExternalStore } from "react";
import { TOKEN } from "./config/game";
import { supabase } from "./backend/supabase";

const POLL_MS = 30_000;
const TWAP_WINDOW_MS = 10 * 60_000;
/** After this long without a fresh sample the live price is considered stale. */
const STALE_MS = 5 * 60_000;
const SIM_KEY = "dacity.simcap";

/** pump.fun tokens start at roughly this market cap. */
export const LAUNCH_MARKET_CAP = 4_600;
export const SIM_MARKET_CAPS = [4_600, 50_000, 100_000, 1_000_000, 10_000_000];

export type AmmoPrice = {
  /** USD per 1 AMMO */
  usd: number;
  marketCap: number;
  source: "live" | "sim";
  updatedAt: number;
  /** live feed configured but no fresh price: purchases should pause on the server */
  stale: boolean;
};

function readSimCap() {
  try {
    const v = Number(localStorage.getItem(SIM_KEY));
    if (v > 0) return v;
  } catch {
    /* ignore */
  }
  return LAUNCH_MARKET_CAP;
}

const simPrice = (): AmmoPrice => {
  const cap = readSimCap();
  return { usd: cap / TOKEN.totalSupply, marketCap: cap, source: "sim", updatedAt: Date.now(), stale: false };
};

let state: AmmoPrice = simPrice();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Admin: choose the simulated market cap (ignored once a live price exists). */
export function setSimMarketCap(cap: number) {
  try {
    localStorage.setItem(SIM_KEY, String(cap));
  } catch {
    /* ignore */
  }
  if (state.source === "sim") {
    state = simPrice();
    emit();
  }
}

// ------------------------------------------------------------------ live feed

const samples: { t: number; p: number }[] = [];

async function fetchDexScreener(mint: string): Promise<number> {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
  if (!r.ok) throw new Error(`dexscreener ${r.status}`);
  const d = (await r.json()) as { pairs?: { priceUsd?: string; liquidity?: { usd?: number } }[] | null };
  // most liquid pair = the most reliable price
  const best = (d.pairs ?? []).filter((p) => Number(p.priceUsd) > 0).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  if (!best) throw new Error("dexscreener: no pair");
  return Number(best.priceUsd);
}

async function fetchJupiter(mint: string): Promise<number> {
  const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`);
  if (!r.ok) throw new Error(`jupiter ${r.status}`);
  const d = (await r.json()) as Record<string, { usdPrice?: number } | undefined>;
  const p = d[mint]?.usdPrice;
  if (!p || !(p > 0)) throw new Error("jupiter: no price");
  return p;
}

async function poll(mint: string) {
  const now = Date.now();
  try {
    const p = await fetchDexScreener(mint).catch(() => fetchJupiter(mint));
    samples.push({ t: now, p });
  } catch {
    /* keep the last samples; marked stale below if they get too old */
  }
  while (samples.length && samples[0].t < now - TWAP_WINDOW_MS) samples.shift();
  if (samples.length === 0) {
    // never got a price (e.g. token not listed yet): stay on the simulated one
    if (state.source === "live") state = { ...state, stale: true };
  } else {
    const usd = samples.reduce((t, s) => t + s.p, 0) / samples.length;
    const last = samples[samples.length - 1].t;
    state = { usd, marketCap: usd * TOKEN.totalSupply, source: "live", updatedAt: last, stale: now - last > STALE_MS };
  }
  emit();
}

/** Live mode: the price players actually pay is the database's (10-minute average or the launch reference). */
async function pollDatabase() {
  if (!supabase) return;
  const { data } = await supabase.from("token_price").select("price_usd, market_cap_usd, prelaunch, updated_at").maybeSingle();
  if (!data?.price_usd) return;
  const usd = Number(data.price_usd);
  state = {
    usd,
    marketCap: Number(data.market_cap_usd),
    source: data.prelaunch ? "sim" : "live",
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
    stale: false,
  };
  emit();
}

const LIVE_DB = import.meta.env.VITE_MOCK === "0" && !!supabase;

if (typeof window !== "undefined" && LIVE_DB) {
  pollDatabase().catch(() => {});
  setInterval(() => pollDatabase().catch(() => {}), 30_000);
} else if (typeof window !== "undefined") {
  if (TOKEN.address) {
    poll(TOKEN.address);
    setInterval(() => poll(TOKEN.address), POLL_MS);
  }
  // admin changed the simulated cap in another tab
  window.addEventListener("storage", (e) => {
    if (e.key === SIM_KEY && state.source === "sim") {
      state = simPrice();
      emit();
    }
  });
}

// ------------------------------------------------------------------ API

export const getAmmoPrice = () => state;

export function useAmmoPrice() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

/** AMMO needed to pay `usd` dollars at the current price (rounded up to a whole token). */
export const ammoFor = (usd: number) => Math.ceil(usd / state.usd);

export const fmtUsd = (usd: number) => `$${usd.toFixed(2)}`;

/** Tiny token prices need significant digits, not 2 decimals: $0.0000046 */
export const fmtTokenPrice = (usd: number) => `$${usd >= 0.01 ? usd.toFixed(4) : usd.toPrecision(3).replace(/e-(\d+)$/, (_, n) => `e-${n}`)}`;

/** $4.6K, $100K, $1M, $2.5M: no trailing zeros. */
export const fmtCap = (n: number) => {
  const short = (v: number, unit: string) => `$${Number(v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2))}${unit}`;
  return n >= 1e9 ? short(n / 1e9, "B") : n >= 1e6 ? short(n / 1e6, "M") : n >= 1e3 ? short(n / 1e3, "K") : `$${n.toFixed(0)}`;
};
