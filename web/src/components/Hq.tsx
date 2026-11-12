import { useEffect, useMemo, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import Portrait from "./Portrait";
import BoxReveal from "./BoxReveal";
import CashBox from "./art/CashBox";
import Coin from "./art/Coin";
import GangsterToy from "./art/GangsterToy";
import ResIcon from "./art/ResIcon";
import { BOX_PRICE_DC, BULK_TIERS, CLAIM_ALL_FEE_RES, DACITY_PER_USDC, LAUNCH_SALE, MEDKIT_PRICE_RES, RESOURCE, fmtRes, PROTAGONISTS, RARITIES, SHOT_CHANCE_PER_DAY, STORE_NAME, WEAPONS, fmt, quoteBoxes } from "../config/game";
import { usePlatform } from "../mock/platform";
import {
  MAX_BOXES_PER_TX,
  MOCK_DAY_MS,
  archetypeOf,
  claimAllQuote,
  fusionCandidates,
  farmedOf,
  isBoxReady,
  isFarming,
  isRetired,
  isShot,
  hasVest,
  rateOf,
  shotAt,
  weaponDaysLeft,
  mock,
  pendingOf,
  statsOf,
  useMock,
  type MockGangster,
} from "../mock";

/** Unopened boxes drawn individually; the rest are summarised. */
const BOXES_SHOWN = 24;
/** Boxes opened per reveal, so the reveal stays readable. */
const OPEN_BATCH = 10;

const fmt1 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const fmtUsdc = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Ideas for what comes after the core loop. Pure placeholders. */
const SOON = [
  { title: "Territory", text: "Send gangsters to hold city districts. Each block boosts farming for its owner.", art: "C3 · city map", color: "#22e4ff" },
  { title: "Heists", text: "Stake a crew for a few days for a shot at a bigger payout. Risky crews can get busted.", art: "C2 · gang HQ", color: "#ff2e88" },
  { title: "Leaderboard", text: "Top gangs by total DC farmed each season. Prizes for the top 10.", art: "ranking", color: "#ffb020" },
  { title: "Black Market", text: "Trade gangsters with other bosses. Retired gangsters keep their collectible value.", art: "marketplace", color: "#b45cff" },
];

export default function Hq({ onBack, onFound }: { onBack: () => void; onFound: () => void }) {
  const s = useMock();
  const now = useNow();
  const [opening, setOpening] = useState<number[] | null>(null);
  const [filter, setFilter] = useState<number | "all">("all");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const totals = useMemo(() => {
    let rate = 0;
    for (const g of s.gangsters) {
      if (isFarming(g, now)) rate += rateOf(g, now);
    }
    const fusable = RARITIES.filter((r) => fusionCandidates(s.gangsters, r.id, now).length >= 2).length;
    return { rate, fusable, claimAll: claimAllQuote(s.gangsters, now) };
  }, [s.gangsters, now]);
  const q = totals.claimAll;
  const fusable = totals.fusable;

  if (!s.gang) {
    return (
      <div className="page select">
        <Scene dim />
        <Nav links={false} game onBack={onBack} />
        <div className="select__inner">
          <header className="section__head">
            <p className="eyebrow">No gang yet</p>
            <h2>Found your gang first</h2>
            <p className="section__lede">Pick a boss and register a gang name to unlock your HQ.</p>
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

  const boss = PROTAGONISTS.find((p) => p.id === s.gang!.protagonist) ?? PROTAGONISTS[0];
  const ready = s.boxes.filter((b) => isBoxReady(b, now));
  const shown = s.gangsters.filter((g) => filter === "all" || g.rarity === filter);

  const run = (fn: () => void, msg: string) => {
    try {
      fn();
      setToast(msg);
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  return (
    <div className="page hq" style={{ "--accent": boss.accent } as React.CSSProperties}>
      <Scene dim />
      <Nav links={false} game onBack={onBack} />

      <div className="hq__inner">
        <div className="mockbar">
          <span className="mockbar__tag">Mock mode</span>
          <span>Fake data, stored only in this browser. 1 farming day = {MOCK_DAY_MS / 1000}s.</span>
          <button type="button" onClick={() => run(mock.faucet, "+1,000 test USDC")}>+1,000 USDC</button>
          <button type="button" onClick={() => run(mock.resourceFaucet, "+10,000 test RESOURCE")}>+10,000 RESOURCE</button>
          <button
            type="button"
            onClick={() => {
              mock.reset();
              onFound();
            }}
          >
            Reset
          </button>
        </div>

        {/* ------------------------------------------------------------ boss header */}
        <header className="hq__head">
          <div className="hq__boss">
            <Portrait protagonist={boss} />
          </div>
          <div className="hq__title">
            <p className="eyebrow">Gang HQ</p>
            <h1>{s.gang.name}</h1>
            <p className="hq__sub">
              Boss <b style={{ color: boss.accent }}>{boss.name}</b> · {boss.alias} · founded{" "}
              {new Date(s.gang.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </div>
          <dl className="tiles">
            <div className="tile tile--gold">
              <dt>Dacity Coin</dt>
              <dd>
                <Coin size={22} /> {fmt(Math.floor(s.dc))}
              </dd>
            </div>
            <div className="tile">
              <dt>Wallet USDC</dt>
              <dd>{fmt(s.usdc)}</dd>
            </div>
            <div className="tile tile--res">
              <dt>${RESOURCE.ticker}</dt>
              <dd>
                <ResIcon /> {fmt(Math.floor(s.resource))}
              </dd>
            </div>
            <div className="tile">
              <dt>Farming / day</dt>
              <dd>{fmt(totals.rate)} DC</dd>
            </div>
          </dl>
        </header>

        {/* ------------------------------------------------------------ vault + shop */}
        <div className="hq__grid">
          <Vault
            usdc={s.usdc}
            dc={s.dc}
            onDeposit={(n) => run(() => mock.deposit(n), `Deposited ${fmt(n)} USDC → ${fmt(n * DACITY_PER_USDC)} DC`)}
            onWithdraw={(n) => run(() => mock.withdraw(n), `Withdrew ${fmt(n)} DC → ${fmtUsdc(n / DACITY_PER_USDC)} USDC`)}
          />
          <Shop
            dc={s.dc}
            onBuy={(n) => {
              try {
                const q = mock.buyBoxes(n);
                setToast(`Bought ${fmt(n)} box${n > 1 ? "es" : ""} for ${fmt(q.totalDc)} DC${q.savedDc > 0 ? ` · saved ${fmt(q.savedDc)} DC` : ""}`);
              } catch (e) {
                setToast((e as Error).message);
              }
            }}
          />
        </div>

        {/* ------------------------------------------------------------ unopened boxes */}
        {s.boxes.length > 0 && (
          <section className="panel">
            <div className="panel__head">
              <h2>
                Unopened boxes <span className="count">{s.boxes.length}</span>
              </h2>
              <button
                type="button"
                className="btn btn--pink"
                disabled={ready.length === 0}
                onClick={() => setOpening(ready.slice(0, OPEN_BATCH).map((b) => b.id))}
              >
                {ready.length > OPEN_BATCH ? `Open ${OPEN_BATCH} (${fmt(ready.length)} ready)` : `Open all ready (${ready.length})`}
              </button>
            </div>
            <ul className="boxes">
              {s.boxes.slice(0, BOXES_SHOWN).map((b) => {
                const ok = isBoxReady(b, now);
                return (
                  <li key={b.id} className="boxes__item">
                    <CashBox state={ok ? "idle" : "still"} />
                    <span className="boxes__id">Box #{b.id}</span>
                    <button type="button" className="btn" disabled={!ok} onClick={() => setOpening([b.id])}>
                      {ok ? "Open" : "Sealing…"}
                    </button>
                  </li>
                );
              })}
              {s.boxes.length > BOXES_SHOWN && (
                <li className="boxes__item boxes__more">
                  <b>+{fmt(s.boxes.length - BOXES_SHOWN)}</b>
                  <span className="boxes__id">more boxes</span>
                </li>
              )}
            </ul>
          </section>
        )}

        {/* ------------------------------------------------------------ crew */}
        <section className="panel">
          <div className="panel__head">
            <div className="crewhead">
              <h2>
                Your crew <span className="count">{s.gangsters.length}</span>
              </h2>
              <a className="crewhead__fuse" href="#/fusion">
                ⚗ Fusion {fusable > 0 && <span className="count count--hot">{fusable} ready</span>}
              </a>
            </div>
              <div className="claimall">
                <button
                  type="button"
                  className="btn btn--gold"
                  disabled={q.ids.length === 0 || q.fee > s.resource}
                  onClick={() => {
                    try {
                      const r = mock.claimAll(q.ids);
                      setToast(`Claimed ${fmt1(r.net)} DC · burned ${fmtRes(r.fee)}`);
                    } catch (e) {
                      setToast((e as Error).message);
                    }
                  }}
                >
                  <Coin size={18} /> Claim all {fmt1(q.net)} DC
                </button>
                <span className="claimall__fee">
                  {q.ids.length > 0
                    ? `🔥 Fee ${fmtRes(q.fee)} (${q.ids.length} × ${CLAIM_ALL_FEE_RES}, burned) · claim one by one for free`
                    : `${CLAIM_ALL_FEE_RES} RESOURCE fee per gangster, burned · claim one by one for free`}
                </span>
              </div>
          </div>

              <MedBar
                kits={s.medkits}
                res={s.resource}
                shotIds={s.gangsters.filter((g) => isShot(g, now)).map((g) => g.id)}
                onToast={setToast}
              />

              <div className="filters" role="tablist" aria-label="Filter by rarity">
                <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
                  All
                </button>
                {RARITIES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === r.id}
                    style={{ "--rc": r.color } as React.CSSProperties}
                    onClick={() => setFilter(r.id)}
                  >
                    {r.name} · {s.gangsters.filter((g) => g.rarity === r.id).length}
                  </button>
                ))}
              </div>

              {shown.length === 0 ? (
                <p className="empty">No gangsters here yet. Open a box.</p>
              ) : (
                <ul className="roster">
                  {shown.map((g) => (
                    <GangsterCard
                      key={g.id}
                      g={g}
                      now={now}
                      kits={s.medkits}
                      onHeal={() => {
                        try {
                          const r = mock.heal([g.id]);
                          setToast(`“${archetypeOf(g.id).nick}” is back to work${r.cost ? ` · burned ${fmtRes(r.cost)} for a kit` : " · used 1 kit"}`);
                        } catch (e) {
                          setToast((e as Error).message);
                        }
                      }}
                      onClaim={() => {
                        const got = mock.claim(g.id);
                        setToast(`Claimed ${fmt1(got)} DC from “${archetypeOf(g.id).nick}”`);
                      }}
                    />
                  ))}
                </ul>
              )}
        </section>

        {/* ------------------------------------------------------------ roadmap placeholders */}
        <section className="panel">
          <div className="panel__head">
            <h2>Coming next</h2>
          </div>
          <ul className="soon">
            {SOON.map((f) => (
              <li key={f.title} className="soon__card" style={{ "--rc": f.color } as React.CSSProperties}>
                <div className="soon__art">
                  <span>{f.art}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <span className="soon__badge">Soon</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {opening && (
        <BoxReveal
          open={() => opening.map((id) => mock.openBox(id))}
          onClose={() => setOpening(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

type VaultMode = "deposit" | "withdraw";

const VAULT_MODES = {
  deposit: { chips: [10, 50, 100], start: "10" },
  withdraw: { chips: [1_000, 5_000, 10_000], start: "1000" },
} as const;

function Vault({
  usdc,
  dc,
  onDeposit,
  onWithdraw,
}: {
  usdc: number;
  dc: number;
  onDeposit: (n: number) => void;
  onWithdraw: (n: number) => void;
}) {
  const [mode, setMode] = useState<VaultMode>("deposit");
  const [amount, setAmount] = useState<string>(VAULT_MODES.deposit.start);
  const dep = mode === "deposit";
  const n = Math.floor(Number(amount) || 0);
  const balance = Math.floor(dep ? usdc : dc);
  const short = n > balance;

  const switchTo = (m: VaultMode) => {
    if (m === mode) return;
    setMode(m);
    setAmount(VAULT_MODES[m].start);
  };

  return (
    <section className={`panel panel--vault vault--${mode}`}>
      <div className="panel__art">
        <Coin size={120} spin />
      </div>
      <div className="panel__body">
        <div className="vault__top">
          <p className="eyebrow">Vault</p>
          <div className="seg" role="tablist" aria-label="Vault action" data-mode={mode}>
            <button type="button" role="tab" aria-selected={dep} onClick={() => switchTo("deposit")}>
              Deposit
            </button>
            <button type="button" role="tab" aria-selected={!dep} onClick={() => switchTo("withdraw")}>
              Withdraw
            </button>
          </div>
        </div>
        <h2>{dep ? "Deposit USDC" : "Withdraw USDC"}</h2>
        <p className="muted">
          {dep
            ? `1 USDC = ${DACITY_PER_USDC} DC, minted straight to your wallet.`
            : `${DACITY_PER_USDC} DC = 1 USDC. DC is burned, USDC goes back to your wallet.`}
        </p>
        <div className="amount">
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            aria-label={dep ? "USDC amount" : "DC amount"}
          />
          <span>{dep ? "USDC" : "DC"}</span>
        </div>
        <div className="chips">
          {VAULT_MODES[mode].chips.map((v) => (
            <button key={v} type="button" onClick={() => setAmount(String(v))}>
              {fmt(v)}
            </button>
          ))}
          <button type="button" onClick={() => setAmount(String(balance))}>
            Max
          </button>
          <span className="chips__bal">
            Balance {fmt(balance)} {dep ? "USDC" : "DC"}
          </span>
        </div>
        <p className="quote">
          You get <b>{dep ? `${fmt(n * DACITY_PER_USDC)} DC` : `${fmtUsdc(n / DACITY_PER_USDC)} USDC`}</b>
        </p>
        <button
          type="button"
          className={`btn btn--block ${dep ? "btn--pink" : "btn--cyan"}`}
          disabled={n < 1 || short}
          onClick={() => (dep ? onDeposit(n) : onWithdraw(n))}
        >
          {short ? `Not enough ${dep ? "USDC" : "DC"}` : dep ? "Approve & deposit" : "Withdraw"}
        </button>
      </div>
    </section>
  );
}

const QTY_CHIPS = [1, 10, 50, 100, 1_000];
const usd = (dc: number) => `$${(dc / DACITY_PER_USDC).toFixed(2)}`;
const tierPct = (n: number) => BULK_TIERS.find((t) => n >= t.min)?.pct ?? 0;

function Shop({ dc, onBuy }: { dc: number; onBuy: (n: number) => void }) {
  const sold = usePlatform((p) => p.boxesSold);
  const [count, setCount] = useState(1);
  const q = quoteBoxes(count, sold);
  const launchLeft = Math.max(0, LAUNCH_SALE.boxes - sold);
  const short = q.totalDc > dc;
  const pick = (n: number) => setCount(Math.min(MAX_BOXES_PER_TX, Math.max(1, Math.floor(n) || 1)));

  return (
    <section className="panel panel--shop">
      <div className="panel__art">
        <CashBox />
        {launchLeft > 0 && <span className="shop__sticker">-50%</span>}
      </div>
      <div className="panel__body">
        <p className="eyebrow">Gangster Box</p>
        <h2>Recruit a gangster</h2>

        {launchLeft > 0 ? (
          <div className="launch">
            <div className="launch__top">
              <span className="launch__tag">Launch sale</span>
              <span>
                <b>{usd(LAUNCH_SALE.priceDc)}</b> <s>{usd(BOX_PRICE_DC)}</s> for the first {fmt(LAUNCH_SALE.boxes)}
              </span>
            </div>
            <div className="launch__bar" aria-label={`${launchLeft} of ${LAUNCH_SALE.boxes} launch boxes left`}>
              <span style={{ width: `${(sold / LAUNCH_SALE.boxes) * 100}%` }} />
            </div>
            <small>
              <b>{fmt(launchLeft)}</b> of {fmt(LAUNCH_SALE.boxes)} left at launch price
            </small>
          </div>
        ) : (
          <p className="muted">
            {usd(BOX_PRICE_DC)} ({fmt(BOX_PRICE_DC)} DC) each. Rarity is rolled when you open it.
          </p>
        )}

        <div className="qty">
          <div className="stepper">
            <button type="button" onClick={() => pick(count - 1)} aria-label="Fewer">
              −
            </button>
            <input
              className="qty__input"
              inputMode="numeric"
              value={count}
              onChange={(e) => pick(Number(e.target.value.replace(/[^0-9]/g, "")))}
              aria-label="Number of boxes"
            />
            <button type="button" onClick={() => pick(count + 1)} aria-label="More">
              +
            </button>
          </div>
          <div className="chips qty__chips">
            {QTY_CHIPS.map((n) => (
              <button key={n} type="button" aria-pressed={count === n} onClick={() => pick(n)}>
                {fmt(n)}
                {tierPct(n) > 0 && <em>-{tierPct(n)}%</em>}
              </button>
            ))}
          </div>
        </div>

        <dl className="bill">
          {q.launchQty > 0 && (
            <div>
              <dt>
                {fmt(q.launchQty)} × {usd(LAUNCH_SALE.priceDc)} <span className="bill__tag">launch -50%</span>
              </dt>
              <dd>{fmt(q.launchQty * LAUNCH_SALE.priceDc)} DC</dd>
            </div>
          )}
          {q.regularQty > 0 && (
            <div>
              <dt>
                {fmt(q.regularQty)} × {usd(BOX_PRICE_DC)}
                {q.pct > 0 && <span className="bill__tag bill__tag--bulk">bulk -{q.pct}%</span>}
              </dt>
              <dd>{fmt(Math.round(q.regularQty * BOX_PRICE_DC * (1 - q.pct / 100)))} DC</dd>
            </div>
          )}
          <div className="bill__total">
            <dt>Total</dt>
            <dd>
              {q.savedDc > 0 && <s>{fmt(q.fullDc)}</s>} {fmt(q.totalDc)} DC <small>≈ {usd(q.totalDc)}</small>
            </dd>
          </div>
        </dl>

        {q.savedDc > 0 && (
          <p className="bill__saved">
            You save <b>{fmt(q.savedDc)} DC</b> ({usd(q.savedDc)})
          </p>
        )}
        {q.next && (
          <button type="button" className="bill__upsell" onClick={() => pick(q.next!.min)}>
            Add {fmt(q.next.more)} more → <b>-{q.next.pct}%</b> on regular-price boxes
          </button>
        )}

        <ul className="odds">
          {RARITIES.map((r) => (
            <li key={r.id} style={{ "--rc": r.color } as React.CSSProperties}>
              <i />
              {r.name} {r.chance}%
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--pink btn--block" disabled={short} onClick={() => onBuy(count)}>
          {short ? `Need ${fmt(q.totalDc)} DC` : `Buy ${fmt(count)} for ${fmt(q.totalDc)} DC`}
        </button>
      </div>
    </section>
  );
}

function MedBar({ kits, res, shotIds, onToast }: { kits: number; res: number; shotIds: number[]; onToast: (m: string) => void }) {
  const missing = Math.max(0, shotIds.length - kits);
  const healCost = missing * MEDKIT_PRICE_RES;
  const act = (fn: () => string) => {
    try {
      onToast(fn());
    } catch (e) {
      onToast((e as Error).message);
    }
  };
  return (
    <div className={`medbar${shotIds.length ? " medbar--alert" : ""}`}>
      <span className="medbar__kit" aria-hidden>
        ✚
      </span>
      <div className="medbar__info">
        <strong>
          Med kits: {fmt(kits)}
          {shotIds.length > 0 && <span className="medbar__shot"> · {shotIds.length} shot</span>}
        </strong>
        <small>
          {fmtRes(MEDKIT_PRICE_RES)} each (burned) · heals one shot gangster · <a href="#/armory">{STORE_NAME} →</a> Shot risk per day: {RARITIES.map((r, i) => `${r.name} ${SHOT_CHANCE_PER_DAY[i]}%`).join(" · ")}
        </small>
      </div>
      <div className="medbar__actions">
        {[1, 5, 10].map((n) => (
          <button
            key={n}
            type="button"
            className="btn"
            disabled={n * MEDKIT_PRICE_RES > res}
            onClick={() => act(() => (mock.buyMedkits(n), `Bought ${n} med kit${n > 1 ? "s" : ""}`))}
          >
            +{n}
          </button>
        ))}
        {shotIds.length > 0 && (
          <button
            type="button"
            className="btn btn--heal"
            disabled={healCost > res}
            onClick={() =>
              act(() => {
                const r = mock.heal(shotIds);
                return `Healed ${r.healed} gangster${r.healed > 1 ? "s" : ""}${r.cost ? ` · bought ${r.bought} kit${r.bought > 1 ? "s" : ""}` : ""}`;
              })
            }
          >
            Heal all ({shotIds.length}){healCost > 0 ? ` · ${fmt(healCost)} RES` : ""}
          </button>
        )}
      </div>
    </div>
  );
}

const ago = (t: number, now: number) => {
  const m = Math.round((now - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
};

function GangsterCard({
  g,
  now,
  kits,
  onClaim,
  onHeal,
}: {
  g: MockGangster;
  now: number;
  kits: number;
  onClaim: () => void;
  onHeal: () => void;
}) {
  const r = RARITIES[g.rarity];
  const st = statsOf(g);
  const a = archetypeOf(g.id);
  const farmed = farmedOf(g, now);
  const pct = (farmed / st.cap) * 100;
  const retired = isRetired(g, now);
  const shot = isShot(g, now);
  const pending = pendingOf(g, now);
  return (
    <li
      className={`gcard${retired ? " gcard--retired" : ""}${shot ? " gcard--shot" : ""}${g.fused ? " gcard--fused" : ""}`}
      style={{ "--rc": r.color } as React.CSSProperties}
    >
      <div className="gcard__art">
        <GangsterToy gangsterId={g.id} rarity={g.rarity} />
        {g.fused && <span className="gcard__fused">Fused</span>}
        {!retired && (weaponDaysLeft(g, now) > 0 || hasVest(g, now)) && (
          <span className="gcard__gear">
            {weaponDaysLeft(g, now) > 0 && (
              <b title={`${WEAPONS[g.weapon!.id].name}: +${WEAPONS[g.weapon!.id].boostPct}% farm, ${weaponDaysLeft(g, now).toFixed(1)} days left`}>
                ⚔ +{WEAPONS[g.weapon!.id].boostPct}%
              </b>
            )}
            {hasVest(g, now) && <b title="Kevlar vest: stops the next bullet">🛡</b>}
          </span>
        )}
        {retired && <span className="gcard__stamp">Retired</span>}
        {shot && (
          <span className="gcard__wound" aria-label="Shot">
            <i />
            <b>Shot</b>
          </span>
        )}
      </div>
      <div className="gcard__body">
        <span className="gcard__rarity">{r.name}</span>
        <h3>
          “{a.nick}” <small>#{g.id}</small>
        </h3>
        <p className="gcard__title">{a.title}</p>
        <div className="bar" aria-label={`${Math.round(pct)}% of career cap`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <dl className="gcard__stats">
          <div>
            <dt>Farmed</dt>
            <dd>
              {fmt(Math.floor(farmed))} / {fmt(st.cap)}
            </dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd className="gold">{fmt1(pending)} DC</dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd className={!retired && !shot && weaponDaysLeft(g, now) > 0 ? "boosted" : undefined}>
              {retired || shot ? "—" : `${fmt1(rateOf(g, now))}/day`}
            </dd>
          </div>
          {!retired && (
            <div>
              <dt>Shot risk</dt>
              <dd className={shot ? "red" : undefined}>{shot ? `hit ${ago(shotAt(g, now)!, now)}` : `${SHOT_CHANCE_PER_DAY[g.rarity]}%/day`}</dd>
            </div>
          )}
        </dl>
        {shot && (
          <button type="button" className="btn btn--heal gcard__claim" onClick={onHeal}>
            ✚ {kits > 0 ? "Heal · use 1 kit" : `Heal · ${fmt(MEDKIT_PRICE_RES)} RES`}
          </button>
        )}
        <button type="button" className="btn btn--gold gcard__claim" disabled={pending < 0.1} onClick={onClaim}>
          Claim {fmt1(pending)} DC <small>free</small>
        </button>
      </div>
    </li>
  );
}
