import { useId } from "react";

/** Gold casino-chip notches around the black rim (8 of them, every 45°). */
const NOTCHES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Palm on the gold center: curved trunk + six arched fronds + coconuts. */
const FRONDS = [
  "M50.3 40Q38.9 35.8 29.9 46.2Q40.4 40.8 50.3 40Z",
  "M50.3 40Q42.9 31.9 34.8 38.8Q42.5 37.1 50.3 40Z",
  "M50.3 40Q50.4 30 43.9 31.8Q46.3 33.2 50.3 40Z",
  "M50.3 40Q50.3 30 56.8 31.8Q54.4 33.2 50.3 40Z",
  "M50.3 40Q57.8 31.9 65.8 38.8Q58.2 37.1 50.3 40Z",
  "M50.3 40Q61.7 35.8 70.7 46.2Q60.2 40.8 50.3 40Z",
];

/** Dacity Coin (DC): "High Roller" chip, black with gold notches and a palm on a gold center. */
export default function Coin({ size = 20, spin = false }: { size?: number; spin?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const gold = `url(#${uid}-g)`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`coin${spin ? " coin--spin" : ""}`} aria-hidden>
      <defs>
        <radialGradient id={`${uid}-g`} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset=".45" stopColor="#ffc533" />
          <stop offset="1" stopColor="#9a5e00" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#14051f" />
      {NOTCHES.map((deg) => (
        <rect key={deg} x="45" y="3" width="10" height="9" rx="1.5" fill={gold} transform={`rotate(${deg} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="39" fill="none" stroke="#ffc533" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="50" cy="50" r="35" fill={gold} stroke="#ffc533" strokeWidth="1.2" />
      <path d="M46 76 Q43.8 58 50.3 40" fill="none" stroke="#7a4300" strokeWidth="2.7" strokeLinecap="round" />
      {FRONDS.map((d) => (
        <path key={d} d={d} fill="#7a4300" />
      ))}
      <circle cx="49.2" cy="41.8" r="1.3" fill="#7a4300" />
      <circle cx="51.8" cy="41.8" r="1.3" fill="#7a4300" />
    </svg>
  );
}
