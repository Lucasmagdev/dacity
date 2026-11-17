/**
 * Burns: every AMMO spent in the game is queued in the database (platform_state.ammo_pending_burn) and
 * burned on-chain from the AMMO wallet in batches.
 *
 * Never burning twice: the batch is recorded as 'pending' with its signature BEFORE it's sent. A pending
 * batch is settled only by looking at the chain: confirmed → counted as burned; expired without landing
 * → its AMMO goes back to the queue. Only one batch is in flight at a time.
 *
 * The AMMO wallet pays the network fee for burns: keep a little SOL in it.
 */
import { Transaction } from "@solana/web3.js";
import { createBurnCheckedInstruction } from "@solana/spl-token";
import bs58 from "bs58";
import { env } from "../env.js";
import { call, db } from "../db.js";
import { ammo, ata, connection, fromRaw, memo, mintInfo, toRaw, tokenBalance } from "../chain.js";
import { log } from "../log.js";

type Batch = { signature: string; amount: number | string; last_valid_height: number | null };

/** Settle the batch in flight. Returns true while one is still undecided. */
async function settlePending(): Promise<boolean> {
  const { data, error } = await db.from("burn_batches").select("signature, amount, last_valid_height").eq("status", "pending");
  if (error) throw new Error(error.message);
  let waiting = false;
  for (const b of (data ?? []) as Batch[]) {
    const st = (await connection.getSignatureStatus(b.signature, { searchTransactionHistory: true })).value;
    if (st && !st.err && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) {
      await call("finish_burn", { p_signature: b.signature, p_ok: true });
      log.info("burns", "burned", { amount: b.amount, signature: b.signature });
      continue;
    }
    if (st?.err) {
      await call("finish_burn", { p_signature: b.signature, p_ok: false });
      log.warn("burns", "burn failed on-chain, AMMO back in the queue", { signature: b.signature });
      continue;
    }
    const height = await connection.getBlockHeight("confirmed");
    if (b.last_valid_height && height > b.last_valid_height + 10) {
      await call("finish_burn", { p_signature: b.signature, p_ok: false });
      log.warn("burns", "burn expired without landing, AMMO back in the queue", { signature: b.signature });
      continue;
    }
    waiting = true;
  }
  return waiting;
}

export async function burnsTick() {
  if (!env.ammoMint) return; // nothing to burn before launch
  if (await settlePending()) return;

  const { data } = await db.from("platform_state").select("ammo_pending_burn").eq("id", 1).maybeSingle();
  const queued = Math.floor(Number(data?.ammo_pending_burn ?? 0));
  if (queued < env.burnMinAmmo) return;

  const m = await mintInfo(env.ammoMint);
  const held = await tokenBalance(ammo.publicKey, m);
  let raw = toRaw(queued, m.decimals);
  if (held < raw) {
    log.error("burns", "AMMO wallet holds less than the burn queue", { queued, held: fromRaw(held, m.decimals) });
    raw = held;
  }
  if (raw <= 0n) return;
  const amount = fromRaw(raw, m.decimals);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: ammo.publicKey, blockhash, lastValidBlockHeight }).add(
    createBurnCheckedInstruction(ata(ammo.publicKey, m), m.mint, ammo.publicKey, raw, m.decimals, [], m.programId),
    memo(`Audacity Game burn: ${amount} AMMO spent by players`),
  );
  tx.sign(ammo);
  const signature = bs58.encode(tx.signature!);

  // record first, send second
  await call("start_burn", { p_amount: amount, p_signature: signature, p_last_valid_height: lastValidBlockHeight });
  try {
    await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 5 });
    log.info("burns", "burn sent", { amount, signature });
  } catch (e) {
    // Even a "failed" send (timeout, RPC hiccup) might still land, so don't put the AMMO back here:
    // the batch stays pending and settlePending() decides from the chain once its blockhash expires.
    log.error("burns", "burn send failed, will settle from the chain", { amount, signature, error: (e as Error).message });
  }
}
