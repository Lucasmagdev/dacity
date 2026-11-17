/**
 * Server configuration, from environment variables (Railway → Variables; locally server/.env).
 * Secrets live ONLY here: never in the web app, never in git.
 */
export type Network = "devnet" | "mainnet-beta";

const need = (k: string) => {
  const v = process.env[k]?.trim();
  if (!v) throw new Error(`Missing environment variable ${k}`);
  return v;
};
const opt = (k: string, d = "") => process.env[k]?.trim() || d;

const network: Network = opt("SOLANA_NETWORK") === "mainnet-beta" ? "mainnet-beta" : "devnet";

const USDC: Record<Network, string> = {
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};
const PUBLIC_RPC: Record<Network, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
};

export const env = {
  network,
  /** Use a paid RPC (Helius, Triton, QuickNode) in production: the public one rate-limits hard. */
  rpcUrl: opt("SOLANA_RPC_URL", PUBLIC_RPC[network]),
  supabaseUrl: need("SUPABASE_URL"),
  supabaseKey: need("SUPABASE_SECRET_KEY"),
  poolSecret: need("POOL_WALLET_SECRET_KEY"),
  poolAddress: opt("POOL_WALLET_ADDRESS"),
  ammoSecret: need("AMMO_WALLET_SECRET_KEY"),
  ammoAddress: opt("AMMO_WALLET_ADDRESS"),
  usdcMint: opt("USDC_MINT", USDC[network]),
  /** $AMMO mint. Empty until launch: price feed, AMMO deposits/withdrawals and burns stay off. */
  ammoMint: opt("AMMO_MINT"),
  /** Comma-separated sites allowed to call the API, e.g. https://audacitygame.com,http://localhost:5317 */
  webOrigins: opt("WEB_ORIGINS").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean),
  /** Shared secret Helius sends in the Authorization header of its webhooks. */
  heliusSecret: opt("HELIUS_WEBHOOK_SECRET"),
  port: Number(opt("PORT", "8080")),
  /** Don't send a burn for less than this many AMMO (saves fees on dust). */
  burnMinAmmo: Number(opt("BURN_MIN_AMMO", "1000")),
  /** WORKERS=0 runs only the API (e.g. extra replicas); the background jobs also lock themselves. */
  workers: opt("WORKERS", "1") !== "0",
};
