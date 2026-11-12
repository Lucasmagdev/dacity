import { useEffect, useMemo, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import Portrait from "./Portrait";
import BoxReveal from "./BoxReveal";
import Fusion from "./Fusion";
import CashBox from "./art/CashBox";
import Coin from "./art/Coin";
import GangsterToy from "./art/GangsterToy";
import { BOX_PRICE_DC, CLAIM_ALL_FEE_DC, DACITY_PER_USDC, PROTAGONISTS, RARITIES, fmt } from "../config/game";
import {
  MAX_BOXES_PER_TX,
  MOCK_DAY_MS,
  archetypeOf,
  claimAllQuote,
  fusionCandidates,
  farmedOf,
  isBoxReady,
  isRetired,
  mock,
  pendingOf,
  statsOf,
  useMock,
  type MockGangster,
} from "../mock";

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
  const [tab, setTab] = useState<"crew" | "fusion">("crew");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const totals = useMemo(() => {
    let rate = 0;
    for (const g of s.gangsters) {
      if (!isRetired(g, now)) rate += statsOf(g).perDay;
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
          <Vault
            usdc={s.usdc}
            dc={s.dc}
            onDeposit={(n) => run(() => mock.deposit(n), `Deposited ${fmt(n)} USDC → ${fmt(n * DACITY_PER_USDC)} DC`)}
            onWithdraw={(n) => run(() => mock.withdraw(n), `Withdrew ${fmt(n)} DC → ${fmtUsdc(n / DACITY_PER_USDC)} USDC`)}
          />
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

        {/* ------------------------------------------------------------ crew / fusion tabs */}
        <section className="panel">
          <div className="panel__head">
            <div className="hqtabs" role="tablist" aria-label="Gang">
              <button type="button" role="tab" aria-selected={tab === "crew"} onClick={() => setTab("crew")}>
                Your crew <span className="count">{s.gangsters.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={tab === "fusion"} onClick={() => setTab("fusion")}>
                Fusion {fusable > 0 && <span className="count count--hot">{fusable}</span>}
              </button>
            </div>
            {tab === "crew" && (
              <div className="claimall">
                <button
                  type="button"
                  className="btn btn--gold"
                  disabled={q.net < 0.1}
                  onClick={() => {
                    try {
                      const r = mock.claimAll();
                      setToast(`Claimed ${fmt1(r.net)} DC (fee ${fmt(r.fee)} DC)`);
                    } catch (e) {
                      setToast((e as Error).message);
                    }
                  }}
                >
                  <Coin size={18} /> Claim all {fmt1(q.net)} DC
                </button>
                <span className="claimall__fee">
                  {q.ids.length > 0
                    ? `Fee ${fmt(q.fee)} DC · ${q.ids.length} × ${CLAIM_ALL_FEE_DC} · claim one by one for free`
                    : `${CLAIM_ALL_FEE_DC} DC fee per gangster · claim one by one for free`}
                </span>
              </div>
            )}
          </div>

          {tab === "fusion" ? (
            <Fusion gangsters={s.gangsters} dc={s.dc} now={now} onToast={setToast} />
          ) : (
            <>
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
                      onClaim={() => {
                        const got = mock.claim(g.id);
                        setToast(`Claimed ${fmt1(got)} DC from “${archetypeOf(g.id).nick}”`);
                      }}
                    />
                  ))}
                </ul>
              )}
            </>
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

function GangsterCard({ g, now, onClaim }: { g: MockGangster; now: number; onClaim: () => void }) {
  const r = RARITIES[g.rarity];
  const st = statsOf(g);
  const a = archetypeOf(g.id);
  const farmed = farmedOf(g, now);
  const pct = (farmed / st.cap) * 100;
  const retired = isRetired(g, now);
  const pending = pendingOf(g, now);
  return (
    <li
      className={`gcard${retired ? " gcard--retired" : ""}${g.fused ? " gcard--fused" : ""}`}
      style={{ "--rc": r.color } as React.CSSProperties}
    >
      <div className="gcard__art">
        <GangsterToy gangsterId={g.id} rarity={g.rarity} />
        {g.fused && <span className="gcard__fused">Fused</span>}
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
              {fmt(Math.floor(farmed))} / {fmt(st.cap)}
            </dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd className="gold">{fmt1(pending)} DC</dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd>{retired ? "—" : `${st.perDay}/day`}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn--gold gcard__claim" disabled={pending < 0.1} onClick={onClaim}>
          Claim {fmt1(pending)} DC <small>free</small>
        </button>
      </div>
    </li>
  );
}
