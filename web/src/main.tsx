import "./polyfills";
import "./referral"; // remember ?ref= invite links before anything routes
import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";
import "./hq.css";
import "./wallet.css";
import { RPC_URL } from "./solana";
import App from "./App";

function Providers({ children }: { children: React.ReactNode }) {
  // Wallet Standard wallets (Phantom, Solflare, Backpack…) register themselves: no adapters to list
  const wallets = useMemo(() => [], []);
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
);
