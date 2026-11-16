import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Before / after slider. The divider follows the mouse on hover (and the finger on touch / keyboard arrows).
 * Until the first interaction it sweeps left and right on its own while it is on screen, so it reads as interactive.
 * Left of the line = before, right of the line = after.
 */
export default function CompareSlider({
  before,
  after,
  beforeAlt,
  afterAlt,
  beforeLabel = "Before",
  afterLabel = "After",
  beforePosition = "50% 50%",
  phase = 0,
}: {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** CSS object-position for the "before" photo when it has to be cropped to a square. */
  beforePosition?: string;
  /** Offset (radians) of the idle sweep, so several sliders on one page don't move in sync. */
  phase?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const [pos, setPos] = useState(50);

  const setFromX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.max(3, Math.min(97, ((clientX - r.left) / r.width) * 100)));
  }, []);

  // idle sweep until the first interaction
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let t0 = 0;
    let visible = false;
    const tick = (t: number) => {
      if (touched.current || !visible) {
        raf = 0;
        return;
      }
      if (!t0) t0 = t;
      setPos(50 + 30 * Math.sin((t - t0) / 1100 + phase));
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf && !touched.current) {
          t0 = 0;
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  return (
    <div
      ref={ref}
      className="cmp"
      style={{ "--pos": `${pos}%`, "--p": pos } as React.CSSProperties}
      role="slider"
      tabIndex={0}
      aria-label="Before and after comparison"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      onPointerMove={(e) => {
        touched.current = true;
        setFromX(e.clientX);
      }}
      onPointerDown={(e) => {
        touched.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setFromX(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        touched.current = true;
        setPos((p) => Math.max(3, Math.min(97, p + (e.key === "ArrowRight" ? 5 : -5))));
      }}
    >
      <img
        className="cmp__img cmp__img--before"
        src={before}
        alt={beforeAlt}
        draggable={false}
        style={{ objectPosition: beforePosition }}
      />
      <img className="cmp__img cmp__img--after" src={after} alt={afterAlt} draggable={false} />
      <span className="cmp__tag cmp__tag--before">{beforeLabel}</span>
      <span className="cmp__tag cmp__tag--after">{afterLabel}</span>
      <span className="cmp__line" aria-hidden>
        <i className="cmp__grip">
          <b>‹</b>
          <b>›</b>
        </i>
      </span>
    </div>
  );
}
