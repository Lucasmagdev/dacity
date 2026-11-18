/**
 * Audacity Jackpot rounds. The database takes the bet and keeps the seeds (slot_begin), this process plays
 * the round with the shared engine and the database pays it (slot_finish). The web app only animates the
 * round it gets back. Stuck rounds (crash between begin and finish) are settled by settleOpenRounds().
 */
import { call } from "../db.js";
import { log } from "../log.js";
import { HttpError } from "../jobs/withdrawals.js";
import { playRound, seededRandom, summarize, type Round } from "./engine.js";

type Begin = {
  round_id: number;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  cost: number;
  max_win_x: number;
};
type Finish = { payout: number; pot_paid: number; balance: number; pot: number };

function finishArgs(roundId: number, r: Round) {
  // the round's single jackpot for the database (the biggest one; GRAND is the only one that touches the pot)
  const order = ["GRAND", "MAJOR", "MINOR", "MINI"] as const;
  const jackpot = order.find((j) => r.jackpots.includes(j)) ?? null;
  return { p_round: roundId, p_win_x: r.totalX, p_jackpot: jackpot, p_summary: summarize(r) };
}

/** Database errors are already worded for players (not enough DC, closed, bad bet…). */
const playerError = (e: unknown) => new HttpError(400, (e as Error).message.replace(/^slot_\w+:\s*/, ""));

export async function spinRound(user: string, body: Record<string, unknown>) {
  const bet = Number(body.bet);
  const buy = body.buy === true;
  if (!Number.isFinite(bet) || bet <= 0) throw new HttpError(400, "Pick a bet");

  let b: Begin;
  try {
    b = await call<Begin>("slot_begin", { p_user: user, p_bet: bet, p_buy: buy });
  } catch (e) {
    throw playerError(e);
  }
  const round = playRound(seededRandom(b.server_seed, b.client_seed, Number(b.nonce)), { buy, maxWinX: Number(b.max_win_x) });
  const f = await call<Finish>("slot_finish", finishArgs(b.round_id, round));
  return {
    roundId: b.round_id,
    bet,
    cost: Number(b.cost),
    round,
    payout: Number(f.payout),
    potPaid: Number(f.pot_paid),
    balance: Number(f.balance),
    pot: Number(f.pot),
    fair: { serverSeedHash: b.server_seed_hash, clientSeed: b.client_seed, nonce: Number(b.nonce) },
  };
}

type Open = { round_id: number; kind: string; server_seed: string; client_seed: string; nonce: number; max_win_x: number };

/** Rounds left open for more than a minute: replay them from their seeds (same result) and pay them. */
export async function settleOpenRounds() {
  const open = await call<Open[]>("slot_open_rounds", { p_older_than_seconds: 60 });
  for (const o of open ?? []) {
    try {
      const round = playRound(seededRandom(o.server_seed, o.client_seed, Number(o.nonce)), {
        buy: o.kind === "buy",
        maxWinX: Number(o.max_win_x),
      });
      await call("slot_finish", finishArgs(o.round_id, round));
      log.warn("slot", "settled a stuck round", { round: o.round_id, winX: round.totalX });
    } catch (e) {
      log.error("slot", "could not settle round", { round: o.round_id, error: (e as Error).message });
    }
  }
}
