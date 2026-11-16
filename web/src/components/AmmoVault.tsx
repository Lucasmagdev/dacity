import { useState } from "react";
import AmmoIcon from "./art/AmmoIcon";
import { TOKEN, fmt } from "../config/game";
import { mock } from "../mock";
import { fmtUsd, useAmmoPrice } from "../price";
import { WITHDRAW_FEE_NOTE } from "../solana";

type Mode = "deposit" | "withdraw";

/**
 * Move $AMMO between the player's Solana wallet and the game.
 * Deposit = one wallet approval to send AMMO to the game's control wallet; after that every in-game
 * purchase is instant, with no more approvals. Withdraw = the game sends unspent AMMO back.
 */
export default function AmmoVault({ walletAmmo, gameAmmo, onToast }: { walletAmmo: number; gameAmmo: number; onToast: (m: string) => void }) {
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState(() => String(Math.floor(walletAmmo / 2)));
  const dep = mode === "deposit";
  const n = Math.floor(Number(amount) || 0);
  const from = Math.floor(dep ? walletAmmo : gameAmmo);
  const short = n > from;
  const price = useAmmoPrice();

  const go = () => {
    try {
      if (dep) mock.depositAmmo(n);
      else mock.withdrawAmmo(n);
      onToast(dep ? `Deposited ${fmt(n)} ${TOKEN.ticker} into the game` : `Withdrew ${fmt(n)} ${TOKEN.ticker} to your wallet`);
    } catch (e) {
      onToast((e as Error).message);
    }
  };

  return (
    <section className={`panel ammovault ammovault--${mode}`}>
      <div className="ammovault__head">
        <div className="ammovault__title">
          <AmmoIcon size={40} />
          <div>
            <p className="eyebrow">${TOKEN.ticker} in the game</p>
            <h2>{dep ? "Load AMMO" : "Withdraw AMMO"}</h2>
          </div>
        </div>
        <div className="seg" role="tablist" aria-label="AMMO action" data-mode={dep ? "deposit" : "withdraw"}>
          <button type="button" role="tab" aria-selected={dep} onClick={() => setMode("deposit")}>
            Deposit
          </button>
          <button type="button" role="tab" aria-selected={!dep} onClick={() => setMode("withdraw")}>
            Withdraw
          </button>
        </div>
      </div>

      <div className="ammovault__balances">
        <div>
          <span>In your wallet</span>
          <b>{fmt(Math.floor(walletAmmo))}</b>
        </div>
        <span className="ammovault__arrow" aria-hidden>
          {dep ? "→" : "←"}
        </span>
        <div>
          <span>In the game</span>
          <b>{fmt(Math.floor(gameAmmo))}</b>
        </div>
      </div>

      <div className="ammovault__form">
        <div className="amount">
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} aria-label={`${TOKEN.ticker} amount`} />
          <span>
            {TOKEN.ticker} <small className="ammovault__usd">≈ {fmtUsd(n * price.usd)}</small>
          </span>
        </div>
        <div className="chips">
          {[25, 50, 75].map((pct) => (
            <button key={pct} type="button" onClick={() => setAmount(String(Math.floor((from * pct) / 100)))}>
              {pct}%
            </button>
          ))}
          <button type="button" onClick={() => setAmount(String(from))}>
            Max
          </button>
        </div>
        <button type="button" className={`btn btn--block ${dep ? "btn--pink" : "btn--cyan"}`} disabled={n < 1 || short} onClick={go}>
          {short ? `Not enough ${TOKEN.ticker} ${dep ? "in your wallet" : "in the game"}` : dep ? `Deposit ${fmt(n)} ${TOKEN.ticker}` : `Withdraw ${fmt(n)} ${TOKEN.ticker}`}
        </button>
      </div>

      <p className="muted ammovault__note">
        {dep
          ? "One wallet approval per deposit. After that every purchase in the game is instant: no more approvals."
          : `Unspent AMMO goes back to your wallet. AMMO you spend in the game is burned and can't be withdrawn. ${WITHDRAW_FEE_NOTE}`}
      </p>
    </section>
  );
}
