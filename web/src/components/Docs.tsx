import { useEffect, useState, type ReactNode } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import ResIcon from "./art/ResIcon";
import Coin from "./art/Coin";
import {
  BOX_PRICE_DC,
  BULK_TIERS,
  CLAIM_ALL_FEE_RES,
  DACITY_PER_USDC,
  FUSION_RECIPES,
  LAUNCH_SALE,
  MAX_BOXES_PER_ORDER,
  MEDKIT_PRICE_RES,
  RARITIES,
  RESOURCE,
  SHOT_CHANCE_PER_DAY,
  STORE_NAME,
  VEST,
  WEAPONS,
  fmt,
} from "../config/game";
import { TARGET_CHAIN } from "../chains";

const usd = (dc: number) => `$${(dc / DACITY_PER_USDC).toFixed(2)}`;
const days = (cap: number, perDay: number) => Math.round(cap / perDay);

type Section = { id: string; title: string; group: string; body: () => ReactNode };

/* ------------------------------------------------------------------ small building blocks */

function Table({ head, rows, className }: { head: ReactNode[]; rows: ReactNode[][]; className?: string }) {
  return (
    <div className={`doc-table${className ? ` ${className}` : ""}`}>
      <table>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "fire"; title: string; children: ReactNode }) {
  return (
    <div className={`doc-callout doc-callout--${tone}`}>
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}

function Rarity({ id }: { id: number }) {
  const r = RARITIES[id];
  return (
    <span className="doc-rarity" style={{ "--rc": r.color } as React.CSSProperties}>
      <i /> {r.name}
    </span>
  );
}

/**
 * The game's economic loop on a 5×5 board:
 *   1 Boxes → POOL ← 4 Tax
 *   ↑         ↓        ↑
 *   ↑         2 Farm → 3 Buy RES
 *   ↑                  ↓
 *   6 Players  ←←←←←   5 Burn
 */
function Flywheel() {
  const node = (area: string, n: number, tone: string, title: string, text: string) => (
    <div className={`fly__node fly__node--${tone}`} style={{ gridArea: area, order: n }}>
      <span className="fly__n">{n}</span>
      <b>{title}</b>
      <small>{text}</small>
    </div>
  );
  const arrow = (area: string, glyph: string) => (
    <div className="fly__arrow" style={{ gridArea: area }} aria-hidden>
      {glyph}
    </div>
  );
  return (
    <div className="fly" role="img" aria-label="Audacity Game flywheel">
      {node("a", 1, "usdc", "Players buy boxes", "USDC goes into the Vault and becomes DC to open Gangster Boxes.")}
      {arrow("ap", "→")}
      <div className="fly__pool" style={{ gridArea: "p", order: 0 }}>
        <Coin size={44} />
        <b>Reward Pool</b>
        <small>The Vault's USDC. Every player withdrawal is paid from here.</small>
      </div>
      {arrow("rp", "←")}
      {node("r", 4, "res", `${RESOURCE.taxPct}% $RESOURCE tax`, `Every buy and sell of $RESOURCE sends ${RESOURCE.taxPct}% into the Reward Pool.`)}
      {arrow("pw", "↓")}
      {node("w", 2, "dc", "Gangsters farm DC", "Players claim DC and withdraw it as USDC from the pool.")}
      {arrow("wb", "→")}
      {node("b", 3, "res", "Players buy $RESOURCE", "For med kits, weapons, vests, fusion and claim-all.")}
      {arrow("rb", "↑")}
      {arrow("bs", "↓")}
      {node("s", 5, "fire", "Spent $RESOURCE is burned", "100% of it, forever. Supply goes down while demand keeps coming.")}
      {arrow("fs", "←")}
      {node("f", 6, "usdc", "More players join", "A deeper pool and a scarcer token pull in new bosses.")}
      {arrow("up", "↑")}
    </div>
  );
}

/* ------------------------------------------------------------------ content */

const SECTIONS: Section[] = [
  {
    id: "overview",
    group: "Start here",
    title: "Overview",
    body: () => (
      <>
        <p>
          <b>Audacity Game</b> is an on-chain crime-empire game on <b>Robinhood Chain</b> (an Arbitrum Orbit L2, gas paid in
          ETH). You pick a boss, found a gang, recruit gangsters from Gangster Boxes and put them to work. Every gangster farms{" "}
          <b>Dacity Coin (DC)</b> every day until the end of its career.
        </p>
        <p>The game runs on three currencies, each with one job:</p>
        <Table
          head={["Currency", "What it is", "Used for"]}
          rows={[
            [<b>USDC</b>, "Stablecoin in your wallet", "Depositing into the Vault (becomes DC) and withdrawing your earnings"],
            [<b>DC · Dacity Coin</b>, `In-game coin. 1 USDC = ${DACITY_PER_USDC} DC`, "Buying Gangster Boxes. It's also what your gangsters farm"],
            [<b>$RESOURCE</b>, `On-chain token on ${RESOURCE.launchpad}, ${fmt(RESOURCE.totalSupply)} fixed supply`, "Every item and fee in the game, and 100% of it is burned"],
          ]}
        />
        <p>The core loop: deposit → open boxes → farm DC → claim → gear up with $RESOURCE → farm more → withdraw.</p>
      </>
    ),
  },
  {
    id: "getting-started",
    group: "Start here",
    title: "Getting started",
    body: () => (
      <ol className="doc-steps">
        <li>
          <b>Get a wallet</b> (MetaMask, Rabby or any WalletConnect wallet) and add <b>{TARGET_CHAIN.name}</b>. The site offers to
          switch network for you.
        </li>
        <li>
          <b>Get a little ETH</b> on Robinhood Chain for gas, and <b>USDC</b> to deposit.
        </li>
        <li>
          <b>Connect</b> and pick your boss: <b>Lucia Caminos</b> (Born Fighter) or <b>Jason Duval</b> (Ex-Army). Name your gang;
          it's registered on-chain.
        </li>
        <li>
          <b>Deposit USDC</b> in the Vault to get DC, then <b>buy and open Gangster Boxes</b>.
        </li>
        <li>
          <b>Claim</b> what your gangsters farm. Buy <b>$RESOURCE</b> when you want items: med kits, weapons, vests, fusion.
        </li>
      </ol>
    ),
  },
  {
    id: "currencies",
    group: "Economy",
    title: "Vault: USDC ↔ DC",
    body: () => (
      <>
        <p>
          The <b>Vault</b> is the contract that holds every player's USDC. It's the game's <b>Reward Pool</b>.
        </p>
        <ul>
          <li>
            <b>Deposit:</b> 1 USDC → {DACITY_PER_USDC} DC, minted straight to your wallet.
          </li>
          <li>
            <b>Withdraw:</b> {DACITY_PER_USDC} DC → 1 USDC. The DC is burned and the USDC is paid from the Reward Pool.
          </li>
          <li>Deposit and withdraw sit in the same card in the HQ (Deposit / Withdraw switch).</li>
        </ul>
        <Callout tone="warn" title="Withdrawals depend on the pool">
          Withdrawals are paid from the USDC actually in the Reward Pool, which is filled by box purchases and the $RESOURCE tax. See{" "}
          <a href="#/docs/flywheel">The flywheel</a>.
        </Callout>
      </>
    ),
  },
  {
    id: "boxes",
    group: "Gameplay",
    title: "Gangster Boxes",
    body: () => (
      <>
        <p>
          A box costs <b>{fmt(BOX_PRICE_DC)} DC ({usd(BOX_PRICE_DC)})</b> and contains one gangster. Boxes are paid in DC. The rarity is
          rolled when you open the box, not when you buy it.
        </p>
        <Callout tone="fire" title={`Launch sale: first ${fmt(LAUNCH_SALE.boxes)} boxes at 50% off`}>
          The first {fmt(LAUNCH_SALE.boxes)} boxes sold game-wide cost <b>{fmt(LAUNCH_SALE.priceDc)} DC ({usd(LAUNCH_SALE.priceDc)})</b>. If an
          order crosses the limit, the boxes before it get the launch price and the rest pay the regular price.
        </Callout>
        <h4>Bulk discounts</h4>
        <p>
          On regular-price boxes, by order size (up to {fmt(MAX_BOXES_PER_ORDER)} per order). They don't stack with the launch price.
        </p>
        <Table
          head={["Order size", "Discount", "Price per box"]}
          rows={[
            [`1 – ${BULK_TIERS[BULK_TIERS.length - 1].min - 1}`, "—", usd(BOX_PRICE_DC)],
            ...[...BULK_TIERS].reverse().map((t) => [`${fmt(t.min)}+`, <b className="doc-green">−{t.pct}%</b>, usd(BOX_PRICE_DC * (1 - t.pct / 100))]),
          ]}
        />
        <h4>Rarities</h4>
        <Table
          head={["Rarity", "Chance", "Farm / day", "Career cap", "Career length", "Shot risk / day"]}
          rows={RARITIES.map((r, i) => [
            <Rarity id={r.id} />,
            `${r.chance}%`,
            `${r.perDay} DC`,
            `${fmt(r.cap)} DC`,
            `~${days(r.cap, r.perDay)} days`,
            `${SHOT_CHANCE_PER_DAY[i]}%`,
          ])}
        />
        <h4>How the roll works</h4>
        <p>
          Opening is a two-step commit-reveal: buying commits the box to a future block, and opening uses that block's hash to roll the
          rarity, so nobody (including you) knows the result in advance. A VRF (verifiable randomness) will replace it before real-money
          launch.
        </p>
      </>
    ),
  },
  {
    id: "farming",
    group: "Gameplay",
    title: "Farming & claiming",
    body: () => (
      <>
        <p>
          Every gangster farms its daily DC from the moment it's minted, until it reaches its <b>career cap</b>. Then it{" "}
          <b>retires</b>: it stays in your crew as a collectible but stops farming.
        </p>
        <ul>
          <li>
            <b>Claim (one gangster):</b> free. Each card in the HQ has its own Claim button.
          </li>
          <li>
            <b>Claim all:</b> one click for the whole crew, with a fee of <b>{fmt(CLAIM_ALL_FEE_RES)} $RESOURCE per gangster</b>, burned. You
            receive the full DC.
          </li>
          <li>Farming keeps counting while you're offline, and if a gangster is transferred, its unclaimed DC goes to the previous owner.</li>
        </ul>
      </>
    ),
  },
  {
    id: "fusion",
    group: "Gameplay",
    title: "Fusion",
    body: () => (
      <>
        <p>
          Fuse <b>2 gangsters of the same rarity</b> into <b>1 fused gangster of the next rarity</b>. It farms both parents' daily DC
          combined and has a bigger career cap than the two parents together. The fee is paid in $RESOURCE and burned.
        </p>
        <Table
          head={["Fusion", "Fee", "Farm / day", "Career cap", "Extra DC"]}
          rows={FUSION_RECIPES.map((f) => [
            <>
              <Rarity id={f.from} /> × 2 → <Rarity id={f.to} />
            </>,
            `${fmt(f.fee)} RES 🔥`,
            `${f.perDay} DC (regular ${RARITIES[f.to].name}: ${RARITIES[f.to].perDay})`,
            `${fmt(f.cap)} DC (parents ${fmt(RARITIES[f.from].cap * 2)})`,
            <b className="doc-green">+{fmt(f.cap - RARITIES[f.from].cap * 2)}</b>,
          ])}
        />
        <h4>Rules</h4>
        <ul>
          <li>{RARITIES[RARITIES.length - 1].name} is the top rarity and can't be fused.</li>
          <li>Both gangsters must be farming: not retired, not shot, and never fused before.</li>
          <li>The two gangsters closest to retirement are consumed. Their pending DC is paid to you first, free.</li>
          <li>The fused gangster starts a brand-new career and can't be fused again.</li>
        </ul>
      </>
    ),
  },
  {
    id: "shootouts",
    group: "Gameplay",
    title: "Shootouts & healing",
    body: () => (
      <>
        <p>
          The streets are dangerous. Every farming day a gangster has a chance to <b>take a bullet</b>, lower for higher rarities. A shot
          gangster <b>stops farming</b> until it's healed with a <b>med kit</b> ({fmt(MEDKIT_PRICE_RES)} $RESOURCE, burned).
        </p>
        <Table head={RARITIES.map((r) => <Rarity id={r.id} />)} rows={[SHOT_CHANCE_PER_DAY.map((c) => `${c}% / day`)]} />
        <ul>
          <li>DC farmed before the shot stays claimable.</li>
          <li>Time spent shot doesn't use up the career: the gangster still farms its full cap, it just finishes later.</li>
          <li>Fused gangsters use their (new) rarity's risk. Retired gangsters can't be shot.</li>
          <li>A Kevlar vest stops the next bullet (see The Armory).</li>
        </ul>
      </>
    ),
  },
  {
    id: "armory",
    group: "Gameplay",
    title: STORE_NAME,
    body: () => (
      <>
        <p>
          The item shop. Everything is paid in <b>$RESOURCE</b> and <b>100% burned</b>. Items go to your stock and you equip them in the
          Loadout.
        </p>
        <Table
          head={["Item", "Price", "Effect"]}
          rows={[
            ["Med kit", `${fmt(MEDKIT_PRICE_RES)} RES`, "Heals one shot gangster, any rarity"],
            ...Object.values(WEAPONS).map((w) => [w.name, `${fmt(w.priceRes)} RES`, `+${w.boostPct}% farm for ${w.days} farming days`]),
            [VEST.name, `${fmt(VEST.priceRes)} RES`, "Stops the next bullet, then it's gone"],
          ]}
        />
        <ul>
          <li>
            Weapon bonuses are <b>extra DC on top of the career cap</b>. The boost is a % of the gangster's rate, so weapons are worth the
            most on high-rarity and fused gangsters.
          </li>
          <li>One weapon and one vest per gangster. A new weapon only goes on once the current one runs out.</li>
          <li>Weapon days only count while the gangster is farming (not while shot).</li>
        </ul>
      </>
    ),
  },
  {
    id: "dashboard",
    group: "Gameplay",
    title: "Dashboard & history",
    body: () => (
      <ul>
        <li>Farm output per hour, day, week and month in DC and USDC, counting every gangster and active weapon boost.</li>
        <li>Status: ready to claim, farmed lifetime, claimed, left to farm, crew (farming / shot / retired / fused), next retirement.</li>
        <li>Breakdown by rarity, your $RESOURCE balance and burns.</li>
        <li>Every transaction: deposits, withdrawals, boxes, opens, claims, fusions, medical, Armory purchases, with filters.</li>
      </ul>
    ),
  },
  {
    id: "black-market",
    group: "Gameplay",
    title: "Black Market (soon)",
    body: () => <p>A player-to-player marketplace to buy and sell gangsters. Retired gangsters keep their collectible value. Not open yet.</p>,
  },
  {
    id: "resource",
    group: "$RESOURCE",
    title: "The $RESOURCE token",
    body: () => (
      <>
        <div className="doc-token">
          <ResIcon size={56} />
          <div>
            <b>${RESOURCE.ticker}</b>
            <small>The game's burn token</small>
          </div>
        </div>
        <Table
          head={["", ""]}
          className="doc-table--kv"
          rows={[
            ["Ticker", <b>${RESOURCE.ticker}</b>],
            ["Chain", "Robinhood Chain"],
            ["Launch", `${RESOURCE.launchpad} launchpad`],
            ["Total supply", <b>{fmt(RESOURCE.totalSupply)} (fixed, no minting)</b>],
            ["Tax", `${RESOURCE.taxPct}% on every buy and sell, 100% to the game's Reward Pool`],
            ["Burn", "Every $RESOURCE spent in the game is burned"],
            ["Contract", RESOURCE.address ? <code>{RESOURCE.address}</code> : "Announced at launch"],
          ]}
        />
        <h4>What it's used for</h4>
        <ul>
          <li>Med kits, weapons and vests in {STORE_NAME}</li>
          <li>Fusion fees</li>
          <li>The Claim-all fee</li>
        </ul>
        <p>Gangster Boxes stay in DC. Farming, claiming and the Vault don't use $RESOURCE.</p>
        <Callout tone="warn" title="Only use the official contract">
          The contract address is published here and on the official channels at launch. Anything else claiming to be $RESOURCE is a
          scam.
        </Callout>
      </>
    ),
  },
  {
    id: "flywheel",
    group: "$RESOURCE",
    title: "The flywheel",
    body: () => (
      <>
        <p>The game and the token feed each other. Two flows fill the Reward Pool, and one flow keeps shrinking the token supply:</p>
        <Flywheel />
        <ol className="doc-steps">
          <li>
            <b>Boxes fill the pool.</b> Players deposit USDC to buy Gangster Boxes. That USDC stays in the Vault: the Reward Pool.
          </li>
          <li>
            <b>Gangsters pay out from the pool.</b> They farm DC, which players claim and can withdraw as USDC from the pool.
          </li>
          <li>
            <b>Playing well needs $RESOURCE.</b> Healing, weapons, vests, fusion and claim-all are all paid in $RESOURCE, so players buy
            it.
          </li>
          <li>
            <b>Every trade tops up the pool.</b> The {RESOURCE.taxPct}% tax on each $RESOURCE buy and sell goes straight into the Reward Pool.
          </li>
          <li>
            <b>Every token spent is burned.</b> Supply only goes down from {fmt(RESOURCE.totalSupply)}, while new players keep creating
            demand.
          </li>
          <li>
            <b>The loop repeats.</b> A deeper pool and a scarcer token bring more players, who buy more boxes and more $RESOURCE.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "fees",
    group: "$RESOURCE",
    title: "All fees at a glance",
    body: () => (
      <Table
        head={["Action", "Cost", "Paid in", "Where it goes"]}
        rows={[
          ["Gangster Box", `${fmt(BOX_PRICE_DC)} DC (${usd(BOX_PRICE_DC)})`, "DC", "Reward Pool (the USDC behind it)"],
          ["Deposit / withdraw", "1 USDC = 100 DC", "USDC / DC", "Vault"],
          ["Claim one gangster", "Free", "—", "—"],
          ["Claim all", `${fmt(CLAIM_ALL_FEE_RES)} per gangster`, "$RESOURCE", "🔥 Burned"],
          ["Fusion", FUSION_RECIPES.map((f) => fmt(f.fee)).join(" / "), "$RESOURCE", "🔥 Burned"],
          ["Med kit", fmt(MEDKIT_PRICE_RES), "$RESOURCE", "🔥 Burned"],
          ["Weapons", Object.values(WEAPONS).map((w) => fmt(w.priceRes)).join(" / "), "$RESOURCE", "🔥 Burned"],
          [VEST.name, fmt(VEST.priceRes), "$RESOURCE", "🔥 Burned"],
          ["$RESOURCE buy / sell", `${RESOURCE.taxPct}% tax`, "$RESOURCE trade", "Reward Pool"],
        ]}
      />
    ),
  },
  {
    id: "security",
    group: "Trust",
    title: "Security & fairness",
    body: () => (
      <ul>
        <li>All game logic lives in smart contracts on Robinhood Chain: balances, boxes, farming, fusion and burns are public and verifiable.</li>
        <li>Box rolls use commit-reveal today, moving to a VRF before real-money launch so the sequencer can't influence results.</li>
        <li>Before real-money launch, contract admin keys move to a multisig (Safe) and the contracts get an external audit.</li>
        <li>The team can pause the game for maintenance. Your gangsters, coins and farming are kept while paused.</li>
      </ul>
    ),
  },
  {
    id: "risks",
    group: "Trust",
    title: "Risks",
    body: () => (
      <Callout tone="warn" title="Read before you play">
        <p>
          Digital assets are volatile and you can lose what you put in. Withdrawals depend on the USDC in the Reward Pool. $RESOURCE's price
          is set by the market and can go to zero. Box contents are random. Smart contracts can have bugs. Only play with money you can
          afford to lose. 18+ only, and check that this kind of game is legal where you live.
        </p>
      </Callout>
    ),
  },
  {
    id: "faq",
    group: "Trust",
    title: "FAQ",
    body: () => (
      <dl className="doc-faq">
        <dt>Do I need $RESOURCE to play?</dt>
        <dd>No. You can deposit, buy boxes, farm and claim one by one with just USDC and DC. $RESOURCE is for items, fusion and claim-all.</dd>
        <dt>Is the DC I farm real money?</dt>
        <dd>DC can be withdrawn at {DACITY_PER_USDC} DC = 1 USDC, paid from the Reward Pool.</dd>
        <dt>What happens to $RESOURCE I spend?</dt>
        <dd>It's burned: removed from the supply forever. Nobody receives it, including the team.</dd>
        <dt>Where does the {RESOURCE.taxPct}% tax go?</dt>
        <dd>100% into the game's Reward Pool, which pays player withdrawals.</dd>
        <dt>Can I lose a gangster?</dt>
        <dd>No. Shot gangsters stop farming until healed, and retired gangsters stop farming, but you keep them all. Fusion consumes two to create one.</dd>
        <dt>When does the Black Market open?</dt>
        <dd>Soon. It'll be announced in the game.</dd>
      </dl>
    ),
  },
];

const GROUPS = [...new Set(SECTIONS.map((s) => s.group))];

export default function Docs({ section, onBack }: { section?: string; onBack: () => void }) {
  const [active, setActive] = useState(section || SECTIONS[0].id);

  // deep link (#/docs/fusion): scroll to it
  useEffect(() => {
    if (!section) return;
    const el = document.getElementById(`doc-${section}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
  }, [section]);

  // highlight the section being read
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.replace(/^doc-/, ""));
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`doc-${s.id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <div className="page docs">
      <Scene dim />
      <Nav links={false} game onBack={onBack} />

      <div className="docs__inner">
        <aside className="docs__toc" aria-label="Contents">
          <p className="docs__brand">Docs</p>
          {GROUPS.map((g) => (
            <div key={g} className="docs__group">
              <p>{g}</p>
              <ul>
                {SECTIONS.filter((s) => s.group === g).map((s) => (
                  <li key={s.id}>
                    <a href={`#/docs/${s.id}`} aria-current={active === s.id ? "true" : undefined}>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        <main className="docs__main">
          <header className="docs__hero">
            <p className="eyebrow">Audacity Game · Docs</p>
            <h1>How the city works</h1>
            <p className="muted">
              Everything about the game, the economy and the <b>${RESOURCE.ticker}</b> token. Numbers on this page come straight from the
              game's config, so they're always current.
            </p>
          </header>

          {SECTIONS.map((s) => (
            <section key={s.id} id={`doc-${s.id}`} className="doc-sec">
              <h2>
                <a href={`#/docs/${s.id}`} aria-label={`Link to ${s.title}`}>
                  #
                </a>
                {s.title}
              </h2>
              {s.body()}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
