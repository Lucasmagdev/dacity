/**
 * Deposits. The player's browser registers an intent (a random reference key) and sends a normal token
 * transfer to the game wallet with that reference attached. Here we find that transaction on-chain,
 * check it really moved the right token INTO the right game wallet, and credit exactly what arrived.
 *
 * Runs every 15s for all pending deposits, and right away when the web app or a Helius webhook pokes us.
 */
import { PublicKey } from "@solana/web3.js";
import { env } from "../env.js";
import { call, db } from "../db.js";
import { ammo, balanceDelta, fromRaw, mintInfo, pool, txsFor } from "../chain.js";
import { log } from "../log.js";

type Deposit = { id: number; reference: string; asset: "usdc" | "ammo"; status: string; created_at: string };

/**
 * Pending intents older than this are closed. The transfer is signed right after the intent is made with
 * a recent blockhash, and such a transaction can't land more than ~90s later, so 1 hour is plenty.
 */
const EXPIRE_HOURS = 1;

/** Look for the deposit's transaction and credit it. Returns true when it got credited. */
export async function checkDeposit(d: Deposit): Promise<boolean> {
  if (d.status !== "pending") return d.status === "confirmed";
  const mintAddress = d.asset === "usdc" ? env.usdcMint : env.ammoMint;
  if (!mintAddress) return false;
  const m = await mintInfo(mintAddress);
  const gameWallet = d.asset === "usdc" ? pool.publicKey : ammo.publicKey;

  for (const tx of await txsFor(new PublicKey(d.reference))) {
    const received = balanceDelta(tx, gameWallet, m.mint);
    if (received <= 0n) continue; // the reference is there but nothing reached the game wallet
    const signature = tx.transaction.signatures[0];
    const sender = tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey.toBase58() ?? null;
    const amount = fromRaw(received, m.decimals);
    try {
      await call("confirm_deposit", { p_reference: d.reference, p_signature: signature, p_amount: amount, p_sender: sender });
      log.info("deposits", "credited", { id: d.id, asset: d.asset, amount, signature });
      return true;
    } catch (e) {
      // same transaction already credited to another intent (unique signature): never credit twice
      log.warn("deposits", "could not credit", { id: d.id, signature, error: (e as Error).message });
    }
  }
  return false;
}

export async function checkDepositByReference(reference: string) {
  const { data } = await db.from("deposits").select("id, reference, asset, status, created_at").eq("reference", reference).maybeSingle();
  if (!data) return { status: "unknown" as const };
  const credited = await checkDeposit(data as Deposit);
  return { status: credited ? "confirmed" : (data as Deposit).status };
}

let running = false;

export async function depositsTick() {
  if (running) return; // a webhook poke while the timer is mid-run
  running = true;
  try {
    const since = new Date(Date.now() - EXPIRE_HOURS * 3600_000).toISOString();
    const { data, error } = await db
      .from("deposits")
      .select("id, reference, asset, status, created_at")
      .eq("status", "pending")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);
    for (const d of (data ?? []) as Deposit[]) {
      try {
        await checkDeposit(d);
      } catch (e) {
        log.warn("deposits", "check failed", { id: d.id, error: (e as Error).message });
      }
    }
    await db.from("deposits").update({ status: "expired" }).eq("status", "pending").lt("created_at", since);
  } finally {
    running = false;
  }
}
