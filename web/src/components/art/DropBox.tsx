import { useEffect, useRef, useState } from "react";
import CashBox from "./CashBox";

type BoxState = "idle" | "shake" | "open";

/**
 * Hero of the rarities section: the Gangster Box, looping idle -> shake -> open while it is on screen.
 * The neon seam cycles through the rarity colours (see rarity.css). Static when reduced motion is on.
 */
export default function DropBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<BoxState>("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timers: number[] = [];
    let running = false;
    const clear = () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
    };
    const cycle = () => {
      setState("idle");
      timers.push(window.setTimeout(() => setState("shake"), 2600));
      timers.push(window.setTimeout(() => setState("open"), 3600));
      timers.push(window.setTimeout(cycle, 6600));
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          cycle();
        } else if (!entry.isIntersecting && running) {
          running = false;
          clear();
          setState("idle");
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
  }, []);

  return (
    <div className="drop__box" ref={ref} aria-hidden>
      <span className="drop__rays" />
      <span className="drop__glow" />
      <div className={`drop__cb drop__cb--${state}`}>
        <CashBox state={state} />
      </div>
    </div>
  );
}
