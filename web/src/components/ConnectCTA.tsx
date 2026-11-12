import { ConnectButton } from "@rainbow-me/rainbowkit";
import { TARGET_CHAIN } from "../chains";
import { MOCK } from "../mock";

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2" strokeLinecap="round" />
      <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
      <circle cx="16.5" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The page's main action. Three states:
 *   disconnected  -> "Connect wallet" (opens RainbowKit modal)
 *   wrong network -> "Switch to Robinhood Chain"
 *   connected     -> "Enter the city" + wallet chip
 */
export default function ConnectCTA({ onEnter, enterLabel = "Enter the city" }: { onEnter?: () => void; enterLabel?: string }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <div className="cta-wrap" style={mounted ? undefined : { visibility: "hidden" }}>
            {!connected ? (
              <>
                <button type="button" className="cta" onClick={openConnectModal}>
                  <WalletIcon />
                  <span>Connect wallet</span>
                </button>
                {MOCK && onEnter && (
                  <button type="button" className="demo-link" onClick={onEnter}>
                    Skip wallet · try the mock demo →
                  </button>
                )}
              </>
            ) : chain.unsupported ? (
              <button type="button" className="cta cta--warn" onClick={openChainModal}>
                Switch to {TARGET_CHAIN.name}
              </button>
            ) : (
              <>
                {onEnter && (
                  <button type="button" className="cta" onClick={onEnter}>
                    <span>{enterLabel}</span>
                    <span aria-hidden>→</span>
                  </button>
                )}
                <button type="button" className="wallet-chip" onClick={openAccountModal}>
                  <span className="wallet-chip__dot" />
                  {account.displayName}
                  <span className="wallet-chip__net">{chain.name}</span>
                </button>
              </>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
