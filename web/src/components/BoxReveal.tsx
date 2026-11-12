import { useEffect, useRef, useState } from "react";
import { RARITIES, fmt } from "../config/game";
import { archetypeOf, type MockGangster } from "../mock";
import CashBox from "./art/CashBox";
import GangsterToy from "./art/GangsterToy";

/**
 * Box opening sequence: shake → burst of light in the best rarity's color → card(s).
 * `open` performs the actual roll (contract call in production) and is invoked once the shake starts.
 */
export default function BoxReveal({ open, onClose }: { open: () => MockGangster[]; onClose: () => void }) {
  const [phase, setPhase] = useState<"shake" | "burst" | "cards">("shake");
  const [result, setResult] = useState<MockGangster[]>([]);

  const rolled = useRef(false);

  useEffect(() => {
    // guard: StrictMode runs effects twice in dev, the roll must happen once
    if (!rolled.current) {
      rolled.current = true;
      setResult(open());
    }
    const t1 = setTimeout(() => setPhase("burst"), 1400);
    const t2 = setTimeout(() => setPhase("cards"), 2100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && phase === "cards" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  const best = result.reduce((m, g) => Math.max(m, g.rarity), 0);
  const light = RARITIES[best].color;

  return (
    <div className="reveal" role="dialog" aria-modal="true" aria-label="Opening box" style={{ "--rc": light } as React.CSSProperties}>
      {phase !== "cards" ? (
        <div className={`reveal__stage reveal__stage--${phase}`}>
          <CashBox state={phase === "shake" ? "shake" : "open"} light={phase === "shake" ? "#ff2e88" : light} />
          <p className="reveal__hint">{phase === "shake" ? "Cracking the lock…" : ""}</p>
        </div>
      ) : (
        <div className="reveal__cards">
          <p className="eyebrow">{result.length > 1 ? `${result.length} new gangsters` : "New gangster"}</p>
          <ul className={`reveal__grid${result.length === 1 ? " reveal__grid--single" : ""}`}>
            {result.map((g, i) => {
              const r = RARITIES[g.rarity];
              const a = archetypeOf(g.id);
              return (
                <li key={g.id} className="gcard gcard--reveal" style={{ "--rc": r.color, animationDelay: `${i * 90}ms` } as React.CSSProperties}>
                  <div className="gcard__art">
                    <GangsterToy gangsterId={g.id} rarity={g.rarity} animate />
                  </div>
                  <div className="gcard__body">
                    <span className="gcard__rarity">{r.name}</span>
                    <h3>
                      “{a.nick}” <small>#{g.id}</small>
                    </h3>
                    <p className="gcard__title">{a.title}</p>
                    {result.length === 1 && <p className="gcard__flavor">{a.flavor}</p>}
                    <dl className="gcard__stats">
                      <div>
                        <dt>Farm/day</dt>
                        <dd>{fmt(r.perDay)} DC</dd>
                      </div>
                      <div>
                        <dt>Career cap</dt>
                        <dd>{fmt(r.cap)} DC</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" className="cta" onClick={onClose} autoFocus>
            Put them to work
          </button>
        </div>
      )}
    </div>
  );
}
