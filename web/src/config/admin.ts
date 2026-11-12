import { useAccount } from "wagmi";

/**
 * Wallets allowed into #/admin, from VITE_ADMIN_WALLETS (comma or space separated, case-insensitive).
 *
 * This only gates the UI. Anything in the front-end bundle is public and can be bypassed, so the real
 * permission check must live where the action happens: an admin/minter role in the contracts for
 * coins and boxes, and a signature check on the server for maintenance and announcements.
 */
export const ADMIN_WALLETS: string[] = (import.meta.env.VITE_ADMIN_WALLETS ?? "")
  .split(/[\s,;]+/)
  .map((a) => a.trim().toLowerCase())
  .filter((a) => /^0x[0-9a-f]{40}$/.test(a));

export const isAdmin = (address?: string | null) => !!address && ADMIN_WALLETS.includes(address.toLowerCase());

export function useAdmin() {
  const { address, isConnected } = useAccount();
  return { address, isConnected, isAdmin: isAdmin(address) };
}

export const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v.trim());
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
