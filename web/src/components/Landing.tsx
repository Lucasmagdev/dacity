import { useRef } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import ConnectCTA from "./ConnectCTA";
import Countdown from "./Countdown";
import Portrait from "./Portrait";
import GangsterToy from "./art/GangsterToy";
import { BOX_PRICE_DC, DACITY_PER_USDC, PROTAGONISTS, RARITIES, SHOT_CHANCE_PER_DAY, SOCIALS, fmt, type Protagonist } from "../config/game";
import { TARGET_CHAIN } from "../chains";
import { useScrollFx } from "./useScrollFx";
import "../landing-fx.css";

const STEPS = [
  {
    title: "Deposit USDC",
    text: `The vault contract converts instantly: 1 USDC becomes ${DACITY_PER_USDC} Dacity Coin, straight to your wallet.`,
  },
  {
    title: "Found your gang",
    text: "Pick Nina or Rico as your boss and register your gang's name on-chain.",
  },
  {
    title: "Open boxes",
    text: `Each box costs ${fmt(BOX_PRICE_DC)} DC and reveals a gangster from one of 5 rarities.`,
  },
  {
    title: "Farm DC",
    text: "Every gangster earns Dacity Coin daily until they hit their career cap.",
  },
];

/** Which archetype represents each rarity on the landing lineup (Mechanic, Skater, Hacker, Dealer, Old Boss). */
const LINEUP_ARCHETYPE = [8, 5, 2, 4, 11];

const scrollToId = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

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

        <a className="scroll-hint" href="#how-it-works" onClick={scrollToId("how-it-works")}>
          Scroll down
        </a>
      </section>

      <main className="magenta">
        {/* ------------------------------------------------------------ how it works */}
        <section id="how-it-works" className="section">
          <header className="section__head" data-fx="head">
            <p className="eyebrow">How it works</p>
            <h2>From deposit to empire</h2>
          </header>
          <ol className="steps" data-fx="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step" style={{ "--i": i } as React.CSSProperties}>
                <span className="step__num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------------ story (zig-zag) */}
        <section id="story" className="section">
          <header className="section__head" data-fx="head">
            <p className="eyebrow">Storyline</p>
            <h2>Welcome to Dacity</h2>
          </header>

          <div className="story">
            <div className="story__row" data-fx="story">
              <div className="story__frame story__frame--city" data-parallax>
                <Scene />
              </div>
              <div className="story__text">
                <p>
                  A neon coastal city where every block has an owner and every owner has a price. The old families are
                  slipping. Somebody new is going to take the waterfront.
                </p>
                <ul className="pills">
                  <li>Crime</li>
                  <li>Strategy</li>
                  <li>On-chain</li>
                </ul>
              </div>
            </div>

            {[nina, rico].map((p, i) => (
              <div
                key={p.id}
                className={`story__row${i % 2 === 0 ? " story__row--flip" : ""}`}
                style={{ "--accent": p.accent } as React.CSSProperties}
                data-fx="story"
              >
                <div className="story__frame" data-parallax>
                  <Portrait protagonist={p} />
                </div>
                <div className="story__text">
                  <h3>
                    {p.name} <span>· {p.alias}</span>
                  </h3>
                  <p>{p.bio}</p>
                  <ul className="pills">
                    <li>{p.role}</li>
                    <li>Boss</li>
                  </ul>
                </div>
              </div>
            ))}
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
          <ul className="lineup" data-fx="deal">
            {RARITIES.map((r, i) => (
              <li key={r.id} className="lineup__panel" style={{ "--rc": r.color, "--i": i } as React.CSSProperties}>
                <div className="lineup__inner">
                  <span className="lineup__shine" aria-hidden />
                  <div className="lineup__top">
                    <span className="lineup__name">{r.name}</span>
                    <span className="lineup__chance">{r.chance}%</span>
                  </div>
                  <div className="lineup__toy">
                    <GangsterToy gangsterId={LINEUP_ARCHETYPE[i]} rarity={r.id} bare animate />
                  </div>
                  <dl className="lineup__stats">
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
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------------ final CTA */}
        <section className="final">
          <div className="final__card" data-fx="pop">
            <h2>The city won't wait.</h2>
            <p>Connect your wallet, pick your boss and open your first box.</p>
            <ConnectCTA onEnter={onEnter} />
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
