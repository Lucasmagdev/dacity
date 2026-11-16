import { useWalletAddress } from "../components/Wallet";
import { LIVE, useLiveStatus } from "../backend/live";
import { isSolanaAddress, shortAddr as short } from "../solana";

/**
 * Wallets allowed into #/admin, from VITE_ADMIN_WALLETS (comma or space separated Solana addresses).
 *
 * This only gates the UI. Anything in the front-end bundle is public and can be bypassed, so the real
 * permission check must live on the server: admin actions are Supabase functions that verify a message
 * signed by an admin wallet.
 */
export const ADMIN_WALLETS: string[] = (import.meta.env.VITE_ADMIN_WALLETS ?? "")
  .split(/[\s,;]+/)
  .map((a) => a.trim())
  .filter(isSolanaAddress);

// base58 is case-sensitive: compare exactly
export const isAdmin = (address?: string | null) => !!address && ADMIN_WALLETS.includes(address);

export function useAdmin() {
  const { address, connected } = useWalletAddress();
  const live = useLiveStatus();
  // live mode: the database's admins table decides; mock mode: VITE_ADMIN_WALLETS
  const admin = LIVE ? live.phase === "ready" && live.isAdmin && live.wallet === address : isAdmin(address);
  return { address, isConnected: connected, isAdmin: admin };
}

export const isAddress = isSolanaAddress;
export const shortAddr = short;
