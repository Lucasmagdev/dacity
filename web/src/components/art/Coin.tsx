import { useId } from "react";

/** MOCK Dacity Coin (art/leonardo-prompts.md F1): gold, palm + sunset stripes, pink neon rim. */
export default function Coin({ size = 20, spin = false }: { size?: number; spin?: boolean }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`coin${spin ? " coin--spin" : ""}`} aria-hidden>
      <defs>
        <radialGradient id={`${uid}-g`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset=".45" stopColor="#ffc533" />
          <stop offset="1" stopColor="#a86a00" />
        </radialGradient>
        <clipPath id={`${uid}-c`}>
          <circle cx="50" cy="50" r="30" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#ff2e88" opacity=".35" />
      <circle cx="50" cy="50" r="44" fill={`url(#${uid}-g)`} stroke="#ff5aa5" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#8a5600" strokeWidth="3" strokeDasharray="2 3" opacity=".7" />
      <g clipPath={`url(#${uid}-c)`}>
        <circle cx="50" cy="50" r="30" fill="#e3a21a" />
        <circle cx="50" cy="58" r="16" fill="#fff1a8" />
        {[52, 58, 64, 70].map((y) => (
          <rect key={y} x="20" y={y} width="60" height="2.5" fill="#e3a21a" />
        ))}
        <path d="M50 80 Q52 62 47 48" fill="none" stroke="#7a4a00" strokeWidth="3" />
        <path d="M47 48 Q36 40 28 48 M47 48 Q58 38 68 46 M47 48 Q40 34 32 34 M47 48 Q54 34 64 34" fill="none" stroke="#7a4a00" strokeWidth="3" strokeLinecap="round" />
      </g>
      <text x="50" y="30" textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize="15" fill="#7a4a00">
        D
      </text>
    </svg>
  );
}
