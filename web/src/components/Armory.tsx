import { useEffect, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import GangsterToy from "./art/GangsterToy";
import { MEDKIT_PRICE_RES, RARITIES, RESOURCE, STORE_NAME, VEST, WEAPONS, fmt, type WeaponId } from "../config/game";
import ResIcon from "./art/ResIcon";
import { usePlatform } from "../mock/platform";
import { archetypeOf, hasVest, isRetired, isShot, mock, rateOf, statsOf, useMock, weaponDaysLeft, type MockGangster } from "../mock";

type ItemId = WeaponId | "vest" | "medkit";

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Simple silhouettes, drawn inline so the shop has no external art yet. */
function ItemIcon({ id }: { id: ItemId }) {
  const paths: Record<ItemId, string> = {
    medkit: "M8 10V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M4 10h16v10H4zM12 13v4M10 15h4",
    pistol: "M3 8h14l1 2h3v2h-6l-1 1v2l-2 5H8l2-6H6L3 12z",
    smg: "M2 9h16v-1h2v4h-4l-1 1h-3l-1 6H8l1-6H6v4H4v-4H2z",
    rifle: "M1 10h15l2-2h4v3h-3l-1 2H11l-1 2H8l-1 4H5l1-5H1z",
    vest: "M8 3l4 2 4-2 3 3v15H5V6zM9 8h6M9 12h6M9 16h6",
  };
  return (
    <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d={paths[id]} />
    </svg>
  );
}

const ITEMS: { id: ItemId; name: string; price: number; stat: string; blurb: string; tone: string }[] = [
  { id: "medkit", name: "Med kit", price: MEDKIT_PRICE_RES, stat: "Heals 1 shot gangster", blurb: "Patch them up and get them back on the street.", tone: "#ff5a6e" },
  ...(Object.values(WEAPONS).map((w) => ({
    id: w.id,
    name: w.name,
    price: w.priceRes,
    stat: `+${w.boostPct}% farm · ${w.days} days`,
    blurb: w.blurb,
    tone: w.id === "pistol" ? "#22e4ff" : w.id === "smg" ? "#b45cff" : "#ffb020",
  })) as { id: ItemId; name: string; price: number; stat: string; blurb: string; tone: string }[]),
  { id: "vest", name: VEST.name, price: VEST.priceRes, stat: "Stops the next bullet", blurb: "One shot it doesn't have to take.", tone: "#3ddc84" },
];

export default function Armory({ onBack, onFound }: { onBack: () => void; onFound: () => void }) {
  const s = useMock();
  const burned = usePlatform((p) => p.resourceBurned);
  const now = useNow();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const run = (fn: () => void, msg: string) => {
    try {
      fn();
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
            <p className="section__lede">{STORE_NAME} only sells to bosses.</p>
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

  const stock = (id: ItemId) => (id === "medkit" ? s.medkits : s.inventory[id]);
  const crew = s.gangsters.filter((g) => !isRetired(g, now)).sort((a, b) => statsOf(b).perDay - statsOf(a).perDay);

  return (
    <div className="page hq armory">
      <Scene dim />
      <Nav links={false} game onBack={onBack} />

      <div className="hq__inner">
        <header className="panel armory__head">
          <div>
            <p className="eyebrow">Supplier · no questions asked</p>
            <h1>{STORE_NAME}</h1>
            <p className="muted">Gear up your crew: weapons boost the farm, vests stop bullets, med kits get the wounded back to work.</p>
            <p className="burnline">
              Everything here is paid in <b>${RESOURCE.ticker}</b> and <b>100% burned</b>.{" "}
              <span className="burnline__total">🔥 {fmt(Math.floor(burned))} burned so far</span>
              {RESOURCE.buyUrl && (
                <>
                  {" "}
                  <a href={RESOURCE.buyUrl} target="_blank" rel="noreferrer">
                    Buy ${RESOURCE.ticker} →
                  </a>
                </>
              )}
            </p>
          </div>
          <dl className="tiles armory__tiles">
            <div className="tile tile--res">
              <dt>${RESOURCE.ticker}</dt>
              <dd>
                <ResIcon size={20} /> {fmt(Math.floor(s.resource))}
              </dd>
            </div>
            <div className="tile">
              <dt>Med kits</dt>
              <dd>{s.medkits}</dd>
            </div>
            <div className="tile">
              <dt>Weapons</dt>
              <dd>{s.inventory.pistol + s.inventory.smg + s.inventory.rifle}</dd>
            </div>
            <div className="tile">
              <dt>Vests</dt>
              <dd>{s.inventory.vest}</dd>
            </div>
          </dl>
        </header>

        {/* ------------------------------------------------------------ catalog */}
        <ul className="shelf">
          {ITEMS.map((it) => {
            const w = it.id in WEAPONS ? WEAPONS[it.id as WeaponId] : null;
            return (
              <li key={it.id} className="item" style={{ "--tone": it.tone } as React.CSSProperties}>
                <div className="item__icon">
                  <ItemIcon id={it.id} />
                </div>
                <h3>{it.name}</h3>
                <p className="item__stat">{it.stat}</p>
                <p className="item__blurb">{it.blurb}</p>
                {w && (
                  <p className="item__value">
                    Extra over {w.days} days: Common <b>+{fmt(Math.round(RARITIES[0].perDay * (w.boostPct / 100) * w.days))}</b> · Legendary{" "}
                    <b>+{fmt(Math.round(RARITIES[4].perDay * (w.boostPct / 100) * w.days))}</b> DC
                  </p>
                )}
                <div className="item__foot">
                  <span className="item__price">
                    <ResIcon size={16} /> {fmt(it.price)} <small>RES</small>
                  </span>
                  <span className="item__stock">In stock: {stock(it.id)}</span>
                </div>
                <div className="item__buy">
                  {[1, 5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`btn${n === 1 ? " btn--pink" : ""}`}
                      disabled={n * it.price > s.resource}
                      onClick={() => run(() => mock.buyItem(it.id, n), `Bought ${n} × ${it.name}`)}
                    >
                      {n === 1 ? `Buy · ${fmt(it.price)}` : `×${n}`}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        {/* ------------------------------------------------------------ loadout */}
        <section className="panel">
          <div className="panel__head">
            <h2>
              Loadout <span className="count">{crew.length}</span>
            </h2>
            <span className="muted armory__hint">
              One weapon and one vest per gangster: a new weapon only goes on once the current one runs out. Weapons are worth the most on
              your highest earners.
            </span>
          </div>
          {crew.length === 0 ? (
            <p className="empty">No active gangsters. Open a box in the HQ.</p>
          ) : (
            <ul className="loadout">
              {crew.map((g) => (
                <LoadoutRow key={g.id} g={g} now={now} inv={s.inventory} kits={s.medkits} run={run} />
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

function LoadoutRow({
  g,
  now,
  inv,
  kits,
  run,
}: {
  g: MockGangster;
  now: number;
  inv: { pistol: number; smg: number; rifle: number; vest: number };
  kits: number;
  run: (fn: () => void, msg: string) => void;
}) {
  const r = RARITIES[g.rarity];
  const a = archetypeOf(g.id);
  const shot = isShot(g, now);
  const wLeft = weaponDaysLeft(g, now);
  const vest = hasVest(g, now);
  return (
    <li className={`lo${shot ? " lo--shot" : ""}`} style={{ "--rc": r.color } as React.CSSProperties}>
      <div className="lo__art">
        <GangsterToy gangsterId={g.id} rarity={g.rarity} />
      </div>
      <div className="lo__who">
        <strong>
          “{a.nick}” <small>#{g.id}</small>
        </strong>
        <span className="lo__rarity">
          {g.fused ? "Fused " : ""}
          {r.name}
        </span>
        <span className="lo__rate">{shot ? <b className="red">Shot · not farming</b> : `${rateOf(g, now).toLocaleString("en-US", { maximumFractionDigits: 1 })} DC/day`}</span>
      </div>
      <div className="lo__gear">
        <span className={`lo__slot${wLeft > 0 ? " lo__slot--on" : ""}`}>
          ⚔ {wLeft > 0 ? `${WEAPONS[g.weapon!.id].name} +${WEAPONS[g.weapon!.id].boostPct}% · ${wLeft.toFixed(1)}d left` : "No weapon"}
        </span>
        <span className={`lo__slot${vest ? " lo__slot--on" : ""}`}>🛡 {vest ? "Vest on" : "No vest"}</span>
      </div>
      <div className="lo__actions">
        {shot ? (
          <button type="button" className="btn btn--heal" onClick={() => run(() => mock.heal([g.id]), `#${g.id} healed`)}>
            ✚ Heal {kits > 0 ? "· use kit" : `· ${fmt(MEDKIT_PRICE_RES)} RES`}
          </button>
        ) : (
          <>
            {(Object.keys(WEAPONS) as WeaponId[]).map((w) => (
              <button
                key={w}
                type="button"
                className="btn"
                disabled={inv[w] < 1 || wLeft > 0}
                title={
                  wLeft > 0
                    ? `Already armed: wait for the ${WEAPONS[g.weapon!.id].name} to run out (${wLeft.toFixed(1)} days)`
                    : inv[w] < 1
                      ? `Buy a ${WEAPONS[w].name} first`
                      : `Equip ${WEAPONS[w].name} (+${WEAPONS[w].boostPct}%)`
                }
                onClick={() => run(() => mock.equipWeapon(g.id, w), `${WEAPONS[w].name} equipped on #${g.id}`)}
              >
                {WEAPONS[w].name} <small>({inv[w]})</small>
              </button>
            ))}
            <button
              type="button"
              className="btn"
              disabled={inv.vest < 1 || vest}
              onClick={() => run(() => mock.equipVest(g.id), `Vest on #${g.id}`)}
            >
              Vest <small>({inv.vest})</small>
            </button>
          </>
        )}
      </div>
    </li>
  );
}
