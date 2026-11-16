/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** devnet (default) | mainnet-beta */
  readonly VITE_SOLANA_NETWORK?: "devnet" | "mainnet-beta";
  /** Private RPC (Helius, QuickNode, Triton…). Defaults to the public RPC of the network. */
  readonly VITE_SOLANA_RPC?: string;
  /** Reward Pool wallet (public address): USDC deposits and withdrawals. */
  readonly VITE_POOL_WALLET?: string;
  /** $AMMO wallet (public address): $AMMO deposits, withdrawals and burns. */
  readonly VITE_AMMO_WALLET?: string;
  /** Wallet that launches $AMMO on pump.fun (public address). */
  readonly VITE_TOKEN_DEPLOYER?: string;
  readonly VITE_SEASON_START?: string;
  /** Comma-separated wallet addresses allowed into #/admin (UI gate only). */
  readonly VITE_ADMIN_WALLETS?: string;
  /** "0" turns the browser-only mock off and plays against Supabase. */
  readonly VITE_MOCK?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** Publishable (public) key. RLS protects the data; the secret key never goes in the web app. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
