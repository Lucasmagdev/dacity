/**
 * The connected wallet, for code outside React (game actions). LiveSession keeps it up to date.
 */
import { Connection, type PublicKey, type Transaction } from "@solana/web3.js";
import { RPC_URL } from "../solana";

export type WalletBridge = {
  publicKey: PublicKey;
  /** wallet signs and sends (deposits) */
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>;
  /** wallet only signs (withdrawals: the game already signed as the sender) */
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
};

let bridge: WalletBridge | null = null;
export const setWalletBridge = (b: WalletBridge | null) => {
  bridge = b;
};

export function wallet(): WalletBridge {
  if (!bridge) throw new Error("Connect your wallet first");
  return bridge;
}

let conn: Connection | null = null;
export const connection = () => (conn ??= new Connection(RPC_URL, "confirmed"));
