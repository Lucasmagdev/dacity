import { CHAIN_NAME } from "../solana";
import MusicToggle from "./MusicToggle";
import AmmoIcon from "./art/AmmoIcon";
import Socials from "./Socials";
import NavStats from "./NavStats";
import { NavWallet } from "./Wallet";

/** One stroke style for every tab icon (24px grid, square ends). */
const ICONS = {
  hq: <path d="M3 21h18M5 21V9.5L12 4l7 5.5V21M10 21v-5h4v5" />,
  fusion: <path d="M9 3h6M10 3v6.5L4.6 18.8A1.5 1.5 0 0 0 5.9 21h12.2a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3M7.2 15h9.6" />,
  inventory: <path d="M4 8h16v12H4zM9 8V4h6v4M4 13h16M10.5 13v2.5h3V13" />,
  armory: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
    </>
  ),
  market: (
    <>
      <path d="M3 3h8.5L21 12.5 12.5 21 3 11.5z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </>
  ),
  dashboard: <path d="M3 21h18M6 17v-5M11 17V6M16 17v-8M21 17V3" />,
  docs: <path d="M3 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H3zM21 4h-6a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h7z" />,
  jackpot: (
    <>
      <path d="M3 5h18v15H3zM3 10h18" />
      <circle cx="12" cy="15" r="2.5" />
      <path d="M12 12.5V10M7 7.5h2M15 7.5h2" />
    </>
  ),
};

/** The Audacity Jackpot lives on its own subdomain (jackpot.html in local dev). */
export const JACKPOT_URL =
  (import.meta.env.VITE_JACKPOT_URL as string | undefined)?.trim() ||
  (typeof window !== "undefined" && /^(localhost|127\.|\[::1\])/.test(window.location.hostname)
    ? "/jackpot.html"
    : "https://jackpot.audacitygame.xyz");

function Ico({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      className="gamenav__ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

/** In-game sections. Black Market is announced but not open yet. */
function GameNav() {
  const route = window.location.hash.replace(/^#/, "") || "/";
  const tab = (href: string, active: boolean) => ({
    href,
    className: "gamenav__item",
    "aria-current": active ? ("page" as const) : undefined,
  });
  return (
    <nav className="gamenav" aria-label="Game">
      <a {...tab("#/hq", route === "/hq")}>
        <Ico name="hq" />
        HQ
      </a>
      <a {...tab("#/fusion", route === "/fusion")}>
        <Ico name="fusion" />
        Fusion
      </a>
      <a {...tab("#/inventory", route === "/inventory")}>
        <Ico name="inventory" />
        Inventory
      </a>
      <a {...tab("#/armory", route === "/armory")}>
        <Ico name="armory" />
        Armory
      </a>
      <span
        className="gamenav__item gamenav__item--soon"
        aria-disabled="true"
        title="The Black Market opens soon: buy and sell gangsters with other bosses."
      >
        <Ico name="market" />
        Black Market
        <em>Soon</em>
      </span>
      <span className="gamenav__sep" aria-hidden />
      <a {...tab("#/dashboard", route === "/dashboard")}>
        <Ico name="dashboard" />
        Dashboard
      </a>
      <a {...tab("#/token", route === "/token")} className="gamenav__item gamenav__item--token">
        <AmmoIcon size={16} />
        $AMMO
      </a>
      <a
        href={JACKPOT_URL}
        target="_blank"
        rel="noopener"
        className="gamenav__item gamenav__item--jackpot"
        title="Audacity Jackpot: spin with your DC (opens in a new tab)"
      >
        <Ico name="jackpot" />
        Jackpot
      </a>
      <a {...tab("#/docs", route.startsWith("/docs"))}>
        <Ico name="docs" />
        Docs
      </a>
    </nav>
  );
}

export default function Nav({
  links = true,
  game = false,
  showChain = true,
  music = false,
  onBack,
}: {
  links?: boolean;
  game?: boolean;
  showChain?: boolean;
  /** landing page: background music + on/off button */
  music?: boolean;
  onBack?: () => void;
}) {
  return (
    <header className="nav">
      {onBack ? (
        <button type="button" className="nav__back" onClick={onBack}>
          ← Back
        </button>
      ) : (
        <a className="nav__logo" href="#/">
          Audacity Game
        </a>
      )}
      {links && (
        <nav className="nav__links" aria-label="Sections">
          <a href="#how-it-works" onClick={(e) => scrollTo(e, "how-it-works")}>How it works</a>
          <a href="#story" onClick={(e) => scrollTo(e, "story")}>Story</a>
          <a href="#rarities" onClick={(e) => scrollTo(e, "rarities")}>Rarities</a>
          <a href="#/token" className="nav__token">🔥 $AMMO</a>
          <a href={JACKPOT_URL} target="_blank" rel="noopener" className="nav__jackpot">🎰 Jackpot</a>
          <a href="#/docs">Docs</a>
        </nav>
      )}
      {game && <GameNav />}
      {game && <NavStats />}
      <div className="nav__right">
        {music && <MusicToggle />}
        <Socials variant="nav" size={15} />
        {showChain && (
          <span className="chain-pill">
            <span className="chain-pill__dot" />
            {CHAIN_NAME}
          </span>
        )}
        <NavWallet />
      </div>
    </header>
  );
}

/** Hash is used for routing, so section links scroll instead of changing the hash. */
function scrollTo(e: React.MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
