import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { LIVE, endSession, startSession, useLiveStatus } from "../backend/live";
import { shortAddr } from "../solana";

/**
 * Live mode only: signs the player in to Supabase with their Solana wallet when it connects, signs out
 * when it disconnects, and shows a small status pill while signing in or if something went wrong.
 */
export default function LiveSession() {
  const { publicKey, signMessage, connected } = useWallet();
  const status = useLiveStatus();

  useEffect(() => {
    if (!LIVE) return;
    if (connected && publicKey && signMessage) startSession({ publicKey, signMessage });
    if (!connected) endSession();
  }, [connected, publicKey, signMessage]);

  if (!LIVE) return null;
  if (connected && publicKey && !signMessage) {
    return <div className="livepill livepill--error">This wallet can't sign messages. Try Phantom, Solflare or Backpack.</div>;
  }
  if (status.phase === "signing") {
    return <div className="livepill">Approve the sign-in message in your wallet (free, no transaction)…</div>;
  }
  if (status.phase === "error") {
    return (
      <div className="livepill livepill--error">
        Sign-in failed{status.wallet ? ` for ${shortAddr(status.wallet)}` : ""}: {status.error}{" "}
        <button
          type="button"
          onClick={() => publicKey && signMessage && startSession({ publicKey, signMessage })}
        >
          Try again
        </button>
      </div>
    );
  }
  return null;
}
