/**
 * Audacity Jackpot: the slot's math, shared by the payment server (which decides every outcome) and the
 * web app (which replays the server's result and lets players verify it). No imports, no I/O.
 *
 * PROVABLY FAIR: every random number comes from HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`).
 * The player sees sha256(serverSeed) before betting; after rotating seeds the old server seed is revealed,
 * and replaying the same (serverSeed, clientSeed, nonce) through playRound() gives the exact same round.
 *
 * The rules (pay anywhere, tumbles, multipliers, The Heist, vault jackpots) and their odds live here.
 * Change them only together with a new simulation (server/scripts/slot-sim.ts) and keep RTP where you want it.
 * Tuned for launch: ~89% RTP in the base game and in a bought Heist (58x), + ~1% back through the GRAND pot ≈ 90%.
 */

export const COLS = 6;
export const ROWS = 5;

export type PayId = "coin" | "red" | "papa" | "lil" | "rifle" | "smg" | "pistol" | "vest" | "medkit";
export type SymId = PayId | "S" | "V" | "M";
export type JackpotId = "GRAND" | "MAJOR" | "MINOR" | "MINI";

export type Cell = { id: number; s: SymId; m?: number };
export type Grid = Cell[][]; // [column][row], row 0 = top
export type Win = { s: PayId; n: number; x: number };
export type Step = { wins: Win[]; ids: number[]; grid: Grid };
export type Spin = {
  free: boolean;
  grid: Grid; // as it lands
  steps: Step[]; // one per tumble: what paid, what blew up, the grid after the refill
  tumbleX: number; // sum of the tumble wins, x bet
  mult: number; // multipliers left on the final grid
  heat: number; // Heat after this spin (free spins only)
  winX: number; // tumbles x multipliers / Heat
  scatterX: number; // Gangster Box pay (base game)
  nS: number;
  nV: number;
  jackpot: JackpotId | null;
  jackpotX: number;
  addedSpins: number; // retrigger during The Heist
};
export type Round = {
  buy: boolean;
  base: Spin | null; // null when The Heist was bought
  free: Spin[];
  triggered: boolean;
  heat: number;
  jackpots: JackpotId[];
  totalX: number; // everything, x bet, after the max-win cap (the GRAND pot share is added by the database)
  capped: boolean;
};

/** Pays x bet for 8-9 / 10-11 / 12+ of a kind anywhere on the grid, and the weight on the reels. */
export const PAYS: Record<PayId, { name: string; pay: [number, number, number]; w: number }> = {
  coin: { name: "$CASINO", pay: [5.45, 13.5, 36], w: 3 },
  red: { name: "Red Ash", pay: [1.35, 3.6, 11], w: 5 },
  papa: { name: "Papa Krown", pay: [0.9, 2.25, 6.35], w: 7 },
  lil: { name: "Lil Blinds", pay: [0.7, 1.35, 4.55], w: 9 },
  rifle: { name: "Rifle", pay: [0.45, 0.9, 3.6], w: 12 },
  smg: { name: "Lowrider", pay: [0.35, 0.7, 2.7], w: 14 },
  pistol: { name: "Pistol", pay: [0.25, 0.55, 2.25], w: 16 },
  vest: { name: "SMG", pay: [0.2, 0.45, 1.8], w: 17 },
  medkit: { name: "Cash", pay: [0.15, 0.35, 1.35], w: 18 },
};
const PAY_IDS = Object.keys(PAYS) as PayId[];

export const RULES = {
  /** weights of the Gangster Box (S) and Vault (V) next to the pay symbols, and the chance of a multiplier per cell */
  base: { S: 2.2, V: 1.5, pm: 0.0115 },
  free: { S: 2.0, V: 2.4, pm: 0.025 },
  scatterPay: { 4: 3, 5: 5, 6: 100 } as Record<number, number>,
  heistSpins: 15,
  retrigger: 5,
  /** safety stop for very long Heists */
  maxFreeSpins: 100,
  multVals: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100, 250, 500],
  multW: [30, 22, 18, 15, 10, 8, 6, 4, 3, 2.2, 1.6, 0.6, 0.25, 0.06, 0.02],
  /** vaults left on the grid after the tumbles → x bet. GRAND also pays a share of the progressive pot (database). */
  jackpots: [
    { id: "GRAND", min: 7, x: 2000 },
    { id: "MAJOR", min: 6, x: 500 },
    { id: "MINOR", min: 5, x: 100 },
    { id: "MINI", min: 4, x: 20 },
  ] as { id: JackpotId; min: number; x: number }[],
};

// ------------------------------------------------------------------ math helpers
const r4 = (x: number) => Math.round(x * 10000) / 10000;

function pickW<T>(rand: () => number, items: readonly T[], weights: readonly number[]): T {
  let t = 0;
  for (const w of weights) t += w;
  let r = rand() * t;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

export function count(grid: Grid, s: SymId) {
  let n = 0;
  for (const col of grid) for (const c of col) if (c.s === s) n++;
  return n;
}
export function multSum(grid: Grid) {
  let t = 0;
  for (const col of grid) for (const c of col) if (c.s === "M") t += c.m ?? 0;
  return t;
}
export function payFor(s: PayId, n: number) {
  const p = PAYS[s].pay;
  return n >= 12 ? p[2] : n >= 10 ? p[1] : p[0];
}
export const scatterPay = (n: number) => (n >= 6 ? RULES.scatterPay[6] : RULES.scatterPay[n] ?? 0);
export function jackpotFor(nV: number) {
  return RULES.jackpots.find((j) => nV >= j.min) ?? null;
}

// ------------------------------------------------------------------ the game
type Ctx = { rand: () => number; id: number };

function newCell(ctx: Ctx, free: boolean): Cell {
  const w = free ? RULES.free : RULES.base;
  if (ctx.rand() < w.pm) return { id: ctx.id++, s: "M", m: pickW(ctx.rand, RULES.multVals, RULES.multW) };
  const ids: SymId[] = [...PAY_IDS, "S", "V"];
  const ws = [...PAY_IDS.map((p) => PAYS[p].w), w.S, w.V];
  return { id: ctx.id++, s: pickW(ctx.rand, ids, ws) };
}

export function evalWins(grid: Grid) {
  const wins: Win[] = [];
  const ids: number[] = [];
  for (const s of PAY_IDS) {
    const n = count(grid, s);
    if (n < 8) continue;
    wins.push({ s, n, x: payFor(s, n) });
    for (const col of grid) for (const c of col) if (c.s === s) ids.push(c.id);
  }
  return { wins, ids };
}

function tumble(ctx: Ctx, grid: Grid, ids: number[], free: boolean): Grid {
  const gone = new Set(ids);
  return grid.map((col) => {
    const keep = col.filter((c) => !gone.has(c.id));
    const add: Cell[] = [];
    for (let k = keep.length; k < ROWS; k++) add.push(newCell(ctx, free));
    return [...add, ...keep];
  });
}

function playSpin(ctx: Ctx, free: boolean, heatIn: number): Spin {
  let grid: Grid = [];
  for (let c = 0; c < COLS; c++) {
    const col: Cell[] = [];
    for (let r = 0; r < ROWS; r++) col.push(newCell(ctx, free));
    grid.push(col);
  }
  const first = grid;
  const steps: Step[] = [];
  let tumbleX = 0;
  for (;;) {
    const e = evalWins(grid);
    if (!e.wins.length) break;
    for (const w of e.wins) tumbleX += w.x;
    grid = tumble(ctx, grid, e.ids, free);
    steps.push({ wins: e.wins, ids: e.ids, grid });
  }
  const mult = multSum(grid);
  let heat = heatIn;
  let winX = tumbleX;
  if (free) {
    if (tumbleX > 0) {
      heat += mult;
      winX = tumbleX * Math.max(1, heat);
    }
  } else if (tumbleX > 0 && mult > 0) winX = tumbleX * mult;
  const nS = count(grid, "S");
  const nV = count(grid, "V");
  const jp = jackpotFor(nV);
  return {
    free, grid: first, steps, tumbleX: r4(tumbleX), mult, heat, winX: r4(winX),
    scatterX: !free && nS >= 4 ? scatterPay(nS) : 0, nS, nV,
    jackpot: jp?.id ?? null, jackpotX: jp?.x ?? 0, addedSpins: 0,
  };
}

/** One paid round: a base spin (plus The Heist if it triggers), or a bought Heist. */
export function playRound(rand: () => number, opts: { buy: boolean; maxWinX: number }): Round {
  const ctx: Ctx = { rand, id: 1 };
  const base = opts.buy ? null : playSpin(ctx, false, 0);
  const triggered = opts.buy || (base !== null && base.nS >= 4);
  const free: Spin[] = [];
  let heat = 0;
  if (triggered) {
    let left = RULES.heistSpins;
    while (left > 0 && free.length < RULES.maxFreeSpins) {
      left--;
      const s = playSpin(ctx, true, heat);
      heat = s.heat;
      if (s.nS >= 3) {
        s.addedSpins = RULES.retrigger;
        left += RULES.retrigger;
      }
      free.push(s);
    }
  }
  const all = base ? [base, ...free] : free;
  let total = 0;
  for (const s of all) total += s.winX + s.scatterX + s.jackpotX;
  const capped = total > opts.maxWinX;
  return {
    buy: opts.buy, base, free, triggered, heat,
    jackpots: all.map((s) => s.jackpot).filter((j): j is JackpotId => j !== null),
    totalX: r4(Math.min(total, opts.maxWinX)),
    capped,
  };
}

// ------------------------------------------------------------------ provably fair RNG (pure SHA-256 / HMAC)
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function sha256(msg: Uint8Array): Uint8Array {
  const l = msg.length;
  const n = (((l + 9 + 63) >> 6) << 6);
  const m = new Uint8Array(n);
  m.set(msg);
  m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  dv.setUint32(n - 4, (l << 3) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  for (let off = 0; off < n; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
  return out;
}

export function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
  let k = key.length > 64 ? sha256(key) : key;
  const pad = new Uint8Array(64);
  pad.set(k);
  k = pad;
  const inner = new Uint8Array(64 + msg.length);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    inner[i] = k[i] ^ 0x36;
    outer[i] = k[i] ^ 0x5c;
  }
  inner.set(msg, 64);
  outer.set(sha256(inner), 64);
  return sha256(outer);
}

const utf8 = (s: string) => new TextEncoder().encode(s);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const sha256Hex = (s: string) => hex(sha256(utf8(s)));

/** Floats in [0, 1) from HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`), 4 bytes each. */
export function seededRandom(serverSeed: string, clientSeed: string, nonce: number): () => number {
  const key = utf8(serverSeed);
  let cursor = 0;
  let buf = hmacSha256(key, utf8(`${clientSeed}:${nonce}:${cursor}`));
  let i = 0;
  return () => {
    if (i + 4 > buf.length) {
      cursor++;
      buf = hmacSha256(key, utf8(`${clientSeed}:${nonce}:${cursor}`));
      i = 0;
    }
    const v = buf[i] / 256 + buf[i + 1] / 65536 + buf[i + 2] / 16777216 + buf[i + 3] / 4294967296;
    i += 4;
    return v;
  };
}

/** The numbers the database keeps for a round (small: the full replay can always be recomputed from the seeds). */
export function summarize(r: Round) {
  const all = r.base ? [r.base, ...r.free] : r.free;
  return {
    totalX: r.totalX,
    capped: r.capped,
    baseX: r.base ? r4(r.base.winX) : 0,
    scatterX: r.base?.scatterX ?? 0,
    heistX: r4(r.free.reduce((t, s) => t + s.winX, 0)),
    jackpotX: all.reduce((t, s) => t + s.jackpotX, 0),
    jackpots: r.jackpots,
    heistSpins: r.free.length,
    heat: r.heat,
  };
}
