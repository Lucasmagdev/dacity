import { useId, useState } from "react";
import { RARITIES } from "../../config/game";
import { archetypeOf, type Archetype } from "../../mock";

const INK = "#1a0a24";

/**
 * Chibi vinyl-toy gangster. MOCK art: drawn in SVG from the archetype + rarity until the real
 * renders exist at /gangsters/<archetype-slug>-<rarity>.webp (see art/leonardo-prompts.md, section E).
 */
export default function GangsterToy({
  gangsterId,
  rarity,
  bare = false,
  animate = false,
}: {
  gangsterId: number;
  rarity: number;
  /** No background card (for the landing lineup). */
  bare?: boolean;
  animate?: boolean;
}) {
  const a = archetypeOf(gangsterId);
  const [failed, setFailed] = useState(false);
  const src = `/gangsters/${slug(a.title)}-${RARITIES[rarity].name.toLowerCase()}.webp`;

  if (!failed && !bare) {
    return <img className="toy toy--img" src={src} alt={`${a.title} (${RARITIES[rarity].name})`} onError={() => setFailed(true)} />;
  }
  return <ToySvg a={a} rarity={rarity} bare={bare} animate={animate} />;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function ToySvg({ a, rarity, bare, animate }: { a: Archetype; rarity: number; bare: boolean; animate: boolean }) {
  const uid = useId().replace(/:/g, "");
  const rc = RARITIES[rarity].color;
  const legendary = rarity === 4;
  const chain = a.chain || legendary;

  return (
    <svg viewBox="0 0 200 240" className={`toy${animate ? " toy--animate" : ""}`} aria-hidden>
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="62%" r="70%">
          <stop offset="0" stopColor={rc} stopOpacity={rarity === 0 ? 0.25 : 0.55} />
          <stop offset=".55" stopColor="#1a0b2e" />
          <stop offset="1" stopColor="#09050f" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset=".5" stopColor="#ffc533" />
          <stop offset="1" stopColor="#b8780c" />
        </linearGradient>
      </defs>

      {!bare && <rect width="200" height="240" rx="18" fill={`url(#${uid}-bg)`} />}

      {/* rarity aura */}
      {rarity >= 2 && (
        <ellipse cx="100" cy="130" rx="76" ry="86" fill={rc} opacity={0.08 + rarity * 0.04} filter={`url(#${uid}-glow)`} />
      )}
      {legendary && <Rays color={rc} />}

      <g className="toy__fig">
        {/* pedestal */}
        <ellipse cx="100" cy="224" rx="56" ry="10" fill="#0d0716" />
        <rect x="44" y="212" width="112" height="12" fill="#1a1028" />
        <ellipse cx="100" cy="212" rx="56" ry="10" fill="#2c1b44" stroke={rc} strokeWidth="2" filter={rarity > 0 ? `url(#${uid}-glow)` : undefined} />

        <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
          {/* legs + shoes */}
          <rect x="79" y="176" width="16" height="30" rx="6" fill={a.pants} />
          <rect x="105" y="176" width="16" height="30" rx="6" fill={a.pants} />
          <ellipse cx="85" cy="207" rx="13" ry="6" fill="#121018" />
          <ellipse cx="115" cy="207" rx="13" ry="6" fill="#121018" />

          {a.prop === "cue" && <line x1="36" y1="214" x2="156" y2="104" stroke="#c9a26b" strokeWidth="5" />}

          {/* arms (behind torso) */}
          <path d="M72 142 Q56 160 60 178" fill="none" stroke={a.outfit} strokeWidth="14" />
          <path d="M128 142 Q146 158 142 174" fill="none" stroke={a.outfit} strokeWidth="14" />
          <path d="M72 142 Q56 160 60 178" fill="none" strokeWidth="2" opacity=".6" />

          {/* torso */}
          <path d="M64 186 C62 150 76 128 100 128 C124 128 138 150 136 186 Q100 194 64 186 Z" fill={a.outfit} />
          <Trim a={a} />
          {chain && (
            <g stroke="none">
              <path d="M80 132 Q100 162 120 132" fill="none" stroke={`url(#${uid}-gold)`} strokeWidth="4.5" />
              <circle cx="100" cy="153" r="6" fill={`url(#${uid}-gold)`} stroke={INK} strokeWidth="1.5" />
            </g>
          )}

          {/* hands */}
          <circle cx="60" cy="180" r="7.5" fill={a.skin} />
          <circle cx="142" cy="176" r="7.5" fill={a.skin} />

          {/* head */}
          <circle cx="56" cy="92" r="7" fill={a.skin} />
          <circle cx="144" cy="92" r="7" fill={a.skin} />
          <circle cx="100" cy="88" r="44" fill={a.skin} />
          {a.hair === "none" && <path d="M76 58 Q86 50 98 50" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="4" />}
        </g>

        <Hair a={a} />
        <Face a={a} uid={uid} />
        <Headwear a={a} />
        <PropArt a={a} uid={uid} />
      </g>

      {rarity === 2 && <Sparkles color={rc} />}
      {rarity === 3 && <Particles color={rc} />}
      {legendary && <Coins uid={uid} />}
    </svg>
  );
}

function Trim({ a }: { a: Archetype }) {
  // collar V + side racing stripes; tuned per prop for a bit of variety
  return (
    <g fill="none" stroke={a.outfitTrim} strokeWidth="4">
      <path d="M88 131 L100 150 L112 131" />
      {(a.prop === "wheel" || a.prop === "bag") && (
        <>
          <path d="M76 140 L72 184" />
          <path d="M124 140 L128 184" />
        </>
      )}
      {a.prop === "cards" && <path d="M96 150 L104 150 M100 146 L100 154" strokeWidth="5" />}
      {a.prop === "wrench" && <rect x="90" y="160" width="20" height="14" rx="3" strokeWidth="3" />}
    </g>
  );
}

function Hair({ a }: { a: Archetype }) {
  const c = a.hairColor;
  const s = { fill: c, stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const };
  switch (a.hair) {
    case "short":
    case "slick":
      return (
        <g>
          <path d="M58 84 C55 52 78 40 100 40 C124 40 147 54 142 84 C134 70 120 62 100 64 C80 62 66 70 58 84 Z" {...s} />
          {a.hair === "slick" && <path d="M80 50 Q100 44 122 52" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" />}
        </g>
      );
    case "silver":
      return (
        <g>
          <path d="M58 88 C54 56 78 42 100 42 C124 42 148 56 142 88 C136 74 120 64 100 66 C80 64 64 74 58 88 Z" {...s} />
          <path d="M86 108 Q100 102 114 108 Q108 114 100 110 Q92 114 86 108 Z" {...s} />
        </g>
      );
    case "bun":
      return (
        <g>
          <circle cx="100" cy="40" r="14" {...s} />
          <path d="M58 84 C55 52 78 40 100 40 C124 40 147 54 142 84 C130 66 112 60 92 66 L84 76 L80 66 C70 70 62 76 58 84 Z" {...s} />
        </g>
      );
    case "mohawk":
      return <path d="M88 64 C86 38 94 20 100 14 C106 20 114 38 112 64 Q100 58 88 64 Z" {...s} />;
    case "curly":
      return (
        <g {...s}>
          {[
            [64, 70, 12],
            [72, 54, 13],
            [88, 44, 13],
            [106, 42, 13],
            [124, 50, 13],
            [136, 66, 12],
          ].map(([cx, cy, r]) => (
            <circle key={cx} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

function Face({ a, uid }: { a: Archetype; uid: string }) {
  return (
    <g>
      <ellipse cx="76" cy="106" rx="6" ry="3" fill="#ff6b8a" opacity=".35" />
      <ellipse cx="124" cy="106" rx="6" ry="3" fill="#ff6b8a" opacity=".35" />
      {a.visor ? (
        <rect x="64" y="84" width="72" height="18" rx="9" fill={a.outfitTrim} opacity=".9" stroke={INK} strokeWidth="2.5" filter={`url(#${uid}-glow)`} />
      ) : a.shades ? (
        <g stroke={INK} strokeWidth="2.5">
          <rect x="70" y="86" width="26" height="15" rx="6" fill="#0b0b14" />
          <rect x="104" y="86" width="26" height="15" rx="6" fill="#0b0b14" />
          <path d="M96 92 h8" />
          <path d="M74 90 l8 0" stroke={a.outfitTrim} strokeWidth="2" />
          <path d="M108 90 l8 0" stroke={a.outfitTrim} strokeWidth="2" />
        </g>
      ) : (
        <g>
          <path d="M76 82 l14 2 M110 84 l14 -2" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="84" cy="95" rx="5" ry="6.5" fill={INK} />
          <ellipse cx="116" cy="95" rx="5" ry="6.5" fill={INK} />
          <circle cx="86" cy="92" r="1.8" fill="#fff" />
          <circle cx="118" cy="92" r="1.8" fill="#fff" />
        </g>
      )}
      {a.hair !== "silver" && <path d="M92 113 Q101 118 109 111" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />}
    </g>
  );
}

function Headwear({ a }: { a: Archetype }) {
  const ink = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const };
  switch (a.headwear) {
    case "cap":
      return (
        <g {...ink}>
          <path d="M58 80 C56 46 78 38 100 38 C124 38 144 48 142 80 Z" fill={a.outfitTrim} />
          <path d="M60 78 Q42 80 34 90 Q58 92 80 82 Z" fill={a.outfitTrim} />
          <circle cx="100" cy="40" r="4" fill={a.outfit} />
        </g>
      );
    case "fedora":
      return (
        <g {...ink}>
          <ellipse cx="100" cy="60" rx="58" ry="10" fill={a.outfit} />
          <path d="M66 60 C66 32 80 26 100 26 C120 26 134 32 134 60 Z" fill={a.outfit} />
          <path d="M66 50 h68 v8 h-68 z" fill={a.outfitTrim} />
          <path d="M92 28 Q100 36 108 28" fill="none" />
        </g>
      );
    case "captain":
      return (
        <g {...ink}>
          <path d="M60 66 C58 44 78 38 100 38 C122 38 142 44 140 66 Z" fill="#f4f4f4" />
          <rect x="60" y="60" width="80" height="10" fill="#141414" />
          <path d="M66 70 Q100 82 134 70 Z" fill="#141414" />
          <circle cx="100" cy="52" r="5" fill="#ffd36b" />
        </g>
      );
    case "hood":
      return (
        <g {...ink}>
          <path d="M48 116 C40 56 70 28 100 28 C130 28 160 56 152 116 C148 90 130 68 100 68 C70 68 52 90 48 116 Z" fill={a.outfit} />
          <path d="M80 70 Q90 64 100 70" fill="none" stroke={a.hairColor} strokeWidth="5" />
        </g>
      );
    case "beanie":
      return (
        <g {...ink}>
          <path d="M58 74 C58 42 80 34 100 34 C120 34 142 42 142 74 Z" fill={a.outfitTrim} />
          <rect x="55" y="66" width="90" height="13" rx="6" fill={a.outfit} />
          <circle cx="100" cy="32" r="8" fill={a.outfitTrim} />
        </g>
      );
    case "bandana":
      return (
        <g {...ink}>
          <path d="M58 74 C58 46 80 40 100 40 C120 40 142 46 142 74 Q100 64 58 74 Z" fill={a.outfitTrim} />
          <path d="M140 68 l18 -8 l-6 14 l10 8 l-20 -4 Z" fill={a.outfitTrim} />
          <circle cx="84" cy="56" r="2" fill="#fff" stroke="none" />
          <circle cx="112" cy="54" r="2" fill="#fff" stroke="none" />
        </g>
      );
    default:
      return null;
  }
}

function PropArt({ a, uid }: { a: Archetype; uid: string }) {
  const ink = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (a.prop) {
    case "wheel":
      return (
        <g {...ink} fill="none">
          <circle cx="150" cy="168" r="16" stroke="#222" strokeWidth="6" />
          <circle cx="150" cy="168" r="16" stroke={a.outfitTrim} strokeWidth="1.5" />
          <path d="M150 168 v14 M150 168 l-13 -6 M150 168 l13 -6" stroke="#222" strokeWidth="4" />
          <circle cx="142" cy="176" r="7.5" fill={a.skin} />
        </g>
      );
    case "earpiece":
      return (
        <g {...ink}>
          <circle cx="146" cy="98" r="4" fill="#222" />
          <path d="M146 102 q5 10 -1 20 q-6 10 1 18" fill="none" stroke="#ccc" strokeWidth="1.5" />
          <rect x="62" y="150" width="76" height="16" rx="8" fill={a.outfit} />
          <circle cx="68" cy="158" r="7" fill={a.skin} />
          <circle cx="132" cy="158" r="7" fill={a.skin} />
        </g>
      );
    case "laptop":
      return (
        <g {...ink}>
          <rect x="70" y="140" width="60" height="36" rx="4" fill="#cfd2dc" />
          <circle cx="100" cy="158" r="6" fill={a.outfitTrim} stroke="none" filter={`url(#${uid}-glow)`} />
          <rect x="64" y="174" width="72" height="6" rx="3" fill="#8d90a0" />
          <circle cx="66" cy="172" r="7" fill={a.skin} />
          <circle cx="134" cy="172" r="7" fill={a.skin} />
        </g>
      );
    case "crate":
      return (
        <g {...ink}>
          <rect x="68" y="148" width="64" height="40" rx="2" fill="#a0622d" />
          <path d="M68 161 h64 M68 175 h64 M74 148 l52 40" fill="none" stroke="#5e3511" />
          <circle cx="64" cy="166" r="7.5" fill={a.skin} />
          <circle cx="136" cy="166" r="7.5" fill={a.skin} />
        </g>
      );
    case "cards":
      return (
        <g {...ink} strokeWidth="1.8">
          {[-24, 0, 24].map((r) => (
            <g key={r} transform={`rotate(${r} 146 178)`}>
              <rect x="139" y="150" width="15" height="22" rx="2" fill="#fff" />
              <circle cx="146.5" cy="161" r="3" fill={r === 0 ? "#e8204f" : "#141014"} stroke="none" />
            </g>
          ))}
          <circle cx="142" cy="176" r="7.5" fill={a.skin} strokeWidth="2.5" />
        </g>
      );
    case "cash":
      return (
        <g {...ink}>
          <rect x="76" y="170" width="48" height="15" rx="7" fill="#1d1d24" />
          <rect x="84" y="162" width="14" height="10" fill="#4fbf6a" strokeWidth="1.5" />
          <rect x="100" y="160" width="14" height="12" fill="#4fbf6a" strokeWidth="1.5" />
          <rect x="140" y="156" width="22" height="12" fill="#4fbf6a" transform="rotate(-20 150 162)" strokeWidth="1.5" />
          <circle cx="142" cy="176" r="7.5" fill={a.skin} />
        </g>
      );
    case "bat":
      return (
        <g {...ink}>
          <path d="M144 176 L170 98" stroke="#b07840" strokeWidth="8" />
          <path d="M162 122 L172 92" stroke="#b07840" strokeWidth="13" />
          <circle cx="142" cy="176" r="7.5" fill={a.skin} />
        </g>
      );
    case "loupe":
      return (
        <g {...ink}>
          <circle cx="116" cy="95" r="11" fill="#bfe8ff" fillOpacity=".45" stroke="#222" strokeWidth="3.5" />
          <rect x="138" y="160" width="26" height="13" fill="#4fbf6a" strokeWidth="1.5" />
          <rect x="136" y="166" width="26" height="13" fill="#5fd27b" strokeWidth="1.5" />
          <circle cx="142" cy="176" r="7.5" fill={a.skin} />
        </g>
      );
    case "wrench":
      return (
        <g {...ink}>
          <path d="M144 176 L158 128" stroke="#b9bfcc" strokeWidth="7" />
          <path d="M150 124 a10 10 0 1 1 16 6 l-6 -6 z" fill="#b9bfcc" />
          <circle cx="142" cy="176" r="7.5" fill={a.skin} />
        </g>
      );
    case "cue":
      return (
        <g {...ink}>
          <circle cx="156" cy="104" r="3" fill="#2fb4ff" stroke="none" />
          <circle cx="142" cy="176" r="7.5" fill={a.skin} />
          <path d="M108 104 l10 -2" stroke="#e8d0a8" strokeWidth="3" />
        </g>
      );
    case "bag":
      return (
        <g {...ink}>
          <path d="M80 132 L146 164" fill="none" stroke="#111" strokeWidth="4" />
          <rect x="134" y="158" width="28" height="28" rx="7" fill="#0f0f16" />
          <path d="M138 168 h20" stroke={a.outfitTrim} strokeWidth="2" />
          <circle cx="142" cy="176" r="7.5" fill={a.skin} />
        </g>
      );
    case "cane":
      return (
        <g {...ink}>
          <path d="M146 176 L146 210" stroke={`url(#${uid}-gold)`} strokeWidth="5" />
          <circle cx="146" cy="170" r="7" fill={`url(#${uid}-gold)`} />
          <circle cx="142" cy="176" r="7.5" fill={a.skin} />
        </g>
      );
  }
}

function Rays({ color }: { color: string }) {
  return (
    <g className="toy__rays" opacity=".35">
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M100 120 L94 0 L106 0 Z" fill={color} transform={`rotate(${i * 30} 100 120)`} />
      ))}
    </g>
  );
}

function Sparkles({ color }: { color: string }) {
  const pts = [
    [34, 60],
    [166, 50],
    [172, 150],
    [28, 160],
  ];
  return (
    <g fill={color} className="toy__twinkle">
      {pts.map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`} />
      ))}
    </g>
  );
}

function Particles({ color }: { color: string }) {
  return (
    <g fill={color} className="toy__float">
      {[
        [30, 70, 3],
        [44, 140, 2],
        [168, 64, 4],
        [160, 128, 2.5],
        [150, 36, 2],
        [52, 30, 2.5],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} opacity=".85" />
      ))}
    </g>
  );
}

function Coins({ uid }: { uid: string }) {
  return (
    <g className="toy__orbit">
      {[
        [28, 96],
        [172, 80],
        [160, 176],
        [40, 186],
      ].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="9" ry="9" fill={`url(#${uid}-gold)`} stroke="#8a5a00" strokeWidth="1.5" />
      ))}
    </g>
  );
}
