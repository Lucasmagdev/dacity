/** Mirrors the defaults in contracts/DacityGang.sol and DacityVault.sol. Keep both in sync. */

export const DACITY_PER_USDC = 100;
export const BOX_PRICE_DC = 1_000;
/** "Claim all" charges this per gangster claimed. Claiming one gangster at a time is free. */
export const CLAIM_ALL_FEE_DC = 10;

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
export type FusionRecipe = FarmStats & { from: number; to: number; fee: number };

export const FUSION_RECIPES: FusionRecipe[] = [
  { from: 0, to: 1, fee: 20, perDay: 20, cap: 2_900 }, //  2 × Common    (2,400 cap) → Uncommon
  { from: 1, to: 2, fee: 40, perDay: 28, cap: 4_000 }, //  2 × Uncommon  (3,200 cap) → Rare
  { from: 2, to: 3, fee: 80, perDay: 40, cap: 5_700 }, //  2 × Rare      (4,400 cap) → Epic
  { from: 3, to: 4, fee: 160, perDay: 60, cap: 8_600 }, // 2 × Epic      (6,400 cap) → Legendary
];

/** Recipe that consumes two gangsters of this rarity (undefined for Legendary). */
export const recipeFrom = (rarity: number) => FUSION_RECIPES.find((r) => r.from === rarity);

/** Stats of a fused gangster of this (resulting) rarity. */
export const fusedStats = (rarity: number): FarmStats | undefined => FUSION_RECIPES.find((r) => r.to === rarity);
