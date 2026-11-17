import { useRef } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import ConnectCTA from "./ConnectCTA";
import Socials from "./Socials";
import Countdown from "./Countdown";
import Portrait from "./Portrait";
import StepArt, { type StepKind } from "./art/StepArt";
import LoreArt from "./art/LoreArt";
import DropBox from "./art/DropBox";
import { BOX_PRICE_DC, DACITY_PER_USDC, PROTAGONISTS, RARITIES, SHOT_CHANCE_PER_DAY, characterOf, fmt, type Protagonist } from "../config/game";
import { CHAIN_NAME } from "../solana";
import { useScrollFx } from "./useScrollFx";
import "../landing-fx.css";
import "../how.css";
import "../story.css";
import "../rarity.css";
import "../mugshots.css";

const STEPS: { kind: StepKind; title: string; text: string; chips: string[]; hot?: boolean }[] = [
  {
    kind: "deposit",
    title: "Deposit USDC",
    text: `Send USDC on Solana to the Vault: 1 USDC becomes ${DACITY_PER_USDC} Dacity Coin in your account as soon as it confirms.`,
    chips: [`1 USDC = ${DACITY_PER_USDC} DC`, "Instant"],
  },
  {
    kind: "gang",
    title: "Found your gang",
    text: `Pick ${PROTAGONISTS.map((p) => p.name.split(" ")[0]).join(" or ")} as your boss and name your gang. It's tied to your wallet.`,
    chips: ["2 bosses", "Wallet login"],
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

/** Booking-photo stand-in for a rarity whose portrait isn't ready yet: a dark head-and-shoulders shape. */
function Silhouette() {
  return (
    <svg className="mug__shade" viewBox="0 0 200 200" aria-hidden>
      <defs>
        <linearGradient id="mug-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--rc)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--rc)" stopOpacity=".12" />
        </linearGradient>
      </defs>
      <path
        d="M100 26c-27 0-46 21-46 49 0 20 9 37 22 46-34 9-56 34-60 79h168c-4-45-26-70-60-79 13-9 22-26 22-46 0-28-19-49-46-49z"
        fill="url(#mug-shade)"
      />
      <text x="100" y="92" textAnchor="middle" fill="var(--rc)" fontSize="46" fontWeight="800">
        ?
      </text>
    </svg>
  );
}

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

export default function Landing({ onEnter }: { onEnter: () => void }) {
  const [nina, rico] = PROTAGONISTS;
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
                <li>Solana</li>
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
              A box costs <b>{fmt(BOX_PRICE_DC)} DC</b> ({fmt(BOX_PRICE_DC / DACITY_PER_USDC)} USDC). Every roll is
              provably fair, and every gangster farms up to their career cap.
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

          <div className="mugs" data-fx="lineup">
            <ul className="mugs__row">
              {RARITIES.map((r) => {
                const ch = characterOf(r.id);
                const known = !!ch.img;
                return (
                  <li
                    key={r.id}
                    className={`mug${known ? "" : " mug--classified"}${r.id === 4 ? " mug--legend" : ""}`}
                    style={{ "--rc": r.color, "--r": r.id } as React.CSSProperties}
                    tabIndex={0}
                  >
                    <div className="mug__photo">
                      {known ? (
                        <img
                          src={`${ch.img}-512.webp`}
                          srcSet={`${ch.img}-256.webp 256w, ${ch.img}-512.webp 512w`}
                          sizes="(max-width: 760px) 70vw, 220px"
                          alt={`${ch.nick}, ${r.name} gangster`}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Silhouette />
                      )}
                      <div className="mug__board">
                        <span className="mug__pd">Audacity PD</span>
                        <strong>{r.name}</strong>
                        <span className="mug__no">
                          {r.chance}% drop · #{String(r.id + 1).padStart(4, "0")}
                        </span>
                      </div>
                    </div>
                    <div className="mug__id">
                      <h3>{known ? `“${ch.nick}”` : "???"}</h3>
                      <p>{known ? `${ch.title} · ${ch.gang}` : "Identity unknown. Pull one to find out."}</p>
                    </div>
                    <dl className="mug__stats">
                      <div>
                        <dt>Farm/day</dt>
                        <dd>{fmt(r.perDay)} DC</dd>
                      </div>
                      <div>
                        <dt>Career cap</dt>
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
              <li>Provably fair rolls</li>
              <li>
                1 USDC = {DACITY_PER_USDC} DC
              </li>
              <li>{CHAIN_NAME}</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="footer__btn" href="#/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          Play now
        </a>
        <span className="nav__logo">Audacity Game</span>
        <Socials variant="footer" size={18} />
        <a className="footer__docs" href="#/docs">
          Read the Docs →
        </a>
        <p className="footer__legal">Independent game on {CHAIN_NAME}. Digital assets involve risk. 18+ only.</p>
      </footer>
    </div>
  );
}
