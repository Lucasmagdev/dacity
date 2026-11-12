/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: "testnet" | "mainnet" | "local";
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_ROBINHOOD_RPC?: string;
  readonly VITE_ROBINHOOD_TESTNET_RPC?: string;
  readonly VITE_SEASON_START?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
