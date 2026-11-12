import { useId } from "react";

/**
 * MOCK Gangster Box: armored cash briefcase (art/leonardo-prompts.md D1).
 * `state` drives the CSS animation: idle bob, shake before opening, open = lid flies + light beam.
 * Swap for /box/idle.mp4, shake.mp4, open-<rarity>.mp4 once the videos exist.
 */
export default function CashBox({ state = "idle", light = "#ff2e88" }: { state?: "idle" | "shake" | "open" | "still"; light?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 180" className={`cashbox cashbox--${state}`} style={{ "--light": light } as React.CSSProperties} aria-hidden>
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2433" />
          <stop offset="1" stopColor="#0c0910" />
        </linearGradient>
        <linearGradient id={`${uid}-chrome`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#9aa0b4" />
          <stop offset="1" stopColor="#4a4f60" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset=".5" stopColor="#ffc533" />
          <stop offset="1" stopColor="#a86a00" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse className="cashbox__shadow" cx="100" cy="168" rx="62" ry="7" fill="#000" opacity=".5" />
      <path className="cashbox__beam" d="M58 70 L142 70 L190 0 L10 0 Z" fill="var(--light)" opacity="0" />

      <g className="cashbox__body">
        {/* handle */}
        <path d="M80 46 V34 Q80 26 88 26 H112 Q120 26 120 34 V46" fill="none" stroke={`url(#${uid}-chrome)`} strokeWidth="7" />
        {/* lid */}
        <g className="cashbox__lid">
          <rect x="30" y="44" width="140" height="30" rx="8" fill={`url(#${uid}-body)`} stroke="#000" strokeWidth="2" />
          <path d="M30 56 h140" stroke="#ffffff" strokeOpacity=".06" strokeWidth="6" />
        </g>
        {/* base */}
        <rect x="30" y="72" width="140" height="84" rx="10" fill={`url(#${uid}-body)`} stroke="#000" strokeWidth="2" />
        {/* neon seam */}
        <path className="cashbox__seam" d="M32 73 H168" stroke="var(--light)" strokeWidth="3" filter={`url(#${uid}-glow)`} />
        <path d="M40 150 H160" stroke="#22e4ff" strokeWidth="2" opacity=".7" filter={`url(#${uid}-glow)`} />
        {/* chrome corners */}
        {[
          [30, 44, 0],
          [170, 44, 90],
          [170, 156, 180],
          [30, 156, 270],
        ].map(([x, y, r]) => (
          <path key={r} d="M0 0 h18 v6 h-12 v12 h-6 Z" fill={`url(#${uid}-chrome)`} transform={`translate(${x} ${y}) rotate(${r})`} />
        ))}
        {/* palm emblem */}
        <g transform="translate(138 116)" fill="none" stroke="#ffd36b" strokeWidth="2" opacity=".75">
          <path d="M0 18 Q2 6 0 -6" />
          <path d="M0 -6 Q-10 -12 -16 -4 M0 -6 Q10 -12 16 -4 M0 -6 Q-6 -16 -12 -16 M0 -6 Q6 -16 12 -16" />
        </g>
        {/* padlock */}
        <g className="cashbox__lock">
          <path d="M88 84 V76 Q88 66 100 66 Q112 66 112 76 V84" fill="none" stroke={`url(#${uid}-chrome)`} strokeWidth="5" />
          <rect x="82" y="82" width="36" height="30" rx="6" fill={`url(#${uid}-gold)`} stroke="#6b4300" strokeWidth="2" />
          <circle cx="100" cy="94" r="4" fill="#3a2400" />
          <path d="M100 96 v8" stroke="#3a2400" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>

      <g className="cashbox__sparks" fill="var(--light)">
        <circle cx="40" cy="40" r="2" />
        <circle cx="166" cy="30" r="2.5" />
        <circle cx="150" cy="62" r="1.5" />
        <circle cx="54" cy="20" r="1.5" />
      </g>
    </svg>
  );
}
