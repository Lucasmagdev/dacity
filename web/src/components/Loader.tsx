import { useEffect, useState } from "react";
import "./loader.css";

const LINES = ["audacity", "game"];
const COVER_SRC = "/loader-cover.webp"; // drop your own artwork in web/public/
const MIN_MS = 3000;
const EXIT_MS = 700;
const SAFETY_MS = 7000;

// "AG" monogram in a 340x260 box; G tucks in close to the A. A has a counter (evenodd).
const A_PATH = "M5 250 L80 10 H130 L205 250 H155 L142 208 H68 L55 250 Z M81 168 H129 L105 90 Z";
const G_PATH =
  "M223 10 H333 V62 H250 V198 H283 V170 H268 V125 H333 V250 H223 L193 220 V40 Z";

function Letter({ id, d }: { id: string; d: string }) {
  return (
    <g className={`loader__letter loader__letter--${id}`}>
      <path className="loader__edge loader__edge--dark" d={d} />
      <path className="loader__edge loader__edge--light" d={d} />
      <path d={d} fill="url(#ldFill)" fillRule="evenodd" />
    </g>
  );
}

export default function Loader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [coverReady, setCoverReady] = useState(false);

  // Progress: eases to 100% over MIN_MS, but holds near 92% until fonts + window load are done.
  useEffect(() => {
    let raf = 0;
    let ready = false;
    let finished = false;
    const timers: number[] = [];
    const start = performance.now();

    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const pageReady =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true }));
    Promise.all([fontsReady, pageReady]).then(() => (ready = true));
    timers.push(window.setTimeout(() => (ready = true), SAFETY_MS));

    // Dev aid: append ?hold to the URL to keep the loader on screen.
    const hold = import.meta.env.DEV && new URLSearchParams(location.search).has("hold");

    let shown = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / MIN_MS, 1);
      let target = 1 - Math.pow(1 - t, 3);
      if (!ready) target = Math.min(target, 0.92);
      shown = Math.max(shown, target);
      setPct(shown);

      if (t >= 1 && ready && !finished && !hold) {
        finished = true;
        setPct(1);
        timers.push(window.setTimeout(() => setLeaving(true), 200));
        timers.push(window.setTimeout(onDone, 200 + EXIT_MS));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [onDone]);

  // Lock page scroll while the loader covers it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const percent = Math.round(pct * 100);

  return (
    <div
      className={`loader${leaving ? " loader--leave" : ""}`}
      role="progressbar"
      aria-label="Loading Audacity Game"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className={`loader__cover${coverReady ? " is-ready" : ""}`} aria-hidden="true">
        <img
          src={COVER_SRC}
          alt=""
          decoding="async"
          onLoad={() => setCoverReady(true)}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      </div>
      <div className="loader__shade" aria-hidden="true" />

      <div className="loader__stage">
        <div className="loader__logo" aria-hidden="true">
          <svg className="loader__emblem" viewBox="0 0 340 260">
            <defs>
              <linearGradient
                id="ldFill"
                gradientUnits="userSpaceOnUse"
                x1="30"
                y1="0"
                x2="300"
                y2="260"
              >
                <stop offset="0" stopColor="#5a5cf0" />
                <stop offset="0.3" stopColor="#b24fe8" />
                <stop offset="0.58" stopColor="#f2609f" />
                <stop offset="0.82" stopColor="#fb9a5b" />
                <stop offset="1" stopColor="#f7cf72" />
              </linearGradient>
            </defs>
            <Letter id="a" d={A_PATH} />
            <Letter id="g" d={G_PATH} />
          </svg>

          <div className="loader__word">
            {LINES.map((line) => (
              <span key={line} className="loader__line">
                {line}
              </span>
            ))}
          </div>
        </div>

        <div className="loader__progress">
          <div className="loader__track">
            <div className="loader__fill" style={{ transform: `scaleX(${pct})` }} />
          </div>
          <span className="loader__pct">{percent}</span>
        </div>
      </div>
    </div>
  );
}
