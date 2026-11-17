import { useEffect, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import BoxReveal from "./BoxReveal";
import CashBox from "./art/CashBox";
import GangsterToy from "./art/GangsterToy";
import AmmoIcon from "./art/AmmoIcon";
import { ItemIcon, LoadoutRow } from "./Armory";
import { game } from "../game";
import { RARITIES, SHOT_CHANCE_PER_DAY, STORE_NAME, VEST, WEAPONS, fmt, type WeaponId, characterOf } from "../config/game";
import { isBoxReady, isRetired, isShot, statsOf, useMock, type MockGangster } from "../mock";

type Tab = "gangsters" | "boxes" | "items";

/** Unopened boxes drawn individually; the rest are summarised. */
const BOXES_SHOWN = 36;
/** Boxes opened per reveal, so the reveal stays readable. */
const OPEN_BATCH = 10;

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * Everything the player owns that isn't in use yet: idle gangsters, sealed boxes and items in stock.
 * Nothing starts on its own: gangsters farm only after "Put to work", items work only once equipped/used.
 */
export default function Inventory({ onBack, onFound }: { onBack: () => void; onFound: () => void }) {
  const s = useMock();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("gangsters");
  const [opening, setOpening] = useState<number[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
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

  if (!s.gang) {
    return (
      <div className="page select">
        <Scene dim />
        <Nav links={false} game onBack={onBack} />
        <div className="select__inner">
          <header className="section__head">
            <p className="eyebrow">No gang yet</p>
            <h2>Found your gang first</h2>
            <p className="section__lede">Your boxes, gangsters and items show up here.</p>
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

  const idle = s.gangsters.filter((g) => g.idle);
  const ready = s.boxes.filter((b) => isBoxReady(b, now));
  const itemCount = s.medkits + s.inventory.pistol + s.inventory.smg + s.inventory.rifle + s.inventory.vest;
  const working = s.gangsters.filter((g) => !g.idle && !isRetired(g, now)).sort((a, b) => statsOf(b).perDay - statsOf(a).perDay);
  const shotIds = s.gangsters.filter((g) => isShot(g, now)).map((g) => g.id);

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "gangsters", label: "Gangsters", count: idle.length },
    { id: "boxes", label: "Boxes", count: s.boxes.length },
    { id: "items", label: "Items", count: itemCount },
  ];

  const ITEMS: { id: WeaponId | "vest" | "medkit"; name: string; count: number; effect: string; icon: string; tone: string }[] = [
    { id: "medkit", name: "Med kit", count: s.medkits, effect: "Heals one shot gangster", icon: "✚", tone: "#ff5a6e" },
    ...(Object.values(WEAPONS).map((w) => ({
      id: w.id,
      name: w.name,
      count: s.inventory[w.id],
      effect: `+${w.boostPct}% farm for ${w.days} days`,
      icon: "⚔",
      tone: w.id === "pistol" ? "#22e4ff" : w.id === "smg" ? "#b45cff" : "#ffb020",
    })) as { id: WeaponId; name: string; count: number; effect: string; icon: string; tone: string }[]),
    { id: "vest", name: VEST.name, count: s.inventory.vest, effect: "Stops the next bullet", icon: "🛡", tone: "#3ddc84" },
  ];

  return (
    <div className="page hq inventory">
      <Scene dim />
      <Nav links={false} game onBack={onBack} />

      <div className="hq__inner">
        <header className="panel inv__head">
          <div>
            <p className="eyebrow">Stash</p>
            <h1>Inventory</h1>
            <p className="muted">Everything you own that isn't in use yet. Nothing starts on its own: you decide when.</p>
          </div>
          <div className="hqtabs inv__tabs" role="tablist" aria-label="Inventory">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label} <span className={`count${t.count > 0 && tab !== t.id ? " count--hot" : ""}`}>{fmt(t.count)}</span>
              </button>
            ))}
          </div>
        </header>

        {/* ------------------------------------------------------------ gangsters */}
        {tab === "gangsters" && (
          <section className="panel">
            <div className="panel__head">
              <h2>
                Idle gangsters <span className="count">{idle.length}</span>
              </h2>
              <button
                type="button"
                className="btn btn--pink"
                disabled={idle.length === 0}
                onClick={() => run(() => game.deploy(idle.map((g) => g.id)), `${idle.length} gangster${idle.length > 1 ? "s" : ""} put to work`)}
              >
                Put all to work ({idle.length})
              </button>
            </div>
            <p className="muted inv__hint">
              Idle gangsters don't farm, can't be shot and their career hasn't started. It starts the moment you put them to work, and it
              can't be paused after that. Idle gangsters can be fused in the <a href="#/fusion">Fusion lab</a>.
            </p>
            {idle.length === 0 ? (
              <p className="empty">
                No idle gangsters. {s.boxes.length > 0 ? "Open a box in the Boxes tab." : "Buy Gangster Boxes in the HQ."}
              </p>
            ) : (
              <ul className="roster">
                {idle.map((g) => (
                  <IdleCard key={g.id} g={g} onDeploy={() => run(() => game.deploy([g.id]), `“${characterOf(g.rarity).nick}” is on the job`)} />
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ------------------------------------------------------------ boxes */}
        {tab === "boxes" && (
          <section className="panel">
            <div className="panel__head">
              <h2>
                Unopened boxes <span className="count">{fmt(s.boxes.length)}</span>
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
            {s.boxes.length === 0 ? (
              <p className="empty">
                No boxes. Buy Gangster Boxes in the <a href="#/hq">HQ</a>.
              </p>
            ) : (
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
            )}
          </section>
        )}

        {/* ------------------------------------------------------------ items */}
        {tab === "items" && (
          <>
            <section className="panel">
              <div className="panel__head">
                <h2>
                  Items in stock <span className="count">{fmt(itemCount)}</span>
                </h2>
                <a className="btn" href="#/armory">
                  <AmmoIcon size={16} /> Buy more in {STORE_NAME} →
                </a>
              </div>
              <ul className="inv__items">
                {ITEMS.map((it) => (
                  <li key={it.id} className={`inv__item${it.count === 0 ? " inv__item--empty" : ""}`} style={{ "--tone": it.tone } as React.CSSProperties}>
                    <span className="inv__item-ico" aria-hidden>
                      <ItemIcon id={it.id} size={128} />
                    </span>
                    <div>
                      <b>{it.name}</b>
                      <small>{it.effect}</small>
                    </div>
                    <span className="inv__item-count">×{fmt(it.count)}</span>
                  </li>
                ))}
              </ul>
              {shotIds.length > 0 && (
                <button
                  type="button"
                  className="btn btn--heal inv__heal"
                  onClick={() => run(() => game.heal(shotIds), `Healed ${shotIds.length} gangster${shotIds.length > 1 ? "s" : ""}`)}
                >
                  ✚ Heal all shot gangsters ({shotIds.length})
                </button>
              )}
            </section>

            <section className="panel">
              <div className="panel__head">
                <h2>
                  Use on your crew <span className="count">{working.length}</span>
                </h2>
                <span className="muted inv__hint">Items only work on gangsters that are at work. One weapon and one vest each.</span>
              </div>
              {working.length === 0 ? (
                <p className="empty">Nobody at work yet. Put a gangster to work in the Gangsters tab first.</p>
              ) : (
                <ul className="loadout">
                  {working.map((g) => (
                    <LoadoutRow key={g.id} g={g} now={now} inv={s.inventory} kits={s.medkits} run={run} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {opening && (
        <BoxReveal
          open={() => game.openBoxes(opening)}
          onClose={() => {
            setOpening(null);
            setTab("gangsters");
          }}
          onDeploy={(ids) => run(() => game.deploy(ids), `${ids.length} gangster${ids.length > 1 ? "s" : ""} put to work`)}
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

function IdleCard({ g, onDeploy }: { g: MockGangster; onDeploy: () => void }) {
  const r = RARITIES[g.rarity];
  const st = statsOf(g);
  const a = characterOf(g.rarity);
  return (
    <li className={`gcard gcard--idle${g.fused ? " gcard--fused" : ""}`} style={{ "--rc": r.color } as React.CSSProperties}>
      <div className="gcard__art">
        <GangsterToy gangsterId={g.id} rarity={g.rarity} />
        {g.fused && <span className="gcard__fused">Fused</span>}
        <span className="gcard__idle">Idle</span>
      </div>
      <div className="gcard__body">
        <span className="gcard__rarity">{r.name}</span>
        <h3>
          “{a.nick}” <small>#{g.id}</small>
        </h3>
        <p className="gcard__title">{a.title} · {a.gang}</p>
        <dl className="gcard__stats">
          <div>
            <dt>Farm</dt>
            <dd>{st.perDay}/day</dd>
          </div>
          <div>
            <dt>Career cap</dt>
            <dd>{fmt(st.cap)} DC</dd>
          </div>
          <div>
            <dt>Shot risk</dt>
            <dd>{SHOT_CHANCE_PER_DAY[g.rarity]}%/day</dd>
          </div>
        </dl>
        <button type="button" className="btn btn--pink gcard__claim" onClick={onDeploy}>
          ▶ Put to work
        </button>
      </div>
    </li>
  );
}
