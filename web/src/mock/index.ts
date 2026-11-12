/**
 * MOCK MODE
 * ---------
 * Fake, browser-only game state so the whole flow (found gang → deposit → buy/open boxes → farm → claim)
 * can be clicked through before the contracts are deployed. Nothing here touches a wallet or chain.
 *
 * On by default while `contracts/deployments.json` is empty. Force with VITE_MOCK=1 / VITE_MOCK=0.
 * State lives in localStorage under STORAGE_KEY; "Reset" in the HQ banner wipes it.
 */
import { useSyncExternalStore } from "react";
import deployments from "../contracts/deployments.json";
import { BOX_PRICE_DC, CLAIM_ALL_FEE_DC, DACITY_PER_USDC, RARITIES, fusedStats, recipeFrom, type FarmStats } from "../config/game";

const envMock = import.meta.env.VITE_MOCK as string | undefined;
export const MOCK = envMock === "1" || (envMock !== "0" && Object.keys(deployments).length === 0);

/** One in-game farming "day" lasts this long in mock mode, so numbers visibly move. */
export const MOCK_DAY_MS = 60_000;
/** Simulates the contract's commit-reveal wait (REVEAL_DELAY blocks). */
export const MOCK_REVEAL_MS = 2_500;
export const MAX_BOXES_PER_TX = 10;

// ------------------------------------------------------------------ archetypes (off-chain metadata)

export type Headwear = "none" | "cap" | "fedora" | "captain" | "hood" | "beanie" | "bandana";
export type Hair = "short" | "bun" | "slick" | "mohawk" | "silver" | "curly" | "none";
export type Prop =
  | "wheel"
  | "earpiece"
  | "laptop"
  | "crate"
  | "cards"
  | "cash"
  | "bat"
  | "loupe"
  | "wrench"
  | "cue"
  | "bag"
  | "cane";

export type Archetype = {
  id: number;
  title: string;
  nick: string;
  skin: string;
  hair: Hair;
  hairColor: string;
  headwear: Headwear;
  outfit: string;
  outfitTrim: string;
  pants: string;
  prop: Prop;
  shades?: boolean;
  visor?: boolean;
  chain?: boolean;
  flavor: string;
};

/** Mirrors art/leonardo-prompts.md section E. Archetype = gangsterId % ARCHETYPES.length. */
export const ARCHETYPES: Archetype[] = [
  { id: 0, title: "Getaway Driver", nick: "Wheels", skin: "#c68863", hair: "short", hairColor: "#2b1a12", headwear: "cap", outfit: "#f2f2f2", outfitTrim: "#22e4ff", pants: "#1d2340", prop: "wheel", flavor: "Never missed a green light." },
  { id: 1, title: "Club Bouncer", nick: "The Wall", skin: "#6b4128", hair: "none", hairColor: "#000", headwear: "none", outfit: "#16121f", outfitTrim: "#ff2e88", pants: "#16121f", prop: "earpiece", shades: true, flavor: "Name's not on the list." },
  { id: 2, title: "Hacker", nick: "Glitch", skin: "#e2b08c", hair: "bun", hairColor: "#ff2e88", headwear: "hood", outfit: "#3a2a6b", outfitTrim: "#22e4ff", pants: "#151026", prop: "laptop", visor: true, flavor: "Your firewall says hi." },
  { id: 3, title: "Dock Smuggler", nick: "Salty", skin: "#b07a52", hair: "curly", hairColor: "#5a3a22", headwear: "captain", outfit: "#ffcc33", outfitTrim: "#1d1d1d", pants: "#283048", prop: "crate", flavor: "Nothing to declare." },
  { id: 4, title: "Card Dealer", nick: "Ace", skin: "#f0c4a0", hair: "slick", hairColor: "#141014", headwear: "none", outfit: "#7a1236", outfitTrim: "#ffd36b", pants: "#141014", prop: "cards", flavor: "The house always wins. He is the house." },
  { id: 5, title: "Skate Hustler", nick: "Roller", skin: "#8a5a3c", hair: "curly", hairColor: "#1b120c", headwear: "bandana", outfit: "#ff8a3d", outfitTrim: "#22e4ff", pants: "#2a1a4a", prop: "cash", flavor: "Fast hands, faster wheels." },
  { id: 6, title: "Enforcer", nick: "Knuckles", skin: "#d39a74", hair: "mohawk", hairColor: "#22e4ff", headwear: "none", outfit: "#101014", outfitTrim: "#ff2e88", pants: "#24242c", prop: "bat", chain: true, flavor: "Collects debts. Personally." },
  { id: 7, title: "Counterfeiter", nick: "Inky", skin: "#e8b896", hair: "short", hairColor: "#7a7a80", headwear: "none", outfit: "#4d6b52", outfitTrim: "#ffd36b", pants: "#2c2c30", prop: "loupe", flavor: "Prints money. Literally." },
  { id: 8, title: "Mechanic", nick: "Grease", skin: "#9c6646", hair: "short", hairColor: "#1b120c", headwear: "beanie", outfit: "#2f5a8a", outfitTrim: "#ff8a3d", pants: "#2f5a8a", prop: "wrench", flavor: "Fixes cars. And problems." },
  { id: 9, title: "Pool Shark", nick: "Eight Ball", skin: "#c68863", hair: "slick", hairColor: "#2b1a12", headwear: "fedora", outfit: "#1f6b5a", outfitTrim: "#f2f2f2", pants: "#141014", prop: "cue", flavor: "Corner pocket. Your wallet." },
  { id: 10, title: "Jet-Ski Courier", nick: "Splash", skin: "#a8724e", hair: "short", hairColor: "#ffd36b", headwear: "none", outfit: "#0f2f4a", outfitTrim: "#22e4ff", pants: "#0f2f4a", prop: "bag", shades: true, flavor: "Delivers by sea. No receipts." },
  { id: 11, title: "Old Boss", nick: "Don Silva", skin: "#e0b090", hair: "silver", hairColor: "#d8d8de", headwear: "fedora", outfit: "#2a2a3a", outfitTrim: "#ffd36b", pants: "#2a2a3a", prop: "cane", chain: true, flavor: "Ran this city before you were born." },
];

export const archetypeOf = (gangsterId: number) => ARCHETYPES[gangsterId % ARCHETYPES.length];

// ------------------------------------------------------------------ state

export type MockGangster = { id: number; rarity: number; mintedAt: number; claimed: number; fused?: boolean };
export type MockBox = { id: number; boughtAt: number };
export type MockGang = { protagonist: 1 | 2; name: string; createdAt: number };

export type MockState = {
  gang: MockGang | null;
  usdc: number; // fake wallet USDC
  dc: number; // DACITY balance
  boxes: MockBox[];
  gangsters: MockGangster[];
  nextGangsterId: number;
  nextBoxId: number;
  stats: { deposited: number; claimed: number; opened: number };
};

const STORAGE_KEY = "dacity.mock.v1";

const initial = (): MockState => ({
  gang: null,
  usdc: 500,
  dc: 0,
  boxes: [],
  gangsters: [],
  nextGangsterId: 1,
  nextBoxId: 1,
  stats: { deposited: 0, claimed: 0, opened: 0 },
});

function load(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initial(), ...JSON.parse(raw) };
  } catch {
    /* private mode / corrupted: start fresh */
  }
  return initial();
}

let state: MockState = load();
const listeners = new Set<() => void>();

function set(next: MockState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useMock<T = MockState>(select: (s: MockState) => T = (s) => s as unknown as T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => select(state),
  );
}

// ------------------------------------------------------------------ farming math (mirrors DacityGang.pendingOf)

/** Daily rate and career cap: the rarity's defaults, or the fused version. */
// (falls back to the base rarity for fused gangsters saved by older builds, e.g. a fused Common)
export const statsOf = (g: MockGangster): FarmStats => (g.fused && fusedStats(g.rarity)) || RARITIES[g.rarity];

export function farmedOf(g: MockGangster, now = Date.now()) {
  const s = statsOf(g);
  return Math.min(s.cap, (s.perDay * (now - g.mintedAt)) / MOCK_DAY_MS);
}
export const pendingOf = (g: MockGangster, now = Date.now()) => Math.max(0, farmedOf(g, now) - g.claimed);
export const isRetired = (g: MockGangster, now = Date.now()) => farmedOf(g, now) >= statsOf(g).cap;

/**
 * Gangsters of `rarity` that can be fused: still farming (not retired) and not fused already.
 * Sorted closest-to-retirement first, the first two are the ones a fusion consumes.
 */
export function fusionCandidates(gangsters: MockGangster[], rarity: number, now = Date.now()) {
  return gangsters
    .filter((g) => g.rarity === rarity && !g.fused && !isRetired(g, now))
    .sort((a, b) => farmedOf(b, now) / statsOf(b).cap - farmedOf(a, now) / statsOf(a).cap);
}
export const isBoxReady = (b: MockBox, now = Date.now()) => now - b.boughtAt >= MOCK_REVEAL_MS;

/**
 * What "Claim all" would do right now. Only gangsters whose pending is above the per-gangster fee
 * are included, so claiming all never costs more than it pays out for any single gangster.
 */
export function claimAllQuote(gangsters: MockGangster[], now = Date.now()) {
  const ids: number[] = [];
  let gross = 0;
  for (const g of gangsters) {
    const p = pendingOf(g, now);
    if (p > CLAIM_ALL_FEE_DC) {
      ids.push(g.id);
      gross += p;
    }
  }
  const fee = ids.length * CLAIM_ALL_FEE_DC;
  return { ids, gross, fee, net: gross - fee };
}

function rollRarity(): number {
  const total = RARITIES.reduce((a, r) => a + r.chance, 0);
  let x = Math.random() * total;
  for (const r of RARITIES) {
    if ((x -= r.chance) < 0) return r.id;
  }
  return 0;
}

// ------------------------------------------------------------------ actions (mirror contract calls)

export const mock = {
  /** DacityGang.createGang. Seeds a small demo so HQ isn't empty. */
  createGang(protagonist: 1 | 2, name: string) {
    const now = Date.now();
    const demo: MockGangster[] = [
      { id: 1, rarity: 0, mintedAt: now - MOCK_DAY_MS * 40, claimed: 0 },
      { id: 2, rarity: 1, mintedAt: now - MOCK_DAY_MS * 6, claimed: 0 },
      { id: 3, rarity: 2, mintedAt: now - MOCK_DAY_MS * 2, claimed: 0 },
      { id: 4, rarity: 3, mintedAt: now - MOCK_DAY_MS * 0.5, claimed: 0 },
      { id: 5, rarity: 0, mintedAt: now - MOCK_DAY_MS * 15, claimed: 0 }, // 2nd Common so Fusion can be tried right away
    ];
    set({
      ...initial(),
      gang: { protagonist, name, createdAt: now },
      dc: 1_500,
      boxes: [
        { id: 1, boughtAt: now - MOCK_REVEAL_MS },
        { id: 2, boughtAt: now - MOCK_REVEAL_MS },
      ],
      gangsters: demo,
      nextGangsterId: 6,
      nextBoxId: 3,
    });
  },

  /** DacityVault.deposit */
  deposit(usdc: number) {
    if (!(usdc > 0) || usdc > state.usdc) throw new Error("Not enough USDC");
    set({
      ...state,
      usdc: state.usdc - usdc,
      dc: state.dc + usdc * DACITY_PER_USDC,
      stats: { ...state.stats, deposited: state.stats.deposited + usdc },
    });
  },

  /** Vault withdraw: burns DC, returns USDC at the same 100:1 rate. */
  withdraw(dc: number) {
    if (!(dc > 0) || dc > state.dc) throw new Error("Not enough DACITY");
    set({ ...state, dc: state.dc - dc, usdc: state.usdc + dc / DACITY_PER_USDC });
  },

  /** MockUSDC.faucet */
  faucet() {
    set({ ...state, usdc: state.usdc + 1_000 });
  },

  /** DacityGang.buyBoxes */
  buyBoxes(count: number) {
    const cost = count * BOX_PRICE_DC;
    if (count < 1 || count > MAX_BOXES_PER_TX) throw new Error(`1 to ${MAX_BOXES_PER_TX} boxes per tx`);
    if (cost > state.dc) throw new Error("Not enough DACITY");
    const now = Date.now();
    const boxes = Array.from({ length: count }, (_, i) => ({ id: state.nextBoxId + i, boughtAt: now }));
    set({ ...state, dc: state.dc - cost, boxes: [...state.boxes, ...boxes], nextBoxId: state.nextBoxId + count });
  },

  /** DacityGang.openBox → returns the minted gangster */
  openBox(boxId: number): MockGangster {
    const box = state.boxes.find((b) => b.id === boxId);
    if (!box) throw new Error("Box not found");
    if (!isBoxReady(box)) throw new Error("Box not ready yet");
    const g: MockGangster = { id: state.nextGangsterId, rarity: rollRarity(), mintedAt: Date.now(), claimed: 0 };
    set({
      ...state,
      boxes: state.boxes.filter((b) => b.id !== boxId),
      gangsters: [g, ...state.gangsters],
      nextGangsterId: state.nextGangsterId + 1,
      stats: { ...state.stats, opened: state.stats.opened + 1 },
    });
    return g;
  },

  /** Claim a single gangster. Free. */
  claim(gangsterId: number): number {
    const now = Date.now();
    const g = state.gangsters.find((x) => x.id === gangsterId);
    if (!g) throw new Error("Gangster not found");
    const p = pendingOf(g, now);
    if (p <= 0) return 0;
    set({
      ...state,
      gangsters: state.gangsters.map((x) => (x.id === gangsterId ? { ...x, claimed: x.claimed + p } : x)),
      dc: state.dc + p,
      stats: { ...state.stats, claimed: state.stats.claimed + p },
    });
    return p;
  },

  /** Claim every gangster with pending > fee in one go, paying CLAIM_ALL_FEE_DC per gangster. Returns the quote applied. */
  claimAll() {
    const now = Date.now();
    const q = claimAllQuote(state.gangsters, now);
    if (q.ids.length === 0 || q.net <= 0) throw new Error("Nothing worth claiming yet");
    const ids = new Set(q.ids);
    set({
      ...state,
      gangsters: state.gangsters.map((g) => (ids.has(g.id) ? { ...g, claimed: g.claimed + pendingOf(g, now) } : g)),
      dc: state.dc + q.net,
      stats: { ...state.stats, claimed: state.stats.claimed + q.net },
    });
    return q;
  },

  /**
   * DacityGang.fuse: burns the two gangsters of `rarity` closest to retirement and mints one fused gangster
   * of the NEXT rarity with a fresh career. Their pending DC is paid out first (free), then the fee is charged.
   */
  fuse(rarity: number) {
    const recipe = recipeFrom(rarity);
    if (!recipe) throw new Error(`${RARITIES[rarity].name} is the top rarity and can't be fused`);
    const now = Date.now();
    const [a, b] = fusionCandidates(state.gangsters, rarity, now);
    if (!a || !b) throw new Error(`Need 2 active ${RARITIES[rarity].name} gangsters`);
    const payout = pendingOf(a, now) + pendingOf(b, now);
    if (state.dc + payout < recipe.fee) throw new Error(`Need ${recipe.fee} DC to fuse`);
    const child: MockGangster = { id: state.nextGangsterId, rarity: recipe.to, mintedAt: now, claimed: 0, fused: true };
    set({
      ...state,
      dc: state.dc + payout - recipe.fee,
      gangsters: [child, ...state.gangsters.filter((g) => g.id !== a.id && g.id !== b.id)],
      nextGangsterId: state.nextGangsterId + 1,
      stats: { ...state.stats, claimed: state.stats.claimed + payout },
    });
    return { parents: [a, b] as const, child, payout, fee: recipe.fee };
  },

  reset() {
    set(initial());
  },
};
