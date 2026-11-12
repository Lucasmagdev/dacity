import { defineChain, type Chain } from "viem";
import { hardhat } from "viem/chains";

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_ROBINHOOD_RPC || "https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_ROBINHOOD_TESTNET_RPC || "https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  testnet: true,
});

const byNetwork: Record<string, Chain> = {
  mainnet: robinhood,
  testnet: robinhoodTestnet,
  local: hardhat,
};

/** Chain the game runs on, picked by VITE_NETWORK (default: testnet). */
export const TARGET_CHAIN: Chain = byNetwork[import.meta.env.VITE_NETWORK ?? "testnet"] ?? robinhoodTestnet;
