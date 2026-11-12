import { useEffect, useMemo, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import ResIcon from "./art/ResIcon";
import { RESOURCE, STORE_NAME, fmt } from "../config/game";
import { MOCK, useMock } from "../mock";
import { usePlatform } from "../mock/platform";
import { snapshot, type BurnCategory, type BurnEvent } from "../mock/tokenSim";

const CATS: { id: BurnCategory; label: string; color: string; icon: string }[] = [
  { id: "medkit", label: "Med kits", color: "#ff5a6e", icon: "✚" },
  { id: "claimAll", label: "Claim all fees", color: "#ffd36b", icon: "◉" },
  { id: "weapon", label: "Weapons", color: "#ff8a3d", icon: "⚔" },
  { id: "fusion", label: "Fusion fees", color: "#b45cff", icon: "⚗" },
  { id: "vest", label: "Vests", color: "#3ddc84", icon: "🛡" },
];

const TX_TO_CAT: Record<string, BurnCategory> = { medkit: "medkit", heal: "medkit", shop: "weapon", fuse: "fusion", claimAll: "claimAll" };

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : fmt(Math.round(n));

const ago = (t: number, now: number) => {
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
};

/** Big supply number: digits roll when they change. */
function Odometer({ value }: { value: number }) {
  const digits = fmt(Math.floor(value)).split("");
  return (
    <span className="odo" aria-label={fmt(Math.floor(value))}>
      {digits.map((d, i) =>
        /\d/.test(d) ? (
          <span key={i} className="odo__d" aria-hidden>
            <span style={{ translate: `0 ${-Number(d) * 10}%` }}>
              {Array.from({ length: 10 }, (_, n) => (
                <i key={n}>{n}</i>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} className="odo__sep" aria-hidden>
            {d}
          </span>
        ),
      )}
    </span>
  );
}

/** Area chart of the supply over the last 24h. */
function SupplyChart({ points }: { points: { t: number; supply: number }[] }) {
  const W = 640;
  const H = 200;
  const min = Math.min(...points.map((p) => p.supply));
  const max = Math.max(...points.map((p) => p.supply));
  const span = Math.max(1, max - min);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => 14 + (1 - (v - min) / span) * (H - 34);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.supply).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const lastY = y(points[points.length - 1].supply);
  return (
    <svg className="schart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Supply over the last 24 hours">
      <defs>
        <linearGradient id="schart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a3d" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ff2e88" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="schart-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd36b" />
          <stop offset="1" stopColor="#ff2e88" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="schart__grid" />
      ))}
      <path d={area} fill="url(#schart-fill)" />
      <path d={line} fill="none" stroke="url(#schart-line)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      <circle cx={W} cy={lastY} r="5" className="schart__dot" />
    </svg>
  );
}

export default function Token({ onBack }: { onBack: () => void }) {
  const now = useNow();
  const s = useMock();
  const yourBurned = usePlatform((p) => p.resourceBurned);
  const snap = useMemo(() => snapshot(now), [now]);

  // your own burns (from the local tx history) join the feed and the categories
  const yours = useMemo(() => {
    const events: BurnEvent[] = [];
    const cats: Partial<Record<BurnCategory, { amount: number; count: number }>> = {};
    for (const t of s.txs) {
      if (!t.resource || t.resource >= 0) continue;
      const cat = t.type === "shop" && /vest/i.test(t.title) ? "vest" : TX_TO_CAT[t.type] ?? "weapon";
      const amount = -t.resource;
      events.push({ at: t.at, amount, category: cat, who: "You", label: t.title });
      const c = (cats[cat] ??= { amount: 0, count: 0 });
      c.amount += amount;
      c.count++;
    }
    return { events, cats };
  }, [s.txs]);

  const burned = snap.simBurned + yourBurned;
  const supply = RESOURCE.totalSupply - burned;
  const pctBurned = (burned / RESOURCE.totalSupply) * 100;
  const perHour = snap.burned1h;
  const circulating = supply; // no locked / non-circulating wallets announced yet
  const feed = [...yours.events.filter((e) => e.at > now - 10 * 60_000), ...snap.recent].sort((a, b) => b.at - a.at).slice(0, 14);
  const cats = CATS.map((c) => {
    const sim = snap.byCategory[c.id];
    const mine = yours.cats[c.id];
    return { ...c, amount: sim.amount + (mine?.amount ?? 0), count: sim.count + (mine?.count ?? 0) };
  });
  const catMax = Math.max(...cats.map((c) => c.amount), 1);
  const totalSpends = cats.reduce((t, c) => t + c.count, 0);
  const chart = snap.supply24h.map((p) => ({ t: p.t, supply: RESOURCE.totalSupply - p.burnedBefore - yourBurned }));

  return (
    <div className="page token">
      <Scene dim />
      <Nav links={false} game onBack={onBack} />
      <div className="token__embers" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>

      <div className="token__inner">
        {MOCK && (
          <div className="mockbar">
            <span className="mockbar__tag">Simulated</span>
            <span>
              The token isn't live yet: game-wide activity is simulated and your own burns are added on top. After launch these numbers
              come straight from the chain.
            </span>
          </div>
        )}

        {/* ------------------------------------------------------------ hero */}
        <section className="thero">
          <div className="thero__badge">
            <ResIcon size={64} />
          </div>
          <p className="thero__ticker">${RESOURCE.ticker}</p>
          <p className="thero__label">Current supply · going down with every burn</p>
          <div className="thero__supply">
            <Odometer value={supply} />
          </div>
          <div className="burnbar" aria-label={`${pctBurned.toFixed(4)}% of the supply burned`}>
            <span style={{ width: `${Math.max(0.6, Math.min(100, pctBurned))}%` }} />
          </div>
          <p className="thero__pct">
            <b>{pctBurned.toFixed(4)}%</b> of the {compact(RESOURCE.totalSupply)} supply burned forever
          </p>
          <div className="thero__cta">
            {RESOURCE.buyUrl ? (
              <a className="cta" href={RESOURCE.buyUrl} target="_blank" rel="noreferrer">
                Buy ${RESOURCE.ticker} on {RESOURCE.launchpad}
              </a>
            ) : (
              <span className="cta cta--soon">Launching on {RESOURCE.launchpad}</span>
            )}
            <a className="btn" href="#/docs/resource">
              Read the token docs
            </a>
          </div>
        </section>

        {/* ------------------------------------------------------------ stat grid */}
        <dl className="tstats">
          <div className="tstat">
            <dt>Initial supply</dt>
            <dd>{compact(RESOURCE.totalSupply)}</dd>
            <small>Fixed. No mint function, ever.</small>
          </div>
          <div className="tstat">
            <dt>Circulating</dt>
            <dd>{compact(circulating)}</dd>
            <small>Current supply in wallets</small>
          </div>
          <div className="tstat tstat--fire">
            <dt>Total burned</dt>
            <dd>🔥 {compact(burned)}</dd>
            <small>{fmt(Math.floor(burned))} RESOURCE gone</small>
          </div>
          <div className="tstat tstat--fire">
            <dt>Burned 24h</dt>
            <dd>{compact(snap.burned24h)}</dd>
            <small>{compact(perHour)} in the last hour</small>
          </div>
          <div className="tstat">
            <dt>Player spends</dt>
            <dd>{fmt(totalSpends)}</dd>
            <small>Items & fees paid in RESOURCE</small>
          </div>
          <div className="tstat tstat--gold">
            <dt>{RESOURCE.taxPct}% tax → Reward Pool</dt>
            <dd>{compact(snap.taxTotal)}</dd>
            <small>{compact(snap.tax24h)} in 24h · from {compact(snap.volume24h)} volume</small>
          </div>
        </dl>

        <div className="tgrid">
          {/* ------------------------------------------------------------ supply chart */}
          <section className="panel tchart">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Last 24 hours</p>
                <h2>Supply only goes down</h2>
              </div>
              <span className="tchart__delta">−{compact(snap.burned24h)}</span>
            </div>
            <SupplyChart points={chart} />
            <div className="tchart__axis">
              <span>24h ago</span>
              <span>12h ago</span>
              <span>now</span>
            </div>
          </section>

          {/* ------------------------------------------------------------ live feed */}
          <section className="panel tfeed">
            <div className="panel__head">
              <h2>
                Live burns <span className="tfeed__live">● live</span>
              </h2>
            </div>
            {feed.length === 0 ? (
              <p className="empty">Waiting for the next burn…</p>
            ) : (
              <ul>
                {feed.map((e) => {
                  const c = CATS.find((x) => x.id === e.category)!;
                  return (
                    <li key={`${e.at}-${e.who}-${e.amount}`} className={e.who === "You" ? "tfeed__you" : undefined} style={{ "--cc": c.color } as React.CSSProperties}>
                      <span className="tfeed__ico">{c.icon}</span>
                      <div>
                        <b>{e.label}</b>
                        <small>
                          {e.who} · {ago(e.at, now)}
                        </small>
                      </div>
                      <span className="tfeed__amt">🔥 {fmt(e.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------------ where it burns */}
        <section className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Where the burn comes from</p>
              <h2>Burned by players</h2>
            </div>
            <a className="btn" href="#/armory">
              {STORE_NAME} →
            </a>
          </div>
          <ul className="tcats">
            {cats
              .slice()
              .sort((a, b) => b.amount - a.amount)
              .map((c) => (
                <li key={c.id} style={{ "--cc": c.color } as React.CSSProperties}>
                  <span className="tcats__name">
                    <i>{c.icon}</i> {c.label}
                  </span>
                  <span className="tcats__bar">
                    <span style={{ width: `${(c.amount / catMax) * 100}%` }} />
                  </span>
                  <span className="tcats__val">
                    {compact(c.amount)} <small>· {fmt(c.count)}×</small>
                  </span>
                </li>
              ))}
          </ul>
        </section>

        {/* ------------------------------------------------------------ flywheel strip */}
        <section className="tfly">
          {[
            ["Players buy boxes", "USDC fills the Reward Pool"],
            [`${RESOURCE.taxPct}% tax on every trade`, "Goes into the Reward Pool"],
            ["Items & fees in RESOURCE", "Med kits, weapons, vests, fusion, claim-all"],
            ["100% burned", "Supply only goes down"],
          ].map(([t, d], i) => (
            <div key={t} className="tfly__step">
              <span>{i + 1}</span>
              <b>{t}</b>
              <small>{d}</small>
            </div>
          ))}
          <a className="tfly__more" href="#/docs/flywheel">
            See the full flywheel →
          </a>
        </section>

        {/* ------------------------------------------------------------ token facts */}
        <section className="panel tfacts">
          <dl>
            <div>
              <dt>Chain</dt>
              <dd>Robinhood Chain</dd>
            </div>
            <div>
              <dt>Launchpad</dt>
              <dd>{RESOURCE.launchpad}</dd>
            </div>
            <div>
              <dt>Supply</dt>
              <dd>{fmt(RESOURCE.totalSupply)} fixed</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{RESOURCE.taxPct}% → Reward Pool</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>{RESOURCE.address ? <code>{RESOURCE.address}</code> : "Announced at launch"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
