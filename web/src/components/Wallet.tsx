import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { CHAIN_NAME, shortAddr } from "../solana";

/** Connected wallet address (base58) or undefined. */
export function useWalletAddress() {
  const { publicKey, connected, connecting } = useWallet();
  return { address: publicKey?.toBase58(), connected, connecting };
}

export function useConnectWallet() {
  const { setVisible } = useWalletModal();
  return () => setVisible(true);
}

/** Address chip with a small menu: copy address, change wallet, disconnect. */
export function WalletChip({ className = "wallet-chip", showNetwork = false }: { className?: string; showNetwork?: boolean }) {
  const { wallet, disconnect } = useWallet();
  const { address } = useWalletAddress();
  const open = useConnectWallet();
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  if (!address) return null;
  return (
    <div className="wmenu" ref={ref}>
      <button type="button" className={className} onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
        {wallet?.adapter.icon ? <img src={wallet.adapter.icon} alt="" width={16} height={16} /> : <span className="wallet-chip__dot" />}
        {shortAddr(address)}
        {showNetwork && <span className="wallet-chip__net">{CHAIN_NAME}</span>}
      </button>
      {menu && (
        <div className="wmenu__pop" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              navigator.clipboard?.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied ✓" : "Copy address"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              open();
            }}
          >
            Change wallet
          </button>
          <button
            type="button"
            role="menuitem"
            className="wmenu__danger"
            onClick={() => {
              setMenu(false);
              disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

/** Compact amber wallet button for the top bar. */
export function NavWallet() {
  const { connected, connecting } = useWalletAddress();
  const open = useConnectWallet();
  if (connected) return <WalletChip className="nav__wallet" />;
  return (
    <button type="button" className="nav__wallet" onClick={open} disabled={connecting}>
      {connecting ? "Connecting…" : "Connect"}
    </button>
  );
}
