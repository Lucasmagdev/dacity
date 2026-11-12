import { useId, useState } from "react";
import type { Protagonist } from "../config/game";

const INK = "#1a0a24";

/**
 * MOCK portrait art (flat cel-shaded SVG) following the B0/B1/B2 briefs in art/leonardo-prompts.md.
 * Shown until the real render exists at `protagonist.image`.
 */
function MockPortrait({ variant, accent }: { variant: Protagonist["variant"]; accent: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 250" className="silhouette" preserveAspectRatio="xMidYMin slice" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          {variant === "nina" ? (
            <>
              <stop offset="0" stopColor="#2a0f4a" />
              <stop offset=".5" stopColor="#b0207a" />
              <stop offset=".78" stopColor="#ff8a3d" />
              <stop offset="1" stopColor="#ffd36b" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#06091a" />
              <stop offset=".6" stopColor="#10264a" />
              <stop offset="1" stopColor="#1b0f33" />
            </>
          )}
        </linearGradient>
        <radialGradient id={`${uid}-key`} cx={variant === "nina" ? "30%" : "20%"} cy="45%" r="60%">
          <stop offset="0" stopColor="#ff8a3d" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-lens`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bff8ff" />
          <stop offset=".45" stopColor="#22e4ff" />
          <stop offset="1" stopColor="#0a5a8a" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="200" height="250" fill={`url(#${uid}-sky)`} />
      {variant === "nina" ? <RooftopBg /> : <GarageBg uid={uid} />}
      <rect width="200" height="250" fill={`url(#${uid}-key)`} />

      {variant === "nina" ? <Nina uid={uid} accent={accent} /> : <Rico uid={uid} accent={accent} />}
    </svg>
  );
}

function RooftopBg() {
  return (
    <g>
      <circle cx="150" cy="150" r="46" fill="#ffd36b" opacity=".55" />
      <g fill="#3a0f4a" opacity=".85">
        <rect x="0" y="150" width="22" height="100" />
        <rect x="24" y="128" width="18" height="122" />
        <rect x="44" y="160" width="26" height="90" />
        <rect x="134" y="140" width="20" height="110" />
        <rect x="156" y="118" width="16" height="132" />
        <rect x="174" y="152" width="26" height="98" />
      </g>
      <g fill="#ff6ab0" opacity=".9">
        {[
          [28, 140],
          [34, 160],
          [160, 130],
          [166, 150],
          [138, 156],
          [6, 170],
          [180, 168],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" />
        ))}
      </g>
      <path d="M0 214 H200" stroke="#2a0f4a" strokeWidth="3" opacity=".6" />
    </g>
  );
}

function GarageBg({ uid }: { uid: string }) {
  return (
    <g>
      <g stroke="#22e4ff" strokeWidth="3" strokeLinecap="round" filter={`url(#${uid}-glow)`}>
        <path d="M14 26 H86" />
        <path d="M114 26 H186" />
        <path d="M30 42 H70" opacity=".6" />
      </g>
      <g fill="#0b1630">
        <rect x="0" y="60" width="16" height="190" />
        <rect x="184" y="60" width="16" height="190" />
      </g>
      <path d="M0 236 C40 214 160 214 200 236 V250 H0 Z" fill="#8a1530" />
      <path d="M10 232 C50 216 150 216 190 232" stroke="#ffd6e6" strokeWidth="2" fill="none" opacity=".7" />
    </g>
  );
}

function Nina({ uid, accent }: { uid: string; accent: string }) {
  const skin = "#c98b62";
  const hair = "#0d0a12";
  const ink = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <g>
      {/* hair back (asymmetric bob: longer on her right) */}
      <path d="M50 160 C40 80 70 44 102 44 C136 44 160 78 150 140 L146 152 Q130 160 122 146 L80 146 Q66 170 50 160 Z" fill={hair} {...ink} />
      {/* blazer */}
      <path d="M12 250 C16 202 50 180 100 178 C150 180 184 202 188 250 Z" fill="#efe3cf" {...ink} />
      <path d="M78 182 L100 232 L122 182 Z" fill="#111" {...ink} />
      <path d="M78 182 L92 228 L66 214 L72 190 Z" fill="#e0cfb2" {...ink} />
      <path d="M122 182 L108 228 L134 214 L128 190 Z" fill="#e0cfb2" {...ink} />
      {/* neck */}
      <path d="M88 140 h24 v44 Q100 192 88 184 Z" fill={skin} {...ink} />
      <path d="M88 160 Q100 168 112 160" fill="none" stroke="#9a5f3e" strokeWidth="3" />
      {/* face */}
      <ellipse cx="100" cy="108" rx="34" ry="42" fill={skin} {...ink} />
      {/* fringe + pink streak */}
      <path d="M64 108 C60 70 84 54 106 54 C132 54 146 72 138 98 C124 78 104 74 92 84 C82 94 72 100 64 108 Z" fill={hair} {...ink} />
      <path d="M100 58 C90 68 80 86 70 102" stroke={accent} strokeWidth="6" fill="none" strokeLinecap="round" filter={`url(#${uid}-glow)`} />
      {/* brows */}
      <path d="M74 98 Q84 92 94 97 M108 97 Q118 92 128 96" fill="none" {...ink} strokeWidth="3" />
      {/* eyes */}
      <ellipse cx="84" cy="108" rx="4.5" ry="3.5" fill={INK} />
      <ellipse cx="117" cy="108" rx="4.5" ry="3.5" fill={INK} />
      {/* gold cat-eye glasses */}
      <g fill="#fff" fillOpacity=".08" stroke="#ffd36b" strokeWidth="2.6" strokeLinejoin="round">
        <path d="M68 104 Q82 98 96 103 Q95 116 83 116 Q71 115 68 104 Z" />
        <path d="M104 103 Q118 98 132 104 Q129 115 117 116 Q105 116 104 103 Z" />
        <path d="M68 104 L62 97 M132 104 L138 97 M96 104 Q100 101 104 104" fill="none" />
      </g>
      {/* nose + smirk */}
      <path d="M100 112 Q97 122 102 124" fill="none" stroke="#8a5234" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M88 133 Q102 138 115 128 Q104 142 88 133 Z" fill="#b8325a" {...ink} strokeWidth="2" />
      <circle cx="66" cy="132" r="4" fill="none" stroke="#ffd36b" strokeWidth="2" />
      {/* ledger + hand with pen */}
      <g transform="rotate(-12 150 220)">
        <rect x="124" y="190" width="52" height="64" rx="4" fill="#5a2e1a" {...ink} />
        <rect x="128" y="194" width="44" height="56" rx="2" fill="none" stroke="#ffd36b" strokeWidth="1.5" opacity=".7" />
        <path d="M166 190 v64" stroke="#3a1c10" strokeWidth="3" />
      </g>
      <path d="M58 226 L82 196" stroke="#ffd36b" strokeWidth="3" strokeLinecap="round" />
      <circle cx="58" cy="228" r="9" fill={skin} {...ink} />
      <path d="M50 236 q8 4 16 0" fill="none" stroke="#ffd36b" strokeWidth="3" />
      {/* hot-pink rim light */}
      <path d="M150 140 C160 80 136 44 102 44" fill="none" stroke={accent} strokeWidth="3" opacity=".85" filter={`url(#${uid}-glow)`} />
      <path d="M186 250 C184 214 166 194 140 186" fill="none" stroke={accent} strokeWidth="3" opacity=".7" filter={`url(#${uid}-glow)`} />
    </g>
  );
}

function Rico({ uid, accent }: { uid: string; accent: string }) {
  const skin = "#6b4128";
  const hair = "#120a06";
  const ink = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <g>
      {/* racing jacket */}
      <path d="M8 250 C12 200 50 178 100 176 C150 178 188 200 192 250 Z" fill="#f2f2f2" {...ink} />
      <path d="M14 226 C60 212 140 212 186 226 L188 238 C140 224 60 224 12 238 Z" fill="#22e4ff" stroke="none" />
      <path d="M12 238 C60 224 140 224 188 238 L190 246 C140 234 60 234 10 246 Z" fill="#ff2e88" stroke="none" />
      <path d="M80 178 Q100 198 120 178 L120 250 L80 250 Z" fill="#111" {...ink} />
      <path d="M80 178 L72 196 L88 204 Z M120 178 L128 196 L112 204 Z" fill="#e6e6e6" {...ink} />
      {/* neck */}
      <path d="M86 140 h28 v40 Q100 188 86 180 Z" fill={skin} {...ink} />
      {/* ears + head */}
      <circle cx="64" cy="112" r="8" fill={skin} {...ink} />
      <circle cx="136" cy="112" r="8" fill={skin} {...ink} />
      <ellipse cx="100" cy="108" rx="36" ry="43" fill={skin} {...ink} />
      {/* tight fade + shaved line */}
      <path d="M64 100 C60 62 82 52 102 52 C124 52 142 64 136 100 C128 82 114 76 100 76 C86 76 72 82 64 100 Z" fill={hair} {...ink} />
      <path d="M66 98 C68 88 72 84 76 82" stroke={hair} strokeWidth="6" opacity=".45" fill="none" />
      <path d="M80 66 L96 60" stroke={skin} strokeWidth="2.2" strokeLinecap="round" />
      {/* aviators pushed up */}
      <g stroke={INK} strokeWidth="2" strokeLinejoin="round">
        <path d="M70 64 Q84 58 96 62 Q96 76 84 78 Q72 76 70 64 Z" fill={`url(#${uid}-lens)`} />
        <path d="M104 62 Q116 58 130 64 Q128 76 116 78 Q104 76 104 62 Z" fill={`url(#${uid}-lens)`} />
        <path d="M96 63 Q100 60 104 63" fill="none" stroke="#c0c0c0" />
      </g>
      <path d="M76 64 l6 6 M110 64 l6 6" stroke="#fff" strokeWidth="2" opacity=".8" />
      {/* brows (one raised) + eyes */}
      <path d="M74 98 Q84 92 94 98 M108 94 Q118 88 128 94" fill="none" {...ink} strokeWidth="3.5" />
      <ellipse cx="85" cy="108" rx="4.5" ry="4" fill={INK} />
      <ellipse cx="116" cy="107" rx="4.5" ry="4" fill={INK} />
      <circle cx="86.5" cy="106.5" r="1.4" fill="#fff" />
      <circle cx="117.5" cy="105.5" r="1.4" fill="#fff" />
      {/* nose, mustache, grin, goatee */}
      <path d="M96 114 Q94 122 100 123 Q106 122 105 116" fill="none" stroke="#3e2414" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M86 130 Q100 123 115 129 Q100 131 86 130 Z" fill={hair} {...ink} strokeWidth="1.5" />
      <path d="M88 133 Q101 144 114 132 Z" fill="#fff" {...ink} strokeWidth="2" />
      <path d="M93 145 Q100 154 107 145 Q100 148 93 145 Z" fill={hair} {...ink} strokeWidth="1.5" />
      {/* gloved hand + spinning keys */}
      <g>
        <circle cx="44" cy="186" r="9" fill="none" stroke="#d6d6de" strokeWidth="2.5" />
        <rect x="30" y="172" width="8" height="18" rx="2" fill="#d6d6de" transform="rotate(-30 34 181)" {...ink} strokeWidth="1.5" />
        <rect x="48" y="166" width="12" height="16" rx="3" fill="#1b1b22" transform="rotate(20 54 174)" {...ink} strokeWidth="1.5" />
        <path d="M30 218 Q28 196 44 194 Q56 196 56 214 Z" fill="#141418" {...ink} />
        <path d="M44 194 v-8" stroke={skin} strokeWidth="6" strokeLinecap="round" />
      </g>
      {/* cyan rim light */}
      <path d="M64 100 C58 62 82 50 102 52" fill="none" stroke={accent} strokeWidth="3" opacity=".9" filter={`url(#${uid}-glow)`} />
      <path d="M8 250 C10 214 30 194 62 184" fill="none" stroke={accent} strokeWidth="3" opacity=".75" filter={`url(#${uid}-glow)`} />
    </g>
  );
}

export default function Portrait({ protagonist }: { protagonist: Protagonist }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <MockPortrait variant={protagonist.variant} accent={protagonist.accent} />;
  return <img className="portrait-img" src={protagonist.image} alt={protagonist.name} onError={() => setFailed(true)} />;
}
