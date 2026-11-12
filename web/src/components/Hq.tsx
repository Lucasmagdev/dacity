import { useEffect, useMemo, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import Portrait from "./Portrait";
import BoxReveal from "./BoxReveal";
import CashBox from "./art/CashBox";
import Coin from "./art/Coin";
import GangsterToy from "./art/GangsterToy";
import { BOX_PRICE_DC, DACITY_PER_USDC, PROTAGONISTS, RARITIES, fmt } from "../config/game";
import {
  MAX_BOXES_PER_TX,
  MOCK_DAY_MS,
  archetypeOf,
  farmedOf,
  isBoxReady,
  isRetired,
  mock,
  pendingOf,
  useMock,
  type MockGangster,
} from "../mock";

const fmt1 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

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
    let pending = 0;
    let rate = 0;
    for (const g of s.gangsters) {
      pending += pendingOf(g, now);
      if (!isRetired(g, now)) rate += RARITIES[g.rarity].perDay;
    }
    return { pending, rate };
  }, [s.gangsters, now]);

  if (!s.gang) {
    return (
      <div className="page select">
        <Scene dim />
        <Nav links={false} onBack={onBack} />
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
      <Nav links={false} onBack={onBack} />

      <div className="hq__inner">
        <div className="mockbar">
          <span className="mockbar__tag">Mock mode</span>
          <span>Fake data, stored only in this browser. 1 farming day = {MOCK_DAY_MS / 1000}s.</span>
          <button type="button" onClick={() => run(mock.faucet, "+1,000 test USDC")}>+1,000 USDC</button>
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
            <div className="tile">
              <dt>Gangsters</dt>
              <dd>{s.gangsters.length}</dd>
            </div>
            <div className="tile">
              <dt>Farming / day</dt>
              <dd>{fmt(totals.rate)} DC</dd>
            </div>
          </dl>
        </header>

        {/* ------------------------------------------------------------ vault + shop */}
        <div className="hq__grid">
          <Vault usdc={s.usdc} onDeposit={(n) => run(() => mock.deposit(n), `Deposited ${fmt(n)} USDC → ${fmt(n * DACITY_PER_USDC)} DC`)} />
          <Shop dc={s.dc} onBuy={(n) => run(() => mock.buyBoxes(n), `Bought ${n} box${n > 1 ? "es" : ""}`)} />
        </div>

        {/* ------------------------------------------------------------ unopened boxes */}
        {s.boxes.length > 0 && (
          <section className="panel">
            <div className="panel__head">
              <h2>
                Unopened boxes <span className="count">{s.boxes.length}</span>
              </h2>
              <button type="button" className="btn btn--pink" disabled={ready.length === 0} onClick={() => setOpening(ready.map((b) => b.id))}>
                Open all ready ({ready.length})
              </button>
            </div>
            <ul className="boxes">
              {s.boxes.map((b) => {
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
            </ul>
          </section>
        )}

        {/* ------------------------------------------------------------ roster */}
        <section className="panel">
          <div className="panel__head">
            <h2>
              Your crew <span className="count">{s.gangsters.length}</span>
            </h2>
            <button
              type="button"
              className="btn btn--gold"
              disabled={totals.pending < 0.1}
              onClick={() => {
                const got = mock.claimAll();
                setToast(`Claimed ${fmt1(got)} DC`);
              }}
            >
              <Coin size={18} /> Claim {fmt1(totals.pending)} DC
            </button>
          </div>

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
                <GangsterCard key={g.id} g={g} now={now} />
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

function Vault({ usdc, onDeposit }: { usdc: number; onDeposit: (n: number) => void }) {
  const [amount, setAmount] = useState("10");
  const n = Math.floor(Number(amount) || 0);
  return (
    <section className="panel panel--vault">
      <div className="panel__art">
        <Coin size={120} spin />
      </div>
      <div className="panel__body">
        <p className="eyebrow">Vault</p>
        <h2>Deposit USDC</h2>
        <p className="muted">1 USDC = {DACITY_PER_USDC} DC, minted straight to your wallet.</p>
        <div className="amount">
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} aria-label="USDC amount" />
          <span>USDC</span>
        </div>
        <div className="chips">
          {[10, 50, 100].map((v) => (
            <button key={v} type="button" onClick={() => setAmount(String(v))}>
              {v}
            </button>
          ))}
          <button type="button" onClick={() => setAmount(String(Math.floor(usdc)))}>
            Max
          </button>
        </div>
        <p className="quote">
          You get <b>{fmt(n * DACITY_PER_USDC)} DC</b>
        </p>
        <button type="button" className="btn btn--pink btn--block" disabled={n < 1 || n > usdc} onClick={() => onDeposit(n)}>
          {n > usdc ? "Not enough USDC" : "Approve & deposit"}
        </button>
      </div>
    </section>
  );
}

function Shop({ dc, onBuy }: { dc: number; onBuy: (n: number) => void }) {
  const [count, setCount] = useState(1);
  const cost = count * BOX_PRICE_DC;
  return (
    <section className="panel panel--shop">
      <div className="panel__art">
        <CashBox />
      </div>
      <div className="panel__body">
        <p className="eyebrow">Gangster Box</p>
        <h2>Recruit a gangster</h2>
        <p className="muted">
          {fmt(BOX_PRICE_DC)} DC each · up to {MAX_BOXES_PER_TX} per tx. Rarity is rolled when you open it.
        </p>
        <div className="stepper">
          <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Fewer">
            −
          </button>
          <output>{count}</output>
          <button type="button" onClick={() => setCount((c) => Math.min(MAX_BOXES_PER_TX, c + 1))} aria-label="More">
            +
          </button>
        </div>
        <ul className="odds">
          {RARITIES.map((r) => (
            <li key={r.id} style={{ "--rc": r.color } as React.CSSProperties}>
              <i />
              {r.name} {r.chance}%
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--pink btn--block" disabled={cost > dc} onClick={() => onBuy(count)}>
          {cost > dc ? `Need ${fmt(cost)} DC` : `Buy for ${fmt(cost)} DC`}
        </button>
      </div>
    </section>
  );
}

function GangsterCard({ g, now }: { g: MockGangster; now: number }) {
  const r = RARITIES[g.rarity];
  const a = archetypeOf(g.id);
  const farmed = farmedOf(g, now);
  const pct = (farmed / r.cap) * 100;
  const retired = isRetired(g, now);
  const pending = pendingOf(g, now);
  return (
    <li className={`gcard${retired ? " gcard--retired" : ""}`} style={{ "--rc": r.color } as React.CSSProperties}>
      <div className="gcard__art">
        <GangsterToy gangsterId={g.id} rarity={g.rarity} />
        {retired && <span className="gcard__stamp">Retired</span>}
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
              {fmt(Math.floor(farmed))} / {fmt(r.cap)}
            </dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd className="gold">{fmt1(pending)} DC</dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd>{retired ? "—" : `${r.perDay}/day`}</dd>
          </div>
        </dl>
      </div>
    </li>
  );
}
