/**
 * LIVE MODE (VITE_MOCK=0): the game plays against Supabase.
 *
 *  - Sign in: the player's Solana wallet signs a "Sign in with Solana" message (free, no transaction).
 *    Supabase Auth verifies it and creates/opens the account; the database links the wallet itself.
 *  - State: the player's row, gangsters, sealed boxes and history are loaded with the publishable key
 *    (RLS = only their own rows) and pushed into the same store the screens already read.
 *  - Platform: maintenance, announcement, launch-sale counter and burns, for everyone.
 */
import { useSyncExternalStore } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { supabase, rpc } from "./supabase";
import { MOCK, MOCK_REVEAL_MS, setDayMs, setLiveState, type MockBox, type MockGangster, type MockState, type MockTx, type TxType } from "../mock";
import { setPlatformLive, type Announcement } from "../mock/platform";
import { RPC_URL, USDC_MINT, NETWORK } from "../solana";
import { TOKEN, type WeaponId } from "../config/game";

export const LIVE = !MOCK && !!supabase;

export type LivePhase = "off" | "disconnected" | "signing" | "ready" | "error";
let status: { phase: LivePhase; error: string | null; wallet: string | null; isAdmin: boolean } = {
  phase: LIVE ? "disconnected" : "off",
  error: null,
  wallet: null,
  isAdmin: false,
};
const listeners = new Set<() => void>();
const setStatus = (next: Partial<typeof status>) => {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
};

export function useLiveStatus() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
  );
}

const ms = (t: string | null | undefined) => (t ? new Date(t).getTime() : 0);
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

const emptyState = (): MockState => ({
  gang: null,
  usdc: 0,
  walletAmmo: 0,
  lastWithdrawAt: 0,
  dc: 0,
  boxes: [],
  gangsters: [],
  nextGangsterId: 0,
  nextBoxId: 0,
  stats: { deposited: 0, claimed: 0, opened: 0 },
  txs: [],
  medkits: 0,
  ammo: 0,
  inventory: { pistol: 0, smg: 0, rifle: 0, vest: 0 },
});

let walletBalances = { usdc: 0, ammo: 0 };

// ------------------------------------------------------------------ loading

type Row = Record<string, unknown>;

function toGangster(r: Row): MockGangster {
  return {
    id: num(r.id),
    rarity: num(r.rarity),
    fused: !!r.fused,
    idle: !!r.idle,
    mintedAt: ms((r.started_at as string) ?? (r.created_at as string)),
    claimed: num(r.claimed),
    nextShotAt: r.next_shot_at ? ms(r.next_shot_at as string) : undefined,
    pausedMs: num(r.paused_seconds) * 1000,
    weapon: r.weapon_id ? { id: r.weapon_id as WeaponId, startActiveMs: num(r.weapon_start_active) * 1000 } : undefined,
    bonusBanked: num(r.bonus_banked),
    vest: r.vest_absorb_at ? { absorbAt: ms(r.vest_absorb_at as string) } : undefined,
  };
}

const toBox = (r: Row): MockBox => ({ id: num(r.id), boughtAt: ms(r.ready_at as string) - MOCK_REVEAL_MS });

const toTx = (r: Row): MockTx => ({
  id: String(r.id),
  hash: `#${r.id}`,
  at: ms(r.at as string),
  type: r.type as TxType,
  title: String(r.title),
  detail: String(r.detail ?? ""),
  dc: r.dc === null ? undefined : num(r.dc),
  usdc: r.usdc === null ? undefined : num(r.usdc),
  ammo: r.ammo === null ? undefined : num(r.ammo),
});

/** Reload the signed-in player's state from the database. */
export async function refresh() {
  if (!supabase || status.phase !== "ready") return;
  const [p, g, b, t] = await Promise.all([
    supabase.from("players").select("*").maybeSingle(),
    supabase.from("gangsters").select("*").is("consumed_at", null).order("id", { ascending: false }),
    supabase.from("boxes").select("id, ready_at").is("opened_at", null).order("id"),
    supabase.from("player_transactions").select("*").order("at", { ascending: false }).limit(300),
  ]);
  const err = p.error || g.error || b.error || t.error;
  if (err) throw new Error(err.message);
  const pl = (p.data ?? {}) as Row;
  setLiveState({
    ...emptyState(),
    gang: pl.gang_name
      ? { protagonist: num(pl.protagonist) as 1 | 2, name: String(pl.gang_name), createdAt: ms(pl.gang_founded_at as string) }
      : null,
    dc: num(pl.dc),
    ammo: num(pl.ammo),
    medkits: num(pl.medkits),
    inventory: { pistol: num(pl.pistols), smg: num(pl.smgs), rifle: num(pl.rifles), vest: num(pl.vests) },
    lastWithdrawAt: ms(pl.last_withdraw_at as string),
    stats: { deposited: num(pl.total_deposited_usdc), claimed: num(pl.total_claimed_dc), opened: num(pl.total_opened) },
    gangsters: (g.data ?? []).map(toGangster),
    boxes: (b.data ?? []).map(toBox),
    txs: (t.data ?? []).map(toTx),
    usdc: walletBalances.usdc,
    walletAmmo: walletBalances.ammo,
  });
}

/** Everyone: maintenance, announcement, launch-sale counter, burns, farming day length. */
export async function refreshPlatform() {
  if (!supabase) return;
  const [ps, an, cfg] = await Promise.all([
    supabase.from("platform_state").select("*").maybeSingle(),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(1),
    supabase.from("game_config").select("day_seconds").maybeSingle(),
  ]);
  if (cfg.data?.day_seconds) setDayMs(num(cfg.data.day_seconds) * 1000);
  const s = (ps.data ?? {}) as Row;
  const a = (an.data?.[0] ?? null) as Row | null;
  const announcement: Announcement | null = a
    ? {
        id: String(a.id),
        kind: a.kind as Announcement["kind"],
        title: String(a.title),
        message: String(a.message),
        createdAt: ms(a.created_at as string),
        expiresAt: a.expires_at ? ms(a.expires_at as string) : null,
      }
    : null;
  setPlatformLive({
    maintenance: { on: !!s.maintenance_on, message: String(s.maintenance_message ?? ""), since: s.maintenance_since ? ms(s.maintenance_since as string) : null },
    announcement,
    boxesSold: num(s.boxes_sold),
    ammoBurned: num(s.ammo_spent_total),
  });
}

/** USDC (and $AMMO once its mint is set) sitting in the connected wallet, read from Solana. */
async function refreshWalletBalances(owner: string) {
  try {
    const conn = new Connection(RPC_URL, "confirmed");
    const ownerKey = new PublicKey(owner);
    const read = async (mint: string) => {
      const res = await conn.getParsedTokenAccountsByOwner(ownerKey, { mint: new PublicKey(mint) });
      return res.value.reduce((t, a) => t + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
    };
    walletBalances = {
      usdc: await read(USDC_MINT[NETWORK]),
      ammo: TOKEN.address ? await read(TOKEN.address) : 0,
    };
  } catch {
    /* public RPC rate limits etc.: keep the last known balances */
  }
}

// ------------------------------------------------------------------ session

type WalletLike = {
  publicKey: PublicKey;
  signMessage?: (m: Uint8Array) => Promise<Uint8Array>;
  /** Wallet-native "Sign in with Solana" (Phantom, Solflare, Backpack): the wallet formats the message itself. */
  signIn?: (input?: Record<string, unknown>) => Promise<unknown>;
};

/**
 * The sign-in message must point at the site root: the app routes with "#/…" and wallets like Phantom
 * reject a sign-in URI with a fragment ("invalid formatting"). Plain statement, no punctuation tricks.
 */
const SIGN_IN_URL = () => `${window.location.origin}/`;
const SIGN_IN_STATEMENT = "Sign in to Audacity Game";

const sessionWallet = async () => {
  const { data } = await supabase!.auth.getSession();
  const u = data.session?.user;
  const claims = (u?.user_metadata?.custom_claims ?? {}) as { address?: string };
  return u ? claims.address ?? null : null;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let starting: string | null = null;

/** Called when a wallet connects: reuse the session for that wallet, or sign in with it. */
export async function startSession(wallet: WalletLike) {
  if (!LIVE || !supabase) return;
  const address = wallet.publicKey.toBase58();
  if (starting === address || (status.phase === "ready" && status.wallet === address)) return;
  starting = address;
  try {
    if ((await sessionWallet()) !== address) {
      await supabase.auth.signOut();
      setStatus({ phase: "signing", error: null, wallet: address });
      // prefer the wallet's own Sign In with Solana; fall back to signing the message ourselves
      const solanaWallet = wallet.signIn
        ? { publicKey: wallet.publicKey, signIn: wallet.signIn }
        : { publicKey: wallet.publicKey, signMessage: wallet.signMessage };
      const { error } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: SIGN_IN_STATEMENT,
        wallet: solanaWallet as never,
        options: { url: SIGN_IN_URL() },
      });
      if (error) throw new Error(error.message);
    }
    await rpc("ensure_player"); // creates the player row and links the wallet
    // admin = the signed-in wallet is in the database's admins table (the database enforces it too)
    const isAdmin = await rpc<boolean>("is_admin").catch(() => false);
    setStatus({ phase: "ready", error: null, wallet: address, isAdmin: !!isAdmin });
    await Promise.all([refreshWalletBalances(address), refreshPlatform()]);
    await refresh();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      refreshPlatform().catch(() => {});
      refresh().catch(() => {});
    }, 20_000);
  } catch (e) {
    setStatus({ phase: "error", error: (e as Error).message, wallet: address });
  } finally {
    starting = null;
  }
}

/** Wallet disconnected: sign out and clear the player's data from the screen. */
export async function endSession() {
  if (!LIVE || !supabase) return;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  await supabase.auth.signOut();
  setLiveState(emptyState());
  setStatus({ phase: "disconnected", error: null, wallet: null, isAdmin: false });
}

// platform data is public: load it right away, even before a wallet connects
if (LIVE) {
  refreshPlatform().catch(() => {});
  setInterval(() => refreshPlatform().catch(() => {}), 30_000);
}
