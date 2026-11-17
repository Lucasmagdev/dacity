/**
 * Withdrawals, with the PLAYER paying the Solana network fee:
 *
 *  1. The player asks the database for a withdrawal (DC → USDC or AMMO). The balance is taken and the
 *     row waits as 'requested'.
 *  2. The web app asks this server for the transaction. We build it with the player as fee payer, sign it
 *     as the sender (Reward Pool / AMMO wallet) and hand it back. The player's wallet signs and sends it.
 *  3. Every withdrawal has its own reference key inside its transfer, so we can always look up whether it
 *     landed, and mark it 'sent'.
 *
 * Never paying twice: while a handed-out transaction can still land (its blockhash hasn't expired), asking
 * again returns that SAME transaction. A new one is only built after the old one expired AND we checked
 * on-chain that it didn't land. The database update is compare-and-set, so two server instances can't
 * both issue one.
 */
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction } from "@solana/spl-token";
import { env } from "../env.js";
import { call, db } from "../db.js";
import { ammo, ata, balanceDelta, connection, memo, mintInfo, pool, sleep, toRaw, tokenBalance, txsFor } from "../chain.js";
import { log } from "../log.js";

type Withdrawal = {
  id: number;
  user_id: string;
  asset: "usdc" | "ammo";
  amount_out: number | string;
  wallet: string;
  status: "requested" | "sent" | "failed";
  reference: string | null;
  tx_base64: string | null;
  tx_last_valid_height: number | null;
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const COLS = "id, user_id, asset, amount_out, wallet, status, reference, tx_base64, tx_last_valid_height";

async function load(id: number): Promise<Withdrawal | null> {
  const { data, error } = await db.from("withdrawals").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Withdrawal) ?? null;
}

async function setup(w: Withdrawal) {
  const mintAddress = w.asset === "usdc" ? env.usdcMint : env.ammoMint;
  if (!mintAddress) throw new HttpError(503, "AMMO withdrawals open when $AMMO launches");
  const m = await mintInfo(mintAddress);
  const source = w.asset === "usdc" ? pool : ammo;
  return { m, source, raw: toRaw(w.amount_out, m.decimals), player: new PublicKey(w.wallet) };
}

/** The transaction that paid this withdrawal, if one landed. */
async function findLanded(w: Withdrawal): Promise<string | null> {
  if (!w.reference) return null;
  const { m, raw, player } = await setup(w);
  for (const tx of await txsFor(new PublicKey(w.reference))) {
    if (balanceDelta(tx, player, m.mint) >= raw) return tx.transaction.signatures[0];
  }
  return null;
}

async function markSent(w: Withdrawal, signature: string) {
  await call("mark_withdrawal", { p_id: w.id, p_status: "sent", p_signature: signature });
  log.info("withdrawals", "sent", { id: w.id, asset: w.asset, amount: w.amount_out, signature });
}

function owned(w: Withdrawal | null, userId: string): Withdrawal {
  if (!w || w.user_id !== userId) throw new HttpError(404, "Withdrawal not found");
  if (w.status === "sent") throw new HttpError(409, "This withdrawal was already sent");
  if (w.status === "failed") throw new HttpError(409, "This withdrawal was cancelled and refunded");
  return w;
}

/** Step 2: the transaction for the player to sign (the same one again while it can still land). */
export async function withdrawalTx(userId: string, id: number): Promise<{ tx: string; lastValidBlockHeight: number }> {
  const w = owned(await load(id), userId);
  const height = await connection.getBlockHeight("confirmed");
  if (w.tx_base64 && w.tx_last_valid_height && height <= w.tx_last_valid_height) {
    return { tx: w.tx_base64, lastValidBlockHeight: w.tx_last_valid_height };
  }
  // the previous transaction (if any) has expired: make sure it didn't land before issuing a new one
  const landed = await findLanded(w);
  if (landed) {
    await markSent(w, landed);
    throw new HttpError(409, "This withdrawal was already sent");
  }

  const { m, source, raw, player } = await setup(w);
  if ((await tokenBalance(source.publicKey, m)) < raw) {
    log.error("withdrawals", "game wallet can't cover a withdrawal", { id: w.id, asset: w.asset });
    throw new HttpError(503, "The game wallet can't cover this withdrawal right now. It stays saved: try again in a few minutes.");
  }

  const reference = w.reference ? new PublicKey(w.reference) : Keypair.generate().publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const toAccount = ata(player, m);
  const transfer = createTransferCheckedInstruction(ata(source.publicKey, m), m.mint, toAccount, source.publicKey, raw, m.decimals, [], m.programId);
  transfer.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
  const tx = new Transaction({ feePayer: player, blockhash, lastValidBlockHeight }).add(
    // creates the player's token account if they never held this token (they pay the one-time rent)
    createAssociatedTokenAccountIdempotentInstruction(player, toAccount, player, m.mint, m.programId),
    transfer,
    memo(`Audacity Game withdrawal #${w.id}`),
  );
  tx.partialSign(source);
  const encoded = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");

  // compare-and-set: only if nobody issued another transaction meanwhile
  let q = db
    .from("withdrawals")
    .update({ reference: reference.toBase58(), tx_base64: encoded, tx_last_valid_height: lastValidBlockHeight, issued_at: new Date().toISOString() })
    .eq("id", w.id)
    .eq("status", "requested");
  q = w.tx_last_valid_height === null ? q.is("tx_last_valid_height", null) : q.eq("tx_last_valid_height", w.tx_last_valid_height);
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    const now = await load(id);
    if (now?.status === "requested" && now.tx_base64 && now.tx_last_valid_height) {
      return { tx: now.tx_base64, lastValidBlockHeight: now.tx_last_valid_height };
    }
    throw new HttpError(409, "This withdrawal changed, try again");
  }
  return { tx: encoded, lastValidBlockHeight };
}

/** Step 3 (fast path): the web app says it sent the transaction; wait for it and mark it sent. */
export async function withdrawalSubmitted(userId: string, id: number): Promise<{ status: string; signature?: string }> {
  const w = await load(id);
  if (!w || w.user_id !== userId) throw new HttpError(404, "Withdrawal not found");
  if (w.status !== "requested") return { status: w.status };
  for (let i = 0; i < 12; i++) {
    const landed = await findLanded(w);
    if (landed) {
      await markSent(w, landed);
      return { status: "sent", signature: landed };
    }
    await sleep(2500);
  }
  return { status: "requested" }; // the background job keeps checking
}

/** The player gives up: refund, but only once nothing can land anymore. */
export async function cancelWithdrawal(userId: string, id: number) {
  const w = owned(await load(id), userId);
  if (w.tx_last_valid_height) {
    const height = await connection.getBlockHeight("confirmed");
    if (height <= w.tx_last_valid_height) {
      throw new HttpError(409, "A transaction for this withdrawal can still land. Try cancelling again in about a minute.");
    }
    const landed = await findLanded(w);
    if (landed) {
      await markSent(w, landed);
      throw new HttpError(409, "This withdrawal was already sent");
    }
  }
  await call("mark_withdrawal", { p_id: w.id, p_status: "failed", p_note: "Cancelled by the player" });
  log.info("withdrawals", "cancelled and refunded", { id: w.id });
  return { status: "failed" };
}

/** Background: catch withdrawals the player sent but whose browser never reported back. */
export async function withdrawalsTick() {
  // a handed-out transaction can only land until its blockhash expires (~90s), so only recent ones matter
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data, error } = await db
    .from("withdrawals")
    .select(COLS)
    .eq("status", "requested")
    .not("reference", "is", null)
    .gte("issued_at", since)
    .order("issued_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  for (const w of (data ?? []) as Withdrawal[]) {
    try {
      const landed = await findLanded(w);
      if (landed) await markSent(w, landed);
    } catch (e) {
      log.warn("withdrawals", "check failed", { id: w.id, error: (e as Error).message });
    }
  }
}
