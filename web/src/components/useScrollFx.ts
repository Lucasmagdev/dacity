import { useEffect, type RefObject } from "react";

/**
 * Scroll effects for the landing, no libraries:
 *  - `[data-fx]`        gets `.is-in` once it enters the viewport (CSS does the animation).
 *  - `[data-fx-hero]`   gets `--hp` = 0..1 as the hero scrolls away (parallax / zoom out).
 *  - `[data-parallax]`  gets `--py` = -1..1 = its position through the viewport (inner parallax).
 *  - the root gets `--sp` = 0..1 page progress (top progress bar).
 *
 * Elements are only hidden while `.fx-ready` is on the root, so the page stays fully visible
 * without JS. With prefers-reduced-motion everything is shown at once and nothing moves.
 */
export function useScrollFx(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const items = root.querySelectorAll<HTMLElement>("[data-fx]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }

    root.classList.add("fx-ready");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));

    const hero = root.querySelector<HTMLElement>("[data-fx-hero]");
    const parallax = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]"));
    let raf = 0;

    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - vh;
      root.style.setProperty("--sp", (max > 0 ? Math.min(1, y / max) : 0).toFixed(4));

      if (hero) {
        const hp = Math.min(1, Math.max(0, y / hero.offsetHeight));
        hero.style.setProperty("--hp", hp.toFixed(4));
      }

      for (const el of parallax) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue; // off screen: skip the write
        const p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        el.style.setProperty("--py", Math.max(-1, Math.min(1, p)).toFixed(4));
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.classList.remove("fx-ready");
    };
  }, [ref]);
}
