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
import { BOX_PRICE_DC, DACITY_PER_USDC, RARITIES } from "../config/game";

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

export type MockGangster = { id: number; rarity: number; mintedAt: number; claimed: number };
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

export function farmedOf(g: MockGangster, now = Date.now()) {
  const r = RARITIES[g.rarity];
  return Math.min(r.cap, (r.perDay * (now - g.mintedAt)) / MOCK_DAY_MS);
}
export const pendingOf = (g: MockGangster, now = Date.now()) => Math.max(0, farmedOf(g, now) - g.claimed);
export const isRetired = (g: MockGangster, now = Date.now()) => farmedOf(g, now) >= RARITIES[g.rarity].cap;
export const isBoxReady = (b: MockBox, now = Date.now()) => now - b.boughtAt >= MOCK_REVEAL_MS;

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
      nextGangsterId: 5,
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

  /** DacityGang.claim(all) */
  claimAll(): number {
    const now = Date.now();
    let total = 0;
    const gangsters = state.gangsters.map((g) => {
      const p = pendingOf(g, now);
      total += p;
      return { ...g, claimed: g.claimed + p };
    });
    if (total <= 0) return 0;
    set({ ...state, gangsters, dc: state.dc + total, stats: { ...state.stats, claimed: state.stats.claimed + total } });
    return total;
  },

  reset() {
    set(initial());
  },
};
