import { useEffect, useRef, useState } from "react";
import GangsterToy from "./art/GangsterToy";
import Coin from "./art/Coin";
import { FUSION_RECIPES, RARITIES, fmt } from "../config/game";
import { archetypeOf, farmedOf, fusionCandidates, mock, pendingOf, statsOf, type MockGangster } from "../mock";

type FuseResult = ReturnType<typeof mock.fuse>;

const TOP = RARITIES[RARITIES.length - 1];

const RULES = [
  "Fusing 2 gangsters of the same rarity gives 1 fused gangster of the next rarity up.",
  "It farms both parents' daily DC combined and its career cap is bigger than the two parents' together.",
  `The fee grows with the tier. ${TOP.name} is the top rarity and can't be fused.`,
  "Both gangsters must be active: still farming (not retired) and never fused before.",
  "The two gangsters closest to retirement are consumed. Their pending DC is paid out to you first, free.",
  "Fused gangsters start a brand-new career and cannot be fused again.",
];

/** Fusion tab: one row per rarity, fuse the two gangsters closest to retirement. */
export default function Fusion({
  gangsters,
  dc,
  now,
  onToast,
}: {
  gangsters: MockGangster[];
  dc: number;
  now: number;
  onToast: (msg: string) => void;
}) {
  const [result, setResult] = useState<FuseResult | null>(null);

  const fuse = (rarity: number) => {
    try {
      setResult(mock.fuse(rarity));
    } catch (e) {
      onToast((e as Error).message);
    }
  };

  return (
    <div className="fusion">
      <p className="muted fusion__lede">
        Fuse 2 gangsters of the same rarity into 1 <b>fused gangster of the next rarity</b>. It farms the daily DC of both
        parents combined and has a bigger career cap, so it earns more than the two would on their own.
      </p>

      <div className="fusion__table" role="table" aria-label="Fusion by rarity">
        <div className="fusion__row fusion__row--head" role="row">
          <span role="columnheader">Fusion</span>
          <span role="columnheader">Cost</span>
          <span role="columnheader">Farm</span>
          <span role="columnheader">Career cap</span>
          <span role="columnheader">Extra DC</span>
          <span role="columnheader">
            <span className="sr-only">Action</span>
          </span>
        </div>

        {FUSION_RECIPES.map((f) => {
          const from = RARITIES[f.from];
          const to = RARITIES[f.to];
          const parentsCap = from.cap * 2;
          const extra = f.cap - parentsCap - f.fee;
          const pool = fusionCandidates(gangsters, f.from, now);
          const pair = pool.slice(0, 2);
          const ready = pair.length === 2;
          // mirrors mock.fuse: the parents' pending DC is paid out before the fee is charged
          const canPay = dc + pair.reduce((t, g) => t + pendingOf(g, now), 0) >= f.fee;
          return (
            <div
              key={f.from}
              className="fusion__row"
              role="row"
              style={{ "--rc": to.color, "--rc-from": from.color } as React.CSSProperties}
            >
              <span role="cell" className="fusion__pair">
                <span className="fusion__from">
                  <i className="fusion__dot" />
                  {from.name} × 2
                </span>
                <span className="fusion__arrow" aria-label="becomes">→</span>
                <b>{to.name}</b>
              </span>
              <span role="cell" data-label="Cost">
                <Coin size={14} /> {fmt(f.fee)} DC
              </span>
              <span role="cell" data-label="Farm">
                <b className="gold">{fmt(f.perDay)}/day</b> <small>regular {to.name} {fmt(to.perDay)}</small>
              </span>
              <span role="cell" data-label="Career cap">
                <b>{fmt(f.cap)} DC</b> <small>parents {fmt(parentsCap)}</small>
              </span>
              <span role="cell" data-label="Extra DC">
                <b className="fusion__gain">+{fmt(extra)}</b> <small>after fee</small>
              </span>
              <span role="cell" className="fusion__act">
                <button type="button" className="btn btn--fuse" disabled={!ready || !canPay} onClick={() => fuse(f.from)}>
                  {ready && !canPay ? `Need ${fmt(f.fee)} DC` : "Fuse"}
                </button>
                <small
                  className={ready ? "fusion__ready" : undefined}
                  title={ready ? "Consumed: the two closest to retirement (% of career done)" : undefined}
                >
                  {ready
                    ? `#${pair[0].id} ${careerPct(pair[0], now)}% + #${pair[1].id} ${careerPct(pair[1], now)}%`
                    : `${pool.length}/2 ${from.name} ready`}
                </small>
              </span>
            </div>
          );
        })}

        <div className="fusion__row fusion__row--max" role="row" style={{ "--rc": TOP.color } as React.CSSProperties}>
          <span role="cell" className="fusion__pair">
            <span className="fusion__from">
              <i className="fusion__dot" />
              {TOP.name} × 2
            </span>
          </span>
          <span role="cell" className="fusion__maxnote">
            Top rarity: can't be fused.
          </span>
        </div>
      </div>

      <div className="fusion__rules">
        <h3>Rules</h3>
        <ul>
          {RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      {result && <FusionReveal result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

/** Two parents slide into each other → flash in the rarity color → fused card. */
function FusionReveal({ result, onClose }: { result: FuseResult; onClose: () => void }) {
  const [phase, setPhase] = useState<"merge" | "burst" | "card">("merge");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("burst"), 1300);
    const t2 = setTimeout(() => setPhase("card"), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && phase === "card" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const { parents, child, payout } = result;
  const r = RARITIES[child.rarity];
  const s = statsOf(child);
  const a = archetypeOf(child.id);

  return (
    <div className="reveal" role="dialog" aria-modal="true" aria-label="Fusion" style={{ "--rc": r.color } as React.CSSProperties}>
      {phase !== "card" ? (
        <div className={`reveal__stage reveal__stage--${phase}`}>
          <div className="fuse-stage">
            {parents.map((p, i) => (
              <div key={p.id} className={`fuse-stage__parent fuse-stage__parent--${i ? "right" : "left"}`}>
                <GangsterToy gangsterId={p.id} rarity={p.rarity} />
              </div>
            ))}
          </div>
          <p className="reveal__hint">Fusing #{parents[0].id} + #{parents[1].id}…</p>
        </div>
      ) : (
        <div className="reveal__cards">
          <p className="eyebrow">
            {RARITIES[parents[0].rarity].name} × 2 → Fused {r.name}
          </p>
          <ul className="reveal__grid reveal__grid--single">
            <li className="gcard gcard--reveal gcard--fused">
              <div className="gcard__art">
                <GangsterToy gangsterId={child.id} rarity={child.rarity} animate />
                <span className="gcard__fused">Fused</span>
              </div>
              <div className="gcard__body">
                <span className="gcard__rarity">{r.name}</span>
                <h3>
                  “{a.nick}” <small>#{child.id}</small>
                </h3>
                <p className="gcard__title">{a.title}</p>
                <dl className="gcard__stats">
                  <div>
                    <dt>Farm/day</dt>
                    <dd>{fmt(s.perDay)} DC</dd>
                  </div>
                  <div>
                    <dt>Career cap</dt>
                    <dd>{fmt(s.cap)} DC</dd>
                  </div>
                  <div>
                    <dt>Parents' pending paid</dt>
                    <dd className="gold">{fmt(Math.floor(payout * 10) / 10)} DC</dd>
                  </div>
                </dl>
              </div>
            </li>
          </ul>
          <button type="button" className="cta" onClick={onClose} autoFocus>
            Put them to work
          </button>
        </div>
      )}
    </div>
  );
}

/** % of career done, used to show which gangsters a fusion would consume. */
const careerPct = (g: MockGangster, now: number) => Math.round((farmedOf(g, now) / statsOf(g).cap) * 100);
