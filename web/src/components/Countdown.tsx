import { useEffect, useState } from "react";
import { SEASON_START } from "../config/game";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Glass box with a live countdown to the season start; switches to "live" once it passes. */
export default function Countdown() {
  const now = useNow();
  const left = SEASON_START.getTime() - now;

  if (left <= 0) {
    return (
      <div className="countdown countdown--live">
        <span className="countdown__label">Season 01</span>
        <strong className="countdown__live">Live now</strong>
      </div>
    );
  }

  const s = Math.floor(left / 1000);
  const parts = [
    { v: Math.floor(s / 86400), u: "d" },
    { v: Math.floor((s % 86400) / 3600), u: "h" },
    { v: Math.floor((s % 3600) / 60), u: "m" },
    { v: s % 60, u: "s" },
  ];

  return (
    <div className="countdown" role="timer" aria-label="Time until Season 01">
      <span className="countdown__label">Season 01 opens in</span>
      <div className="countdown__digits">
        {parts.map((p) => (
          <span key={p.u}>
            <b>{pad(p.v)}</b>
            <i>{p.u}</i>
          </span>
        ))}
      </div>
    </div>
  );
}
