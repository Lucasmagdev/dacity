import { useId } from "react";

/** $RESOURCE mark: a flame, since every RESOURCE spent in the game is burned. */
export default function ResIcon({ size = 18 }: { size?: number }) {
  const id = `res-${useId().replace(/:/g, "")}`;
  return (
    <svg className="resicon" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff2e88" />
          <stop offset="0.55" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#ffd36b" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" />
    </svg>
  );
}
