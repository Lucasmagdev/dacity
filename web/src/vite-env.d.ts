/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** devnet (default) | mainnet-beta */
  readonly VITE_SOLANA_NETWORK?: "devnet" | "mainnet-beta";
  /** Private RPC (Helius, QuickNode, Triton…). Defaults to the public RPC of the network. */
  readonly VITE_SOLANA_RPC?: string;
  /** Game control wallet that receives deposits. */
  readonly VITE_CONTROL_WALLET?: string;
  readonly VITE_SEASON_START?: string;
  /** Comma-separated wallet addresses allowed into #/admin (UI gate only). */
  readonly VITE_ADMIN_WALLETS?: string;
  /** "0" turns the browser-only mock off (once the Supabase backend exists). */
  readonly VITE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
