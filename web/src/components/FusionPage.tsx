import { useEffect, useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import GangsterToy from "./art/GangsterToy";
import Fusion from "./Fusion";
import { RARITIES, RESOURCE, fmt, recipeFrom } from "../config/game";
import ResIcon from "./art/ResIcon";
import { archetypeOf, farmedOf, fusionCandidates, isFarming, isRetired, isShot, statsOf, useMock, type MockGangster } from "../mock";

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Dedicated fusion screen: recipes + the player's crew grouped by rarity, showing who a fusion would consume. */
export default function FusionPage({ onBack, onFound }: { onBack: () => void; onFound: () => void }) {
  const s = useMock();
  const now = useNow();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  if (!s.gang) {
    return (
      <div className="page select">
        <Scene dim />
        <Nav links={false} game onBack={onBack} />
        <div className="select__inner">
          <header className="section__head">
            <p className="eyebrow">No gang yet</p>
            <h2>Found your gang first</h2>
            <p className="section__lede">You need a crew before you can fuse gangsters.</p>
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

  const pairs = RARITIES.filter((r) => recipeFrom(r.id) && fusionCandidates(s.gangsters, r.id, now).length >= 2).length;
  const fusedCount = s.gangsters.filter((g) => g.fused).length;
  const activeCount = s.gangsters.filter((g) => isFarming(g, now)).length;

  return (
    <div className="page hq fusionpage">
      <Scene dim />
      <Nav links={false} game onBack={onBack} />

      <div className="hq__inner">
        <header className="panel fusionpage__head">
          <div>
            <p className="eyebrow">Back room</p>
            <h1>Fusion lab</h1>
            <p className="muted">Merge two gangsters of the same rarity into one fused gangster of the next rarity.</p>
          </div>
          <dl className="tiles fusionpage__tiles">
            <div className="tile tile--res">
              <dt>${RESOURCE.ticker}</dt>
              <dd>
                <ResIcon size={20} /> {fmt(Math.floor(s.resource))}
              </dd>
            </div>
            <div className={`tile${pairs > 0 ? " tile--hot" : ""}`}>
              <dt>Ready to fuse</dt>
              <dd>{pairs}</dd>
            </div>
            <div className="tile">
              <dt>Fused</dt>
              <dd>{fusedCount}</dd>
            </div>
            <div className="tile">
              <dt>Active crew</dt>
              <dd>{activeCount}</dd>
            </div>
          </dl>
        </header>

        <section className="panel">
          <div className="panel__head">
            <h2>Recipes</h2>
          </div>
          <Fusion gangsters={s.gangsters} resource={s.resource} now={now} onToast={setToast} />
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Your crew by rarity</h2>
            <span className="muted fusionpage__hint">
              <i className="fusionpage__key" /> next in line to be fused (closest to retirement)
            </span>
          </div>

          {s.gangsters.length === 0 ? (
            <p className="empty">No gangsters yet. Open a box in the HQ.</p>
          ) : (
            <div className="fgroups">
              {RARITIES.map((r) => {
                const all = s.gangsters.filter((g) => g.rarity === r.id);
                if (all.length === 0) return null;
                const pool = fusionCandidates(s.gangsters, r.id, now);
                const canFuse = !!recipeFrom(r.id);
                const nextIds = new Set(canFuse && pool.length >= 2 ? [pool[0].id, pool[1].id] : []);
                // eligible first (in fusion order), then fused / retired
                const rest = all.filter((g) => !pool.includes(g));
                const ordered = [...pool, ...rest];
                return (
                  <div key={r.id} className="fgroup" style={{ "--rc": r.color } as React.CSSProperties}>
                    <div className="fgroup__head">
                      <span className="fgroup__name">
                        <i /> {r.name}
                      </span>
                      <span className="muted">
                        {canFuse ? `${pool.length} can fuse · ${pool.length >= 2 ? Math.floor(pool.length / 2) : 0} pair${Math.floor(pool.length / 2) === 1 ? "" : "s"}` : "Top rarity · can't be fused"}
                      </span>
                    </div>
                    <ul className="fgroup__list">
                      {ordered.map((g) => (
                        <FCard key={g.id} g={g} now={now} next={nextIds.has(g.id)} eligible={canFuse && pool.includes(g)} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
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

function FCard({ g, now, next, eligible }: { g: MockGangster; now: number; next: boolean; eligible: boolean }) {
  const st = statsOf(g);
  const pct = Math.min(100, (farmedOf(g, now) / st.cap) * 100);
  const retired = isRetired(g, now);
  const why = g.fused ? "Fused" : retired ? "Retired" : isShot(g, now) ? "Shot · heal first" : null;
  return (
    <li className={`fcard${next ? " fcard--next" : ""}${!eligible ? " fcard--locked" : ""}`}>
      {next && <span className="fcard__flag">Next</span>}
      {why && <span className="fcard__why">{why}</span>}
      <div className="fcard__art">
        <GangsterToy gangsterId={g.id} rarity={g.rarity} />
      </div>
      <strong>
        “{archetypeOf(g.id).nick}” <small>#{g.id}</small>
      </strong>
      <div className="bar" aria-label={`${Math.round(pct)}% of career done`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <small className="fcard__meta">
        {Math.round(pct)}% career · {st.perDay}/day
      </small>
    </li>
  );
}
