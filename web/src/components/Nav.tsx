import { ConnectButton } from "@rainbow-me/rainbowkit";
import { TARGET_CHAIN } from "../chains";

/** Compact amber wallet button for the top bar. */
function NavWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        if (!mounted) return <span className="nav__wallet" style={{ visibility: "hidden" }}>Connect</span>;
        if (!account || !chain) {
          return (
            <button type="button" className="nav__wallet" onClick={openConnectModal}>
              Connect
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button type="button" className="nav__wallet nav__wallet--warn" onClick={openChainModal}>
              Wrong network
            </button>
          );
        }
        return (
          <button type="button" className="nav__wallet" onClick={openAccountModal}>
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

/** In-game sections. Black Market is announced but not open yet. */
function GameNav() {
  const route = window.location.hash.replace(/^#/, "") || "/";
  return (
    <nav className="gamenav" aria-label="Game">
      <a href="#/hq" aria-current={route === "/hq" ? "page" : undefined}>
        <span className="gamenav__ico" aria-hidden>⌂</span>
        HQ
      </a>
      <a href="#/fusion" aria-current={route === "/fusion" ? "page" : undefined}>
        <span className="gamenav__ico" aria-hidden>⚗</span>
        Fusion
      </a>
      <a href="#/armory" aria-current={route === "/armory" ? "page" : undefined}>
        <span className="gamenav__ico" aria-hidden>⌖</span>
        Armory
      </a>
      <a href="#/dashboard" aria-current={route === "/dashboard" ? "page" : undefined}>
        <span className="gamenav__ico" aria-hidden>▤</span>
        Dashboard
      </a>
      <span className="gamenav__soon" aria-disabled="true" title="The Black Market opens soon: buy and sell gangsters with other bosses.">
        <span className="gamenav__ico" aria-hidden>⚖</span>
        Black Market
        <em>Soon</em>
      </span>
      <a href="#/docs" aria-current={route.startsWith("/docs") ? "page" : undefined}>
        <span className="gamenav__ico" aria-hidden>?</span>
        Docs
      </a>
    </nav>
  );
}

export default function Nav({
  links = true,
  game = false,
  showChain = true,
  onBack,
}: {
  links?: boolean;
  game?: boolean;
  showChain?: boolean;
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
          <a href="#/docs">Docs</a>
        </nav>
      )}
      {game && <GameNav />}
      <div className="nav__right">
        {showChain && (
          <span className="chain-pill">
            <span className="chain-pill__dot" />
            {TARGET_CHAIN.name}
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
