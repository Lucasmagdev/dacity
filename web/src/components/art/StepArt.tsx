import Coin from "./Coin";
import CashBox from "./CashBox";
import Portrait from "../Portrait";
import { PROTAGONISTS } from "../../config/game";

export type StepKind = "deposit" | "gang" | "boxes" | "farm";

/** USDC mock token (blue, $) - the deposit side of step 01. */
function UsdcCoin({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <circle cx="50" cy="50" r="47" fill="#2775ca" opacity=".35" />
      <circle cx="50" cy="50" r="44" fill="#2775ca" stroke="#8ec1ff" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="2 3" opacity=".6" />
      <text x="50" y="64" textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize="44" fill="#fff">
        $
      </text>
    </svg>
  );
}

/** Small illustration shown on top of each "How it works" card. Pure SVG/CSS, no assets. */
export default function StepArt({ kind }: { kind: StepKind }) {
  if (kind === "deposit") {
    return (
      <div className="sart sart--deposit">
        <UsdcCoin size={66} />
        <span className="sart__arrows" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <Coin size={84} spin />
      </div>
    );
  }

  if (kind === "gang") {
    const [nina, rico] = PROTAGONISTS;
    return (
      <div className="sart sart--gang">
        {[nina, rico].map((p) => (
          <figure key={p.id} className="sart__avatar" style={{ "--accent": p.accent } as React.CSSProperties}>
            <Portrait protagonist={p} />
          </figure>
        ))}
        <span className="sart__or" aria-hidden>
          OR
        </span>
      </div>
    );
  }

  if (kind === "boxes") {
    return (
      <div className="sart sart--boxes">
        <span className="sart__halo" aria-hidden />
        <div className="sart__box">
          <CashBox state="idle" />
        </div>
        <span className="sart__spark sart__spark--a" aria-hidden />
        <span className="sart__spark sart__spark--b" aria-hidden />
        <span className="sart__spark sart__spark--c" aria-hidden />
      </div>
    );
  }

  return (
    <div className="sart sart--farm">
      <div className="sart__coins" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ "--k": i } as React.CSSProperties}>
            <Coin size={34} />
          </span>
        ))}
      </div>
      <div className="sart__meter" aria-hidden>
        <span />
      </div>
      <span className="sart__cap">CAP</span>
    </div>
  );
}
