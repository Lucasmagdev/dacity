import { useEffect, useState } from "react";
import { NavWallet } from "./Wallet";
import { SIM_MARKET_CAPS, ammoFor, fmtCap, fmtTokenPrice, fmtUsd, setSimMarketCap, useAmmoPrice } from "../price";
import { MEDKIT_PRICE_USD, TOKEN, WEAPONS } from "../config/game";
import Scene from "./Scene";
import Nav from "./Nav";
import Coin from "./art/Coin";
import CashBox from "./art/CashBox";
import { AnnouncementCard } from "./GlobalNotices";
import { ADMIN_WALLETS, isAddress, shortAddr, useAdmin } from "../config/admin";
import { fmt } from "../config/game";
import { MOCK } from "../mock";
import { game } from "../game";
import { isLive, platform, usePlatform, type AnnouncementKind } from "../mock/platform";

const MAX_BOXES_GRANT = 50;

const DURATIONS = [
  { label: "1 hour", ms: 3_600_000 },
  { label: "24 hours", ms: 86_400_000 },
  { label: "7 days", ms: 7 * 86_400_000 },
  { label: "Until removed", ms: null },
] as const;

const KINDS: { id: AnnouncementKind; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "event", label: "Event" },
  { id: "warning", label: "Warning" },
];

const timeAgo = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** Two-step button: first click arms it, second click within 4s runs the action. */
function ConfirmButton({
  className = "btn btn--pink btn--block",
  disabled,
  label,
  confirmLabel,
  onConfirm,
}: {
  className?: string;
  disabled?: boolean;
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className}${armed ? " btn--armed" : ""}`}
      disabled={disabled}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export default function Admin({ onBack }: { onBack: () => void }) {
  const { address, isConnected, isAdmin } = useAdmin();

  if (!isAdmin) {
    return (
      <div className="page select">
        <Scene dim />
        <Nav links={false} onBack={onBack} />
        <div className="select__inner">
          <div className="gate panel">
            <p className="eyebrow">Restricted</p>
            <h2>Admin access</h2>
            {ADMIN_WALLETS.length === 0 ? (
              <p className="muted">
                No admin wallets configured. Add your address to <code>VITE_ADMIN_WALLETS</code> in <code>web/.env</code> and
                restart the dev server.
              </p>
            ) : !isConnected ? (
              <p className="muted">Connect an admin wallet to continue.</p>
            ) : (
              <p className="muted">
                <b>{shortAddr(address!)}</b> is not on the admin list.
              </p>
            )}
            <NavWallet />
          </div>
        </div>
      </div>
    );
  }

  return <AdminConsole me={address!} onBack={onBack} />;
}

function AdminConsole({ me, onBack }: { me: string; onBack: () => void }) {
  const p = usePlatform();
  const [toast, setToast] = useState<string | null>(null);
  const live = isLive(p.announcement);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // actions are async (database calls in live mode): show the error the database sends back
  const run = async (fn: () => unknown, msg: string) => {
    try {
      await fn();
      setToast(msg);
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  return (
    <div className="page hq admin">
      <Scene dim />
      <Nav links={false} onBack={onBack} />

      <div className="hq__inner">
        {MOCK && (
          <div className="mockbar">
            <span className="mockbar__tag">Mock mode</span>
            <span>
              Single-player demo: coins and boxes land in this browser's gang whatever the address. Open the game in another tab
              to watch maintenance and announcements apply live.
            </span>
          </div>
        )}

        <header className="admin__head panel">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Control room</h1>
            <p className="muted">
              Signed in as <b>{shortAddr(me)}</b>
            </p>
          </div>
          <dl className="tiles admin__tiles">
            <div className={`tile${p.maintenance.on ? " tile--alert" : ""}`}>
              <dt>Game</dt>
              <dd>{p.maintenance.on ? "Maintenance" : "Online"}</dd>
            </div>
            <div className="tile">
              <dt>Announcement</dt>
              <dd>{live ? "Live" : "None"}</dd>
            </div>
            <div className="tile">
              <dt>Admins</dt>
              <dd>{ADMIN_WALLETS.length}</dd>
            </div>
          </dl>
        </header>

        <div className="admin__grid">
          <SendCoins me={me} run={run} />
          <SendBoxes me={me} run={run} />
          <MaintenanceCard me={me} run={run} />
          <TokenPriceCard me={me} run={run} />
          <AnnouncementForm me={me} run={run} />
        </div>

        <section className="panel">
          <div className="panel__head">
            <h2>
              Activity <span className="count">{p.log.length}</span>
            </h2>
          </div>
          {p.log.length === 0 ? (
            <p className="empty">No admin actions yet.</p>
          ) : (
            <ul className="adminlog">
              {p.log.map((l) => (
                <li key={l.id}>
                  <span className="adminlog__action">{l.action}</span>
                  <span className="adminlog__detail">{l.detail}</span>
                  <span className="adminlog__meta">
                    {shortAddr(l.by)} · {timeAgo(l.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

type CardProps = { me: string; run: (fn: () => void, msg: string) => void };

function Recipient({ value, onChange, me }: { value: string; onChange: (v: string) => void; me: string }) {
  const bad = value.length > 0 && !isAddress(value);
  return (
    <>
      <label className="field">
        <span>Recipient wallet</span>
        <div className={`amount${bad ? " amount--bad" : ""}`}>
          <input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="Solana address" spellCheck={false} />
          <button type="button" className="field__fill" onClick={() => onChange(me)}>
            Me
          </button>
        </div>
      </label>
      {bad && <p className="field__err">Not a valid wallet address.</p>}
    </>
  );
}

function SendCoins({ me, run }: CardProps) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("1000");
  const n = Math.floor(Number(amount) || 0);
  const ok = isAddress(to) && n > 0;
  return (
    <section className="panel admin__card">
      <div className="admin__card-head">
        <span className="admin__icon">
          <Coin size={40} />
        </span>
        <div>
          <p className="eyebrow">Economy</p>
          <h2>Send coins</h2>
        </div>
      </div>
      <Recipient value={to} onChange={setTo} me={me} />
      <label className="field">
        <span>Amount</span>
        <div className="amount">
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
          <span>DC</span>
        </div>
      </label>
      <div className="chips">
        {[100, 1_000, 10_000].map((v) => (
          <button key={v} type="button" onClick={() => setAmount(String(v))}>
            {fmt(v)}
          </button>
        ))}
      </div>
      <ConfirmButton
        disabled={!ok}
        label={`Send ${fmt(n)} DC`}
        confirmLabel={`Confirm: ${fmt(n)} DC → ${ok ? shortAddr(to) : ""}`}
        onConfirm={() =>
          run(async () => {
            await game.grantDc(to, n);
            platform.log(me, "Sent coins", `${fmt(n)} DC → ${shortAddr(to)}`);
          }, `Sent ${fmt(n)} DC to ${shortAddr(to)}`)
        }
      />
    </section>
  );
}

function SendBoxes({ me, run }: CardProps) {
  const [to, setTo] = useState("");
  const [count, setCount] = useState(1);
  const ok = isAddress(to);
  return (
    <section className="panel admin__card">
      <div className="admin__card-head">
        <span className="admin__icon admin__icon--box">
          <CashBox state="still" />
        </span>
        <div>
          <p className="eyebrow">Loot</p>
          <h2>Send boxes</h2>
        </div>
      </div>
      <Recipient value={to} onChange={setTo} me={me} />
      <label className="field">
        <span>Boxes (arrive sealed and ready to open)</span>
        <div className="stepper">
          <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Fewer">
            −
          </button>
          <output>{count}</output>
          <button type="button" onClick={() => setCount((c) => Math.min(MAX_BOXES_GRANT, c + 1))} aria-label="More">
            +
          </button>
        </div>
      </label>
      <div className="chips">
        {[1, 5, 10, 25].map((v) => (
          <button key={v} type="button" onClick={() => setCount(v)}>
            {v}
          </button>
        ))}
      </div>
      <ConfirmButton
        disabled={!ok}
        label={`Send ${count} box${count > 1 ? "es" : ""}`}
        confirmLabel={`Confirm: ${count} → ${ok ? shortAddr(to) : ""}`}
        onConfirm={() =>
          run(async () => {
            await game.grantBoxes(to, count);
            platform.log(me, "Sent boxes", `${count} box${count > 1 ? "es" : ""} → ${shortAddr(to)}`);
          }, `Sent ${count} box${count > 1 ? "es" : ""} to ${shortAddr(to)}`)
        }
      />
    </section>
  );
}

function MaintenanceCard({ me, run }: CardProps) {
  const m = usePlatform((s) => s.maintenance);
  const [msg, setMsg] = useState(m.message || "We're upgrading the city. Back shortly.");
  return (
    <section className={`panel admin__card${m.on ? " admin__card--alert" : ""}`}>
      <div className="admin__card-head">
        <span className={`admin__status${m.on ? " admin__status--on" : ""}`} aria-hidden />
        <div>
          <p className="eyebrow">Game status</p>
          <h2>Maintenance</h2>
        </div>
      </div>
      <p className="muted">
        {m.on
          ? `ON since ${timeAgo(m.since!)}. Players can still see the landing page but can't enter the game. Admins bypass it.`
          : "Blocks the game for every player and shows them the message below. Admins keep access."}
      </p>
      <label className="field">
        <span>Message to players</span>
        <textarea rows={3} maxLength={200} value={msg} onChange={(e) => setMsg(e.target.value)} />
      </label>
      {m.on ? (
        <div className="admin__row">
          <button type="button" className="btn" onClick={() => run(() => game.setMaintenance(true, msg, me), "Message updated")}>
            Update message
          </button>
          <ConfirmButton
            className="btn btn--cyan"
            label="Reopen the game"
            confirmLabel="Confirm reopen"
            onConfirm={() => run(() => game.setMaintenance(false, msg, me), "Game is back online")}
          />
        </div>
      ) : (
        <ConfirmButton
          className="btn btn--danger btn--block"
          label="Turn on maintenance"
          confirmLabel="Confirm: lock the game for everyone"
          onConfirm={() => run(() => game.setMaintenance(true, msg, me), "Maintenance is ON")}
        />
      )}
    </section>
  );
}

/** Test how prices behave at different market caps (only while there's no live token price). */
function TokenPriceCard({ me, run }: CardProps) {
  const price = useAmmoPrice();
  const live = price.source === "live";
  return (
    <section className="panel admin__card admin__card--wide">
      <div className="admin__card-head">
        <span className="admin__icon admin__icon--mega" aria-hidden>
          $
        </span>
        <div>
          <p className="eyebrow">${TOKEN.ticker} price</p>
          <h2>{live ? "Live token price" : "Simulated token price"}</h2>
        </div>
      </div>
      <p className="muted">
        Items and fees are priced in dollars and paid in {TOKEN.ticker} at this price.{" "}
        {live
          ? "The price is live (10-minute average), so it can't be changed here."
          : "The token isn't live yet: pick a market cap to see how many tokens each item costs."}
      </p>
      <dl className="tiles admin__tiles">
        <div className={`tile${price.stale ? " tile--alert" : ""}`}>
          <dt>1 {TOKEN.ticker}</dt>
          <dd>{fmtTokenPrice(price.usd)}</dd>
        </div>
        <div className="tile">
          <dt>Market cap</dt>
          <dd>{fmtCap(price.marketCap)}</dd>
        </div>
        <div className="tile">
          <dt>Med kit {fmtUsd(MEDKIT_PRICE_USD)}</dt>
          <dd>{ammoFor(MEDKIT_PRICE_USD).toLocaleString("en-US")}</dd>
        </div>
        <div className="tile">
          <dt>Rifle {fmtUsd(WEAPONS.rifle.priceUsd)}</dt>
          <dd>{ammoFor(WEAPONS.rifle.priceUsd).toLocaleString("en-US")}</dd>
        </div>
      </dl>
      {!live && (
        <div className="chips chips--select">
          {SIM_MARKET_CAPS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={Math.round(price.marketCap) === c}
              onClick={() =>
                run(() => {
                  setSimMarketCap(c);
                  platform.log(me, "Simulated token price", `Market cap ${fmtCap(c)}`);
                }, `Simulating a ${fmtCap(c)} market cap`)
              }
            >
              {fmtCap(c)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AnnouncementForm({ me, run }: CardProps) {
  const current = usePlatform((s) => s.announcement);
  const live = isLive(current);
  const [kind, setKind] = useState<AnnouncementKind>("info");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [dur, setDur] = useState(1);
  const ok = title.trim().length > 0 && message.trim().length > 0;
  const preview = { id: "preview", kind, title: title || "Title", message: message || "Your message to every player.", createdAt: 0, expiresAt: null };

  return (
    <section className="panel admin__card admin__card--wide">
      <div className="admin__card-head">
        <span className="admin__icon admin__icon--mega" aria-hidden>
          📣
        </span>
        <div>
          <p className="eyebrow">Broadcast</p>
          <h2>Announcement</h2>
        </div>
      </div>

      <div className="admin__split">
        <div>
          <div className="seg seg--3" role="tablist" aria-label="Type" data-kind={kind}>
            {KINDS.map((k) => (
              <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Title</span>
            <input className="input" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Season 1 is live" />
          </label>
          <label className="field">
            <span>Message</span>
            <textarea rows={3} maxLength={240} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Double farming this weekend…" />
          </label>
          <label className="field">
            <span>Show for</span>
            <div className="chips chips--select">
              {DURATIONS.map((d, i) => (
                <button key={d.label} type="button" aria-pressed={dur === i} onClick={() => setDur(i)}>
                  {d.label}
                </button>
              ))}
            </div>
          </label>
          <ConfirmButton
            disabled={!ok}
            label={live ? "Replace current announcement" : "Publish to all players"}
            confirmLabel="Confirm publish"
            onConfirm={() =>
              run(async () => {
                const ms = DURATIONS[dur].ms;
                await game.announce({ kind, title, message, expiresAt: ms === null ? null : Date.now() + ms }, me);
                setTitle("");
                setMessage("");
              }, "Announcement published")
            }
          />
        </div>

        <div className="admin__preview">
          <p className="admin__label">Preview</p>
          <AnnouncementCard a={preview} />
          <p className="admin__label">Live now</p>
          {live ? (
            <>
              <AnnouncementCard a={current} />
              <p className="muted admin__small">
                Published {timeAgo(current.createdAt)} ·{" "}
                {current.expiresAt ? `ends ${new Date(current.expiresAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}` : "until removed"}
              </p>
              <button type="button" className="btn" onClick={() => run(() => game.clearAnnouncement(me), "Announcement removed")}>
                Remove announcement
              </button>
            </>
          ) : (
            <p className="empty admin__small">Nothing live.</p>
          )}
        </div>
      </div>
    </section>
  );
}
