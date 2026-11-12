import { memo, useMemo, useState } from "react";

/**
 * Hero key art. A looping web/public/hero/keyart.mp4 wins (skipped for reduced motion);
 * otherwise the images below are tried in order; if none loads, the procedural city shows.
 */
const KEYART_VIDEO = "/hero/keyart.mp4";
const KEYART_POSTER = "/hero/keyart-poster.jpg";
const KEYART_VIDEO_SPEED = 0.4; // 1 = normal, menor = mais lento
const KEYART_SOURCES = ["/hero/keyart.webp", "/hero/keyart.jpg", "/hero/keyart1.svg"];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function KeyArt() {
  const [videoFailed, setVideoFailed] = useState(prefersReducedMotion);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  if (!videoFailed) {
    return (
      <video
        className={`keyart${loaded ? " keyart--on" : ""}`}
        src={KEYART_VIDEO}
        poster={KEYART_POSTER}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        onLoadedMetadata={(e) => {
          e.currentTarget.defaultPlaybackRate = KEYART_VIDEO_SPEED;
          e.currentTarget.playbackRate = KEYART_VIDEO_SPEED;
        }}
        onLoadedData={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setVideoFailed(true);
        }}
      />
    );
  }

  if (index >= KEYART_SOURCES.length) return null;
  return (
    <img
      key={index}
      className={`keyart${loaded ? " keyart--on" : ""}`}
      src={KEYART_SOURCES[index]}
      alt=""
      onLoad={() => setLoaded(true)}
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

/** Deterministic PRNG so the skyline is identical on every render. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Win = { x: number; y: number; c: string };
type Building = { x: number; w: number; h: number; windows: Win[]; antenna: number };

const VIEW_W = 1600;
const VIEW_H = 360;

function buildCity(seed: number, minH: number, maxH: number, density: number, palette: string[]): Building[] {
  const rnd = mulberry32(seed);
  const out: Building[] = [];
  let x = -20;
  while (x < VIEW_W + 20) {
    const w = 34 + rnd() * 72;
    // Lower in the middle so the sun shows through, taller towards the edges.
    const fromCenter = Math.abs(x + w / 2 - VIEW_W / 2) / (VIEW_W / 2);
    const h = (minH + rnd() * (maxH - minH)) * Math.min(1, 0.42 + fromCenter * 0.85);
    const top = VIEW_H - h;
    const windows: Win[] = [];
    for (let wy = top + 10; wy < VIEW_H - 10; wy += 12) {
      for (let wx = x + 6; wx < x + w - 8; wx += 9) {
        if (rnd() < density) windows.push({ x: wx, y: wy, c: palette[Math.floor(rnd() * palette.length)] });
      }
    }
    out.push({ x, w, h, windows, antenna: rnd() < 0.22 ? 12 + rnd() * 30 : 0 });
    x += w + rnd() * 6 - 2;
  }
  return out;
}

function Skyline({ seed, minH, maxH, density, palette, className }: {
  seed: number;
  minH: number;
  maxH: number;
  density: number;
  palette: string[];
  className: string;
}) {
  const city = useMemo(() => buildCity(seed, minH, maxH, density, palette), [seed, minH, maxH, density, palette]);
  return (
    <svg className={className} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax slice" aria-hidden>
      {city.map((b, i) => (
        <g key={i}>
          {b.antenna > 0 && (
            <rect x={b.x + b.w / 2 - 1} y={VIEW_H - b.h - b.antenna} width={2} height={b.antenna} className="skyline__body" />
          )}
          <rect x={b.x} y={VIEW_H - b.h} width={b.w} height={b.h} className="skyline__body" />
          {b.windows.map((w, j) => (
            <rect key={j} x={w.x} y={w.y} width={4} height={6} fill={w.c} />
          ))}
        </g>
      ))}
    </svg>
  );
}

const BACK_PALETTE = ["#7a2a8f", "#93306f", "#5b2a8a"];
const FRONT_PALETTE = ["#ff4fa0", "#ffb35c", "#5ff0ff", "#ffe38a", "#ff4fa0"];

function Palm({ className }: { className: string }) {
  const fronds = [-88, -55, -25, 5, 32];
  const leaf =
    "M0,0 C30,-28 90,-40 160,-6 C140,-9 128,0 116,7 C104,-1 92,1 80,9 C68,1 55,3 44,10 C32,3 16,2 0,0 Z";
  return (
    <svg className={className} viewBox="0 0 400 800" aria-hidden>
      <path d="M190 800 C 196 620, 222 420, 208 205 L 224 205 C 240 420, 214 620, 214 800 Z" />
      <g className="palm__crown">
      <g transform="translate(216 200)">
        {fronds.map((a) => (
          <path key={`r${a}`} d={leaf} transform={`rotate(${a}) scale(1.25)`} />
        ))}
        {fronds.map((a) => (
          <path key={`l${a}`} d={leaf} transform={`scale(-1 1) rotate(${a}) scale(1.15)`} />
        ))}
        <circle r="14" />
      </g>
      </g>
    </svg>
  );
}

function Stars() {
  const stars = useMemo(() => {
    const rnd = mulberry32(7);
    return Array.from({ length: 70 }, () => ({ x: rnd() * 100, y: rnd() * 42, r: rnd() * 1.4 + 0.3, o: rnd() * 0.7 + 0.2 }));
  }, []);
  return (
    <svg className="stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r / 10} fill="#fff" opacity={s.o} />
      ))}
    </svg>
  );
}

/** Synthwave sunset city: sky, sun, two skyline layers, neon grid floor, palms and CRT overlays. */
function Scene({ dim = false, keyart = false }: { dim?: boolean; keyart?: boolean }) {
  return (
    <div className={`scene${dim ? " scene--dim" : ""}`} aria-hidden>
      <div className="sky" />
      {keyart && <KeyArt />}
      <Stars />
      <div className="sun-wrap">
        <div className="sun-glow" />
        <div className="sun" />
      </div>
      <div className="city">
        <Skyline className="skyline skyline--back" seed={11} minH={120} maxH={330} density={0.12} palette={BACK_PALETTE} />
        <Skyline className="skyline skyline--front" seed={42} minH={60} maxH={230} density={0.2} palette={FRONT_PALETTE} />
      </div>
      <div className="horizon-line" />
      <div className="ground">
        <div className="grid" />
        <span className="trail trail--pink" />
        <span className="trail trail--white" />
        <span className="trail trail--cyan" />
      </div>
      <Palm className="palm palm--left" />
      <Palm className="palm palm--left-back" />
      <Palm className="palm palm--right" />
      <div className="haze" />
      <div className="scanlines" />
      <div className="vignette" />
    </div>
  );
}

export default memo(Scene);
