import { useRef } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import ConnectCTA from "./ConnectCTA";
import Countdown from "./Countdown";
import Portrait from "./Portrait";
import GangsterToy from "./art/GangsterToy";
import StepArt, { type StepKind } from "./art/StepArt";
import LoreArt from "./art/LoreArt";
import DropBox from "./art/DropBox";
import CompareSlider from "./CompareSlider";
import { archetypeOf } from "../mock";
import { BOX_PRICE_DC, DACITY_PER_USDC, PROTAGONISTS, RARITIES, SHOT_CHANCE_PER_DAY, SOCIALS, fmt, type Protagonist } from "../config/game";
import { TARGET_CHAIN } from "../chains";
import { useScrollFx } from "./useScrollFx";
import "../landing-fx.css";
import "../how.css";
import "../story.css";
import "../rarity.css";
import "../lineup.css";
import "../compare.css";

const STEPS: { kind: StepKind; title: string; text: string; chips: string[]; hot?: boolean }[] = [
  {
    kind: "deposit",
    title: "Deposit USDC",
    text: `The vault contract converts instantly: 1 USDC becomes ${DACITY_PER_USDC} Dacity Coin, straight to your wallet.`,
    chips: [`1 USDC = ${DACITY_PER_USDC} DC`, "Instant"],
  },
  {
    kind: "gang",
    title: "Found your gang",
    text: "Pick Lucia or Jason as your boss and register your gang's name on-chain.",
    chips: ["2 bosses", "Name on-chain"],
  },
  {
    kind: "boxes",
    title: "Open boxes",
    text: `Each box costs ${fmt(BOX_PRICE_DC)} DC and reveals a gangster from one of 5 rarities.`,
    chips: [`${fmt(BOX_PRICE_DC)} DC / box`, "5 rarities"],
    hot: true,
  },
  {
    kind: "farm",
    title: "Farm DC",
    text: "Every gangster earns Dacity Coin daily until they hit their career cap.",
    chips: ["Paid daily", "Up to career cap"],
  },
];

/** Which archetype represents each rarity on the landing lineup (Mechanic, Skater, Hacker, Dealer, Old Boss). */
const LINEUP_ARCHETYPE = [8, 5, 2, 4, 11];

/** Before / after pairs for the glow-up section. Photos live in /public/compare/<slug>-before.jpg and -after.jpg. */
const GLOW_UPS = [
  {
    slug: "iguana",
    name: "The Iguana",
    // the "before" shot is wide: keep the head and body in the square crop
    beforePosition: "24% 50%",
    beforeAlt: "A green iguana walking on foot across an empty asphalt road",
    afterAlt: "The same iguana in sunglasses and a gold chain, lounging on a purple muscle car at a Miami sunset",
  },
  {
    slug: "pinscher",
    name: "The Pinscher",
    beforePosition: "50% 50%",
    beforeAlt: "A thin miniature pinscher standing alone on a cracked sidewalk under a grey sky",
    afterAlt: "The same pinscher in sunglasses and a gold chain, driving a pastel teal convertible at a Miami sunset",
  },
  {
    slug: "flamingo",
    name: "The Flamingo",
    beforePosition: "50% 50%",
    beforeAlt: "A faded pink flamingo standing alone on a worn wooden dock on a grey day",
    afterAlt: "The same flamingo in gold sunglasses and a chain at the marble entrance of a bank, surrounded by briefcases of cash",
  },
] as const;

/** Lineup order, left -> right: Common, Uncommon, Rare, Epic, Legendary. */
const LINEUP_ORDER = [0, 1, 2, 3, 4];

function Teaser({ p, side }: { p: Protagonist; side: "left" | "right" }) {
  return (
    <figure className={`teaser teaser--${side}`} style={{ "--accent": p.accent } as React.CSSProperties}>
      <div className="teaser__art">
        <Portrait protagonist={p} />
      </div>
      <figcaption>
        <strong>{p.name}</strong>
        <span>{p.alias}</span>
      </figcaption>
    </figure>
  );
}

function SocialIcon({ icon }: { icon: (typeof SOCIALS)[number]["icon"] }) {
  const paths = {
    x: "M4 4l16 16M20 4L4 20",
    discord: "M7 7c3-1.3 7-1.3 10 0l1.5 9c-1.8 1.4-3.6 2-3.6 2l-.9-1.6M9 16.4L8.1 18S6.3 17.4 4.5 16L6 7m3.5 6.5h.01m5 0h.01",
    telegram: "M21 4L3 11l6 2m12-9l-4 16-8-7m12-9L9 13v6l3-4",
  } as const;
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[icon]} />
    </svg>
  );
}

export default function Landing({ onEnter }: { onEnter: () => void }) {
  const [nina, rico] = PROTAGONISTS;
  const socials = SOCIALS.filter((s) => s.url);
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollFx(pageRef);

  return (
    <div className="page" ref={pageRef}>
      <div className="fx-progress" aria-hidden />
      <Nav showChain={false} />

      {/* ------------------------------------------------------------ hero */}
      <section className="hero" data-fx-hero>
        <Scene keyart />
        <Teaser p={nina} side="left" />
        <Teaser p={rico} side="right" />

        <div className="hero__content">
          <h1 className="wordmark">Audacity</h1>
          <p className="script" aria-hidden>
            Game
          </p>
          <p className="hero__sub">
            Pick your boss, build your gang and put your gangsters to work across the whole city.
          </p>

          <ConnectCTA onEnter={onEnter} demoLink={false} />
          <Countdown />
        </div>

      </section>

      <main className="magenta">
        {/* ------------------------------------------------------------ how it works */}
        <section id="how-it-works" className="section section--wide">
          <header className="section__head" data-fx="head">
            <p className="eyebrow">How it works</p>
            <h2>From deposit to empire</h2>
          </header>
          <ol className="steps" data-fx="steps">
            {STEPS.map((s, i) => {
              const num = String(i + 1).padStart(2, "0");
              return (
                <li key={s.title} className={`step${s.hot ? " step--hot" : ""}`} style={{ "--i": i } as React.CSSProperties}>
                  <div className="step__node" aria-hidden>
                    <span className="step__badge">{num}</span>
                    <span className="step__trail" />
                  </div>
                  <div className="step__card">
                    {s.hot && <span className="step__tag">The hook</span>}
                    <div className="step__art">
                      <StepArt kind={s.kind} />
                    </div>
                    <span className="step__ghost" aria-hidden>
                      {num}
                    </span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    <ul className="step__chips">
                      {s.chips.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                      {s.hot && (
                        <li aria-label="rarity colors">
                          <span className="step__dots" aria-hidden>
                            {RARITIES.map((r) => (
                              <i key={r.id} style={{ "--c": r.color } as React.CSSProperties} />
                            ))}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ------------------------------------------------------------ story (zig-zag) */}
        {/* ------------------------------------------------------------ glow up (before / after slider) */}
        <section id="glow-up" className="section section--wide">
          <header className="section__head" data-fx="head">
            <p className="eyebrow">Glow up</p>
            <h2>Buy the Dacity Coin game</h2>
            <p className="section__lede">Same crew, new life. Hover or drag each photo to slide.</p>
          </header>
          <div className="cmp-grid">
            {GLOW_UPS.map((g, i) => (
              <figure key={g.name} className="cmp-frame" data-fx="pop" style={{ "--i": i } as React.CSSProperties}>
                <CompareSlider
                  before={`/compare/${g.slug}-before.jpg`}
                  after={`/compare/${g.slug}-after.jpg`}
                  beforeAlt={g.beforeAlt}
                  afterAlt={g.afterAlt}
                  beforePosition={g.beforePosition}
                  phase={i * 2.1}
                />
                <figcaption>{g.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="story" className="section section--wide">
          <header className="section__head" data-fx="head">
            <p className="eyebrow">Storyline</p>
            <h2>Welcome to Dacity</h2>
            <p className="section__lede">Two bosses, one city. Pick the one who takes the waterfront.</p>
          </header>

          <div className="lore" data-fx="lore">
            <div className="story__frame story__frame--city lore__frame">
              <LoreArt />
              <span className="lore__scan" aria-hidden />
            </div>
            <div className="lore__copy">
              <div>
                <p className="lore__kicker">The city</p>
                <p>
                  A neon coastal city where every block has an owner and every owner has a price. The old families are
                  slipping. Somebody new is going to take the waterfront.
                </p>
              </div>
              <ul className="pills">
                <li>Crime</li>
                <li>Strategy</li>
                <li>On-chain</li>
              </ul>
            </div>
          </div>

          <div className="duo">
            {[nina, rico].map((p, i) => (
              <article
                key={p.id}
                className={`char char--${p.variant}`}
                style={{ "--accent": p.accent, "--i": i } as React.CSSProperties}
                data-fx="char"
              >
                <div className="char__stage">
                  <div className="char__frame">
                    <div className="char__photo" data-parallax>
                      <Portrait protagonist={p} />
                    </div>
                    <span className="char__shade" aria-hidden />
                    <span className="char__scan" aria-hidden />
                    <span className="char__label">Boss {String(i + 1).padStart(2, "0")}</span>
                    <span className="char__ghost" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="char__name">
                      <span>{p.name}</span>
                      <em>{p.alias}</em>
                    </h3>
                  </div>
                </div>
                <div className="char__panel">
                  <p>{p.bio}</p>
                  <ul className="char__pills">
                    <li>{p.role}</li>
                    <li>Boss</li>
                  </ul>
                </div>
              </article>
            ))}
            <span className="duo__or" aria-hidden>
              OR
            </span>
          </div>
        </section>

        {/* ------------------------------------------------------------ rarities (slanted lineup) */}
        <section id="rarities" className="section section--wide">
          <header className="section__head" data-fx="head">
            <p className="eyebrow">Gangster Box</p>
            <h2>Who's in the box?</h2>
            <p className="section__lede">
              A box costs <b>{fmt(BOX_PRICE_DC)} DC</b> ({fmt(BOX_PRICE_DC / DACITY_PER_USDC)} USDC). The roll happens in
              the contract, and every gangster farms up to their career cap.
            </p>
          </header>
          <div className="drop" data-fx="drop">
            <DropBox />
            <div className="dodds">
              <div className="dodds__bar" aria-hidden>
                {RARITIES.map((r) => (
                  <span key={r.id} style={{ "--rc": r.color, "--g": r.chance } as React.CSSProperties} />
                ))}
              </div>
              <ul className="dodds__legend">
                {RARITIES.map((r) => (
                  <li key={r.id} style={{ "--rc": r.color } as React.CSSProperties}>
                    <i aria-hidden />
                    {r.name} <b>{r.chance}%</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lu" data-fx="lineup">
            <ul className="lu__row">
              {LINEUP_ORDER.map((ri, slot) => {
                const r = RARITIES[ri];
                return (
                  <li
                    key={r.id}
                    className={`suspect${r.id === 4 ? " suspect--legend" : ""}`}
                    style={
                      {
                        "--rc": r.color,
                        "--r": r.id,
                        "--slot": slot,
                        "--skin": archetypeOf(LINEUP_ARCHETYPE[ri]).skin,
                      } as React.CSSProperties
                    }
                    tabIndex={0}
                  >
                    <span className="suspect__shadow" aria-hidden />
                    <div className="suspect__fig">
                      <GangsterToy gangsterId={LINEUP_ARCHETYPE[ri]} rarity={r.id} bare animate />
                      {/* the booking placard each gangster holds */}
                      <div className="suspect__board">
                        <span className="suspect__bar">{r.name}</span>
                        <span className="suspect__pct">{r.chance}%</span>
                      </div>
                    </div>
                    <dl className="suspect__stats">
                      <div>
                        <dt>Farm/day</dt>
                        <dd>{fmt(r.perDay)} DC</dd>
                      </div>
                      <div>
                        <dt>Cap</dt>
                        <dd>{fmt(r.cap)} DC</dd>
                      </div>
                      <div>
                        <dt>Shot risk</dt>
                        <dd>{SHOT_CHANCE_PER_DAY[r.id]}%/day</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ final CTA */}
        <section className="final">
          <div className="final__card" data-fx="pop">
            <span className="final__bg" aria-hidden />
            <span className="final__veil" aria-hidden />
            <p className="eyebrow">Season 01</p>
            <h2>The city won't wait.</h2>
            <p>Connect your wallet, pick your boss and open your first box.</p>
            <ConnectCTA onEnter={onEnter} />
            <Countdown />
            <ul className="final__facts">
              <li>Roll happens on-chain</li>
              <li>
                1 USDC = {DACITY_PER_USDC} DC
              </li>
              <li>{TARGET_CHAIN.name}</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="footer__btn" href="#/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          Play now
        </a>
        <span className="nav__logo">Audacity Game</span>
        {socials.length > 0 && (
          <ul className="footer__socials">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.url} target="_blank" rel="noreferrer" aria-label={s.label}>
                  <SocialIcon icon={s.icon} />
                </a>
              </li>
            ))}
          </ul>
        )}
        <a className="footer__docs" href="#/docs">
          Read the Docs →
        </a>
        <p className="footer__legal">Independent game on {TARGET_CHAIN.name}. Digital assets involve risk. 18+ only.</p>
      </footer>
    </div>
  );
}
