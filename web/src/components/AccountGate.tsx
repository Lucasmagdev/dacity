import { useWallet } from "@solana/wallet-adapter-react";
import Scene from "./Scene";
import Nav from "./Nav";
import { LIVE, useLiveStatus } from "../backend/live";

/**
 * Live mode: true while we can't know yet whether this wallet already has a gang (wallet reconnecting,
 * signing in, or the first load of the player's data). Screens must not show "found your gang" then.
 */
export function useAccountLoading() {
  const { connected, connecting } = useWallet();
  const st = useLiveStatus();
  if (!LIVE) return false;
  if (connecting) return true;
  if (!connected) return false;
  if (st.phase === "error") return false;
  return st.phase !== "ready" || !st.loaded;
}

/** Shown instead of the "no gang yet" screens while the account loads. */
export function AccountLoading({ onBack }: { onBack: () => void }) {
  const st = useLiveStatus();
  const signing = st.phase === "signing";
  return (
    <div className="page select">
      <Scene dim />
      <Nav links={false} game onBack={onBack} />
      <div className="select__inner acctload" role="status" aria-live="polite">
        <span className="acctload__spin" aria-hidden />
        <h2>{signing ? "Approve the sign-in in your wallet" : "Loading your gang…"}</h2>
        <p className="section__lede">
          {signing
            ? "One free signature (no transaction) so the game knows this wallet is yours."
            : "Checking your wallet's gang, gangsters and balances."}
        </p>
      </div>
    </div>
  );
}
