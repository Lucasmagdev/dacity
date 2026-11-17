/**
 * $AMMO price feed: every 30s, read the USD price (DexScreener, Jupiter as fallback) and record it.
 * The database prices items with the 10-minute average of these samples and pauses AMMO purchases if
 * no fresh sample arrives (feed down), so a short price spike can't be used to buy items cheap.
 */
import { env } from "../env.js";
import { call } from "../db.js";
import { log } from "../log.js";

async function dexScreener(mint: string): Promise<number> {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`dexscreener ${r.status}`);
  const d = (await r.json()) as { pairs?: { priceUsd?: string; liquidity?: { usd?: number } }[] | null };
  const best = (d.pairs ?? [])
    .filter((p) => Number(p.priceUsd) > 0)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  if (!best) throw new Error("dexscreener: no pair yet");
  return Number(best.priceUsd);
}

async function jupiter(mint: string): Promise<number> {
  const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`jupiter ${r.status}`);
  const d = (await r.json()) as Record<string, { usdPrice?: number } | undefined>;
  const p = d[mint]?.usdPrice;
  if (!p || !(p > 0)) throw new Error("jupiter: no price yet");
  return p;
}

let lastSource = "";

export async function priceTick() {
  if (!env.ammoMint) return; // pre-launch: the database uses the launch reference price
  let price: number;
  let source: string;
  try {
    price = await dexScreener(env.ammoMint);
    source = "dexscreener";
  } catch (e) {
    price = await jupiter(env.ammoMint);
    source = "jupiter";
    if (lastSource !== source) log.warn("price", `DexScreener failed (${(e as Error).message}), using Jupiter`);
  }
  lastSource = source;
  await call("record_price", { p_price_usd: price, p_source: source });
}
