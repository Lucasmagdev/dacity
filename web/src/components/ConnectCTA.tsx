import { MOCK } from "../mock";
import { WalletChip, useConnectWallet, useWalletAddress } from "./Wallet";

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
 * The page's main action:
 *   disconnected -> "Connect wallet" (opens the Solana wallet picker)
 *   connected    -> "Enter the city" + wallet chip
 */
export default function ConnectCTA({
  onEnter,
  enterLabel = "Enter the city",
  demoLink = true,
}: {
  onEnter?: () => void;
  enterLabel?: string;
  demoLink?: boolean;
}) {
  const { connected, connecting } = useWalletAddress();
  const open = useConnectWallet();

  return (
    <div className="cta-wrap">
      {!connected ? (
        <>
          <button type="button" className="cta" onClick={open} disabled={connecting}>
            <WalletIcon />
            <span>{connecting ? "Connecting…" : "Connect wallet"}</span>
          </button>
          {MOCK && demoLink && onEnter && (
            <button type="button" className="demo-link" onClick={onEnter}>
              Skip wallet · try the mock demo →
            </button>
          )}
        </>
      ) : (
        <>
          {onEnter && (
            <button type="button" className="cta" onClick={onEnter}>
              <span>{enterLabel}</span>
              <span aria-hidden>→</span>
            </button>
          )}
          <WalletChip showNetwork />
        </>
      )}
    </div>
  );
}
