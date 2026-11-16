import { useEffect, useState, type ReactNode } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import AmmoIcon from "./art/AmmoIcon";
import Coin from "./art/Coin";
import {
  BOX_PRICE_DC,
  BULK_TIERS,
  CLAIM_ALL_FEE_AMMO,
  DACITY_PER_USDC,
  FUSION_RECIPES,
  LAUNCH_SALE,
  MAX_BOXES_PER_ORDER,
  MEDKIT_PRICE_AMMO,
  RARITIES,
  TOKEN,
  SHOT_CHANCE_PER_DAY,
  STORE_NAME,
  VEST,
  WEAPONS,
  PROTAGONISTS,
  fmt,
} from "../config/game";
import { CHAIN_NAME } from "../solana";

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
 *   ↑         2 Farm → 3 Buy AMMO
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
      {node("r", 4, "ammo", "Creator rewards", `Every $AMMO trade on ${TOKEN.launchpad} pays creator rewards, and 100% of them go into the Reward Pool.`)}
      {arrow("pw", "↓")}
      {node("w", 2, "dc", "Gangsters farm DC", "Players claim DC and withdraw it as USDC from the pool.")}
      {arrow("wb", "→")}
      {node("b", 3, "ammo", "Players buy $AMMO", "For med kits, weapons, vests, fusion and claim-all.")}
      {arrow("rb", "↑")}
      {arrow("bs", "↓")}
      {node("s", 5, "fire", "Spent $AMMO is burned", "100% of it, forever. Supply goes down while demand keeps coming.")}
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
          <b>Audacity Game</b> is a crime-empire game on <b>Solana</b>. You connect your wallet, pick a boss, found a gang, recruit
          gangsters from Gangster Boxes and put them to work. Every gangster farms <b>Dacity Coin (DC)</b> every day until the end of its
          career.
        </p>
        <p>The game runs on three currencies, each with one job:</p>
        <Table
          head={["Currency", "What it is", "Used for"]}
          rows={[
            [<b>USDC</b>, "USDC on Solana, in your wallet", "Depositing into the game (becomes DC) and withdrawing your earnings"],
            [<b>DC · Dacity Coin</b>, `In-game balance. 1 USDC = ${DACITY_PER_USDC} DC`, "Buying Gangster Boxes. It's also what your gangsters farm"],
            [<b>$AMMO</b>, `Solana token on ${TOKEN.launchpad}, ${fmt(TOKEN.totalSupply)} fixed supply`, "Every item and fee in the game, and 100% of it is burned"],
          ]}
        />
        <p>The core loop: deposit → open boxes → farm DC → claim → gear up with $AMMO → farm more → withdraw.</p>
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
          <b>Get a Solana wallet</b>: Phantom, Solflare or Backpack.
        </li>
        <li>
          <b>Get a little SOL</b> for network fees (a few cents covers many transactions) and <b>USDC on Solana</b> to deposit.
        </li>
        <li>
          <b>Connect</b> and pick your boss:{" "}
          {PROTAGONISTS.map((p, i) => (
            <span key={p.id}>
              {i > 0 && " or "}
              <b>{p.name}</b> ({p.alias})
            </span>
          ))}
          . Name your gang; it's tied to your wallet.
        </li>
        <li>
          <b>Deposit USDC</b> in the Vault to get DC, then <b>buy and open Gangster Boxes</b>.
        </li>
        <li>
          <b>Claim</b> what your gangsters farm. When you want items (med kits, weapons, vests, fusion), buy <b>$AMMO</b> on{" "}
          {TOKEN.launchpad} and <b>deposit it in {STORE_NAME}</b>.
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
          The <b>Vault</b> is the game's wallet on Solana that holds the players' USDC. It's the game's <b>Reward Pool</b>. DC is an
          in-game balance kept by the game's servers, not a token.
        </p>
        <ul>
          <li>
            <b>Deposit:</b> you send USDC from your wallet to the Vault (one approval in your wallet). As soon as the transfer confirms,
            the game credits 1 USDC → {DACITY_PER_USDC} DC to your account.
          </li>
          <li>
            <b>Withdraw:</b> {DACITY_PER_USDC} DC → 1 USDC. The game sends the USDC from the Reward Pool to the wallet you play with.
          </li>
          <li>Deposit and withdraw sit in the same card in the HQ (Deposit / Withdraw switch).</li>
          <li>
            <b>Network fees:</b> you pay the Solana fee on both deposits and withdrawals (a fraction of a cent in SOL). On a withdrawal
            you approve one transaction in your wallet; if your wallet never held the token before, Solana also charges a one-time
            account rent of about 0.002 SOL.
          </li>
        </ul>
        <Callout tone="warn" title="Withdrawals depend on the pool">
          Withdrawals are paid from the USDC actually in the Reward Pool, which is filled by box purchases and the $AMMO creator rewards.
          Large withdrawals may be reviewed before they're sent. See <a href="#/docs/flywheel">The flywheel</a>.
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
          head={["Rarity", "Chance", "Farm / day", "ROI", "Career", "Lifetime return", "Shot risk / day"]}
          rows={RARITIES.map((r, i) => [
            <Rarity id={r.id} />,
            `${r.chance}%`,
            `${r.perDay} DC`,
            `~${Math.round(BOX_PRICE_DC / r.perDay)} days`,
            `~${days(r.cap, r.perDay)} days`,
            <>
              {fmt(r.cap)} DC <b className="doc-green">({(r.cap / BOX_PRICE_DC).toFixed(1)}× the box)</b>
            </>,
            `${SHOT_CHANCE_PER_DAY[i]}%`,
          ])}
        />
        <p>
          <b>ROI</b> is how many farming days it takes to earn back the regular box price ({fmt(BOX_PRICE_DC)} DC). <b>Lifetime return</b> is
          everything the gangster farms over its whole career (its career cap). Rarer gangsters pay back faster and farm for longer. Days
          spent shot don't count, and weapons add extra DC on top.
        </p>
        <h4>How the roll works</h4>
        <p>
          Rolls are <b>provably fair</b>: before you open a box the server publishes a hash of its secret seed; the roll combines that
          seed with your own seed, and after opening the server reveals its seed so anyone can recompute the result and check it wasn't
          changed.
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
            <b>Claim all:</b> one click for the whole crew, with a fee of <b>{fmt(CLAIM_ALL_FEE_AMMO)} $AMMO per gangster</b>, burned. You
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
          combined and has a bigger career cap than the two parents together. The fee is paid in $AMMO and burned.
        </p>
        <Table
          head={["Fusion", "Fee", "Farm / day", "Career cap", "Extra DC"]}
          rows={FUSION_RECIPES.map((f) => [
            <>
              <Rarity id={f.from} /> × 2 → <Rarity id={f.to} />
            </>,
            `${fmt(f.fee)} AMMO 🔥`,
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
          gangster <b>stops farming</b> until it's healed with a <b>med kit</b> ({fmt(MEDKIT_PRICE_AMMO)} $AMMO, burned).
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
          The item shop. Everything is paid in <b>$AMMO</b> and <b>100% burned</b>. Items go to your stock and you equip them in the
          Loadout.
        </p>
        <Table
          head={["Item", "Price", "Effect"]}
          rows={[
            ["Med kit", `${fmt(MEDKIT_PRICE_AMMO)} AMMO`, "Heals one shot gangster, any rarity"],
            ...Object.values(WEAPONS).map((w) => [w.name, `${fmt(w.priceAmmo)} AMMO`, `+${w.boostPct}% farm for ${w.days} farming days`]),
            [VEST.name, `${fmt(VEST.priceAmmo)} AMMO`, "Stops the next bullet, then it's gone"],
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
        <li>Breakdown by rarity, your $AMMO balance and burns.</li>
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
    id: "ammo",
    group: "$AMMO",
    title: "The $AMMO token",
    body: () => (
      <>
        <div className="doc-token">
          <AmmoIcon size={56} />
          <div>
            <b>${TOKEN.ticker}</b>
            <small>The game's burn token</small>
          </div>
        </div>
        <Table
          head={["", ""]}
          className="doc-table--kv"
          rows={[
            ["Ticker", <b>${TOKEN.ticker}</b>],
            ["Chain", TOKEN.chain],
            ["Launch", TOKEN.launchpad],
            ["Paired with", TOKEN.pair],
            ["Total supply", <b>{fmt(TOKEN.totalSupply)} (fixed, no minting)</b>],
            ["Fees", `${TOKEN.launchpad} creator rewards on every trade, 100% to the game's Reward Pool`],
            ["Burn", "Every $AMMO spent in the game is burned on-chain"],
            ["Mint address", TOKEN.address ? <code>{TOKEN.address}</code> : "Announced at launch"],
          ]}
        />
        <h4>What it's used for</h4>
        <ul>
          <li>Med kits, weapons and vests in {STORE_NAME}</li>
          <li>Fusion fees</li>
          <li>The Claim-all fee</li>
        </ul>
        <p>Gangster Boxes stay in DC. Farming, claiming and the Vault don't use $AMMO.</p>
        <h4>Using $AMMO in the game</h4>
        <ol className="doc-steps">
          <li>
            Buy $AMMO on {TOKEN.launchpad}. It's priced against {TOKEN.pairTicker}.
          </li>
          <li>
            In {STORE_NAME}, <b>deposit</b> the amount you want: one approval in your wallet sends it to the game's wallet, and it shows up
            in your in-game balance.
          </li>
          <li>Spend it on items and fees with one click: no more wallet approvals.</li>
          <li>
            <b>Withdraw</b> any $AMMO you haven't spent back to your wallet whenever you want.
          </li>
        </ol>
        <h4>How the burn works</h4>
        <p>
          Spending $AMMO in the game moves it out of your balance instantly. The game then burns everything spent from its wallet on-chain,
          in regular batches, and every burn transaction is listed on the $AMMO page so anyone can verify it on Solana.
        </p>
        <Callout tone="warn" title="Only use the official mint">
          The mint address is published here and on the official channels at launch. Anything else claiming to be $AMMO is a scam.
        </Callout>
      </>
    ),
  },
  {
    id: "flywheel",
    group: "$AMMO",
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
            <b>Playing well needs $AMMO.</b> Healing, weapons, vests, fusion and claim-all are all paid in $AMMO, so players buy
            it.
          </li>
          <li>
            <b>Every trade tops up the pool.</b> {TOKEN.launchpad} pays creator rewards on every $AMMO buy and sell, and 100% of them go
            into the Reward Pool. The rate is set by {TOKEN.launchpad}, so it isn't fixed.
          </li>
          <li>
            <b>Every token spent is burned.</b> Supply only goes down from {fmt(TOKEN.totalSupply)}, while new players keep creating
            demand.
          </li>
          <li>
            <b>The loop repeats.</b> A deeper pool and a scarcer token bring more players, who buy more boxes and more $AMMO.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "fees",
    group: "$AMMO",
    title: "All fees at a glance",
    body: () => (
      <Table
        head={["Action", "Cost", "Paid in", "Where it goes"]}
        rows={[
          ["Gangster Box", `${fmt(BOX_PRICE_DC)} DC (${usd(BOX_PRICE_DC)})`, "DC", "Reward Pool (the USDC behind it)"],
          ["Deposit / withdraw USDC", "1 USDC = 100 DC", "USDC / DC", "Vault"],
          ["Deposit / withdraw $AMMO", "Free (Solana network fee only)", "$AMMO", "Your in-game balance"],
          ["Solana network fee", "~0.00001 SOL per deposit or withdrawal, paid by you", "SOL", "Solana validators"],
          ["Claim one gangster", "Free", "—", "—"],
          ["Claim all", `${fmt(CLAIM_ALL_FEE_AMMO)} per gangster`, "$AMMO", "🔥 Burned"],
          ["Fusion", FUSION_RECIPES.map((f) => fmt(f.fee)).join(" / "), "$AMMO", "🔥 Burned"],
          ["Med kit", fmt(MEDKIT_PRICE_AMMO), "$AMMO", "🔥 Burned"],
          ["Weapons", Object.values(WEAPONS).map((w) => fmt(w.priceAmmo)).join(" / "), "$AMMO", "🔥 Burned"],
          [VEST.name, fmt(VEST.priceAmmo), "$AMMO", "🔥 Burned"],
          ["$AMMO buy / sell", `${TOKEN.launchpad} creator rewards`, "$AMMO trade", "Reward Pool"],
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
        <li>
          You log in by signing a message with your wallet: it proves you own the wallet and costs nothing. The game never asks for your seed
          phrase or private key.
        </li>
        <li>Game logic runs on the game's servers, so nobody can edit their own balance from the browser.</li>
        <li>Deposits are credited only after the transfer is confirmed on Solana. Withdrawals have daily limits and large ones are reviewed.</li>
        <li>Box rolls are provably fair (see Gangster Boxes), and every $AMMO burn is an on-chain transaction anyone can check.</li>
        <li>The team can pause the game for maintenance. Your gangsters, balances and farming are kept while paused.</li>
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
          Digital assets are volatile and you can lose what you put in. Withdrawals depend on the USDC in the Reward Pool. $AMMO's price
          is set by the market and can go to zero. Box contents are random. Your in-game balances are held by the game until you
          withdraw them. Only play with money you can
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
        <dt>Do I need $AMMO to play?</dt>
        <dd>No. You can deposit, buy boxes, farm and claim one by one with just USDC and DC. $AMMO is for items, fusion and claim-all.</dd>
        <dt>Is the DC I farm real money?</dt>
        <dd>DC can be withdrawn at {DACITY_PER_USDC} DC = 1 USDC, paid from the Reward Pool.</dd>
        <dt>What happens to $AMMO I spend?</dt>
        <dd>It's burned: removed from the supply forever. Nobody receives it, including the team.</dd>
        <dt>Where do the token's trading fees go?</dt>
        <dd>
          {TOKEN.launchpad} pays creator rewards on every $AMMO trade, and 100% of them go into the game's Reward Pool, which pays player
          withdrawals.
        </dd>
        <dt>Can I get my $AMMO back?</dt>
        <dd>Yes, any $AMMO you deposited and haven't spent can be withdrawn to your wallet. $AMMO you spend is burned.</dd>
        <dt>Which network is it on?</dt>
        <dd>
          {CHAIN_NAME}. You need a Solana wallet, a little SOL for network fees, and USDC on Solana.
        </dd>
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
              Everything about the game, the economy and the <b>${TOKEN.ticker}</b> token. Numbers on this page come straight from the
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
