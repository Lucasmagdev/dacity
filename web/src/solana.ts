/**
 * Solana network the game runs on. Players connect a Solana wallet (Phantom, Solflare, Backpack…),
 * deposit USDC / $AMMO by sending a normal transfer to the game's control wallet, and the backend
 * (Supabase, coming later) credits their in-game balance. No smart contracts.
 */
export type SolanaNetwork = "devnet" | "mainnet-beta";

export const NETWORK: SolanaNetwork = import.meta.env.VITE_SOLANA_NETWORK === "mainnet-beta" ? "mainnet-beta" : "devnet";

const PUBLIC_RPC: Record<SolanaNetwork, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

/** Public RPCs are heavily rate-limited: use a provider (Helius, QuickNode, Triton…) via VITE_SOLANA_RPC. */
export const RPC_URL = import.meta.env.VITE_SOLANA_RPC || PUBLIC_RPC[NETWORK];

/** Display name, e.g. in the nav pill. */
export const CHAIN_NAME = NETWORK === "mainnet-beta" ? "Solana" : "Solana Devnet";

/** Circle's USDC mint on each network. */
export const USDC_MINT: Record<SolanaNetwork, string> = {
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

/**
 * Game wallets (public addresses only: their private keys live on the server, never in the web app).
 *  - POOL_WALLET: the Reward Pool. Receives USDC deposits and pays USDC withdrawals.
 *  - AMMO_WALLET: receives $AMMO deposits, pays $AMMO withdrawals and burns the $AMMO spent in the game.
 *  - TOKEN_DEPLOYER: the wallet that launches $AMMO on pump.fun (creator rewards arrive there and are
 *    forwarded to the Reward Pool).
 */
export const POOL_WALLET = import.meta.env.VITE_POOL_WALLET || "";
export const AMMO_WALLET = import.meta.env.VITE_AMMO_WALLET || "";
export const TOKEN_DEPLOYER = import.meta.env.VITE_TOKEN_DEPLOYER || "";

/**
 * Who pays the Solana network fee:
 *  - deposits: the player (they send the transfer from their own wallet).
 *  - withdrawals: also the player. The server builds the transfer with the PLAYER as fee payer and signs
 *    only as the sender; the player's wallet then signs and submits it. So withdrawals cost the game
 *    nothing in SOL, and the player approves one transaction (a fraction of a cent in SOL, plus a one-time
 *    ~0.002 SOL account rent if their wallet never held that token before).
 */
export const WITHDRAW_FEE_PAYER: "player" | "game" = "player";
/** Shown in the UI next to withdraw buttons. */
export const WITHDRAW_FEE_NOTE = "Network fee (~0.00001 SOL) is paid by you when you approve the withdrawal.";

export const explorerTx = (sig: string) => `https://solscan.io/tx/${sig}${NETWORK === "devnet" ? "?cluster=devnet" : ""}`;
export const explorerAccount = (addr: string) => `https://solscan.io/account/${addr}${NETWORK === "devnet" ? "?cluster=devnet" : ""}`;

/** base58, 32–44 chars: shape of a Solana address (not a full on-curve check). */
export const isSolanaAddress = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());

export const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
