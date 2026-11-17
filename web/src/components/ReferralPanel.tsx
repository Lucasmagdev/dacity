import { useEffect, useState } from "react";
import { DACITY_PER_USDC, fmt } from "../config/game";
import { MOCK, useMock } from "../mock";
import { LIVE, useLiveStatus } from "../backend/live";
import { rpc } from "../backend/supabase";
import { refCode, refLink } from "../referral";

type Mine = {
  code: string | null;
  pct: number;
  earned_dc: number;
  recruits: number;
  depositors: number;
  list: { gang: string; joined_at: string; earned_dc: number }[];
};

const DEFAULT_PCT = 5;

/** HQ: the player's invite link (their gang name), who joined with it and what it earned. */
export default function ReferralPanel() {
  const gangName = useMock((s) => s.gang?.name ?? "");
  const status = useLiveStatus();
  const [mine, setMine] = useState<Mine | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!LIVE || status.phase !== "ready") return;
    let alive = true;
    const load = () =>
      rpc<Mine>("my_referrals")
        .then((m) => alive && setMine(m))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [status.phase]);

  const code = mine?.code ?? (gangName ? refCode(gangName) : "");
  if (!code) return null;
  const link = refLink(code);
  const pct = Number(mine?.pct ?? DEFAULT_PCT);
  const earned = Number(mine?.earned_dc ?? 0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy your invite link", link);
    }
  };

  return (
    <section className="panel refer" aria-label="Invite and earn">
      <div className="refer__head">
        <div>
          <p className="eyebrow">Invite &amp; earn</p>
          <h2>
            Get {pct}% of every deposit your recruits make
          </h2>
          <p className="muted">
            Share your link. Anyone who founds their gang through it is yours for good, and every USDC they deposit pays you {pct}% in DC,
            instantly.
          </p>
        </div>
        <dl className="refer__stats">
          <div>
            <dt>Recruits</dt>
            <dd>{fmt(Number(mine?.recruits ?? 0))}</dd>
          </div>
          <div>
            <dt>Earned</dt>
            <dd>
              {fmt(earned)} DC <small>≈ ${(earned / DACITY_PER_USDC).toFixed(2)}</small>
            </dd>
          </div>
        </dl>
      </div>

      <div className="refer__link">
        <code title={link}>{link.replace(/^https?:\/\//, "")}</code>
        <button type="button" className="btn btn--pink" onClick={copy}>
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>

      {MOCK && <p className="hint">Mock mode: rewards are paid by the real backend when a recruit's deposit confirms on Solana.</p>}

      {!!mine?.list.length && (
        <ul className="refer__list">
          {mine.list.slice(0, 8).map((r) => (
            <li key={r.gang + r.joined_at}>
              <span>{r.gang}</span>
              <b>+{fmt(Number(r.earned_dc))} DC</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
