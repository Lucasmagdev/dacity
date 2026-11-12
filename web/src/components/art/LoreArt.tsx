/**
 * Storyline banner: the Dacity waterfront key art with a few subtle, looping touches on top.
 * Everything is positioned in % of the picture (16:9), and the whole stack drifts together
 * (slow Ken Burns), so the overlays stay locked to the details they light up.
 */
const TWINKLES: [number, number][] = [
  [43.4, 34],
  [45.2, 41.5],
  [44.2, 48],
  [62.2, 38.5],
  [66.4, 43],
  [36.2, 52.5],
  [24.4, 52],
  [67.8, 50],
];

export default function LoreArt() {
  return (
    <div className="lore__art" aria-hidden>
      <img className="lore__img" src="/story/dacity.png" alt="" draggable={false} />

      {/* sky: soft cloud drift + the sunset breathing at the horizon */}
      <span className="lore__cloud lore__cloud--a" />
      <span className="lore__cloud lore__cloud--b" />
      <span className="lore__sunglow" />

      {/* helicopter spotlight, plane strobe */}
      <span className="lore__beam" />
      <span className="lore__blink lore__blink--plane" />

      {/* skyline windows */}
      {TWINKLES.map(([x, y], i) => (
        <span key={i} className="lore__twinkle" style={{ left: `${x}%`, top: `${y}%`, "--d": `${(i * 0.7) % 3.2}s` } as React.CSSProperties} />
      ))}

      {/* OCEAN VIEW neon */}
      <span className="lore__neon" />

      {/* car tail lights + wet street shimmer */}
      <span className="lore__tail lore__tail--l" />
      <span className="lore__tail lore__tail--r" />
      <span className="lore__shimmer" />
    </div>
  );
}
