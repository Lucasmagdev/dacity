/**
 * Must be the FIRST import of main.tsx: Solana libraries (web3.js, spl-token) use Node's Buffer as soon
 * as they load, and ES imports run before any code in main.tsx itself.
 */
import { Buffer } from "buffer";

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
