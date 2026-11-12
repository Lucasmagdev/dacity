import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import type { Chain } from "viem";
import { TARGET_CHAIN } from "./chains";

const chains: readonly [Chain, ...Chain[]] = [TARGET_CHAIN];

export const wagmiConfig = getDefaultConfig({
  appName: "Audacity Game",
  // Placeholder keeps extension wallets working; set a real id for WalletConnect/mobile.
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "dacity-dev-placeholder",
  chains,
  transports: { [TARGET_CHAIN.id]: http() },
});
