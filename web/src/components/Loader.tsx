import { useEffect, useState, type CSSProperties } from "react";
import "./loader.css";

// Six classic rating stars: outlined when empty, solid once their sixth of the progress is reached.
const STAR_COUNT = 6;
// Regular pentagram (inner radius = 0.382 × outer) for sharp, classic points.
const STAR_PATH =
  "M12 1.6 L14.47 9.2 L22.46 9.2 L15.99 13.9 L18.47 21.5 L12 16.8 L5.53 21.5 L8.01 13.9 L1.54 9.2 L9.53 9.2 Z";

const COVER_SRC = "/loader-cover.webp"; // drop your own artwork in web/public/
const MIN_MS = 2200;
const FILL_DELAY_MS = 400; // stars fade in before they start filling
const EXIT_MS = 700;
const SAFETY_MS = 7000;

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
        {/* Same lockup as the hero: gradient wordmark with palms + neon script. */}
        <div className="loader__logo" aria-hidden="true">
          <div className="wordmark loader__wordmark">Audacity</div>
          <p className="script loader__script">Game</p>
        </div>

        <div className="loader__progress">
          {Array.from({ length: STAR_COUNT }, (_, i) => (
            <svg
              key={i}
              className={`loader__star${pct * STAR_COUNT >= i + 1 ? " is-full" : ""}`}
              style={{ "--i": i } as CSSProperties}
              viewBox="0 0 24 24"
            >
              <path d={STAR_PATH} />
            </svg>
          ))}
        </div>
      </div>
    </div>
  );
}
