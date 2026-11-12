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
import { platform } from "./platform";
import deployments from "../contracts/deployments.json";
import { CLAIM_ALL_FEE_RES, MAX_BOXES_PER_ORDER, MEDKIT_PRICE_RES, fmtRes, SHOT_CHANCE_PER_DAY, STORE_NAME, VEST, WEAPONS, quoteBoxes, type WeaponId, DACITY_PER_USDC, RARITIES, fusedStats, recipeFrom, type FarmStats } from "../config/game";

const envMock = import.meta.env.VITE_MOCK as string | undefined;
export const MOCK = envMock === "1" || (envMock !== "0" && Object.keys(deployments).length === 0);

/** One in-game farming "day" lasts this long in mock mode, so numbers visibly move. */
export const MOCK_DAY_MS = 60_000;
/** Simulates the contract's commit-reveal wait (REVEAL_DELAY blocks). */
export const MOCK_REVEAL_MS = 2_500;
export const MAX_BOXES_PER_TX = MAX_BOXES_PER_ORDER;

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

export type MockGangster = {
  id: number;
  rarity: number;
  mintedAt: number;
  claimed: number;
  fused?: boolean;
  /** when the next bullet lands (wall time while farming). Re-rolled on every heal. */
  nextShotAt?: number;
  /** total time spent shot and waiting for a med kit, so it doesn't count as farming */
  pausedMs?: number;
  /** equipped weapon; `startActiveMs` = farming time already done when it was equipped */
  weapon?: { id: WeaponId; startActiveMs: number };
  /** weapon bonus earned by previous weapons (kept when a weapon is replaced) */
  bonusBanked?: number;
  /** vest stops the bullet that was due at `absorbAt` */
  vest?: { absorbAt: number };
};
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
  /** Everything the player did, newest first (capped at TX_MAX). */
  txs: MockTx[];
  /** med kits in stock */
  medkits: number;
  /** $RESOURCE in the wallet (spent on items and fees, and burned) */
  resource: number;
  /** unequipped items in stock */
  inventory: { pistol: number; smg: number; rifle: number; vest: number };
};

export type TxType = "gang" | "deposit" | "withdraw" | "faucet" | "buy" | "open" | "claim" | "claimAll" | "fuse" | "gift" | "medkit" | "heal" | "shop" | "equip" | "resource";

export type MockTx = {
  id: string;
  /** fake tx hash, shaped like a real one */
  hash: string;
  at: number;
  type: TxType;
  title: string;
  detail: string;
  /** signed balance changes caused by this tx */
  dc?: number;
  usdc?: number;
  /** RESOURCE spent (negative = burned) */
  resource?: number;
};

const TX_MAX = 500;
const STORE = STORE_NAME;

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
  txs: [],
  medkits: 0,
  resource: 0,
  inventory: { pistol: 0, smg: 0, rifle: 0, vest: 0 },
});

const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

/** Returns `next` with a new tx prepended. */
function withTx(next: MockState, t: Omit<MockTx, "id" | "hash" | "at">): MockState {
  const tx: MockTx = { ...t, id: hex(12), hash: `0x${hex(64)}`, at: Date.now() };
  return { ...next, txs: [tx, ...(next.txs ?? [])].slice(0, TX_MAX) };
}

const plural = (n: number, w: string) => `${n.toLocaleString("en-US")} ${w}${n === 1 ? "" : w.endsWith("x") ? "es" : "s"}`;

function load(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s: MockState = { ...initial(), ...JSON.parse(raw) };
      const now = Date.now();
      s.gangsters = s.gangsters.map((g) => (g.nextShotAt ? g : { ...g, nextShotAt: sampleNextShot(g.rarity, now) }));
      return s;
    }
  } catch {
    /* private mode / corrupted: start fresh */
  }
  return initial();
}

let state: MockState = load();
const listeners = new Set<() => void>();

// keep tabs in sync (admin gifts sent from #/admin in another tab land here without a reload)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    listeners.forEach((l) => l());
  });
}

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

/** Random time until the next shot: exponential with the rarity's daily chance. */
export function sampleNextShot(rarity: number, from = Date.now()) {
  return from + sampleShotGap(rarity);
}

/** Random farming time (ms) until the next bullet. */
function sampleShotGap(rarity: number) {
  const p = SHOT_CHANCE_PER_DAY[rarity] / 100;
  const perDay = -Math.log(1 - p);
  return (-Math.log(1 - Math.random()) / perDay) * MOCK_DAY_MS;
}

/** When this gangster got shot, or null if it's fine. */
export const shotAt = (g: MockGangster, now = Date.now()) => (g.nextShotAt !== undefined && g.nextShotAt <= now ? g.nextShotAt : null);

/** Time actually spent farming: stops at the shot, minus past downtime. */
export const activeMs = (g: MockGangster, now: number) => Math.max(0, (shotAt(g, now) ?? now) - g.mintedAt - (g.pausedMs ?? 0));

export function farmedOf(g: MockGangster, now = Date.now()) {
  const s = statsOf(g);
  return Math.min(s.cap, (s.perDay * activeMs(g, now)) / MOCK_DAY_MS);
}
/** Farming time (ms) at which the career cap is reached. */
const retireAtActive = (g: MockGangster) => {
  const s = statsOf(g);
  return (s.cap / s.perDay) * MOCK_DAY_MS;
};

/** Farming time the equipped weapon has been boosting so far (stops when it runs out or the gangster retires). */
function weaponActiveMs(g: MockGangster, now: number) {
  if (!g.weapon) return 0;
  const w = WEAPONS[g.weapon.id];
  const end = Math.min(activeMs(g, now), g.weapon.startActiveMs + w.days * MOCK_DAY_MS, retireAtActive(g));
  return Math.max(0, end - g.weapon.startActiveMs);
}

/** Extra DC from weapons (current + previously replaced). Not counted against the career cap. */
export function bonusOf(g: MockGangster, now = Date.now()) {
  const cur = g.weapon ? (statsOf(g).perDay * (WEAPONS[g.weapon.id].boostPct / 100) * weaponActiveMs(g, now)) / MOCK_DAY_MS : 0;
  return (g.bonusBanked ?? 0) + cur;
}

/** Farming days left on the equipped weapon (0 when none or used up). */
export function weaponDaysLeft(g: MockGangster, now = Date.now()) {
  if (!g.weapon) return 0;
  return Math.max(0, WEAPONS[g.weapon.id].days - weaponActiveMs(g, now) / MOCK_DAY_MS);
}

/** Vest still on (hasn't stopped its bullet yet). */
export const hasVest = (g: MockGangster, now = Date.now()) => !!g.vest && g.vest.absorbAt > now;

export const pendingOf = (g: MockGangster, now = Date.now()) => Math.max(0, farmedOf(g, now) + bonusOf(g, now) - g.claimed);
export const isRetired = (g: MockGangster, now = Date.now()) => farmedOf(g, now) >= statsOf(g).cap;
/** Shot and waiting for a med kit (a retired gangster can't be shot: its career is over). */
export const isShot = (g: MockGangster, now = Date.now()) => !isRetired(g, now) && shotAt(g, now) !== null;
/** Actually earning right now. */
export const isFarming = (g: MockGangster, now = Date.now()) => !isRetired(g, now) && shotAt(g, now) === null;

/** DC per day right now, weapon boost included (0 when shot or retired). */
export function rateOf(g: MockGangster, now = Date.now()) {
  if (!isFarming(g, now)) return 0;
  const base = statsOf(g).perDay;
  return weaponDaysLeft(g, now) > 0 ? base * (1 + WEAPONS[g.weapon!.id].boostPct / 100) : base;
}

/**
 * Gangsters of `rarity` that can be fused: still farming (not retired) and not fused already.
 * Sorted closest-to-retirement first, the first two are the ones a fusion consumes.
 */
export function fusionCandidates(gangsters: MockGangster[], rarity: number, now = Date.now()) {
  return gangsters
    .filter((g) => g.rarity === rarity && !g.fused && isFarming(g, now))
    .sort((a, b) => farmedOf(b, now) / statsOf(b).cap - farmedOf(a, now) / statsOf(a).cap);
}
export const isBoxReady = (b: MockBox, now = Date.now()) => now - b.boughtAt >= MOCK_REVEAL_MS;

/**
 * What "Claim all" would do right now: every gangster with at least 1 DC pending, full DC to the player,
 * and a fee of CLAIM_ALL_FEE_RES per gangster paid in RESOURCE (burned).
 * are included, so claiming all never costs more than it pays out for any single gangster.
 */
export function claimAllQuote(gangsters: MockGangster[], now = Date.now()) {
  const ids: number[] = [];
  let gross = 0;
  for (const g of gangsters) {
    const p = pendingOf(g, now);
    if (p >= 1) {
      ids.push(g.id);
      gross += p;
    }
  }
  const fee = ids.length * CLAIM_ALL_FEE_RES;
  return { ids, gross, fee, net: gross };
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
      { id: 1, rarity: 0, mintedAt: now - MOCK_DAY_MS * 40, claimed: 0, nextShotAt: now - MOCK_DAY_MS * 2 }, // already shot, to show healing
      { id: 2, rarity: 1, mintedAt: now - MOCK_DAY_MS * 6, claimed: 0, nextShotAt: sampleNextShot(1, now) },
      { id: 3, rarity: 2, mintedAt: now - MOCK_DAY_MS * 2, claimed: 0, nextShotAt: sampleNextShot(2, now) },
      { id: 4, rarity: 3, mintedAt: now - MOCK_DAY_MS * 0.5, claimed: 0, nextShotAt: sampleNextShot(3, now) },
      { id: 5, rarity: 0, mintedAt: now - MOCK_DAY_MS * 15, claimed: 0, nextShotAt: sampleNextShot(0, now) }, // 2nd Common so Fusion can be tried right away
    ];
    set(withTx({
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
      resource: 5_000,
    }, { type: "gang", title: "Gang founded", detail: `${name} · demo crew of 5 + 2 boxes + 5,000 test RESOURCE`, dc: 1_500, resource: 5_000 }));
  },

  /** DacityVault.deposit */
  deposit(usdc: number) {
    if (!(usdc > 0) || usdc > state.usdc) throw new Error("Not enough USDC");
    set(
      withTx(
        {
          ...state,
          usdc: state.usdc - usdc,
          dc: state.dc + usdc * DACITY_PER_USDC,
          stats: { ...state.stats, deposited: state.stats.deposited + usdc },
        },
        { type: "deposit", title: "Deposit", detail: "Vault: USDC → DC", usdc: -usdc, dc: usdc * DACITY_PER_USDC },
      ),
    );
  },

  /** Vault withdraw: burns DC, returns USDC at the same 100:1 rate. */
  withdraw(dc: number) {
    if (!(dc > 0) || dc > state.dc) throw new Error("Not enough DACITY");
    set(
      withTx(
        { ...state, dc: state.dc - dc, usdc: state.usdc + dc / DACITY_PER_USDC },
        { type: "withdraw", title: "Withdraw", detail: "Vault: DC → USDC", dc: -dc, usdc: dc / DACITY_PER_USDC },
      ),
    );
  },

  /** Admin: mint DC to a player (DacityCoin.mint by an admin/minter role in production). */
  grantDc(amount: number) {
    if (!(amount > 0)) throw new Error("Amount must be positive");
    set(withTx({ ...state, dc: state.dc + amount }, { type: "gift", title: "Received coins", detail: "Sent by an admin", dc: amount }));
  },

  /** Admin: give sealed boxes to a player, ready to open (an admin grantBoxes in DacityGang in production). */
  grantBoxes(count: number) {
    if (!Number.isInteger(count) || count < 1) throw new Error("Count must be a whole number ≥ 1");
    const ready = Date.now() - MOCK_REVEAL_MS;
    const boxes = Array.from({ length: count }, (_, i) => ({ id: state.nextBoxId + i, boughtAt: ready }));
    set(
      withTx(
        { ...state, boxes: [...state.boxes, ...boxes], nextBoxId: state.nextBoxId + count },
        { type: "gift", title: "Received boxes", detail: `${plural(count, "box")} sent by an admin` },
      ),
    );
  },

  /** Test RESOURCE (mock only; in production players buy it on the Poons launchpad). */
  resourceFaucet() {
    set(withTx({ ...state, resource: state.resource + 10_000 }, { type: "resource", title: "Test RESOURCE", detail: "Faucet (mock only)", resource: 10_000 }));
  },

  /** MockUSDC.faucet */
  faucet() {
    set(withTx({ ...state, usdc: state.usdc + 1_000 }, { type: "faucet", title: "Test USDC", detail: "Faucet (testnet only)", usdc: 1_000 }));
  },

  /** DacityGang.buyBoxes: launch price for the first boxes sold game-wide, bulk discount on the rest. */
  buyBoxes(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > MAX_BOXES_PER_TX) throw new Error(`1 to ${MAX_BOXES_PER_TX} boxes per order`);
    const q = quoteBoxes(count, platform.boxesSold());
    if (q.totalDc > state.dc) throw new Error("Not enough DACITY");
    const now = Date.now();
    const boxes = Array.from({ length: count }, (_, i) => ({ id: state.nextBoxId + i, boughtAt: now }));
    const parts = [
      q.launchQty > 0 ? `${q.launchQty} at launch price` : "",
      q.regularQty > 0 ? `${q.regularQty} regular${q.pct ? ` -${q.pct}%` : ""}` : "",
    ].filter(Boolean);
    set(
      withTx(
        { ...state, dc: state.dc - q.totalDc, boxes: [...state.boxes, ...boxes], nextBoxId: state.nextBoxId + count },
        { type: "buy", title: `Bought ${plural(count, "box")}`, detail: parts.join(" · "), dc: -q.totalDc },
      ),
    );
    platform.recordBoxSale(count);
    return q;
  },

  /** DacityGang.openBox → returns the minted gangster */
  openBox(boxId: number): MockGangster {
    const box = state.boxes.find((b) => b.id === boxId);
    if (!box) throw new Error("Box not found");
    if (!isBoxReady(box)) throw new Error("Box not ready yet");
    const rarity = rollRarity();
    const g: MockGangster = { id: state.nextGangsterId, rarity, mintedAt: Date.now(), claimed: 0, nextShotAt: sampleNextShot(rarity) };
    const r = RARITIES[g.rarity];
    set(
      withTx(
        {
          ...state,
          boxes: state.boxes.filter((b) => b.id !== boxId),
          gangsters: [g, ...state.gangsters],
          nextGangsterId: state.nextGangsterId + 1,
          stats: { ...state.stats, opened: state.stats.opened + 1 },
        },
        { type: "open", title: `Opened box #${boxId}`, detail: `${r.name} gangster #${g.id} · started farming ${r.perDay} DC/day` },
      ),
    );
    return g;
  },

  /** Claim a single gangster. Free. */
  claim(gangsterId: number): number {
    const now = Date.now();
    const g = state.gangsters.find((x) => x.id === gangsterId);
    if (!g) throw new Error("Gangster not found");
    const p = pendingOf(g, now);
    if (p <= 0) return 0;
    set(
      withTx(
        {
          ...state,
          gangsters: state.gangsters.map((x) => (x.id === gangsterId ? { ...x, claimed: x.claimed + p } : x)),
          dc: state.dc + p,
          stats: { ...state.stats, claimed: state.stats.claimed + p },
        },
        { type: "claim", title: "Claim", detail: `Gangster #${gangsterId} · no fee`, dc: p },
      ),
    );
    return p;
  },

  /** Claim every gangster with pending > fee in one go, paying CLAIM_ALL_FEE_DC per gangster. Returns the quote applied. */
  claimAll(onlyIds?: number[]) {
    const now = Date.now();
    // charge for exactly the gangsters the player saw in the quote, even if another one crossed 1 DC since
    const q = claimAllQuote(onlyIds ? state.gangsters.filter((g) => onlyIds.includes(g.id)) : state.gangsters, now);
    if (q.ids.length === 0) throw new Error("Nothing to claim yet");
    if (q.fee > state.resource) throw new Error(`Need ${fmtRes(q.fee)} for the claim-all fee`);
    const ids = new Set(q.ids);
    set(
      withTx(
        {
          ...state,
          gangsters: state.gangsters.map((g) => (ids.has(g.id) ? { ...g, claimed: g.claimed + pendingOf(g, now) } : g)),
          dc: state.dc + q.net,
          resource: state.resource - q.fee,
          stats: { ...state.stats, claimed: state.stats.claimed + q.net },
        },
        { type: "claimAll", title: "Claim all", detail: `${plural(q.ids.length, "gangster")} · fee burned`, dc: q.net, resource: -q.fee },
      ),
    );
    platform.recordBurn(q.fee);
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
    if (state.resource < recipe.fee) throw new Error(`Need ${fmtRes(recipe.fee)} to fuse`);
    const child: MockGangster = { id: state.nextGangsterId, rarity: recipe.to, mintedAt: now, claimed: 0, fused: true, nextShotAt: sampleNextShot(recipe.to, now) };
    set(
      withTx(
        {
          ...state,
          dc: state.dc + payout,
          resource: state.resource - recipe.fee,
          gangsters: [child, ...state.gangsters.filter((g) => g.id !== a.id && g.id !== b.id)],
          nextGangsterId: state.nextGangsterId + 1,
          stats: { ...state.stats, claimed: state.stats.claimed + payout },
        },
        {
          type: "fuse",
          title: "Fusion",
          detail: `#${a.id} + #${b.id} (${RARITIES[rarity].name}) → fused ${RARITIES[recipe.to].name} #${child.id} · fee burned`,
          dc: payout,
          resource: -recipe.fee,
        },
      ),
    );
    platform.recordBurn(recipe.fee);
    return { parents: [a, b] as const, child, payout, fee: recipe.fee };
  },

  /** Buy med kits into stock. */
  buyMedkits(count: number) {
    if (!Number.isInteger(count) || count < 1) throw new Error("Count must be a whole number ≥ 1");
    const cost = count * MEDKIT_PRICE_RES;
    if (cost > state.resource) throw new Error(`Need ${fmtRes(cost)}`);
    set(
      withTx(
        { ...state, resource: state.resource - cost, medkits: state.medkits + count },
        { type: "medkit", title: `Bought ${plural(count, "med kit")}`, detail: `${fmtRes(MEDKIT_PRICE_RES)} each · burned`, resource: -cost },
      ),
    );
    platform.recordBurn(cost);
  },

  /**
   * Heal shot gangsters so they farm again. Uses kits from stock first and buys the missing ones.
   * The time spent shot doesn't count against the career; a new shot time is rolled.
   */
  heal(ids: number[]) {
    const now = Date.now();
    const targets = state.gangsters.filter((g) => ids.includes(g.id) && isShot(g, now));
    if (targets.length === 0) throw new Error("Nobody to heal");
    const fromStock = Math.min(state.medkits, targets.length);
    const toBuy = targets.length - fromStock;
    const cost = toBuy * MEDKIT_PRICE_RES;
    if (cost > state.resource) throw new Error(`Need ${fmtRes(cost)} for ${plural(toBuy, "med kit")}`);
    const healed = new Set(targets.map((g) => g.id));
    const gangsters = state.gangsters.map((g) =>
      healed.has(g.id)
        ? { ...g, pausedMs: (g.pausedMs ?? 0) + (now - shotAt(g, now)!), nextShotAt: sampleNextShot(g.rarity, now), vest: undefined }
        : g,
    );
    const who = targets.length === 1 ? `#${targets[0].id}` : plural(targets.length, "gangster");
    const used = [fromStock ? `${fromStock} from stock` : "", toBuy ? `${toBuy} bought` : ""].filter(Boolean).join(" · ");
    set(
      withTx(
        { ...state, gangsters, medkits: state.medkits - fromStock, resource: state.resource - cost },
        { type: "heal", title: "Healed", detail: `${who} back to farming · ${plural(targets.length, "med kit")} (${used})`, resource: cost ? -cost : undefined },
      ),
    );
    if (cost) platform.recordBurn(cost);
    return { healed: targets.length, bought: toBuy, cost };
  },

  /** The Armory: buy items into the inventory (med kits go to the med kit stock). */
  buyItem(item: WeaponId | "vest" | "medkit", count: number) {
    if (!Number.isInteger(count) || count < 1) throw new Error("Count must be a whole number ≥ 1");
    if (item === "medkit") return mock.buyMedkits(count);
    const def = item === "vest" ? { name: VEST.name, priceRes: VEST.priceRes } : WEAPONS[item];
    const cost = def.priceRes * count;
    if (cost > state.resource) throw new Error(`Need ${fmtRes(cost)}`);
    set(
      withTx(
        { ...state, resource: state.resource - cost, inventory: { ...state.inventory, [item]: state.inventory[item] + count } },
        { type: "shop", title: `Bought ${count} × ${def.name}`, detail: `${STORE} · ${fmtRes(def.priceRes)} each · burned`, resource: -cost },
      ),
    );
    platform.recordBurn(cost);
  },

  /** Equip a weapon from the inventory. Replacing a weapon banks the bonus it already earned. */
  equipWeapon(gangsterId: number, weaponId: WeaponId) {
    const now = Date.now();
    const g = state.gangsters.find((x) => x.id === gangsterId);
    if (!g) throw new Error("Gangster not found");
    if (state.inventory[weaponId] < 1) throw new Error(`No ${WEAPONS[weaponId].name} in stock`);
    if (isRetired(g, now)) throw new Error("Retired gangsters don't need weapons");
    const banked = bonusOf(g, now);
    // one weapon at a time: a new one only goes on after the current one runs out
    if (g.weapon && weaponDaysLeft(g, now) > 0)
      throw new Error(`#${gangsterId} already has a ${WEAPONS[g.weapon.id].name} (${weaponDaysLeft(g, now).toFixed(1)} days left)`);
    set(
      withTx(
        {
          ...state,
          inventory: { ...state.inventory, [weaponId]: state.inventory[weaponId] - 1 },
          gangsters: state.gangsters.map((x) =>
            x.id === gangsterId ? { ...x, bonusBanked: banked, weapon: { id: weaponId, startActiveMs: activeMs(x, now) } } : x,
          ),
        },
        {
          type: "equip",
          title: `Equipped ${WEAPONS[weaponId].name}`,
          detail: `#${gangsterId} · +${WEAPONS[weaponId].boostPct}% farm for ${WEAPONS[weaponId].days} days`,
        },
      ),
    );
  },

  /** Put a vest on: it stops the next bullet (the one due at nextShotAt), the bullet after that is rolled now. */
  equipVest(gangsterId: number) {
    const now = Date.now();
    const g = state.gangsters.find((x) => x.id === gangsterId);
    if (!g) throw new Error("Gangster not found");
    if (state.inventory.vest < 1) throw new Error("No vest in stock");
    if (isShot(g, now)) throw new Error("Heal this gangster first");
    if (isRetired(g, now)) throw new Error("Retired gangsters don't need a vest");
    if (hasVest(g, now)) throw new Error("Already wearing a vest");
    const due = g.nextShotAt ?? sampleNextShot(g.rarity, now);
    set(
      withTx(
        {
          ...state,
          inventory: { ...state.inventory, vest: state.inventory.vest - 1 },
          gangsters: state.gangsters.map((x) => (x.id === gangsterId ? { ...x, vest: { absorbAt: due }, nextShotAt: due + sampleShotGap(x.rarity) } : x)),
        },
        { type: "equip", title: `Equipped ${VEST.name}`, detail: `#${gangsterId} · stops the next bullet` },
      ),
    );
  },

  reset() {
    set(initial());
  },
};
