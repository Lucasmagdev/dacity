/**
 * Solana helpers: connection, the game's two wallets, mint info (classic SPL or Token-2022, pump.fun
 * uses both), token accounts and reading how much a transaction moved.
 */
import { Connection, Keypair, PublicKey, TransactionInstruction, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, unpackMint } from "@solana/spl-token";
import bs58 from "bs58";
import { env } from "./env.js";

export const connection = new Connection(env.rpcUrl, { commitment: "confirmed" });

function keypair(secret: string, expected: string, label: string) {
  const kp = Keypair.fromSecretKey(bs58.decode(secret));
  if (expected && kp.publicKey.toBase58() !== expected) {
    throw new Error(`${label}: the secret key doesn't match ${expected}`);
  }
  return kp;
}

/** Reward Pool: receives USDC deposits, pays USDC withdrawals. */
export const pool = keypair(env.poolSecret, env.poolAddress, "POOL_WALLET");
/** AMMO wallet: receives AMMO deposits, pays AMMO withdrawals, burns the AMMO spent in the game. */
export const ammo = keypair(env.ammoSecret, env.ammoAddress, "AMMO_WALLET");

export const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const memo = (text: string) => new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(text, "utf8") });

export type MintInfo = { mint: PublicKey; decimals: number; programId: PublicKey };
const mints = new Map<string, MintInfo>();

/** Decimals and token program of a mint (cached: they never change). */
export async function mintInfo(address: string): Promise<MintInfo> {
  const hit = mints.get(address);
  if (hit) return hit;
  const mint = new PublicKey(address);
  const acc = await connection.getAccountInfo(mint);
  if (!acc) throw new Error(`Mint ${address} not found on ${env.network}`);
  const m = unpackMint(mint, acc, acc.owner);
  const info = { mint, decimals: m.decimals, programId: acc.owner };
  mints.set(address, info);
  return info;
}

export const ata = (owner: PublicKey, m: MintInfo) => getAssociatedTokenAddressSync(m.mint, owner, true, m.programId);

/** Raw token amount (integer units) as a bigint, from a decimal amount, rounding DOWN. */
export function toRaw(amount: number | string, decimals: number): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export function fromRaw(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const frac = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${raw / base}.${frac}` : `${raw / base}`;
}

/** How much of `mint` the wallet `owner` gained (positive) or lost (negative) in a transaction, raw units. */
export function balanceDelta(tx: ParsedTransactionWithMeta, owner: PublicKey, mint: PublicKey): bigint {
  const meta = tx.meta;
  if (!meta) return 0n;
  const o = owner.toBase58();
  const m = mint.toBase58();
  const sum = (list: typeof meta.postTokenBalances) =>
    (list ?? []).filter((b) => b.owner === o && b.mint === m).reduce((t, b) => t + BigInt(b.uiTokenAmount.amount), 0n);
  return sum(meta.postTokenBalances) - sum(meta.preTokenBalances);
}

/** Token balance of a wallet (raw units); 0 if it has no account for that mint. */
export async function tokenBalance(owner: PublicKey, m: MintInfo): Promise<bigint> {
  try {
    const r = await connection.getTokenAccountBalance(ata(owner, m));
    return BigInt(r.value.amount);
  } catch {
    return 0n;
  }
}

/** Successful transactions that include `address` (a reference key), newest first. */
export async function txsFor(address: PublicKey, limit = 10): Promise<ParsedTransactionWithMeta[]> {
  const sigs = await connection.getSignaturesForAddress(address, { limit }, "confirmed");
  const out: ParsedTransactionWithMeta[] = [];
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    if (tx?.meta && !tx.meta.err) out.push(tx);
  }
  return out;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
