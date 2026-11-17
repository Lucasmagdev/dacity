import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { LIVE, endSession, startSession, useLiveStatus } from "../backend/live";
import { shortAddr } from "../solana";
import { setWalletBridge } from "../backend/wallet";

/**
 * Live mode only: signs the player in to Supabase with their Solana wallet when it connects, signs out
 * when it disconnects, and shows a small status pill while signing in or if something went wrong.
 */
export default function LiveSession() {
  const { publicKey, signMessage, signIn, connected, connecting, sendTransaction, signTransaction } = useWallet();
  const wasConnected = useRef(false);
  const status = useLiveStatus();

  // let deposits / withdrawals use the connected wallet
  useEffect(() => {
    setWalletBridge(connected && publicKey ? { publicKey, sendTransaction, signTransaction } : null);
  }, [connected, publicKey, sendTransaction, signTransaction]);

  // On page load the wallet takes a moment to reconnect: that is NOT a disconnect, and signing out then would
  // force a new signature and show "choose your boss" meanwhile. Only a real connected -> disconnected change ends it.
  useEffect(() => {
    if (!LIVE) return;
    if (connected && publicKey && (signIn || signMessage)) {
      wasConnected.current = true;
      startSession({ publicKey, signMessage, signIn: signIn as never });
    } else if (!connected && !connecting && wasConnected.current) {
      wasConnected.current = false;
      endSession();
    }
  }, [connected, connecting, publicKey, signMessage, signIn]);

  if (!LIVE) return null;
  if (connected && publicKey && !signMessage && !signIn) {
    return <div className="livepill livepill--error">This wallet can't sign messages. Try Phantom, Solflare or Backpack.</div>;
  }
  if (status.phase === "signing") {
    return <div className="livepill">Approve the sign-in request in your wallet (free, no transaction)…</div>;
  }
  if (status.phase === "error") {
    return (
      <div className="livepill livepill--error">
        Sign-in failed{status.wallet ? ` for ${shortAddr(status.wallet)}` : ""}: {status.error}{" "}
        <button
          type="button"
          onClick={() => publicKey && (signIn || signMessage) && startSession({ publicKey, signMessage, signIn: signIn as never })}
        >
          Try again
        </button>
      </div>
    );
  }
  return null;
}
