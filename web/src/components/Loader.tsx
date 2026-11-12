import { useEffect, useState, type CSSProperties } from "react";
import "./loader.css";

// Six loading stars, tinted along the logo gradient (indigo → gold).
const STAR_COLORS = ["#5a5cf0", "#8f56ec", "#c656d4", "#f2609f", "#fb9a5b", "#f7cf72"];
const STAR_PATH =
  "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z";

const LINES = ["audacity", "game"];
const COVER_SRC = "/loader-cover.webp"; // drop your own artwork in web/public/
const MIN_MS = 2200;
const FILL_DELAY_MS = 400; // stars fade in before they start filling
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
      const elapsed = now - start;
      const t = Math.min(elapsed / MIN_MS, 1);
      // Linear after the entrance, so every star gets the same beat.
      let target = Math.min(Math.max((elapsed - FILL_DELAY_MS) / (MIN_MS - FILL_DELAY_MS), 0), 1);
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
          {STAR_COLORS.map((color, i) => {
            const fill = Math.min(Math.max(pct * STAR_COLORS.length - i, 0), 1);
            return (
              <span
                key={i}
                className={`loader__star${fill >= 1 ? " is-full" : ""}`}
                style={{ "--star": color, "--f": fill, "--i": i } as CSSProperties}
              >
                <svg className="loader__star-base" viewBox="0 0 24 24">
                  <path d={STAR_PATH} />
                </svg>
                <span className="loader__star-fill" />
                <svg className="loader__star-outline" viewBox="0 0 24 24">
                  <path d={STAR_PATH} />
                </svg>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
