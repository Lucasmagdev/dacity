/** Mirrors the defaults in contracts/DacityGang.sol and DacityVault.sol. Keep both in sync. */

export const DACITY_PER_USDC = 100;
/** Regular box price: 300 DC = $3.00. */
export const BOX_PRICE_DC = 300;

/** Max boxes in one purchase (one tx). */
export const MAX_BOXES_PER_ORDER = 1_000;

/** Launch sale: the first `boxes` boxes sold game-wide cost `priceDc` each (50% off). */
export const LAUNCH_SALE = { boxes: 250, priceDc: 150 };

/**
 * Bulk discounts by order size, on regular-price boxes only (they don't stack with the launch price).
 * Highest matching tier wins.
 */
export const BULK_TIERS = [
  { min: 1_000, pct: 40 },
  { min: 100, pct: 25 },
  { min: 50, pct: 15 },
];

export type BoxQuote = {
  count: number;
  launchQty: number;
  regularQty: number;
  /** bulk discount % applied to the regular-price boxes */
  pct: number;
  totalDc: number;
  /** what the same boxes would cost at the regular price with no discount */
  fullDc: number;
  savedDc: number;
  /** next bulk tier this order could reach, if any */
  next: { min: number; pct: number; more: number } | null;
};

/** Price an order given how many boxes have already been sold game-wide. */
export function quoteBoxes(count: number, soldSoFar: number): BoxQuote {
  const launchLeft = Math.max(0, LAUNCH_SALE.boxes - soldSoFar);
  const launchQty = Math.min(count, launchLeft);
  const regularQty = count - launchQty;
  const pct = BULK_TIERS.find((t) => count >= t.min)?.pct ?? 0;
  const regularDc = Math.round(regularQty * BOX_PRICE_DC * (1 - pct / 100));
  const totalDc = launchQty * LAUNCH_SALE.priceDc + regularDc;
  const fullDc = count * BOX_PRICE_DC;
  const nextTier = [...BULK_TIERS].reverse().find((t) => count < t.min);
  return {
    count,
    launchQty,
    regularQty,
    pct,
    totalDc,
    fullDc,
    savedDc: fullDc - totalDc,
    next: nextTier && nextTier.min <= MAX_BOXES_PER_ORDER ? { ...nextTier, more: nextTier.min - count } : null,
  };
}
// ------------------------------------------------------------------ $RESOURCE (burn token)

/**
 * $RESOURCE: the game's on-chain token, launched on the Poons launchpad on Robinhood Chain.
 * Every item and fee in the game is paid in RESOURCE and 100% of it is BURNED (supply only goes down).
 * Boxes stay in DC. Farming, claims and the Vault stay in DC.
 *
 * PLACEHOLDER AMOUNTS: the token price is only known after launch, so every RESOURCE price below
 * must be re-set then (aim for the same dollar value the old DC prices had).
 */
export const RESOURCE = {
  ticker: "RESOURCE",
  /** Fixed supply: no mint function, it can only go down through burns. */
  totalSupply: 1_000_000_000,
  /** Tax on every buy/sell. 100% of it goes to the game's reward pool. */
  taxPct: 2,
  launchpad: "Poons",
  /** Poons launchpad page, set once the token is live. Empty = link hidden. */
  buyUrl: "",
  /** Token contract, set once deployed. Empty = shown as "announced at launch". */
  address: "",
};

/** "Claim all" charges this per gangster claimed (in RESOURCE, burned). Claiming one gangster at a time is free. */
export const CLAIM_ALL_FEE_RES = 100;

/** Season start shown in the hero countdown. Override with VITE_SEASON_START (ISO date). */
export const SEASON_START = new Date(import.meta.env.VITE_SEASON_START || "2026-12-12T20:00:00Z");

/** Footer social links. Empty url = hidden. */
export const SOCIALS: { label: string; url: string; icon: "x" | "discord" | "telegram" }[] = [
  { label: "X", url: "", icon: "x" },
  { label: "Discord", url: "", icon: "discord" },
  { label: "Telegram", url: "", icon: "telegram" },
];

export type Protagonist = {
  id: 1 | 2;
  name: string;
  alias: string;
  role: string;
  bio: string;
  image: string;
  accent: string;
  variant: "nina" | "rico";
};

export const PROTAGONISTS: Protagonist[] = [
  {
    id: 1,
    name: "Nina Solano",
    alias: "The Accountant",
    role: "Brains",
    bio: "Laundered money for half the waterfront before deciding the other half would be hers. Plans every job on a spreadsheet.",
    image: "/characters/nina.webp",
    accent: "#ff2e88",
    variant: "nina",
  },
  {
    id: 2,
    name: "Rico Tavares",
    alias: "The Driver",
    role: "Muscle",
    bio: "Ex-getaway driver who never lost a chase. Done driving for other people: now he wants the wheel of the whole city.",
    image: "/characters/rico.webp",
    accent: "#22e4ff",
    variant: "rico",
  },
];

export type Rarity = {
  id: number;
  name: string;
  chance: number; // %
  perDay: number; // DACITY
  cap: number; // DACITY lifetime
  color: string;
};

export const RARITIES: Rarity[] = [
  { id: 0, name: "Common", chance: 60, perDay: 10, cap: 1_200, color: "#a7afc2" },
  { id: 1, name: "Uncommon", chance: 25, perDay: 14, cap: 1_600, color: "#3ddc84" },
  { id: 2, name: "Rare", chance: 10, perDay: 20, cap: 2_200, color: "#2fb4ff" },
  { id: 3, name: "Epic", chance: 4, perDay: 30, cap: 3_200, color: "#b45cff" },
  { id: 4, name: "Legendary", chance: 1, perDay: 50, cap: 5_000, color: "#ffb020" },
];

export const fmt = (n: number) => n.toLocaleString("en-US");

// ------------------------------------------------------------------ fusion

export type FarmStats = { perDay: number; cap: number };

/**
 * Fusion recipes: 2 gangsters of `from` rarity → 1 fused gangster of the next rarity (`to`).
 * Legendary is the top rarity and cannot be fused.
 *
 * Tuning rules:
 *  - perDay = both parents combined, so fusing never lowers your daily income
 *    (and a fused gangster always beats a regular one of the same rarity).
 *  - cap    = both parents' caps combined + 20% / 25% / 30% / 35%, rounded to 100.
 *  - fee    = doubles each tier. It is ~3–5% of the extra DC the fusion unlocks.
 */
/** `fee` is in RESOURCE and burned. */
export type FusionRecipe = FarmStats & { from: number; to: number; fee: number };

export const FUSION_RECIPES: FusionRecipe[] = [
  { from: 0, to: 1, fee: 200, perDay: 20, cap: 2_900 }, //  2 × Common    (2,400 cap) → Uncommon
  { from: 1, to: 2, fee: 400, perDay: 28, cap: 4_000 }, //  2 × Uncommon  (3,200 cap) → Rare
  { from: 2, to: 3, fee: 800, perDay: 40, cap: 5_700 }, //  2 × Rare      (4,400 cap) → Epic
  { from: 3, to: 4, fee: 1_600, perDay: 60, cap: 8_600 }, // 2 × Epic      (6,400 cap) → Legendary
];

/** Recipe that consumes two gangsters of this rarity (undefined for Legendary). */
export const recipeFrom = (rarity: number) => FUSION_RECIPES.find((r) => r.from === rarity);

/** Stats of a fused gangster of this (resulting) rarity. */
export const fusedStats = (rarity: number): FarmStats | undefined => FUSION_RECIPES.find((r) => r.to === rarity);

// ------------------------------------------------------------------ shootouts

/**
 * Chance (%) per farming day that a gangster takes a bullet, by rarity. Higher rarity = harder to hit.
 * A shot gangster stops farming until it's healed with a med kit. Fused gangsters use their rarity's chance.
 */
export const SHOT_CHANCE_PER_DAY = [4, 3, 2, 1.5, 1];

/** One med kit heals one shot gangster, any rarity. Price in RESOURCE (burned). */
export const MEDKIT_PRICE_RES = 500;

// ------------------------------------------------------------------ the armory (item shop)

/** Shop name shown in the nav and page title. Keep it original: no names from existing games. */
export const STORE_NAME = "The Armory";

export type WeaponId = "pistol" | "smg" | "rifle";

/**
 * Weapons boost one gangster's farm by `boostPct` for `days` farming days (shot time doesn't count).
 * The bonus is extra DC on top of the career cap. One weapon per gangster; equipping another replaces it.
 * Worth more on high-rarity and fused gangsters, since the boost is a % of their rate.
 */
/** Prices in RESOURCE (burned). */
export const WEAPONS: Record<WeaponId, { id: WeaponId; name: string; boostPct: number; days: number; priceRes: number; blurb: string }> = {
  pistol: { id: "pistol", name: "Pistol", boostPct: 15, days: 30, priceRes: 400, blurb: "Cheap and reliable. Keeps the street honest." },
  smg: { id: "smg", name: "SMG", boostPct: 30, days: 30, priceRes: 900, blurb: "Spray and collect. Debtors pay faster." },
  rifle: { id: "rifle", name: "Rifle", boostPct: 50, days: 30, priceRes: 1_600, blurb: "Heavy hardware for your top earners." },
};

/** Absorbs the next bullet, then it's gone. One per gangster. */
export const VEST = { name: "Kevlar vest", priceRes: 350 };

export const fmtRes = (n: number) => `${Math.round(n).toLocaleString("en-US")} RESOURCE`;
