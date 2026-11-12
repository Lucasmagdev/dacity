import { useEffect, useMemo, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import Coin from "./art/Coin";
import { DACITY_PER_USDC, RARITIES, RESOURCE, WEAPONS, fmt } from "../config/game";
import ResIcon from "./art/ResIcon";
import { usePlatform } from "../mock/platform";
import { MOCK, MOCK_DAY_MS, farmedOf, isFarming, isShot, pendingOf, rateOf, statsOf, useMock, weaponDaysLeft, type MockTx, type TxType } from "../mock";

const PERIODS = [
  { label: "Per hour", days: 1 / 24 },
  { label: "Per day", days: 1 },
  { label: "Per week", days: 7 },
  { label: "Per month", days: 30 },
];

const TX_FILTERS: { label: string; types: TxType[] | null }[] = [
  { label: "All", types: null },
  { label: "Vault", types: ["deposit", "withdraw", "faucet"] },
  { label: "Boxes", types: ["buy", "open"] },
  { label: "Claims", types: ["claim", "claimAll"] },
  { label: "Fusion", types: ["fuse"] },
  { label: "Medical", types: ["medkit", "heal"] },
  { label: "Armory", types: ["shop", "equip"] },
  { label: "RESOURCE", types: ["resource"] },
  { label: "Other", types: ["gang", "gift"] },
];

const TX_ICON: Record<TxType, string> = {
  gang: "★",
  deposit: "↓",
  withdraw: "↑",
  faucet: "$",
  buy: "▣",
  open: "✦",
  claim: "◎",
  claimAll: "◉",
  fuse: "⚗",
  gift: "♥",
  medkit: "✚",
  heal: "✚",
  shop: "⌖",
  equip: "⚔",
  resource: "🔥",
};

const PAGE = 25;

const fmtDc = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 1 : 0 });
const fmtUsd = (dc: number) => `$${(dc / DACITY_PER_USDC).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number, f: (x: number) => string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${f(Math.abs(n))}`;

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function when(t: number, now: number) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard({ onBack, onFound }: { onBack: () => void; onFound: () => void }) {
  const s = useMock();
  const burnedAll = usePlatform((p) => p.resourceBurned);
  const now = useNow();
  const [filter, setFilter] = useState(0);
  const [shown, setShown] = useState(PAGE);

  const farm = useMemo(() => {
    let ratePerDay = 0;
    let pending = 0;
    let lifetime = 0;
    let remaining = 0;
    let active = 0;
    let shot = 0;
    let fused = 0;
    let nextRetire: { id: number; days: number } | null = null;
    const byRarity = RARITIES.map(() => ({ count: 0, fused: 0, active: 0, rate: 0, pending: 0, remaining: 0 }));

    for (const g of s.gangsters) {
      const st = statsOf(g);
      const farmed = farmedOf(g, now);
      const left = st.cap - farmed;
      const row = byRarity[g.rarity];
      const p = pendingOf(g, now);
      row.count++;
      row.pending += p;
      row.remaining += left;
      pending += p;
      lifetime += farmed;
      remaining += left;
      if (g.fused) {
        fused++;
        row.fused++;
      }
      if (isShot(g, now)) shot++;
      if (isFarming(g, now)) {
        active++;
        row.active++;
        row.rate += rateOf(g, now);
        ratePerDay += rateOf(g, now);
        const days = left / st.perDay;
        if (!nextRetire || days < nextRetire.days) nextRetire = { id: g.id, days };
      }
    }

    /** cap-aware: a gangster near retirement only earns what it has left */
    const earnIn = (days: number) =>
      s.gangsters.reduce((t, g) => {
        if (!isFarming(g, now)) return t; // retired or shot: earns nothing until healed
        const st = statsOf(g);
        const career = Math.min(st.perDay * days, st.cap - farmedOf(g, now));
        // weapon bonus is extra DC on top of the career, for the days the weapon has left
        const wDays = Math.min(days, weaponDaysLeft(g, now), (st.cap - farmedOf(g, now)) / st.perDay);
        const boost = g.weapon && wDays > 0 ? st.perDay * (WEAPONS[g.weapon.id].boostPct / 100) * wDays : 0;
        return t + career + boost;
      }, 0);

    // gangsters consumed by fusion are gone from the list, so lifetime = everything ever claimed + what's pending now
    lifetime = s.stats.claimed + pending;

    return { ratePerDay, pending, lifetime, remaining, active, shot, fused, nextRetire, byRarity, periods: PERIODS.map((p) => ({ ...p, dc: earnIn(p.days) })) };
  }, [s.gangsters, s.stats.claimed, now]);

  if (!s.gang) {
    return (
      <div className="page select">
        <Scene dim />
        <Nav links={false} game onBack={onBack} />
        <div className="select__inner">
          <header className="section__head">
            <p className="eyebrow">No gang yet</p>
            <h2>Found your gang first</h2>
            <p className="section__lede">Your farm stats and transactions show up here once you have a crew.</p>
          </header>
          <div style={{ display: "grid", placeItems: "center" }}>
            <button type="button" className="cta" onClick={onFound}>
              Choose your boss →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const types = TX_FILTERS[filter].types;
  const txs = types ? s.txs.filter((t) => types.includes(t.type)) : s.txs;
  const retired = s.gangsters.length - farm.active - farm.shot;

  return (
    <div className="page hq dash">
      <Scene dim />
      <Nav links={false} game onBack={onBack} />

      <div className="hq__inner">
        {MOCK && (
          <div className="mockbar">
            <span className="mockbar__tag">Mock mode</span>
            <span>Time is sped up: 1 farming day = {MOCK_DAY_MS / 1000}s. Periods below are in game time.</span>
          </div>
        )}

        {/* ------------------------------------------------------------ farm rate */}
        <section className="panel dash__hero">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Dashboard · {s.gang.name}</p>
              <h2>Farm output</h2>
            </div>
            <span className="dash__live">
              <i /> {fmt(farm.active)} of {fmt(s.gangsters.length)} gangsters farming
            </span>
          </div>
          <ul className="dash__rates">
            {farm.periods.map((p) => (
              <li key={p.label}>
                <span className="dash__label">{p.label}</span>
                <strong>
                  <Coin size={20} /> {fmtDc(p.dc)} <small>DC</small>
                </strong>
                <span className="dash__usd">≈ {fmtUsd(p.dc)}</span>
              </li>
            ))}
          </ul>
          <p className="dash__note">
            Counts every gangster you own, fused or not, at its current rate. Shot gangsters earn nothing until healed, and
            gangsters close to retirement only count what they have left to farm.
            {farm.shot > 0 && (
              <>
                {" "}
                <a href="#/hq" className="dash__warn">
                  {fmt(farm.shot)} shot · heal them in the HQ →
                </a>
              </>
            )}
          </p>
        </section>

        {/* ------------------------------------------------------------ status */}
        <dl className="dash__stats">
          <div className="tile tile--gold">
            <dt>Ready to claim</dt>
            <dd>{fmtDc(farm.pending)} DC</dd>
            <small>≈ {fmtUsd(farm.pending)}</small>
          </div>
          <div className="tile">
            <dt>Farmed lifetime</dt>
            <dd>{fmtDc(farm.lifetime)} DC</dd>
            <small>≈ {fmtUsd(farm.lifetime)}</small>
          </div>
          <div className="tile">
            <dt>Claimed</dt>
            <dd>{fmtDc(s.stats.claimed)} DC</dd>
            <small>≈ {fmtUsd(s.stats.claimed)}</small>
          </div>
          <div className="tile">
            <dt>Left to farm</dt>
            <dd>{fmtDc(farm.remaining)} DC</dd>
            <small>until every career ends</small>
          </div>
          <div className="tile">
            <dt>Crew</dt>
            <dd>{fmt(s.gangsters.length)}</dd>
            <small>
              {fmt(farm.active)} farming · {fmt(farm.shot)} shot · {fmt(retired)} retired · {fmt(farm.fused)} fused
            </small>
          </div>
          <div className="tile">
            <dt>Next retirement</dt>
            <dd>{farm.nextRetire ? `#${farm.nextRetire.id}` : "—"}</dd>
            <small>{farm.nextRetire ? `in ${farm.nextRetire.days.toFixed(1)} days` : "nobody farming"}</small>
          </div>
        </dl>

        {/* ------------------------------------------------------------ $RESOURCE */}
        <section className="panel burnpanel">
          <div className="burnpanel__flame" aria-hidden>
            <ResIcon size={44} />
          </div>
          <div className="burnpanel__text">
            <p className="eyebrow">${RESOURCE.ticker}</p>
            <p className="muted">Items and fees are paid in RESOURCE and every token spent is burned, so the supply only goes down.</p>
          </div>
          <dl className="burnpanel__stats">
            <div>
              <dt>Your balance</dt>
              <dd>{fmt(Math.floor(s.resource))}</dd>
            </div>
            <div>
              <dt>You burned</dt>
              <dd>{fmt(Math.floor(s.txs.reduce((t, x) => t + (x.resource && x.resource < 0 ? -x.resource : 0), 0)))}</dd>
            </div>
            <div>
              <dt>Burned game-wide</dt>
              <dd className="burnpanel__hot">🔥 {fmt(Math.floor(burnedAll))}</dd>
            </div>
          </dl>
        </section>

        {/* ------------------------------------------------------------ by rarity */}
        <section className="panel">
          <div className="panel__head">
            <h2>By rarity</h2>
          </div>
          <div className="dash__table" role="table" aria-label="Farm by rarity">
            <div className="dash__row dash__row--head" role="row">
              <span role="columnheader">Rarity</span>
              <span role="columnheader">Gangsters</span>
              <span role="columnheader">Farming</span>
              <span role="columnheader">DC / day</span>
              <span role="columnheader">Pending</span>
              <span role="columnheader">Left to farm</span>
            </div>
            {RARITIES.map((r, i) => {
              const row = farm.byRarity[i];
              return (
                <div key={r.id} className={`dash__row${row.count === 0 ? " dash__row--empty" : ""}`} role="row" style={{ "--rc": r.color } as React.CSSProperties}>
                  <span role="cell" className="dash__rarity">
                    <i /> {r.name}
                  </span>
                  <span role="cell" data-label="Gangsters">
                    {fmt(row.count)}
                    {row.fused > 0 && <small> · {row.fused} fused</small>}
                  </span>
                  <span role="cell" data-label="Farming">
                    {fmt(row.active)}
                  </span>
                  <span role="cell" data-label="DC / day" className="gold">
                    {fmt(row.rate)}
                  </span>
                  <span role="cell" data-label="Pending">
                    {fmtDc(row.pending)}
                  </span>
                  <span role="cell" data-label="Left to farm">
                    {fmtDc(row.remaining)}
                  </span>
                </div>
              );
            })}
            <div className="dash__row dash__row--total" role="row">
              <span role="cell">Total</span>
              <span role="cell" data-label="Gangsters">
                {fmt(s.gangsters.length)}
              </span>
              <span role="cell" data-label="Farming">
                {fmt(farm.active)}
              </span>
              <span role="cell" data-label="DC / day" className="gold">
                {fmt(farm.ratePerDay)}
              </span>
              <span role="cell" data-label="Pending">
                {fmtDc(farm.pending)}
              </span>
              <span role="cell" data-label="Left to farm">
                {fmtDc(farm.remaining)}
              </span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ transactions */}
        <section className="panel">
          <div className="panel__head">
            <h2>
              Transactions <span className="count">{fmt(s.txs.length)}</span>
            </h2>
          </div>
          <div className="filters" role="tablist" aria-label="Filter transactions">
            {TX_FILTERS.map((f, i) => (
              <button
                key={f.label}
                type="button"
                role="tab"
                aria-selected={filter === i}
                onClick={() => {
                  setFilter(i);
                  setShown(PAGE);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {txs.length === 0 ? (
            <p className="empty">No transactions here yet.</p>
          ) : (
            <>
              <ul className="txs">
                {txs.slice(0, shown).map((t) => (
                  <TxRow key={t.id} t={t} now={now} />
                ))}
              </ul>
              {txs.length > shown && (
                <button type="button" className="btn btn--block txs__more" onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({fmt(txs.length - shown)} left)
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function TxRow({ t, now }: { t: MockTx; now: number }) {
  return (
    <li className={`tx tx--${t.type}`}>
      <span className="tx__ico" aria-hidden>
        {TX_ICON[t.type]}
      </span>
      <div className="tx__main">
        <strong>{t.title}</strong>
        <span>{t.detail}</span>
      </div>
      <div className="tx__amounts">
        {t.dc !== undefined && t.dc !== 0 && <span className={t.dc > 0 ? "up" : "down"}>{signed(t.dc, fmtDc)} DC</span>}
        {t.resource !== undefined && t.resource !== 0 && (
          <span className={t.resource > 0 ? "up" : "burn"}>
            {t.resource < 0 ? "🔥 " : ""}
            {signed(t.resource, (x) => x.toLocaleString("en-US", { maximumFractionDigits: 0 }))} RES
          </span>
        )}
        {t.usdc !== undefined && t.usdc !== 0 && (
          <span className={t.usdc > 0 ? "up" : "down"}>{signed(t.usdc, (x) => x.toLocaleString("en-US", { maximumFractionDigits: 2 }))} USDC</span>
        )}
      </div>
      <div className="tx__meta">
        <span>{when(t.at, now)}</span>
        <code title={t.hash}>
          {t.hash.slice(0, 6)}…{t.hash.slice(-4)}
        </code>
      </div>
    </li>
  );
}
