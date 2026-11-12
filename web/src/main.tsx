import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import "./styles.css";
import "./hq.css";
import { wagmiConfig } from "./wagmi";
import { TARGET_CHAIN } from "./chains";
import App from "./App";

const queryClient = new QueryClient();

const theme = darkTheme({
  accentColor: "#ff2e88",
  accentColorForeground: "#fff",
  borderRadius: "large",
  overlayBlur: "small",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} initialChain={TARGET_CHAIN} locale="en-US" modalSize="compact">
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
