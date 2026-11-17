/**
 * Real-money moves in live mode.
 *
 *  Deposit: register an intent (random reference key) in the database, then the player's wallet sends a
 *  normal token transfer to the game wallet with that reference attached. The payment server finds it
 *  on-chain and credits what actually arrived. The player pays the network fee.
 *
 *  Withdraw: the database takes the balance, the payment server builds the transfer already signed by
 *  the game wallet, and the player's wallet signs it as fee payer and sends it.
 */
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  unpackMint,
} from "@solana/spl-token";
import { AMMO_WALLET, NETWORK, POOL_WALLET, USDC_MINT } from "../solana";
import { TOKEN } from "../config/game";
import { rpc, supabase } from "./supabase";
import { api } from "./api";
import { connection, wallet } from "./wallet";

export type Asset = "usdc" | "ammo";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const memo = (text: string) => new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: new TextEncoder().encode(text) as never });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toRaw(amount: number, decimals: number): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
}

async function mintOf(asset: Asset) {
  const address = asset === "usdc" ? USDC_MINT[NETWORK] : TOKEN.address;
  if (!address) throw new Error(`${TOKEN.ticker} deposits open when ${TOKEN.ticker} launches`);
  const mint = new PublicKey(address);
  const acc = await connection().getAccountInfo(mint);
  if (!acc) throw new Error("Token not found on this network");
  return { mint, programId: acc.owner, decimals: unpackMint(mint, acc, acc.owner).decimals };
}

/** Deposit USDC (becomes DC) or AMMO into the game. Resolves once credited, or { pending } if still confirming. */
export async function deposit(asset: Asset, amount: number): Promise<{ pending: boolean }> {
  const gameWallet = asset === "usdc" ? POOL_WALLET : AMMO_WALLET;
  if (!gameWallet) throw new Error("Deposits aren't configured yet");
  const w = wallet();
  const conn = connection();
  const m = await mintOf(asset);
  const raw = toRaw(amount, m.decimals);
  const from = getAssociatedTokenAddressSync(m.mint, w.publicKey, false, m.programId);
  const have = await conn.getTokenAccountBalance(from).then((b) => BigInt(b.value.amount)).catch(() => 0n);
  if (have < raw) throw new Error(`Not enough ${asset === "usdc" ? "USDC" : TOKEN.ticker} in your wallet`);

  const owner = new PublicKey(gameWallet);
  const to = getAssociatedTokenAddressSync(m.mint, owner, true, m.programId);
  const reference = Keypair.generate().publicKey;
  await rpc("create_deposit_intent", { p_asset: asset, p_reference: reference.toBase58() });

  const transfer = createTransferCheckedInstruction(from, m.mint, to, w.publicKey, raw, m.decimals, [], m.programId);
  transfer.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: w.publicKey, blockhash, lastValidBlockHeight }).add(
    createAssociatedTokenAccountIdempotentInstruction(w.publicKey, to, owner, m.mint, m.programId),
    transfer,
    memo(`Audacity Game deposit`),
  );
  const signature = await w.sendTransaction(tx, conn);
  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

  // ask the payment server to credit it now (it also checks every few seconds on its own)
  for (let i = 0; i < 6; i++) {
    const r = await api<{ status: string }>("/deposits/check", { reference: reference.toBase58() }).catch(() => ({ status: "pending" }));
    if (r.status === "confirmed") return { pending: false };
    await sleep(2500);
  }
  return { pending: true };
}

function decode(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Sign and send a requested withdrawal (also used to finish one the player didn't approve the first time). */
export async function finishWithdrawal(id: number): Promise<{ sent: boolean }> {
  const w = wallet();
  if (!w.signTransaction) throw new Error("This wallet can't sign transactions. Try Phantom, Solflare or Backpack.");
  const { tx } = await api<{ tx: string }>("/withdrawals/tx", { id });
  const unsigned = Transaction.from(decode(tx));
  if (!unsigned.feePayer?.equals(w.publicKey)) throw new Error("Connect the wallet this withdrawal goes to");
  const signed = await w.signTransaction(unsigned);
  await connection().sendRawTransaction(signed.serialize(), { maxRetries: 5 });
  const r = await api<{ status: string }>("/withdrawals/submitted", { id });
  return { sent: r.status === "sent" };
}

export const cancelWithdrawal = (id: number) => api("/withdrawals/cancel", { id });

export type PendingWithdrawal = { id: number; asset: Asset; amount_out: number; created_at: string };

export async function pendingWithdrawals(): Promise<PendingWithdrawal[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("withdrawals").select("id, asset, amount_out, created_at").eq("status", "requested").order("id");
  return ((data ?? []) as PendingWithdrawal[]).map((w) => ({ ...w, amount_out: Number(w.amount_out) }));
}
