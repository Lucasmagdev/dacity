import { useEffect, useMemo, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import AmmoIcon from "./art/AmmoIcon";
import Coin from "./art/Coin";
import GangsterToy from "./art/GangsterToy";
import Socials from "./Socials";
import { TOKEN, STORE_NAME, fmt } from "../config/game";
import { MOCK, useMock } from "../mock";
import { LIVE } from "../backend/live";
import { rpc } from "../backend/supabase";
import { fmtCap, fmtTokenPrice, useAmmoPrice } from "../price";
import { usePlatform } from "../mock/platform";
import { snapshot, type BurnCategory, type BurnEvent } from "../mock/tokenSim";

/**
 * Burn categories use the game's own art: item images for med kits, weapons and vests, the DC chip for
 * claim-all fees, and a fused gangster for fusion fees.
 */
function CatIcon({ id, label, size = 30 }: { id: BurnCategory; label?: string; size?: number }) {
  if (id === "claimAll") return <Coin size={size} />;
  if (id === "fusion")
    return (
      <span className="caticon caticon--toy" style={{ width: size, height: size }}>
        <GangsterToy gangsterId={11} rarity={3} bare />
      </span>
    );
  // weapons: show the exact weapon when the feed label names it
  const weapon = id === "weapon" ? (/rifle/i.test(label ?? "") ? "rifle" : /smg/i.test(label ?? "") ? "smg" : /pistol/i.test(label ?? "") ? "pistol" : "rifle") : id;
  return <img className="caticon" src={`/items/${weapon}-128.webp`} width={size} height={size} alt="" loading="lazy" decoding="async" />;
}

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

/** Live mode: real game-wide $AMMO numbers from the database (public totals + anonymous feed). */
type LiveStats = {
  spent_total: number;
  pending_burn: number;
  burned_onchain: number;
  spent_24h: number;
  spent_1h: number;
  spends: number;
  by_category: Partial<Record<BurnCategory, { amount: number; count: number }>>;
  hourly_24h: { hour: string; amount: number }[];
  recent: { at: string; amount: number; category: BurnCategory; label: string; who: string }[];
  burns: { amount: number; signature: string; created_at: string }[];
};

function useLiveStats() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!LIVE) return;
    let alive = true;
    const load = () =>
      rpc<LiveStats>("ammo_stats")
        .then((s) => alive && (setStats(s), setError(null)))
        .catch((e: Error) => alive && setError(e.message));
    load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return { stats, error };
}

export default function Token({ onBack }: { onBack: () => void }) {
  const now = useNow();
  const live = useLiveStats();
  const s = useMock();
  const yourBurned = usePlatform((p) => p.ammoBurned);
  const snap = useMemo(() => snapshot(now), [now]);
  const price = useAmmoPrice();

  // your own burns (from the local tx history) join the feed and the categories
  const yours = useMemo(() => {
    const events: BurnEvent[] = [];
    const cats: Partial<Record<BurnCategory, { amount: number; count: number }>> = {};
    for (const t of s.txs) {
      if (!t.ammo || t.ammo >= 0 || t.type === "ammoWithdraw") continue;
      const cat = t.type === "shop" && /vest/i.test(t.title) ? "vest" : TX_TO_CAT[t.type] ?? "weapon";
      const amount = -t.ammo;
      events.push({ at: t.at, amount, category: cat, who: "You", label: t.title });
      const c = (cats[cat] ??= { amount: 0, count: 0 });
      c.amount += amount;
      c.count++;
    }
    return { events, cats };
  }, [s.txs]);

  // ---- one shape for both modes: simulated network (mock) or real database numbers (live)
  const ls = live.stats;
  const n = (v: unknown) => Number(v ?? 0);
  // every AMMO spent in the game is committed to the burn (burned on-chain in batches)
  const burned = LIVE ? n(ls?.spent_total) : snap.simBurned + yourBurned;
  const burned24h = LIVE ? n(ls?.spent_24h) : snap.burned24h;
  const perHour = LIVE ? n(ls?.spent_1h) : snap.burned1h;
  const supply = TOKEN.totalSupply - burned;
  const pctBurned = (burned / TOKEN.totalSupply) * 100;
  const circulating = supply; // no locked / non-circulating wallets announced yet
  const feed: BurnEvent[] = LIVE
    ? (ls?.recent ?? []).map((r) => ({ at: new Date(r.at).getTime(), amount: n(r.amount), category: r.category, who: r.who, label: r.label })).slice(0, 14)
    : [...yours.events.filter((e) => e.at > now - 10 * 60_000), ...snap.recent].sort((a, b) => b.at - a.at).slice(0, 14);
  const cats = CATS.map((c) => {
    if (LIVE) return { ...c, amount: n(ls?.by_category?.[c.id]?.amount), count: n(ls?.by_category?.[c.id]?.count) };
    const sim = snap.byCategory[c.id];
    const mine = yours.cats[c.id];
    return { ...c, amount: sim.amount + (mine?.amount ?? 0), count: sim.count + (mine?.count ?? 0) };
  });
  const catMax = Math.max(...cats.map((c) => c.amount), 1);
  const totalSpends = LIVE ? n(ls?.spends) : cats.reduce((t, c) => t + c.count, 0);
  const chart = LIVE
    ? Array.from({ length: 25 }, (_, h) => {
        const t = now - (24 - h) * 3_600_000;
        const after = (ls?.hourly_24h ?? []).filter((b) => new Date(b.hour).getTime() + 3_600_000 > t).reduce((s2, b) => s2 + n(b.amount), 0);
        return { t, supply: TOKEN.totalSupply - (burned - (h === 24 ? 0 : after)) };
      })
    : snap.supply24h.map((p) => ({ t: p.t, supply: TOKEN.totalSupply - p.burnedBefore - yourBurned }));

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
        {MOCK ? (
          <div className="mockbar">
            <span className="mockbar__tag">Simulated</span>
            <span>
              The token isn't live yet: game-wide activity is simulated and your own burns are added on top. After launch these numbers
              come straight from the chain.
            </span>
          </div>
        ) : (
          !TOKEN.address && (
            <div className="mockbar mockbar--info">
              <span className="mockbar__tag">Pre-launch</span>
              <span>
                Real numbers from the game. ${TOKEN.ticker} isn't trading yet, so the price is the {TOKEN.launchpad} launch reference and trading
                stats start at launch.
              </span>
            </div>
          )
        )}
        {LIVE && live.error && <p className="note note--error">Couldn't load live stats: {live.error}</p>}

        {/* ------------------------------------------------------------ hero */}
        <section className="thero">
          <div className="thero__badge">
            <AmmoIcon size={132} />
          </div>
          <p className="thero__ticker">${TOKEN.ticker}</p>
          <p className="thero__label">Current supply · going down with every burn</p>
          <div className="thero__supply">
            <Odometer value={supply} />
          </div>
          <div className="burnbar" aria-label={`${pctBurned.toFixed(4)}% of the supply burned`}>
            <span style={{ width: `${Math.max(0.6, Math.min(100, pctBurned))}%` }} />
          </div>
          <p className="thero__pct">
            <b>{pctBurned.toFixed(4)}%</b> of the {compact(TOKEN.totalSupply)} supply burned forever
          </p>
          <div className="thero__cta">
            {TOKEN.buyUrl ? (
              <a className="cta" href={TOKEN.buyUrl} target="_blank" rel="noreferrer">
                Buy ${TOKEN.ticker} on {TOKEN.launchpad}
              </a>
            ) : (
              <span className="cta cta--soon">Launching on {TOKEN.launchpad}</span>
            )}
            <a className="btn" href="#/docs/ammo">
              Read the token docs
            </a>
          </div>
          <div className="thero__socials">
            <span>Official channels</span>
            <Socials variant="pill" size={16} />
          </div>
        </section>

        {/* ------------------------------------------------------------ stat grid */}
        <dl className="tstats">
          <div className="tstat tstat--gold">
            <dt>Price{price.source === "sim" ? (MOCK ? " (simulated)" : " (launch reference)") : ""}</dt>
            <dd>{fmtTokenPrice(price.usd)}</dd>
            <small>Market cap {fmtCap(price.marketCap)}</small>
          </div>
          <div className="tstat">
            <dt>Initial supply</dt>
            <dd>{compact(TOKEN.totalSupply)}</dd>
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
            <small>
              {LIVE
                ? `${fmt(Math.floor(n(ls?.burned_onchain)))} burned on-chain · ${fmt(Math.floor(n(ls?.pending_burn)))} in the next burn`
                : `${fmt(Math.floor(burned))} AMMO gone`}
            </small>
          </div>
          <div className="tstat tstat--fire">
            <dt>Burned 24h</dt>
            <dd>{compact(burned24h)}</dd>
            <small>{compact(perHour)} in the last hour</small>
          </div>
          <div className="tstat">
            <dt>Player spends</dt>
            <dd>{fmt(totalSpends)}</dd>
            <small>Items & fees paid in AMMO</small>
          </div>
          <div className="tstat tstat--gold">
            <dt>Creator rewards → Reward Pool</dt>
            {LIVE ? (
              <>
                <dd>—</dd>
                <small>Starts when {TOKEN.ticker} trades on {TOKEN.launchpad}</small>
              </>
            ) : (
              <>
                <dd>{compact(snap.taxTotal)}</dd>
                <small>
                  {compact(snap.tax24h)} in 24h · from {compact(snap.volume24h)} volume
                </small>
              </>
            )}
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
              <span className="tchart__delta">−{compact(burned24h)}</span>
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
                      <span className="tfeed__ico">
                        <CatIcon id={e.category} label={e.label} size={30} />
                      </span>
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
                    <CatIcon id={c.id} size={28} /> {c.label}
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
            [`${TOKEN.launchpad} creator rewards`, "100% go into the Reward Pool"],
            ["Items & fees in AMMO", "Med kits, weapons, vests, fusion, claim-all"],
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
              <dd>{TOKEN.chain}</dd>
            </div>
            <div>
              <dt>Launchpad</dt>
              <dd>{TOKEN.launchpad}</dd>
            </div>
            <div>
              <dt>Supply</dt>
              <dd>{fmt(TOKEN.totalSupply)} fixed</dd>
            </div>
            <div>
              <dt>Paired with</dt>
              <dd>{TOKEN.pair}</dd>
            </div>
            <div>
              <dt>Trading fees</dt>
              <dd>Creator rewards → Reward Pool</dd>
            </div>
            <div>
              <dt>Mint address</dt>
              <dd>{TOKEN.address ? <code>{TOKEN.address}</code> : "Announced at launch"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
